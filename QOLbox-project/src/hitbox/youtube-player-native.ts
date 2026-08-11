import { isCallable as isNativeCallable, isRecord, readObjectProperty } from '../utils/object-properties';

export { isNativeCallable, isRecord };

export type NativeCallable = (...args: unknown[]) => unknown;

export interface ConstructableCallable {
  new (...args: unknown[]): unknown;
  (...args: unknown[]): unknown;
}

export function isConstructableCallable(value: unknown): value is ConstructableCallable {
  return typeof value === 'function';
}

export function readBooleanProperty(source: unknown, property: PropertyKey): boolean {
  return readObjectProperty(source, property) === true;
}
