import { readObjectProperty, setObjectProperty } from '../utils/object-properties';

type NativeCallable = (...args: unknown[]) => unknown;

export type JukeboxStyleDatasetElement = Element & {
  dataset: DOMStringMap;
  style: CSSStyleDeclaration;
};

export function readJukeboxProperty(source: unknown, property: PropertyKey): unknown {
  return readObjectProperty(source, property);
}

export function setJukeboxProperty(source: unknown, property: PropertyKey, value: unknown): boolean {
  return setObjectProperty(source, property, value);
}

export function readJukeboxNumberProperty(source: unknown, property: PropertyKey): number {
  const value = readJukeboxProperty(source, property);
  return typeof value === 'number' ? value : Number(value);
}

export function readJukeboxBooleanProperty(source: unknown, property: PropertyKey): boolean {
  return readJukeboxProperty(source, property) === true;
}

function isNativeCallable(value: unknown): value is NativeCallable {
  return typeof value === 'function';
}

export function isJukeboxStyleDatasetElement(value: unknown): value is JukeboxStyleDatasetElement {
  return (
    value instanceof Element &&
    typeof readJukeboxProperty(value, 'dataset') === 'object' &&
    typeof readJukeboxProperty(value, 'style') === 'object'
  );
}

export function requestJukeboxPointerCapture(knob: Element, event: unknown): void {
  const setPointerCapture = readJukeboxProperty(knob, 'setPointerCapture');
  const pointerId = readJukeboxProperty(event, 'pointerId');
  if (!isNativeCallable(setPointerCapture) || pointerId === undefined) {
    return;
  }

  try {
    Reflect.apply(setPointerCapture, knob, [pointerId]);
  } catch {
    // Pointer capture is best effort; drag still works through global listeners.
  }
}
