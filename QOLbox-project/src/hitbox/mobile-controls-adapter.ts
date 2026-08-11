import {
  isNativeObject,
  readNativePath,
  readNativeProperty,
  readNativeReflectProperty,
  replaceNativeReflectProperty,
  setNativeReflectProperty,
} from './native-access';
import { HITBOX_NATIVE } from './native-contract';

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
  return Boolean(readNativeProperty(game, HITBOX_NATIVE.mobile.mobileFlag) || readNativeProperty(game, HITBOX_NATIVE.mobile.controls));
}

export function isNativeTouchLobbyChatPrompt(): boolean {
  // `xm` is the observed native flag for the touch/mobile lobby chat prompt path.
  return Boolean(readNativeProperty(window.a8, HITBOX_NATIVE.mobile.mobileFlag));
}

export function getNativeMobileControls(): unknown | null {
  return readNativeProperty(window.a8, HITBOX_NATIVE.mobile.controls) ?? null;
}

function getControlSlot(controls: unknown, key: string): unknown {
  return readNativeProperty(controls, key);
}

function getControlInputState(control: unknown): unknown | null {
  const inputState = readNativeProperty(control, HITBOX_NATIVE.mobile.inputState);
  return isNativeObject(inputState) ? inputState : null;
}

export function getNativeMobileControlInputState(controls: unknown = getNativeMobileControls()): unknown | null {
  for (const key of [...HITBOX_NATIVE.mobile.slots, 'nz']) {
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
  for (const key of HITBOX_NATIVE.mobile.slots) {
    const element = readNativeProperty(getControlSlot(controls, key), HITBOX_NATIVE.mobile.view);
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
  return setNativeReflectProperty(inputState, HITBOX_NATIVE.mobile.pressGrab, pressed);
}

export function installNativeMobileControlHooks(hooks: NativeMobileControlHooks): boolean {
  const controls = getNativeMobileControls();
  if (!isNativeObject(controls)) {
    return false;
  }

  let hookInstalled = false;

  function installHook(
    methodName: string,
    createWrapper: (original: (...args: unknown[]) => unknown) => (...args: unknown[]) => unknown
  ): void {
    const method = readNativeProperty(controls, methodName);
    if (typeof method !== 'function') {
      return;
    }
    if (readNativeReflectProperty(method, '__qolboxMobileGrabWrapped') === true) {
      hookInstalled = true;
      return;
    }

    const wrapper = createWrapper(method as (...args: unknown[]) => unknown);
    setNativeReflectProperty(wrapper, '__qolboxMobileGrabWrapped', true);
    hookInstalled = replaceNativeReflectProperty(controls, methodName, wrapper) || hookInstalled;
  }

  installHook(HITBOX_NATIVE.mobile.setInputState, originalSetInputState =>
    function wrappedMobileControlInputState(this: unknown, inputState: unknown, ...rest: unknown[]) {
        hooks.onInputStateObserved(inputState);
        const result = Reflect.apply(originalSetInputState, this, [inputState, ...rest]);
        hooks.afterInputStateSet(inputState);
        hooks.onControlsShown();
        return result;
    }
  );

  installHook(HITBOX_NATIVE.mobile.show, originalShowControls =>
    function wrappedMobileControlsShow(this: unknown, ...args: unknown[]) {
      const result = Reflect.apply(originalShowControls, this, args);
      hooks.onControlsShown();
      return result;
    }
  );

  installHook(HITBOX_NATIVE.mobile.hide, originalHideControls =>
    function wrappedMobileControlsHide(this: unknown, ...args: unknown[]) {
      const result = Reflect.apply(originalHideControls, this, args);
      hooks.onControlsHidden();
      return result;
    }
  );

  return hookInstalled;
}
