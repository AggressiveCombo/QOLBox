import { isNativeObject, readNativeProperty, setNativeReflectProperty } from './native-access';

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

function isNativeCallable(value: unknown): value is NativeCallable {
  return typeof value === 'function';
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
  const nativeShowStatus = readNativeProperty(session, 'vG');
  if (!isNativeObject(session) || !isNativeCallable(nativeShowStatus)) {
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

  const nativeSendChat = readNativeProperty(session, 'CJ');
  if (!isNativeCallable(nativeSendChat) || readNativeProperty(session, '__qolboxSlashCommandsPatched')) {
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

  setNativeReflectProperty(session, 'CJ', wrappedSendChat);
  setNativeReflectProperty(session, '__qolboxSlashCommandsPatched', true);
  setNativeReflectProperty(session, '__qolboxSlashCommandsOriginalCJ', nativeSendChat);
  return true;
}
