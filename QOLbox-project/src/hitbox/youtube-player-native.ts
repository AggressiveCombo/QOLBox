import { readObjectProperty } from '../utils/object-properties';

export type NativeCallable = (...args: unknown[]) => unknown;

export interface ConstructableCallable {
  new (...args: unknown[]): unknown;
  (...args: unknown[]): unknown;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function isNativeCallable(value: unknown): value is NativeCallable {
  return typeof value === 'function';
}

export function isConstructableCallable(value: unknown): value is ConstructableCallable {
  return typeof value === 'function';
}

export function readBooleanProperty(source: unknown, property: PropertyKey): boolean {
  return readObjectProperty(source, property) === true;
}
