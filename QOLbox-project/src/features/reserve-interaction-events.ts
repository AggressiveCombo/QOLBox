import { readObjectProperty } from '../utils/object-properties';

export function getClosestReserveJoinButton(target: unknown): Element | null {
  return target instanceof Element ? target.closest('.roomListContainer .bottomButton.right') : null;
}

export function getReservePasswordSubmitButton(target: unknown): Element | null {
  return target instanceof Element ? target.closest('.passwordWindowContainer .joinButton') : null;
}

export function getReserveEventKey(event: Event): string {
  const key = readObjectProperty(event, 'key');
  return typeof key === 'string' ? key : '';
}

export function stopReserveNativeEvent(event: Event): void {
  event.preventDefault();
  event.stopImmediatePropagation();
}

export function clickReserveElement(element: Element): void {
  const click = readObjectProperty(element, 'click');
  if (typeof click === 'function') {
    Reflect.apply(click, element, []);
  }
}
