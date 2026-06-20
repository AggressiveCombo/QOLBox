import { installNativeChatSendInterceptor } from '../hitbox/chat-send-adapter';
import { areAdvancedCommandAliasesEnabled } from '../settings/advanced-settings';

interface SlashCommandDependencies {
  areCommandsEnabled(): boolean;
  handleCommand(message: unknown): boolean;
  prepareNativeCommand?(message: unknown): unknown | null;
  showHelp(session: unknown): void;
}

export function expandNativeChatAlias(message: string): string;
export function expandNativeChatAlias(message: unknown): unknown;
export function expandNativeChatAlias(message: unknown): unknown {
  if (typeof message !== 'string' || !areAdvancedCommandAliasesEnabled()) {
    return message;
  }

  return message.replace(/^(\s*)\/rec(?=\s|$)/i, '$1/record');
}

export function installSlashCommandInterceptor(session: unknown, dependencies: SlashCommandDependencies): boolean {
  return installNativeChatSendInterceptor(session, {
    handleSend(nativeChat) {
      if (dependencies.areCommandsEnabled() && dependencies.handleCommand(nativeChat.message)) {
        return undefined;
      }

      const commandsEnabled = dependencies.areCommandsEnabled();
      let nextMessage = commandsEnabled ? expandNativeChatAlias(nativeChat.message) : nativeChat.message;
      if (commandsEnabled && dependencies.prepareNativeCommand) {
        const preparedMessage = dependencies.prepareNativeCommand(nextMessage);
        if (preparedMessage === null) {
          return undefined;
        }
        nextMessage = preparedMessage;
      }
      const isNativeHelp = commandsEnabled && /^\/help\s*$/.test(String(nextMessage || '').trim());
      const result = isNativeHelp
        ? nativeChat.sendNativeChatWithSettingsHelpCorrection(nextMessage)
        : nativeChat.sendNativeChat(nextMessage);

      if (isNativeHelp) {
        dependencies.showHelp(nativeChat.session);
      }

      return result;
    },
  });
}
