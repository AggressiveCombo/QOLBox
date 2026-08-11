export type Callable = (...args: unknown[]) => unknown;

export function isCallable(value: unknown): value is Callable {
  return typeof value === 'function';
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isReflectableObject(value: unknown): value is object {
  return (typeof value === 'object' && value !== null) || typeof value === 'function';
}

export function readObjectProperty(source: unknown, property: PropertyKey): unknown {
  if (!isReflectableObject(source)) {
    return undefined;
  }

  try {
    return Reflect.get(source, property);
  } catch {
    return undefined;
  }
}

export function setObjectProperty(source: unknown, property: PropertyKey, value: unknown): boolean {
  if (!isReflectableObject(source)) {
    return false;
  }

  try {
    return Reflect.set(source, property, value);
  } catch {
    return false;
  }
}
