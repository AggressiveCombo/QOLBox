import {
  isNativeObject,
  readNativeProperty,
  replaceNativeReflectProperty,
  setNativeReflectProperty,
} from './native-access';
import { isCallable } from '../utils/object-properties';
import { HITBOX_NATIVE } from './native-contract';

type NativeCallable = (...args: unknown[]) => unknown;

export interface NativeChatSendContext {
  message: unknown;
  rest: readonly unknown[];
  session: unknown;
  sendNativeChat(message: unknown): unknown;
  sendNativeChatWithSettingsHelpCorrection(message: unknown): unknown;
}

interface NativeChatSendOptions {
  handleSend(context: NativeChatSendContext): unknown;
}

function getAccurateNativeHelpText(text: unknown): unknown {
  return text === '/settings -- view all gameplay commands'
    ? '/settings -- view normal gameplay settings'
    : text;
}

function callNativeChatSend(
  nativeSendChat: NativeCallable,
  session: unknown,
  message: unknown,
  rest: readonly unknown[]
): unknown {
  return Reflect.apply(nativeSendChat, session, [message, ...rest]);
}

function callNativeChatSendWithSettingsHelpCorrection(
  nativeSendChat: NativeCallable,
  session: unknown,
  message: unknown,
  rest: readonly unknown[]
): unknown {
  const nativeShowStatus = readNativeProperty(session, HITBOX_NATIVE.session.showStatus);
  if (!isNativeObject(session) || !isCallable(nativeShowStatus)) {
    return callNativeChatSend(nativeSendChat, session, message, rest);
  }

  // Vanilla `/help` writes rows synchronously through `vG`; replace only its inaccurate settings row.
  const accurateShowStatus = function showAccurateNativeSettingsHelp(
    this: unknown,
    text: unknown,
    ...statusRest: unknown[]
  ): unknown {
    return Reflect.apply(nativeShowStatus, this, [getAccurateNativeHelpText(text), ...statusRest]);
  };

  setNativeReflectProperty(session, 'vG', accurateShowStatus);
  try {
    return callNativeChatSend(nativeSendChat, session, message, rest);
  } finally {
    setNativeReflectProperty(session, 'vG', nativeShowStatus);
  }
}

export function installNativeChatSendInterceptor(session: unknown, options: NativeChatSendOptions): boolean {
  if (!isNativeObject(session)) {
    return false;
  }

  const nativeSendChat = readNativeProperty(session, HITBOX_NATIVE.session.chatSend);
  if (!isCallable(nativeSendChat) || readNativeProperty(session, '__qolboxSlashCommandsPatched')) {
    return false;
  }

  const wrappedSendChat = function wrappedQolboxSlashCommand(this: unknown, message: unknown, ...rest: unknown[]): unknown {
    return options.handleSend({
      message,
      rest,
      session: this,
      sendNativeChat: nextMessage => callNativeChatSend(nativeSendChat, this, nextMessage, rest),
      sendNativeChatWithSettingsHelpCorrection: nextMessage =>
        callNativeChatSendWithSettingsHelpCorrection(nativeSendChat, this, nextMessage, rest),
    });
  };

  if (!replaceNativeReflectProperty(session, HITBOX_NATIVE.session.chatSend, wrappedSendChat)) {
    return false;
  }
  setNativeReflectProperty(session, '__qolboxSlashCommandsPatched', true);
  setNativeReflectProperty(session, '__qolboxSlashCommandsOriginalCJ', nativeSendChat);
  return true;
}
