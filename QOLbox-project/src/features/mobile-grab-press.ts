import {
  getChangedTouches,
  getPointerIdentifier,
  getTouchIdentifier,
  isPrimaryPointerStart,
  stopMobileGrabEvent,
} from './mobile-grab-events';

interface MobileGrabPressControllerOptions {
  getButton(): HTMLElement | null;
  isPressed(): boolean;
  setPressed(pressed: boolean): void;
  shouldShow(): boolean;
}

const UNKNOWN_POINTER_ID = Symbol('qolbox-unknown-pointer');

export function createMobileGrabPressController(options: MobileGrabPressControllerOptions) {
  let activeTouchId: unknown = null;
  let activePointerId: unknown = null;
  let releaseHooksInstalled = false;

  function resetMobileGrabPress(): void {
    activeTouchId = null;
    activePointerId = null;
    options.setPressed(false);
  }

  function getPointerKey(event: unknown): unknown {
    const pointerId = getPointerIdentifier(event);
    return pointerId === undefined || pointerId === null ? UNKNOWN_POINTER_ID : pointerId;
  }

  function handleMobileGrabTouchStart(event: unknown): void {
    if (!options.getButton() || !options.shouldShow()) {
      return;
    }

    const touch = getChangedTouches(event)[0];
    if (!touch) {
      return;
    }

    stopMobileGrabEvent(event);
    activeTouchId = getTouchIdentifier(touch);
    options.setPressed(true);
  }

  function handleMobileGrabTouchEnd(event: unknown): void {
    if (activeTouchId === null) {
      return;
    }

    for (const touch of getChangedTouches(event)) {
      if (getTouchIdentifier(touch) === activeTouchId) {
        activeTouchId = null;
        options.setPressed(false);
        return;
      }
    }
  }

  function handleMobileGrabPointerStart(event: unknown): void {
    if (!options.getButton() || !options.shouldShow()) {
      return;
    }

    if (!isPrimaryPointerStart(event)) {
      return;
    }

    stopMobileGrabEvent(event);
    activePointerId = getPointerKey(event);
    options.setPressed(true);
  }

  function handleMobileGrabPointerEnd(event: unknown): void {
    if (activePointerId === null) {
      return;
    }

    if (getPointerKey(event) !== activePointerId) {
      return;
    }

    stopMobileGrabEvent(event);
    activePointerId = null;
    options.setPressed(false);
  }

  function installMobileGrabReleaseHooks(): void {
    if (releaseHooksInstalled) {
      return;
    }

    releaseHooksInstalled = true;
    document.addEventListener('touchend', handleMobileGrabTouchEnd, true);
    document.addEventListener('touchcancel', handleMobileGrabTouchEnd, true);
    document.addEventListener('pointerup', handleMobileGrabPointerEnd, true);
    document.addEventListener('pointercancel', handleMobileGrabPointerEnd, true);
    window.addEventListener('touchend', handleMobileGrabTouchEnd, true);
    window.addEventListener('touchcancel', handleMobileGrabTouchEnd, true);
    window.addEventListener('pointerup', handleMobileGrabPointerEnd, true);
    window.addEventListener('pointercancel', handleMobileGrabPointerEnd, true);
    window.addEventListener('blur', resetMobileGrabPress, true);
  }

  return {
    handleMobileGrabPointerStart,
    handleMobileGrabTouchStart,
    installMobileGrabReleaseHooks,
    resetMobileGrabPress,
  };
}
