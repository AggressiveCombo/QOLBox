import { isNativeObject, readNativeProperty, setNativeReflectProperty } from './native-access';

type NativeCallable = (...args: unknown[]) => unknown;

function isNativeCallable(value: unknown): value is NativeCallable {
  return typeof value === 'function';
}

function getNativeLobbyUi(session: unknown): unknown | null {
  // `TJ` is the observed native lobby UI object; `$W` fires when a lobby-chat typing pulse is seen.
  const lobbyUi = readNativeProperty(session, 'TJ');
  return isNativeObject(lobbyUi) ? lobbyUi : null;
}

export function isNativeTypingPulseHookInstalled(session: unknown): boolean {
  return Boolean(readNativeProperty(getNativeLobbyUi(session), '__qolboxTypingIndicatorPatched'));
}

export function installNativeTypingPulseHook(
  session: unknown,
  onTypingPulse: (playerId: unknown) => void
): boolean {
  const lobbyUi = getNativeLobbyUi(session);
  if (!lobbyUi || isNativeTypingPulseHookInstalled(session)) {
    return Boolean(lobbyUi);
  }

  const nativeTypingPulse = readNativeProperty(lobbyUi, '$W');
  if (!isNativeCallable(nativeTypingPulse)) {
    return false;
  }

  const wrappedTypingPulse = function wrappedTypingPulse(this: unknown, playerId: unknown, ...rest: unknown[]): unknown {
    onTypingPulse(playerId);
    return Reflect.apply(nativeTypingPulse, this, [playerId, ...rest]);
  };

  setNativeReflectProperty(lobbyUi, '$W', wrappedTypingPulse);
  setNativeReflectProperty(lobbyUi, '__qolboxTypingIndicatorOriginal', nativeTypingPulse);
  setNativeReflectProperty(lobbyUi, '__qolboxTypingIndicatorPatched', true);
  return true;
}
