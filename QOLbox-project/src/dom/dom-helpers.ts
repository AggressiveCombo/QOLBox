import { isFocusableElement, isTabbableElement } from './element-guards';

interface FocusableValue {
  focus(options?: FocusOptions): void;
}

function isFocusableValue(value: unknown): value is FocusableValue {
  return isFocusableElement(value);
}

export function isElementVisible(element: Element | null | undefined): boolean {
  if (!element || !element.isConnected) {
    return false;
  }

  const style = window.getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden') {
    return false;
  }

  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

export function hasVisibleLayer(selector: string): boolean {
  for (const layer of document.querySelectorAll(selector)) {
    if (isElementVisible(layer)) {
      return true;
    }
  }

  return false;
}

export function escapeMenuText(value: unknown): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function focusElementWithoutScroll(element: unknown): void {
  if (!isFocusableValue(element)) {
    return;
  }

  try {
    element.focus({ preventScroll: true });
  } catch {
    element.focus();
  }
}

export function keepOutOfBrowserTabOrder(element: unknown): void {
  if (isTabbableElement(element)) {
    element.tabIndex = -1;
  }
}

export function keepInBrowserTabOrder(element: unknown): void {
  if (isTabbableElement(element)) {
    element.tabIndex = 0;
  }
}

function matchesElementOrDescendant(node: Node | null, selector: string): boolean {
  if (!(node instanceof Element)) {
    return false;
  }

  return node.matches(selector) || Boolean(node.closest(selector)) || Boolean(node.querySelector(selector));
}

export function mutationTouchesSelector(record: MutationRecord, selector: string): boolean {
  const targetElement =
    record.target instanceof Element
      ? record.target
      : record.target.parentElement instanceof Element
        ? record.target.parentElement
        : null;

  if (matchesElementOrDescendant(targetElement, selector)) {
    return true;
  }

  for (const node of record.addedNodes) {
    if (matchesElementOrDescendant(node, selector)) {
      return true;
    }
  }

  for (const node of record.removedNodes) {
    if (matchesElementOrDescendant(node, selector)) {
      return true;
    }
  }

  return false;
}
