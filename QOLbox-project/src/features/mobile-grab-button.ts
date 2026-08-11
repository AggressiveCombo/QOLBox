import { installNativeMobileControlHooks } from '../hitbox/mobile-controls-adapter';
import {
  areNativeMobileAbilityButtonsVisible,
  getMobileAbilityButtons,
  isMobileGameModeContext,
  isMobileQolboxMenuContextValue,
} from './mobile-grab-context';
import {
  createMobileGrabButtonElement,
  hideMobileGrabButtonElement,
  removeMobileGrabButtonElement,
} from './mobile-grab-button-element';
import { createMobileGrabInputController } from './mobile-grab-input';
import { positionMobileGrabButton } from './mobile-grab-layout';
import { createMobileGrabPressController } from './mobile-grab-press';

export const MOBILE_GRAB_ICON_HREF =
  'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22 fill=%22none%22%3E%3Cpath d=%22M22 36V13a5 5 0 0 1 10 0v20V9a5 5 0 0 1 10 0v25V13a5 5 0 0 1 10 0v23V22a4 4 0 0 1 8 0v18c0 13-9 21-23 21h-7c-7 0-11-4-15-10l-6-9a5 5 0 0 1 8-6l8 9%22 stroke=%22%23f4f4f4%22 stroke-width=%226%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22/%3E%3C/svg%3E';

interface MobileGrabControllerDependencies {
  fallbackBaseHeight: number;
  fallbackBaseWidth: number;
  isEnabled(): boolean;
}

export interface MobileGrabController {
  handleMobileGrabPointerStart(event: unknown): void;
  hideMobileGrabButton(): void;
  isMobileGameMode(): boolean;
  isMobileQolboxMenuContext(): boolean;
  layoutMobileGrabButton(button: HTMLElement): void;
  patchMobileGrabButton(): boolean;
  removeMobileGrabButton(): void;
  setMobileGrabPressed(pressed: unknown): void;
  shouldShowMobileGrabButton(): boolean;
  syncMobileGrabButton(): boolean;
}

export function createMobileGrabController(dependencies: MobileGrabControllerDependencies): MobileGrabController {
  let mobileGrabButton: HTMLElement | null = null;
  const mobileGrabInput = createMobileGrabInputController();
  const mobileGrabPress = createMobileGrabPressController({
    getButton: () => mobileGrabButton,
    isPressed: () => mobileGrabInput.isMobileGrabPressed(),
    setPressed: mobileGrabInput.setMobileGrabPressed,
    shouldShow: () => shouldShowMobileGrabButton(),
  });

  function hideMobileGrabButton(): void {
    mobileGrabPress.resetMobileGrabPress();
    hideMobileGrabButtonElement(mobileGrabButton);
  }

  function removeMobileGrabButton(): void {
    hideMobileGrabButton();
    mobileGrabButton = removeMobileGrabButtonElement(mobileGrabButton);
  }

  function ensureMobileGrabButton(): HTMLElement | null {
    if (mobileGrabButton && mobileGrabButton.isConnected) {
      return mobileGrabButton;
    }

    const container = document.getElementById('relativeContainer');
    if (!container) {
      return null;
    }

    const button = createMobileGrabButtonElement(container, {
      onKeyboardChange: mobileGrabInput.setMobileGrabPressed,
      onPointerStart: mobileGrabPress.handleMobileGrabPointerStart,
      onTouchStart: mobileGrabPress.handleMobileGrabTouchStart,
    });
    mobileGrabButton = button;
    mobileGrabPress.installMobileGrabReleaseHooks();
    return button;
  }

  function layoutMobileGrabButton(button: HTMLElement): void {
    positionMobileGrabButton(button, {
      fallbackBaseHeight: dependencies.fallbackBaseHeight,
      fallbackBaseWidth: dependencies.fallbackBaseWidth,
      getAbilityButtons: getMobileAbilityButtons,
    });
  }

  function shouldShowMobileGrabButton(): boolean {
    return Boolean(dependencies.isEnabled() && isMobileGameModeContext() && areNativeMobileAbilityButtonsVisible());
  }

  function syncMobileGrabButton(): boolean {
    if (!dependencies.isEnabled() || !isMobileGameModeContext()) {
      removeMobileGrabButton();
      return false;
    }

    const button = ensureMobileGrabButton();
    if (!button) {
      return false;
    }

    if (!shouldShowMobileGrabButton()) {
      hideMobileGrabButton();
      return false;
    }

    layoutMobileGrabButton(button);
    button.style.display = 'block';
    return true;
  }

  function installMobileGrabControlHooks(): boolean {
    return installNativeMobileControlHooks({
      onInputStateObserved(inputState) {
        mobileGrabInput.observeMobileGrabInputState(inputState);
      },
      afterInputStateSet(inputState) {
        mobileGrabInput.restoreMobileGrabPressedOnInputState(inputState);
      },
      onControlsShown() {
        syncMobileGrabButton();
      },
      onControlsHidden() {
        hideMobileGrabButton();
      },
    });
  }

  function patchMobileGrabButton(): boolean {
    if (!dependencies.isEnabled()) {
      removeMobileGrabButton();
      return false;
    }

    installMobileGrabControlHooks();
    return syncMobileGrabButton();
  }

  return {
    handleMobileGrabPointerStart: mobileGrabPress.handleMobileGrabPointerStart,
    hideMobileGrabButton,
    isMobileGameMode: isMobileGameModeContext,
    isMobileQolboxMenuContext: isMobileQolboxMenuContextValue,
    layoutMobileGrabButton,
    patchMobileGrabButton,
    removeMobileGrabButton,
    setMobileGrabPressed: mobileGrabInput.setMobileGrabPressed,
    shouldShowMobileGrabButton,
    syncMobileGrabButton,
  };
}
