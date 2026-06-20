import { isNativeObject, readNativePath, readNativeProperty, setNativeReflectProperty } from './native-access';

declare global {
  interface Window {
    a8?: unknown;
  }
}

interface NativeMobileControlHooks {
  afterInputStateSet(inputState: unknown): void;
  onControlsHidden(): void;
  onControlsShown(): void;
  onInputStateObserved(inputState: unknown): void;
}

export function isNativeMobileMode(): boolean {
  const game = window.a8;
  return Boolean(readNativeProperty(game, 'xm') || readNativeProperty(game, 'PD'));
}

export function isNativeTouchLobbyChatPrompt(): boolean {
  // `xm` is the observed native flag for the touch/mobile lobby chat prompt path.
  return Boolean(readNativeProperty(window.a8, 'xm'));
}

export function getNativeMobileControls(): unknown | null {
  return readNativeProperty(window.a8, 'PD') ?? null;
}

function getControlSlot(controls: unknown, key: string): unknown {
  return readNativeProperty(controls, key);
}

function getControlInputState(control: unknown): unknown | null {
  const inputState = readNativeProperty(control, 'hg');
  return isNativeObject(inputState) ? inputState : null;
}

export function getNativeMobileControlInputState(controls: unknown = getNativeMobileControls()): unknown | null {
  for (const key of ['oz', 'rz', 'az', 'nz']) {
    const inputState = getControlInputState(getControlSlot(controls, key));
    if (inputState) {
      return inputState;
    }
  }

  return null;
}

export function getLiveMultiplayerInputState(): unknown | null {
  const inputState = readNativePath(window.multiplayerSession, ['KR', 'hg']);
  return isNativeObject(inputState) ? inputState : null;
}

export function getNativeMobileAbilityButtonElements(): Element[] {
  const controls = getNativeMobileControls();
  if (!controls) {
    return [];
  }

  const buttons: Element[] = [];
  for (const key of ['oz', 'rz', 'az']) {
    const element = readNativeProperty(getControlSlot(controls, key), 'hf');
    if (element instanceof Element) {
      buttons.push(element);
    }
  }
  return buttons;
}

export function setGrabInputPressed(inputState: unknown, pressed: boolean): boolean {
  if (!isNativeObject(inputState)) {
    return false;
  }

  // `Fn` is the observed input-state flag shared by desktop and mobile Grab.
  setNativeReflectProperty(inputState, 'Fn', pressed);
  return true;
}

export function installNativeMobileControlHooks(hooks: NativeMobileControlHooks): boolean {
  const controls = getNativeMobileControls();
  if (!isNativeObject(controls)) {
    return false;
  }

  if (readNativeProperty(controls, '__qolboxMobileGrabPatched')) {
    return true;
  }

  setNativeReflectProperty(controls, '__qolboxMobileGrabPatched', true);

  const setInputState = readNativeProperty(controls, 'ED');
  if (typeof setInputState === 'function') {
    const originalSetInputState = setInputState;
    setNativeReflectProperty(
      controls,
      'ED',
      function wrappedMobileControlInputState(this: unknown, inputState: unknown, ...rest: unknown[]) {
        hooks.onInputStateObserved(inputState);
        const result = Reflect.apply(originalSetInputState, this, [inputState, ...rest]);
        hooks.afterInputStateSet(inputState);
        hooks.onControlsShown();
        return result;
      }
    );
  }

  const showControls = readNativeProperty(controls, 'NL');
  if (typeof showControls === 'function') {
    const originalShowControls = showControls;
    setNativeReflectProperty(controls, 'NL', function wrappedMobileControlsShow(this: unknown, ...args: unknown[]) {
      const result = Reflect.apply(originalShowControls, this, args);
      hooks.onControlsShown();
      return result;
    });
  }

  const hideControls = readNativeProperty(controls, '_L');
  if (typeof hideControls === 'function') {
    const originalHideControls = hideControls;
    setNativeReflectProperty(controls, '_L', function wrappedMobileControlsHide(this: unknown, ...args: unknown[]) {
      const result = Reflect.apply(originalHideControls, this, args);
      hooks.onControlsHidden();
      return result;
    });
  }

  return true;
}
