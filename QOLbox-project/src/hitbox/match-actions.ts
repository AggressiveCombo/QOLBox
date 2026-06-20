import { callNativeMethod, hasNativeMethod } from './native-access';

export function canEndMatch(session: unknown): boolean {
  return hasNativeMethod(session, 'PJ');
}

export function endMatch(session: unknown): boolean {
  return callNativeMethod(session, 'PJ').called;
}

export function canStartMatch(session: unknown): boolean {
  return hasNativeMethod(session, '_J');
}

export function startMatch(session: unknown): boolean {
  // `_J` is the observed native START action invoked by the game's own lobby control.
  return callNativeMethod(session, '_J').called;
}
