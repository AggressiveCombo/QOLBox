import {
  isArrowLeftKey,
  isArrowRightKey,
  isEnterKey,
  isEscapeKey,
} from './chat-keyboard-events';

const NATIVE_POPUP_SELECTOR = [
  '.mouseBlockContainer > :not(.behindBlocker)',
  '.createWindowContainer .createWindow',
  '.passwordWindowContainer .passwordWindow',
  '.connectingWindowContainer .connectingWindow',
  '.autoLoginWindowContainer .autoLoginWindow',
  '.mapListContainer .enterNameWindow',
  '.oneButtonWindow',
  '.twoButtonWindow',
  '.updateNews',
  '.settingsWindow',
  '.recordsWindow',
  '.cosmeticWindow',
  '.rightClickMenu',
].join(', ');

function isVisibleElement(element: Element): element is HTMLElement {
  if (!(element instanceof HTMLElement)) {
    return false;
  }

  const style = window.getComputedStyle(element);
  const rect = element.getBoundingClientRect();
  return (
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    Number(style.opacity || 1) !== 0 &&
    rect.width > 0 &&
    rect.height > 0
  );
}

function getVisibleNativePopup(): HTMLElement | null {
  const popups = Array.from(document.querySelectorAll(NATIVE_POPUP_SELECTOR))
    .filter(isVisibleElement)
    .filter(popup => !popup.closest('.qolboxMenuOverlay'));
  return popups[popups.length - 1] || null;
}

function isDisabledAction(element: HTMLElement): boolean {
  return (
    element.classList.contains('disabled') ||
    element.hasAttribute('disabled') ||
    element.getAttribute('aria-disabled') === 'true' ||
    window.getComputedStyle(element).pointerEvents === 'none'
  );
}

function findEnabledAction(popup: HTMLElement, selectors: readonly string[]): HTMLElement | null {
  for (const selector of selectors) {
    const action = popup.querySelector<HTMLElement>(selector);
    if (action && isVisibleElement(action) && !isDisabledAction(action)) {
      return action;
    }
  }

  return null;
}

function isNativeKeyBindingActive(popup: HTMLElement): boolean {
  return popup.matches('.settingsWindow') &&
    Array.from(popup.querySelectorAll('.clickable')).some(element => element.textContent?.trim() === '...');
}

function isMultilineEditor(target: EventTarget | null): boolean {
  return target instanceof HTMLTextAreaElement ||
    (target instanceof HTMLElement && target.isContentEditable);
}

function dismissRightClickMenu(popup: HTMLElement): boolean {
  if (!popup.matches('.rightClickMenu')) {
    return false;
  }

  popup.remove();
  return true;
}

function getEscapeAction(popup: HTMLElement): HTMLElement | null {
  return findEnabledAction(popup, [
    '.crossButton',
    '.cancelButton',
    '.backButton',
    '.oneButtonWindow .button',
    '.button',
  ]);
}

function getEnterAction(popup: HTMLElement): HTMLElement | null {
  const activeElement = document.activeElement;
  if (
    activeElement instanceof HTMLElement &&
    popup.contains(activeElement) &&
    activeElement.matches('button, [role="button"], .button, .bottomButton, .item') &&
    !isDisabledAction(activeElement)
  ) {
    return activeElement;
  }

  const primaryAction = findEnabledAction(popup, [
    '.okButton',
    '.joinButton',
    '.createButton',
    '.saveButton',
    '.playButton',
    '.oneButtonWindow .button',
    '.button:not(.cancelButton):not(.leftButton):not(.rightButton)',
  ]);
  if (primaryAction) {
    return primaryAction;
  }

  return popup.matches('.updateNews') ? findEnabledAction(popup, ['.crossButton']) : null;
}

function getArrowAction(popup: HTMLElement, direction: 'left' | 'right'): HTMLElement | null {
  const hasPageNavigation = popup.matches('.updateNews') || Boolean(popup.querySelector('.dateLabel'));
  if (!hasPageNavigation) {
    return null;
  }

  return findEnabledAction(popup, [direction === 'left' ? '.leftButton' : '.rightButton']);
}

export function createPopupKeyboardController() {
  let hooksInstalled = false;

  function handlePopupKeyboard(event: KeyboardEvent): void {
    if (
      event.defaultPrevented ||
      event.repeat ||
      event.isComposing ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      document.querySelector('.qolboxMenuOverlay')
    ) {
      return;
    }

    const popup = getVisibleNativePopup();
    if (!popup || isNativeKeyBindingActive(popup)) {
      return;
    }

    let handled = false;
    if (isEscapeKey(event)) {
      handled = dismissRightClickMenu(popup);
      const action = handled ? null : getEscapeAction(popup);
      if (action) {
        action.click();
        handled = true;
      }
    } else if (isEnterKey(event) && !isMultilineEditor(event.target)) {
      const action = getEnterAction(popup);
      if (action) {
        action.click();
        handled = true;
      }
    } else if (isArrowLeftKey(event) || isArrowRightKey(event)) {
      const action = getArrowAction(popup, isArrowLeftKey(event) ? 'left' : 'right');
      if (action) {
        action.click();
        handled = true;
      }
    }

    if (!handled) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  }

  function installPopupKeyboardHooks(): void {
    if (hooksInstalled) {
      return;
    }

    hooksInstalled = true;
    window.addEventListener('keydown', handlePopupKeyboard, true);
  }

  return {
    handlePopupKeyboard,
    installPopupKeyboardHooks,
  };
}
