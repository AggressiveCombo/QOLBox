import { readNativeReflectProperty, setNativeReflectProperty } from './native-access';

export type NativeReserveCallable = (...args: unknown[]) => unknown;

interface ReserveSocketEmitPatchOptions {
  onJoin(socket: unknown, eventName: unknown, args: readonly unknown[]): void;
  originalEmitKey: string;
  shouldCaptureJoin(args: readonly unknown[]): boolean;
}

export function isNativeReserveCallable(value: unknown): value is NativeReserveCallable {
  return typeof value === 'function';
}

export function patchReserveSocketEmitTarget(target: unknown, options: ReserveSocketEmitPatchOptions): boolean {
  if (!target) {
    return false;
  }

  const nativeEmit = readNativeReflectProperty(target, 'emit');
  if (readNativeReflectProperty(target, '__qolboxReservePatched') || !isNativeReserveCallable(nativeEmit)) {
    return false;
  }

  const baseEmit: NativeReserveCallable = nativeEmit;

  function wrappedReserveEmit(this: unknown, eventName: unknown, ...args: unknown[]): unknown {
    if (options.shouldCaptureJoin(args)) {
      options.onJoin(this, eventName, args);
    }

    return Reflect.apply(baseEmit, this, [eventName, ...args]);
  }

  setNativeReflectProperty(target, 'emit', wrappedReserveEmit);
  setNativeReflectProperty(target, '__qolboxReservePatched', true);
  setNativeReflectProperty(target, options.originalEmitKey, baseEmit);
  return true;
}
