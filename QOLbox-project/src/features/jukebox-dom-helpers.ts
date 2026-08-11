import { isCallable, readObjectProperty } from '../utils/object-properties';

export type JukeboxStyleDatasetElement = Element & {
  dataset: DOMStringMap;
  style: CSSStyleDeclaration;
};

export function readJukeboxNumberProperty(source: unknown, property: PropertyKey): number {
  const value = readObjectProperty(source, property);
  return typeof value === 'number' ? value : Number(value);
}

export function readJukeboxBooleanProperty(source: unknown, property: PropertyKey): boolean {
  return readObjectProperty(source, property) === true;
}

export function isJukeboxStyleDatasetElement(value: unknown): value is JukeboxStyleDatasetElement {
  return (
    value instanceof Element &&
    typeof readObjectProperty(value, 'dataset') === 'object' &&
    typeof readObjectProperty(value, 'style') === 'object'
  );
}

export function requestJukeboxPointerCapture(knob: Element, event: unknown): void {
  const setPointerCapture = readObjectProperty(knob, 'setPointerCapture');
  const pointerId = readObjectProperty(event, 'pointerId');
  if (!isCallable(setPointerCapture) || pointerId === undefined) {
    return;
  }

  try {
    Reflect.apply(setPointerCapture, knob, [pointerId]);
  } catch {
    // Pointer capture is best effort; drag still works through global listeners.
  }
}
