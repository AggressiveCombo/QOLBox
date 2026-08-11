import { readObjectProperty, setObjectProperty } from '../utils/object-properties';

function readStringProperty(source: unknown, property: PropertyKey): string {
  const value = readObjectProperty(source, property);
  return typeof value === 'string' ? value : '';
}

function readNumberProperty(source: unknown, property: PropertyKey): number {
  const value = readObjectProperty(source, property);
  return typeof value === 'number' ? value : Number(value);
}

export function readGameplayFocusBooleanProperty(source: unknown, property: PropertyKey): boolean {
  return readObjectProperty(source, property) === true;
}

export function canPreventGameplayDefault(event: unknown): event is { preventDefault(): void } {
  return (
    typeof event === 'object' &&
    event !== null &&
    typeof readObjectProperty(event, 'preventDefault') === 'function'
  );
}

function canDispatchEvents(element: unknown): element is Element & { dispatchEvent(event: Event): boolean } {
  return element instanceof Element && typeof readObjectProperty(element, 'dispatchEvent') === 'function';
}

export function canBlurGameplayFocusTarget(element: unknown): element is { blur(): void } {
  return (
    typeof element === 'object' &&
    element !== null &&
    typeof readObjectProperty(element, 'blur') === 'function'
  );
}

function hasTabIndexApi(element: unknown): element is Element & { hasAttribute(name: string): boolean; tabIndex: number } {
  return (
    element instanceof Element &&
    typeof readObjectProperty(element, 'hasAttribute') === 'function' &&
    typeof readObjectProperty(element, 'tabIndex') === 'number'
  );
}

export function ensureGameplayFocusTargetFocusable(element: Element): void {
  if (hasTabIndexApi(element) && !element.hasAttribute('tabindex')) {
    element.tabIndex = -1;
  }
}

function getPointerEventType(event: unknown): string {
  return readStringProperty(event, 'type');
}

export function isPrimaryGameplayMouseButton(event: unknown): boolean {
  const button = readObjectProperty(event, 'button');
  return button === undefined || button === 0;
}

function clampPointerToRect(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return (min + max) / 2;
  }

  return Math.max(min, Math.min(max, value));
}

function createForwardedPointerEvent(event: unknown, clientX: number, clientY: number): Event {
  const eventType = getPointerEventType(event);
  const commonInit = {
    bubbles: true,
    cancelable: true,
    button: 0,
    buttons: eventType === 'click' ? 0 : 1,
    clientX,
    clientY,
    ctrlKey: readGameplayFocusBooleanProperty(event, 'ctrlKey'),
    shiftKey: readGameplayFocusBooleanProperty(event, 'shiftKey'),
    altKey: readGameplayFocusBooleanProperty(event, 'altKey'),
    metaKey: readGameplayFocusBooleanProperty(event, 'metaKey'),
  };

  if (/^pointer/i.test(eventType) && typeof PointerEvent === 'function') {
    return new PointerEvent(eventType, {
      ...commonInit,
      pointerId: readNumberProperty(event, 'pointerId') || 1,
      pointerType: readStringProperty(event, 'pointerType') || 'mouse',
      isPrimary: readObjectProperty(event, 'isPrimary') !== false,
    });
  }

  return new MouseEvent(eventType, commonInit);
}

export function forwardGameplayPointerToCanvas(event: unknown, canvas: Element | null): boolean {
  const eventType = getPointerEventType(event);
  if (!canDispatchEvents(canvas) || !/^(?:pointerdown|mousedown|click)$/i.test(eventType)) {
    return false;
  }

  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) {
    return false;
  }

  const rectRight = Number.isFinite(rect.right) ? rect.right : rect.left + rect.width;
  const rectBottom = Number.isFinite(rect.bottom) ? rect.bottom : rect.top + rect.height;
  const clientX = clampPointerToRect(readNumberProperty(event, 'clientX'), rect.left + 1, rectRight - 1);
  const clientY = clampPointerToRect(readNumberProperty(event, 'clientY'), rect.top + 1, rectBottom - 1);
  const forwardedEvent = createForwardedPointerEvent(event, clientX, clientY);

  setObjectProperty(forwardedEvent, '__qolboxForwardedGameplayPointer', true);

  canvas.dispatchEvent(forwardedEvent);
  return true;
}
