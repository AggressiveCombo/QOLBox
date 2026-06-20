import { isElementVisible } from '../dom/dom-helpers';
import { getNativeMobileAbilityButtonElements, isNativeMobileMode } from '../hitbox/mobile-controls-adapter';
import { readObjectProperty } from '../utils/object-properties';

export function getMobileAbilityButtons(): Element[] {
  const nativeButtons = getNativeMobileAbilityButtonElements();
  if (nativeButtons.length) {
    return nativeButtons;
  }

  return Array.from(document.querySelectorAll('.buttonArea.bat, .buttonArea.push, .buttonArea.rocket'));
}

export function areNativeMobileAbilityButtonsVisible(): boolean {
  const buttons = getMobileAbilityButtons();
  return buttons.length > 0 && buttons.every(isElementVisible);
}

export function isMobileGameModeContext(): boolean {
  return isNativeMobileMode() || areNativeMobileAbilityButtonsVisible();
}

export function isMobileQolboxMenuContextValue(): boolean {
  if (isNativeMobileMode()) {
    return true;
  }

  const nav = window.navigator || (typeof navigator !== 'undefined' ? navigator : null);
  const touchPoints = Number(
    nav && (readObjectProperty(nav, 'maxTouchPoints') || readObjectProperty(nav, 'msMaxTouchPoints') || 0)
  );
  if (!touchPoints || typeof window.matchMedia !== 'function') {
    return false;
  }

  try {
    return window.matchMedia('(hover: none) and (pointer: coarse)').matches;
  } catch {
    return false;
  }
}
