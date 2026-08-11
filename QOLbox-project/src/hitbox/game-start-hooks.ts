import {
  isNativeObject,
  readNativeProperty,
  readNativeReflectProperty,
  replaceNativeReflectProperty,
  setNativeReflectProperty,
} from './native-access';
import { isCallable } from '../utils/object-properties';
import { HITBOX_NATIVE } from './native-contract';

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

const REMOTE_START_METHODS: readonly string[] = HITBOX_NATIVE.session.remoteGameStart;
const LOCAL_START_METHOD = HITBOX_NATIVE.session.localGameStart;

function isWrappedGameStartMethod(method: unknown): boolean {
  return isCallable(method) && readNativeReflectProperty(method, '__qolboxWrapped') === true;
}

function markWrappedGameStartMethod(method: NativeCallable, originalMethod: NativeCallable): void {
  setNativeReflectProperty(method, '__qolboxWrapped', true);
  setNativeReflectProperty(method, '__qolboxOriginal', originalMethod);
}

export function areGameStartSessionHooksInstalled(session: unknown): boolean {
  return [...REMOTE_START_METHODS, LOCAL_START_METHOD].every(methodName => {
    const method = readNativeProperty(session, methodName);
    return !isCallable(method) || isWrappedGameStartMethod(method);
  });
}

export function installGameStartSessionHooks(session: unknown, callbacks: GameStartHookCallbacks): boolean {
  if (!isNativeObject(session)) {
    return false;
  }

  let hookInstalled = false;

  // Current hitbox.io game-start handlers observed in the live bundle.
  for (const methodName of REMOTE_START_METHODS) {
    const originalMethod = readNativeProperty(session, methodName);
    if (!isCallable(originalMethod)) {
      continue;
    }

    if (isWrappedGameStartMethod(originalMethod)) {
      hookInstalled = true;
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
    hookInstalled = replaceNativeReflectProperty(session, methodName, wrappedMethod) || hookInstalled;
  }

  const originalStartRequest = readNativeProperty(session, LOCAL_START_METHOD);
  if (isCallable(originalStartRequest) && !isWrappedGameStartMethod(originalStartRequest)) {
    const wrappedStartRequest = function wrappedLocalGameStartRequest(this: unknown, ...args: unknown[]): unknown {
      callbacks.noteLocalStartRequest(this);
      return Reflect.apply(originalStartRequest, this, args);
    };

    markWrappedGameStartMethod(wrappedStartRequest, originalStartRequest);
    hookInstalled = replaceNativeReflectProperty(session, LOCAL_START_METHOD, wrappedStartRequest) || hookInstalled;
  }

  return hookInstalled;
}
