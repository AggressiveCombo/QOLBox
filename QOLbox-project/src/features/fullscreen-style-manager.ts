import { isStyledElement, type StyledElement } from '../dom/element-guards';

interface StyleSnapshot {
  hadValue: boolean;
  priority: string;
  value: string;
}

type ElementStyleSnapshot = Map<string, StyleSnapshot>;

export function createFullscreenStyleManager() {
  let fullscreenStyleSnapshots = new WeakMap<StyledElement, ElementStyleSnapshot>();

  function rememberFullscreenStyle(element: unknown, property: string): void {
    if (!isStyledElement(element)) {
      return;
    }

    let snapshot = fullscreenStyleSnapshots.get(element);
    if (!snapshot) {
      snapshot = new Map();
      fullscreenStyleSnapshots.set(element, snapshot);
    }

    if (snapshot.has(property)) {
      return;
    }

    const value = element.style.getPropertyValue(property);
    const priority = element.style.getPropertyPriority(property);
    snapshot.set(property, {
      priority,
      value,
      hadValue: value !== '' || priority !== '',
    });
  }

  function setImportantStyle(element: unknown, property: string, value: string): void {
    if (!isStyledElement(element)) {
      return;
    }

    rememberFullscreenStyle(element, property);
    element.style.setProperty(property, value, 'important');
  }

  function restoreFullscreenStyles(element: unknown, properties: Iterable<string>): void {
    if (!isStyledElement(element)) {
      return;
    }

    const snapshot = fullscreenStyleSnapshots.get(element);
    for (const property of properties) {
      const original = snapshot?.get(property);
      if (original?.hadValue) {
        element.style.setProperty(property, original.value, original.priority);
      } else {
        element.style.removeProperty(property);
      }
    }
  }

  function clearFullscreenStyleSnapshots(): void {
    fullscreenStyleSnapshots = new WeakMap();
  }

  return {
    clearFullscreenStyleSnapshots,
    restoreFullscreenStyles,
    setImportantStyle,
  };
}
