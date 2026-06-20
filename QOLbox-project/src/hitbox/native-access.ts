export type NativeObject = object;
export type NativeReflectTarget = object;

export function isNativeObject(value: unknown): value is NativeObject {
  return typeof value === 'object' && value !== null;
}

export function isNativeReflectTarget(value: unknown): value is NativeReflectTarget {
  return isNativeObject(value) || typeof value === 'function';
}

export function readNativeProperty(source: unknown, property: PropertyKey): unknown {
  return isNativeObject(source) ? Reflect.get(source, property) : undefined;
}

export function readNativeReflectProperty(source: unknown, property: PropertyKey): unknown {
  return isNativeReflectTarget(source) ? Reflect.get(source, property) : undefined;
}

export function setNativeReflectProperty(source: unknown, property: PropertyKey, value: unknown): boolean {
  return isNativeReflectTarget(source) && Reflect.set(source, property, value);
}

export function readNativePath(source: unknown, path: readonly PropertyKey[]): unknown {
  let current = source;
  for (const property of path) {
    current = readNativeProperty(current, property);
    if (current === undefined || current === null) {
      return current;
    }
  }
  return current;
}

export function hasNativeMethod(source: unknown, methodName: PropertyKey): boolean {
  return typeof readNativeProperty(source, methodName) === 'function';
}

export function callNativeMethod(
  source: unknown,
  methodName: PropertyKey,
  args: readonly unknown[] = []
): { called: boolean; result: unknown } {
  const method = readNativeProperty(source, methodName);
  if (!isNativeObject(source) || typeof method !== 'function') {
    return { called: false, result: undefined };
  }

  return { called: true, result: Reflect.apply(method, source, [...args]) };
}
