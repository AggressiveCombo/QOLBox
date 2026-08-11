import {
  isArrowLeftKey,
  isArrowRightKey,
  isEnterKey,
  isEscapeKey,
} from './chat-keyboard-events';
import { readObjectProperty } from '../utils/object-properties';

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

const NATIVE_DISMISS_ACTION_SELECTOR = '.returnButton, .crossButton, .closeButton, .cancelButton, .backButton';
const NATIVE_POPUP_TAB_ACTION_SELECTOR = 'input, select, textarea, button, [data-qolbox-keyboard-action]';
const MAP_VOTE_ACTION_SELECTOR = '.lobbyContainer .voteSpan';

const NATIVE_KEYBOARD_ACTION_SELECTOR = [
  '.bigButton',
  '.cornerButton .square',
  '.cornerButton .items .item',
  '.roomListContainer .scrollBox tr',
  '.bottomButton',
  '.createWindowContainer .unlistedCheckContainer .checkbox',
  '.lobbyContainer .ffaButton',
  '.lobbyContainer .specButton',
  '.lobbyContainer .settingsButton',
  '.lobbyContainer .teamLockButton',
  MAP_VOTE_ACTION_SELECTOR,
  '#editorContainer .topMenu .topLabel',
  '#editorContainer .topMenu .item',
  '#editorContainer .sideBar .button',
  '.mouseBlockContainer .button',
  '.mouseBlockContainer .item',
  '.mapListContainer .searchButton',
  '.mapListContainer .mapsContainer > .element',
  '.mapListContainer .dropdownContainer > .element:not(.disabled)',
  NATIVE_DISMISS_ACTION_SELECTOR,
].join(', ');

const KEYBOARD_ACTION_ATTRIBUTE = 'data-qolbox-keyboard-action';
const UNAVAILABLE_POINTER_ACTION_SELECTOR =
  ':disabled, [disabled], [aria-disabled="true"], .disabled, .unlockedClient, .lockedClient, .beenDeleted';

interface PopupKeyboardControllerOptions {
  decorateActions(root?: ParentNode): void;
}

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

function blockUnavailablePointerAction(event: Event): void {
  const action = event.target instanceof Element
    ? event.target.closest(UNAVAILABLE_POINTER_ACTION_SELECTOR)
    : null;
  if (!action) return;
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
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

function getKeyboardActions(root: ParentNode = document): HTMLElement[] {
  return Array.from(root.querySelectorAll(NATIVE_KEYBOARD_ACTION_SELECTOR))
    .filter((element): element is HTMLElement => element instanceof HTMLElement);
}

function patchKeyboardAction(element: HTMLElement): void {
  element.setAttribute(KEYBOARD_ACTION_ATTRIBUTE, 'true');
  element.tabIndex = isDisabledAction(element) || (element.matches(MAP_VOTE_ACTION_SELECTOR) && !element.textContent) ? -1 : 0;

  if (!element.hasAttribute('role')) {
    element.setAttribute(
      'role',
      element.matches('.createWindowContainer .unlistedCheckContainer .checkbox')
        ? 'checkbox'
        : element.matches('.roomListContainer .scrollBox tr, .mapListContainer .mapsContainer > .element')
        ? 'option'
        : element.matches('.cornerButton .items .item, #editorContainer .topMenu .item, .mapListContainer .dropdownContainer > .element')
          ? 'menuitem'
          : 'button'
    );
  }

  if (element.matches('.cornerButton .square')) {
    element.setAttribute('aria-label', 'Menu');
  } else if (element.matches('.crossButton, .closeButton')) {
    element.setAttribute('aria-label', 'Close');
  } else if (element.matches('#editorContainer .topMenu .topLabel')) {
    element.setAttribute('aria-haspopup', 'menu');
  } else if (element.matches('.lobbyContainer .teamLockButton')) {
    element.setAttribute('aria-label', 'Toggle team lock');
  } else if (element.matches(MAP_VOTE_ACTION_SELECTOR)) {
    element.setAttribute('aria-label', element === element.parentElement?.querySelector(MAP_VOTE_ACTION_SELECTOR)
      ? 'Like map'
      : 'Dislike map');
  } else if (element.matches('.createWindowContainer .unlistedCheckContainer .checkbox')) {
    element.setAttribute('aria-label', 'Unlisted room');
    element.setAttribute('aria-checked', String(element.classList.contains('checked')));
  }

  if (element.matches('.roomListContainer .scrollBox tr')) {
    element.setAttribute('aria-selected', String(element.classList.contains('SELECTED')));
  }
}

function patchNativeKeyboardNavigation(root: ParentNode = document): void {
  if (root instanceof HTMLElement && root.matches(NATIVE_KEYBOARD_ACTION_SELECTOR)) {
    patchKeyboardAction(root);
  }
  getKeyboardActions(root).forEach(patchKeyboardAction);
}

function getVisibleKeyboardActions(selector: string, root: ParentNode = document): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(selector))
    .filter(isVisibleElement)
    .filter(element => !isDisabledAction(element));
}

function containPopupTab(event: KeyboardEvent, popup: HTMLElement): boolean {
  if (event.key !== 'Tab') return false;

  const actions = getVisibleKeyboardActions(NATIVE_POPUP_TAB_ACTION_SELECTOR, popup);
  if (!actions.length) return false;

  const currentIndex = actions.indexOf(document.activeElement as HTMLElement);
  if (currentIndex >= 0 && (event.shiftKey ? currentIndex > 0 : currentIndex < actions.length - 1)) {
    return false;
  }

  actions[event.shiftKey ? actions.length - 1 : 0]?.focus({ preventScroll: true });
  return true;
}

function clickNativeAction(action: HTMLElement): void {
  if (action.matches(MAP_VOTE_ACTION_SELECTOR)) {
    if (!action.textContent) return;
    const session = readObjectProperty(window, 'multiplayerSession');
    const vote = readObjectProperty(session, 'EJ');
    if (typeof vote === 'function') {
      Reflect.apply(vote, session, [action === action.parentElement?.querySelector(MAP_VOTE_ACTION_SELECTOR)]);
    }
    return;
  }

  // Hitbox selects event.target.parentNode, so room rows must be activated through a cell.
  const target = action.matches('.roomListContainer .scrollBox tr')
    ? action.querySelector<HTMLElement>('td')
    : action;
  target?.click();
}

function activateNativeAction(action: HTMLElement, joinSelectedRoom: boolean): void {
  if (!(joinSelectedRoom && action.matches('.roomListContainer .scrollBox tr.SELECTED'))) {
    clickNativeAction(action);
  }
  if (!joinSelectedRoom || !action.matches('.roomListContainer .scrollBox tr')) return;

  const joinButton = action.closest('.roomListContainer')
    ?.querySelector<HTMLElement>('.bottomButton.right');
  if (joinButton && !isDisabledAction(joinButton)) joinButton.click();
}

function getNavigationActions(activeElement: HTMLElement): HTMLElement[] {
  if (activeElement.matches('.bigButton')) {
    return getVisibleKeyboardActions(`.bigButton[${KEYBOARD_ACTION_ATTRIBUTE}]`);
  }

  const group = activeElement.closest(
    '.cornerButton .items, .roomListContainer .scrollBox, .mapListContainer .mapsContainer, .mapListContainer .dropdownContainer, .lobbyContainer, #editorContainer .topMenu .container, #editorContainer .sideBar'
  );
  if (group) {
    return getVisibleKeyboardActions(`[${KEYBOARD_ACTION_ATTRIBUTE}]`, group);
  }

  const popup = activeElement.closest(NATIVE_POPUP_SELECTOR);
  return popup ? getVisibleKeyboardActions(`[${KEYBOARD_ACTION_ATTRIBUTE}]`, popup) : [];
}

function moveNativeFocus(event: KeyboardEvent, direction: -1 | 1): boolean {
  const activeElement = document.activeElement;
  if (!(activeElement instanceof HTMLElement) || !activeElement.hasAttribute(KEYBOARD_ACTION_ATTRIBUTE)) {
    return false;
  }
  if (activeElement.getAttribute('role') === 'slider') {
    return false;
  }
  if (
    activeElement.matches('.roomListContainer .scrollBox tr') &&
    event.key !== 'ArrowUp' &&
    event.key !== 'ArrowDown'
  ) {
    return false;
  }

  const actions = getNavigationActions(activeElement);
  const currentIndex = actions.indexOf(activeElement);
  if (currentIndex < 0 || actions.length < 2) {
    return false;
  }

  const nextAction = actions[(currentIndex + direction + actions.length) % actions.length];
  if (!nextAction) {
    return false;
  }
  nextAction.focus({ preventScroll: false });
  return true;
}

function getNavigationSelector(opener: HTMLElement | null): string {
  if (opener?.matches('.bigButton.qp')) return '.quickMenuContainer';
  if (opener?.matches('.bigButton.custom')) return '.roomListContainer';
  return '';
}

let navigationDismissEpoch = 0;

function settleNavigationDismiss(
  opener: HTMLElement,
  remainingFrames = 60,
  focusRestored = false,
  epoch = ++navigationDismissEpoch,
): void {
  if (!remainingFrames) return;
  window.requestAnimationFrame(() => {
    if (epoch !== navigationDismissEpoch) return;
    const navigation = document.querySelector<HTMLElement>(getNavigationSelector(opener));
    const mainMenuActions = document.querySelector<HTMLElement>('.mainMenuFancy .rightContainer');
    let restored = focusRestored;
    if (navigation && isVisibleElement(navigation) && mainMenuActions?.style.display === 'none') {
      const dismiss = navigation.querySelector<HTMLElement>(NATIVE_DISMISS_ACTION_SELECTOR);
      if (dismiss && !isDisabledAction(dismiss)) {
        dismiss.click();
        restored = false;
      }
    } else if (!restored && mainMenuActions?.style.display !== 'none' && opener.isConnected) {
      opener.focus({ preventScroll: true });
      restored = true;
    }
    settleNavigationDismiss(opener, remainingFrames - 1, restored, epoch);
  });
}

function dismissOpenNavigation(returnFocusTo: HTMLElement | null, attempt = 0): boolean {
  const mainMenuActions = document.querySelector('.mainMenuFancy .rightContainer');
  const editorMenuContainer = getVisibleKeyboardActions('#editorContainer .topMenu .container')[0];
  const editorMenu = editorMenuContainer?.closest<HTMLElement>('.topLabel');
  if (editorMenu) {
    editorMenu.click();
    editorMenu.focus({ preventScroll: true });
    return true;
  }

  const hamburgerItems = getVisibleKeyboardActions('.cornerButton .items')[0];
  const hamburgerButton = hamburgerItems?.closest('.cornerButton')?.querySelector<HTMLElement>('.square');
  if (hamburgerButton) {
    hamburgerButton.click();
    hamburgerButton.focus({ preventScroll: true });
    return true;
  }

  const pendingNavigationSelector = getNavigationSelector(returnFocusTo);
  const pendingNavigation = pendingNavigationSelector
    ? getVisibleKeyboardActions(pendingNavigationSelector)[0]
    : null;
  if (attempt === 0 && returnFocusTo && pendingNavigationSelector) {
    settleNavigationDismiss(returnFocusTo);
  }
  const pendingDismiss = pendingNavigation?.querySelector<HTMLElement>(NATIVE_DISMISS_ACTION_SELECTOR) ?? null;
  if (
    returnFocusTo &&
    pendingDismiss &&
    mainMenuActions instanceof HTMLElement &&
    mainMenuActions.style.display === 'none' &&
    !isDisabledAction(pendingDismiss)
  ) {
    pendingDismiss.click();
    returnFocusTo?.focus({ preventScroll: true });
    return true;
  }

  const navigation = pendingNavigation ?? getVisibleKeyboardActions('.roomListContainer, .quickMenuContainer').pop();
  const navigationDismiss = navigation?.querySelector<HTMLElement>(NATIVE_DISMISS_ACTION_SELECTOR);
  if (navigationDismiss && !isDisabledAction(navigationDismiss)) {
    navigationDismiss.click();
    if (returnFocusTo?.isConnected) returnFocusTo.focus({ preventScroll: true });
    return true;
  }

  const dismissAction = getVisibleKeyboardActions(NATIVE_DISMISS_ACTION_SELECTOR).pop();
  if (!dismissAction) {
    if (
      returnFocusTo?.isConnected &&
      mainMenuActions instanceof HTMLElement &&
      mainMenuActions.style.display === 'none' &&
      attempt < 8
    ) {
      window.requestAnimationFrame(() => dismissOpenNavigation(returnFocusTo, attempt + 1));
      return true;
    }
    return Boolean(pendingNavigation);
  }
  if (mainMenuActions instanceof HTMLElement && mainMenuActions.style.display !== 'none') {
    window.requestAnimationFrame(() => dismissOpenNavigation(returnFocusTo, attempt + 1));
    return true;
  }
  dismissAction.click();
  if (returnFocusTo?.isConnected) returnFocusTo.focus({ preventScroll: true });
  return true;
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
    '.returnButton',
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

export function createPopupKeyboardController(options: PopupKeyboardControllerOptions) {
  let hooksInstalled = false;
  let keyboardActionObserver: MutationObserver | null = null;
  let lastNavigationOpener: HTMLElement | null = null;
  let lastPopupFocus: { opener: HTMLElement; popup: HTMLElement } | null = null;
  let escapePopupFocus: { opener: HTMLElement; popup: HTMLElement } | null = null;
  let lastRoomFocus: HTMLElement | null = null;
  let lastRoomText = '';
  const suppressedKeyups = new Set<string>();

  function getSelectedRoom(): HTMLElement | null {
    const selected = getVisibleKeyboardActions('.roomListContainer .scrollBox tr.SELECTED')[0];
    if (selected) return selected;
    if (lastRoomFocus?.isConnected && isVisibleElement(lastRoomFocus)) return lastRoomFocus;
    return getVisibleKeyboardActions('.roomListContainer .scrollBox tr')
      .find(row => row.textContent === lastRoomText) ?? null;
  }

  function handlePopupKeyboard(event: KeyboardEvent): void {
    suppressedKeyups.delete(event.key);
    if (
      event.defaultPrevented ||
      event.repeat ||
      event.isComposing ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      document.querySelector('.qolboxMenuOverlay, dialog[open]')
    ) {
      return;
    }

    const popup = getVisibleNativePopup();
    if (popup && isNativeKeyBindingActive(popup)) {
      return;
    }

    let handled = false;
    if (popup && containPopupTab(event, popup)) {
      handled = true;
    } else if (isEscapeKey(event) && popup) {
      escapePopupFocus = lastPopupFocus?.popup === popup ? lastPopupFocus : null;
      lastPopupFocus = null;
      handled = dismissRightClickMenu(popup);
      const action = handled ? null : getEscapeAction(popup);
      if (action) {
        action.click();
        handled = true;
      }
    } else if (isEscapeKey(event)) {
      handled = dismissOpenNavigation(lastNavigationOpener);
    } else if (
      (isEnterKey(event) || event.key === ' ') &&
      !isMultilineEditor(event.target) &&
      document.activeElement instanceof HTMLElement &&
      document.activeElement.hasAttribute(KEYBOARD_ACTION_ATTRIBUTE) &&
      !isDisabledAction(document.activeElement)
    ) {
      const activeElement = document.activeElement;
      const navigationWasOpen = getVisibleKeyboardActions(NATIVE_DISMISS_ACTION_SELECTOR).length > 0;
      if (activeElement.matches('.bigButton.qp, .bigButton.custom, .cornerButton .square')) {
        navigationDismissEpoch += 1;
        lastNavigationOpener = activeElement;
      }
      activateNativeAction(activeElement, isEnterKey(event));
      if (!navigationWasOpen && getVisibleKeyboardActions(NATIVE_DISMISS_ACTION_SELECTOR).length > 0) {
        lastNavigationOpener = activeElement;
      }
      handled = true;
    } else if (isEnterKey(event) && document.activeElement === document.body) {
      const selectedRoom = getSelectedRoom();
      if (selectedRoom) {
        activateNativeAction(selectedRoom, true);
        handled = true;
      }
    } else if (popup && isEnterKey(event) && !isMultilineEditor(event.target)) {
      const action = getEnterAction(popup);
      if (action) {
        action.click();
        handled = true;
      }
    } else if (popup && (isArrowLeftKey(event) || isArrowRightKey(event))) {
      const action = getArrowAction(popup, isArrowLeftKey(event) ? 'left' : 'right');
      if (action) {
        action.click();
        handled = true;
      }
    } else if (/^Arrow(?:Up|Down|Left|Right)$/.test(event.key)) {
      handled = moveNativeFocus(event, event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -1 : 1);
    }

    if (!handled) {
      return;
    }

    if (isEnterKey(event) || event.key === ' ') suppressedKeyups.add(event.key);
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  }

  function handlePopupKeyboardKeyup(event: KeyboardEvent): void {
    if (isEscapeKey(event) && escapePopupFocus) {
      const { opener, popup } = escapePopupFocus;
      escapePopupFocus = null;
      window.requestAnimationFrame(() => {
        if (isVisibleElement(popup)) return;
        const focusTarget = opener.isConnected
          ? opener
          : opener.matches('.roomListContainer .scrollBox tr')
            ? getSelectedRoom()
            : null;
        focusTarget?.focus({ preventScroll: true });
      });
    } else if (isEscapeKey(event)) {
      window.requestAnimationFrame(() => {
        if (document.activeElement !== document.body) return;
        getSelectedRoom()?.focus({ preventScroll: true });
      });
    }
    if (!suppressedKeyups.delete(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
  }

  function installPopupKeyboardHooks(): void {
    if (hooksInstalled) {
      return;
    }

    hooksInstalled = true;
    window.addEventListener('pointerdown', blockUnavailablePointerAction, true);
    window.addEventListener('click', blockUnavailablePointerAction, true);
    window.addEventListener('keydown', handlePopupKeyboard, true);
    window.addEventListener('keyup', handlePopupKeyboardKeyup, true);
    window.addEventListener('click', event => {
      const opener = event.target instanceof Element
        ? event.target.closest<HTMLElement>('.bigButton.qp, .bigButton.custom, .cornerButton .square')
        : null;
      if (opener) {
        navigationDismissEpoch += 1;
        lastNavigationOpener = opener;
      }
      const vote = event.target instanceof Element
        ? event.target.closest<HTMLElement>(MAP_VOTE_ACTION_SELECTOR)
        : null;
      if (!vote) return;
      event.preventDefault();
      event.stopPropagation();
      clickNativeAction(vote);
    }, true);
    window.addEventListener('focusin', event => {
      if (!(event.target instanceof HTMLElement)) return;
      const popup = event.target.closest<HTMLElement>(NATIVE_POPUP_SELECTOR);
      if (popup && event.relatedTarget instanceof HTMLElement && !popup.contains(event.relatedTarget)) {
        lastPopupFocus = { opener: event.relatedTarget, popup };
      }
      if (event.target.matches('.roomListContainer .scrollBox tr')) {
        lastRoomFocus = event.target;
        lastRoomText = event.target.textContent ?? '';
        if (!event.target.classList.contains('SELECTED')) clickNativeAction(event.target);
      }
    }, true);
    patchNativeKeyboardNavigation();
    options.decorateActions();

    keyboardActionObserver = new MutationObserver(records => {
      const roots = new Set<HTMLElement>();
      for (const record of records) {
        if (record.target instanceof HTMLElement) roots.add(record.target);
        else record.addedNodes.forEach(node => {
          if (node instanceof HTMLElement) roots.add(node);
        });
      }
      for (const root of roots) {
        if ([...roots].some(candidate => candidate !== root && candidate.contains(root))) continue;
        patchNativeKeyboardNavigation(root);
        options.decorateActions(root);
      }
    });
    keyboardActionObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['class'],
      childList: true,
      subtree: true,
    });
  }

  return {
    handlePopupKeyboard,
    installPopupKeyboardHooks,
    patchNativeKeyboardNavigation,
  };
}
