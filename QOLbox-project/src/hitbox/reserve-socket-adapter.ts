import {
  readNativeProperty,
  readNativeReflectProperty,
  replaceNativeReflectProperty,
  setNativeReflectProperty,
} from './native-access';
import {
  isNativeReserveCallable,
  type NativeReserveCallable,
  patchReserveSocketEmitTarget,
} from './reserve-socket-emit-patcher';

interface ReserveSocketCaptureHookOptions {
  onJoin(socket: unknown, eventName: unknown, args: readonly unknown[]): void;
  shouldCaptureJoin(args: readonly unknown[]): boolean;
}

interface ReserveSocketJoinAttempt {
  args: readonly unknown[];
  eventName: unknown;
  socket: unknown;
}

interface ReserveSocketJoinAttemptOptions {
  beforeEmit(): void;
  cloneValue(value: unknown): unknown;
}

export function emitReserveSocketJoinAttempt(
  attempt: ReserveSocketJoinAttempt | null,
  options: ReserveSocketJoinAttemptOptions
): boolean {
  const emit = readNativeProperty(attempt?.socket, 'emit');
  if (!attempt || !isNativeReserveCallable(emit)) {
    return false;
  }

  const connect = readNativeProperty(attempt.socket, 'connect');
  if (!readNativeProperty(attempt.socket, 'connected') && isNativeReserveCallable(connect)) {
    try {
      Reflect.apply(connect, attempt.socket, []);
    } catch {
      return false;
    }
  }

  try {
    options.beforeEmit();
    Reflect.apply(emit, attempt.socket, [attempt.eventName, ...attempt.args.map(options.cloneValue)]);
    return true;
  } catch {
    return false;
  }
}

export function createReserveSocketCaptureHook(options: ReserveSocketCaptureHookOptions) {
  let socketHookInstalled = false;

  function patchSocket(socket: unknown): unknown {
    patchReserveSocketEmitTarget(socket, {
      onJoin: options.onJoin,
      originalEmitKey: '__qolboxReserveOriginalEmit',
      shouldCaptureJoin: options.shouldCaptureJoin,
    });
    return socket;
  }

  function patchSocketPrototype(ioFactory: unknown): void {
    const prototype = readNativeReflectProperty(readNativeReflectProperty(ioFactory, 'Socket'), 'prototype');
    if (!prototype) {
      return;
    }

    patchReserveSocketEmitTarget(prototype, {
      onJoin: options.onJoin,
      originalEmitKey: '__qolboxReserveOriginalEmit',
      shouldCaptureJoin: options.shouldCaptureJoin,
    });
  }

  function patchIo(ioFactory: unknown): unknown {
    if (!isNativeReserveCallable(ioFactory) || readNativeReflectProperty(ioFactory, '__qolboxReservePatched')) {
      patchSocketPrototype(ioFactory);
      return ioFactory;
    }
    const baseIoFactory: NativeReserveCallable = ioFactory;

    function wrappedReserveIo(this: unknown, ...args: unknown[]): unknown {
      return patchSocket(Reflect.apply(baseIoFactory, this, args));
    }

    try {
      Object.setPrototypeOf(wrappedReserveIo, Object.getPrototypeOf(baseIoFactory));
    } catch {
      // Some native-like function objects reject prototype changes.
    }

    for (const key of Reflect.ownKeys(baseIoFactory)) {
      try {
        setNativeReflectProperty(wrappedReserveIo, key, readNativeReflectProperty(baseIoFactory, key));
      } catch {
        // Some function properties are read-only in older browsers.
      }
    }

    setNativeReflectProperty(wrappedReserveIo, '__qolboxReservePatched', true);
    setNativeReflectProperty(wrappedReserveIo, '__qolboxReserveOriginal', baseIoFactory);
    patchSocketPrototype(wrappedReserveIo);
    return wrappedReserveIo;
  }

  function installReserveSocketCaptureHook(): void {
    if (socketHookInstalled) {
      return;
    }

    try {
      let ioValue = readNativeReflectProperty(window, 'io');
      Object.defineProperty(window, 'io', {
        configurable: true,
        enumerable: true,
        get() {
          return ioValue;
        },
        set(value: unknown) {
          ioValue = patchIo(value);
        },
      });

      if (ioValue) {
        setNativeReflectProperty(window, 'io', ioValue);
      }
      socketHookInstalled = true;
    } catch {
      const ioValue = readNativeReflectProperty(window, 'io');
      if (ioValue) {
        socketHookInstalled = replaceNativeReflectProperty(window, 'io', patchIo(ioValue));
      }
    }
  }

  return {
    installReserveSocketCaptureHook,
  };
}
