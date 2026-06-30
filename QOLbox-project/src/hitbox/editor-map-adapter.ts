import {
  callNativeMethod,
  isNativeObject,
  isNativeReflectTarget,
  readNativePath,
  readNativeProperty,
  setNativeReflectProperty,
} from './native-access';

const EDITOR_MAP_STATE_PATH = ['multiplayerSession', 'TJ', 'JD', 'tP'] as const;
const EDITOR_FILE_MENU_SELECTOR = '#editorContainer .fileMenu';
const EDITOR_MENU_ITEM_SELECTOR = '.item';

type NativeFunction = (...args: unknown[]) => unknown;

function getEditorMapState(): unknown {
  const maps = readNativePath(window, EDITOR_MAP_STATE_PATH);
  if (!Array.isArray(maps)) {
    return null;
  }

  return readNativeProperty(maps[0], 'state') || null;
}

function isNativeFunction(value: unknown): value is NativeFunction {
  return typeof value === 'function';
}

function callMapExport(mapState: unknown): string | null {
  try {
    const { called, result } = callNativeMethod(mapState, 'rc');
    if (!called || typeof result !== 'string') {
      return null;
    }

    const mapData = result.trim();
    return mapData ? mapData : null;
  } catch {
    return null;
  }
}

function getNativeEditorFileItem(label: string): HTMLElement | null {
  const fileMenu = document.querySelector(EDITOR_FILE_MENU_SELECTOR);
  if (!(fileMenu instanceof HTMLElement)) {
    return null;
  }

  return Array.from(fileMenu.querySelectorAll(EDITOR_MENU_ITEM_SELECTOR))
    .find((item): item is HTMLElement => item instanceof HTMLElement && item.textContent?.trim() === label) || null;
}

function replaceNativeMethod(
  target: unknown,
  methodName: PropertyKey,
  replacement: NativeFunction
): (() => void) | null {
  if (!isNativeReflectTarget(target)) {
    return null;
  }

  const original = readNativeProperty(target, methodName);
  if (!isNativeFunction(original) || !setNativeReflectProperty(target, methodName, replacement)) {
    return null;
  }

  return () => {
    setNativeReflectProperty(target, methodName, original);
  };
}

function getCapturedMapState(candidate: unknown): unknown | null {
  if (!isNativeObject(candidate)) {
    return null;
  }

  const state = readNativeProperty(candidate, 'state');
  return isNativeObject(state) ? state : null;
}

function exportCurrentEditorMapViaNativePlayClone(): string | null {
  const playItem = getNativeEditorFileItem('Play');
  const session = readNativeProperty(window, 'multiplayerSession');
  const lobbyState = readNativePath(window, ['multiplayerSession', 'JD']);
  if (!(playItem instanceof HTMLElement) || !isNativeReflectTarget(session) || !isNativeReflectTarget(lobbyState)) {
    return null;
  }

  let capturedMapState: unknown | null = null;
  const captureMap = (candidate: unknown): void => {
    capturedMapState = getCapturedMapState(candidate) || capturedMapState;
  };

  const restores = [
    replaceNativeMethod(lobbyState, 'tU', (maps: unknown) => {
      if (Array.isArray(maps)) {
        captureMap(maps[0]);
      }
    }),
    replaceNativeMethod(lobbyState, 'sU', (map: unknown) => {
      captureMap(map);
    }),
    replaceNativeMethod(session, '_J', () => undefined),
  ].filter((restore): restore is () => void => typeof restore === 'function');

  if (!restores.length) {
    return null;
  }

  try {
    playItem.click();
    return callMapExport(capturedMapState);
  } catch {
    return null;
  } finally {
    for (const restore of restores.reverse()) {
      try {
        restore();
      } catch {
        // A native transition may already have replaced the method; later fallbacks still cover export.
      }
    }
  }
}

function refreshEditorAfterMapImport(): void {
  try {
    const editorController = readNativePath(window, ['multiplayerSession', 'TJ']);
    callNativeMethod(editorController, 'gW');
  } catch {
    // Loading the map data is the important part; the visible editor may refresh on the next native tick.
  }

  try {
    window.dispatchEvent(new Event('resize'));
  } catch {
    // Older embedded contexts can reject synthetic resize construction.
  }
}

export function exportEditorMapData(): string | null {
  return exportCurrentEditorMapViaNativePlayClone() || callMapExport(getEditorMapState());
}

export function importEditorMapData(mapData: string): boolean {
  const trimmedMapData = mapData.trim();
  if (!trimmedMapData) {
    return false;
  }

  try {
    const { called } = callNativeMethod(getEditorMapState(), 'ac', [trimmedMapData]);
    if (!called) {
      return false;
    }

    refreshEditorAfterMapImport();
    return true;
  } catch {
    return false;
  }
}
