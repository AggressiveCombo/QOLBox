import {
  isNativeObject,
  readNativeProperty,
  setNativeReflectProperty,
} from './native-access';

type NativeCallable = (...args: unknown[]) => unknown;

const PLAYER_JOIN_HOOK_MARKER = '__qolboxPlayerJoinHookInstalled';

export function installPlayerJoinHook(
  session: unknown,
  onPlayerJoined: (session: unknown) => void
): boolean {
  if (!isNativeObject(session) || readNativeProperty(session, PLAYER_JOIN_HOOK_MARKER)) {
    return false;
  }

  const nativePlayerJoined = readNativeProperty(session, 'VW');
  if (typeof nativePlayerJoined !== 'function') {
    return false;
  }

  const wrappedPlayerJoined: NativeCallable = function wrappedQolboxPlayerJoined(
    this: unknown,
    ...args: unknown[]
  ): unknown {
    const result = Reflect.apply(nativePlayerJoined, this, args);
    window.setTimeout(() => onPlayerJoined(this), 0);
    return result;
  };

  setNativeReflectProperty(session, 'VW', wrappedPlayerJoined);
  setNativeReflectProperty(session, PLAYER_JOIN_HOOK_MARKER, true);
  return true;
}
