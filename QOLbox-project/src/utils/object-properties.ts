export function isReflectableObject(value: unknown): value is object {
  return (typeof value === 'object' && value !== null) || typeof value === 'function';
}

export function readObjectProperty(source: unknown, property: PropertyKey): unknown {
  return isReflectableObject(source) ? Reflect.get(source, property) : undefined;
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
