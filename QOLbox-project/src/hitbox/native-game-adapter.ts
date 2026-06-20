import { isNativeObject, readNativeProperty } from './native-access';

export interface NativeGameSize {
  height: number;
  width: number;
}

function getNativeGameObject(): unknown | null {
  const game = readNativeProperty(window, 'a8');
  return isNativeObject(game) ? game : null;
}

function getNativeGameSlot(): unknown {
  return readNativeProperty(window, 'a8');
}

function readFinitePositiveNumber(source: unknown, property: PropertyKey): number | null {
  const value = Number(readNativeProperty(source, property));
  return Number.isFinite(value) && value > 0 ? value : null;
}

export function hasNativeGameObject(): boolean {
  return getNativeGameObject() !== null;
}

export function installNativeGameReadyHook(onReady: () => void): void {
  if (getNativeGameSlot()) {
    onReady();
    return;
  }

  try {
    let pendingGame: unknown = null;

    // `a8` is the observed public-client slot that receives the native game object after boot.
    Object.defineProperty(window, 'a8', {
      configurable: true,
      enumerable: true,
      get() {
        return pendingGame;
      },
      set(value: unknown) {
        pendingGame = value;
        Object.defineProperty(window, 'a8', {
          configurable: true,
          enumerable: true,
          writable: true,
          value,
        });
        onReady();
      },
    });
  } catch {
    // DOM observers and resize hooks still provide the fallback settle path.
  }
}

export function getNativeBaseGameSize(fallback: NativeGameSize): NativeGameSize {
  const game = getNativeGameObject();

  // `Xg`/`Zg` are the observed native base render dimensions before fullscreen scaling.
  return {
    width: readFinitePositiveNumber(game, 'Xg') ?? fallback.width,
    height: readFinitePositiveNumber(game, 'Zg') ?? fallback.height,
  };
}

export function getNativeFullscreenLayoutSize(): NativeGameSize {
  const game = getNativeGameObject();

  // `lg`/`ug` are the observed native layout dimensions after fullscreen metrics are pinned.
  return {
    width: Number(readNativeProperty(game, 'lg')) || 0,
    height: Number(readNativeProperty(game, 'ug')) || 0,
  };
}
