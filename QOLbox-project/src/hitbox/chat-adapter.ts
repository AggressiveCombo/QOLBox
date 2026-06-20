import { callNativeMethod, hasNativeMethod } from './native-access';

export function canWriteChatLine(session: unknown): boolean {
  return hasNativeMethod(session, 'vG');
}

export function writeChatLine(session: unknown, line: string): boolean {
  return callNativeMethod(session, 'vG', [line]).called;
}
