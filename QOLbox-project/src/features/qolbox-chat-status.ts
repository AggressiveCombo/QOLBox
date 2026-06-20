import { writeChatLine } from '../hitbox/chat-adapter';

interface QolboxChatStatusOptions {
  getSession(): unknown;
}

export function createQolboxChatStatusWriter(options: QolboxChatStatusOptions) {
  function showQolboxChatStatus(message: string, session: unknown = options.getSession()): void {
    writeChatLine(session, `* ${message}`);
  }

  return {
    showQolboxChatStatus,
  };
}
