import { isReflectableObject, readObjectProperty } from '../utils/object-properties';

export function getChangedTouches(event: unknown): unknown[] {
  const changedTouches = readObjectProperty(event, 'changedTouches');
  const length = Number(readObjectProperty(changedTouches, 'length'));
  if (!Number.isFinite(length) || length <= 0) {
    return [];
  }

  const touches: unknown[] = [];
  for (let index = 0; index < length; index += 1) {
    const touch = readObjectProperty(changedTouches, index);
    if (touch) {
      touches.push(touch);
    }
  }
  return touches;
}

export function getTouchIdentifier(touch: unknown): unknown {
  return readObjectProperty(touch, 'identifier');
}

export function isPrimaryPointerStart(event: unknown): boolean {
  const button = readObjectProperty(event, 'button');
  return button === undefined || button === 0;
}

function callEventMethod(event: unknown, methodName: string): void {
  const method = readObjectProperty(event, methodName);
  if (isReflectableObject(event) && typeof method === 'function') {
    Reflect.apply(method, event, []);
  }
}

export function stopMobileGrabEvent(event: unknown): void {
  if (readObjectProperty(event, 'cancelable') !== false) {
    callEventMethod(event, 'preventDefault');
  }
  callEventMethod(event, 'stopImmediatePropagation');
}
