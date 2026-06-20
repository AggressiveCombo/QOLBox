export function getChatGlobalStyleText(): string {
  return `
      html.qolbox-feature-chat .inGameChat {
        pointer-events: none;
      }

      html.qolbox-feature-chat .inGameChat.qolboxChatInteractive {
        pointer-events: auto;
      }

      html.qolbox-feature-chat .inGameChat .input {
        pointer-events: none;
      }

      html.qolbox-feature-chat .inGameChat .input:focus,
      html.qolbox-feature-chat .inGameChat .input.bgActive {
        pointer-events: auto;
      }

      html.qolbox-feature-chat .inGameChat:hover,
      html.qolbox-feature-chat .inGameChat.qolboxChatReading {
        opacity: 1 !important;
      }

      html.qolbox-feature-chat .inGameChat.qolboxChatReading {
        overflow: hidden !important;
        overscroll-behavior: contain;
      }
    `;
}
