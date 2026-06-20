import {
  getLiveMultiplayerInputState,
  getNativeMobileControlInputState,
  getNativeMobileControls,
  setGrabInputPressed,
} from '../hitbox/mobile-controls-adapter';

const MOBILE_GRAB_FALLBACK_KEY = 'v';
const MOBILE_GRAB_FALLBACK_CODE = 'KeyV';
const MOBILE_GRAB_FALLBACK_KEY_CODE = 86;

export interface MobileGrabInputController {
  isMobileGrabPressed(): boolean;
  observeMobileGrabInputState(inputState: unknown): void;
  restoreMobileGrabPressedOnInputState(inputState: unknown): void;
  setMobileGrabPressed(pressed: unknown): void;
}

export function createMobileGrabInputController(): MobileGrabInputController {
  let mobileGrabPointerDown = false;
  let mobileGrabInputState: unknown = null;
  let mobileGrabControlledInputState: unknown = null;
  let mobileGrabKeyboardFallbackActive = false;

  function getMobileGrabInputState(): unknown | null {
    const controlInputState = getNativeMobileControlInputState(getNativeMobileControls());
    if (controlInputState) {
      return controlInputState;
    }

    const sessionInputState = getLiveMultiplayerInputState();
    if (sessionInputState) {
      return sessionInputState;
    }

    return mobileGrabInputState;
  }

  function dispatchMobileGrabKeyboardFallback(pressed: boolean): void {
    if (pressed === mobileGrabKeyboardFallbackActive) {
      return;
    }

    mobileGrabKeyboardFallbackActive = pressed;
    const event = new KeyboardEvent(pressed ? 'keydown' : 'keyup', {
      bubbles: true,
      cancelable: true,
      code: MOBILE_GRAB_FALLBACK_CODE,
      composed: true,
      key: MOBILE_GRAB_FALLBACK_KEY,
    });

    const legacyKeyProperties: readonly (readonly [string, number])[] = [
      ['keyCode', MOBILE_GRAB_FALLBACK_KEY_CODE],
      ['which', MOBILE_GRAB_FALLBACK_KEY_CODE],
    ];
    for (const [property, value] of legacyKeyProperties) {
      try {
        Object.defineProperty(event, property, { get: () => value });
      } catch {
        // Some browsers keep legacy KeyboardEvent fields read-only.
      }
    }

    window.dispatchEvent(event);
  }

  function setMobileGrabPressed(pressed: unknown): void {
    const nextPressed = Boolean(pressed);
    if (
      !nextPressed &&
      !mobileGrabPointerDown &&
      !mobileGrabControlledInputState &&
      !mobileGrabKeyboardFallbackActive
    ) {
      return;
    }

    mobileGrabPointerDown = nextPressed;
    if (!mobileGrabPointerDown) {
      // Desktop and mobile share Fn; release only a state this added button asserted.
      if (mobileGrabControlledInputState) {
        setGrabInputPressed(mobileGrabControlledInputState, false);
        mobileGrabControlledInputState = null;
      }

      if (mobileGrabKeyboardFallbackActive) {
        dispatchMobileGrabKeyboardFallback(false);
      }
      return;
    }

    const inputState = getMobileGrabInputState();
    if (inputState && setGrabInputPressed(inputState, true)) {
      mobileGrabInputState = inputState;
      mobileGrabControlledInputState = inputState;
      if (mobileGrabKeyboardFallbackActive) {
        dispatchMobileGrabKeyboardFallback(false);
      }
      return;
    }

    dispatchMobileGrabKeyboardFallback(true);
  }

  function observeMobileGrabInputState(inputState: unknown): void {
    mobileGrabInputState = inputState;
  }

  function restoreMobileGrabPressedOnInputState(inputState: unknown): void {
    if (mobileGrabPointerDown && setGrabInputPressed(inputState, true)) {
      mobileGrabControlledInputState = inputState;
    }
  }

  function isMobileGrabPressed(): boolean {
    return mobileGrabPointerDown;
  }

  return {
    isMobileGrabPressed,
    observeMobileGrabInputState,
    restoreMobileGrabPressedOnInputState,
    setMobileGrabPressed,
  };
}
