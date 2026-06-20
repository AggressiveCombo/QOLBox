import {
  isNativeObject,
  readNativeProperty,
  readNativeReflectProperty,
  setNativeReflectProperty,
} from './native-access';

type NativeCallable = (...args: unknown[]) => unknown;

interface GameStartSnapshot {
  wasPlayableLobby: boolean;
  wasPlayingMatch: boolean;
}

interface GameStartHookCallbacks {
  captureStartState(): GameStartSnapshot;
  handleStartAfterNativeEvent(snapshot: GameStartSnapshot, session: unknown): void;
  noteLocalStartRequest(session: unknown): void;
}

const REMOTE_START_METHODS: readonly string[] = ['KJ', 'ZJ'];
const LOCAL_START_METHOD = '_J';

function isNativeCallable(value: unknown): value is NativeCallable {
  return typeof value === 'function';
}

function isWrappedGameStartMethod(method: unknown): boolean {
  return isNativeCallable(method) && readNativeReflectProperty(method, '__qolboxWrapped') === true;
}

function markWrappedGameStartMethod(method: NativeCallable, originalMethod: NativeCallable): void {
  setNativeReflectProperty(method, '__qolboxWrapped', true);
  setNativeReflectProperty(method, '__qolboxOriginal', originalMethod);
}

export function areGameStartSessionHooksInstalled(session: unknown): boolean {
  return [...REMOTE_START_METHODS, LOCAL_START_METHOD].every(methodName => {
    const method = readNativeProperty(session, methodName);
    return !isNativeCallable(method) || isWrappedGameStartMethod(method);
  });
}

export function installGameStartSessionHooks(session: unknown, callbacks: GameStartHookCallbacks): boolean {
  if (!isNativeObject(session)) {
    return false;
  }

  let foundRemoteStartHandler = false;

  // Current hitbox.io game-start handlers observed in the live bundle.
  for (const methodName of REMOTE_START_METHODS) {
    const originalMethod = readNativeProperty(session, methodName);
    if (!isNativeCallable(originalMethod)) {
      continue;
    }

    foundRemoteStartHandler = true;

    if (isWrappedGameStartMethod(originalMethod)) {
      continue;
    }

    const wrappedMethod = function wrappedGameStartSessionMethod(this: unknown, ...args: unknown[]): unknown {
      const snapshot = callbacks.captureStartState();
      let result: unknown;

      try {
        result = Reflect.apply(originalMethod, this, args);
      } finally {
        callbacks.handleStartAfterNativeEvent(snapshot, this);
      }

      return result;
    };

    markWrappedGameStartMethod(wrappedMethod, originalMethod);
    setNativeReflectProperty(session, methodName, wrappedMethod);
  }

  const originalStartRequest = readNativeProperty(session, LOCAL_START_METHOD);
  if (isNativeCallable(originalStartRequest) && !isWrappedGameStartMethod(originalStartRequest)) {
    const wrappedStartRequest = function wrappedLocalGameStartRequest(this: unknown, ...args: unknown[]): unknown {
      callbacks.noteLocalStartRequest(this);
      return Reflect.apply(originalStartRequest, this, args);
    };

    markWrappedGameStartMethod(wrappedStartRequest, originalStartRequest);
    setNativeReflectProperty(session, LOCAL_START_METHOD, wrappedStartRequest);
  }

  const startRequest = readNativeProperty(session, LOCAL_START_METHOD);
  return foundRemoteStartHandler || (isNativeCallable(startRequest) && isWrappedGameStartMethod(startRequest));
}
