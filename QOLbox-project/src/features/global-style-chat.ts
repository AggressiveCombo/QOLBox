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

      html.qolbox-feature-chat .inGameChat .content div:not(:has(> .name)) > .message {
        color: rgb(112, 169, 255);
      }

      html.qolbox-feature-chat .inGameChat .content div:has(> .message.link) > .message:not(.link) {
        color: #dfa032;
      }

      html.qolbox-feature-chat .inGameChat .content .qolboxInGameJukeboxTitle {
        font-style: italic;
      }

      html.qolbox-feature-chat .inGameChat .content .message.link {
        color: rgb(112, 169, 255);
        font-weight: 700;
        text-decoration: underline;
      }

      .qolboxChatCommandGhost {
        align-items: center;
        --qolbox-chat-command: #79bdff;
        --qolbox-chat-command-argument: #f2cd83;
        --qolbox-chat-command-suggestion: #b9c4d2;
        display: flex;
        overflow: hidden;
        pointer-events: none;
        position: absolute;
        white-space: pre;
        z-index: 1;
      }

      html:not(.qolbox-feature-lobbyCommands) .qolboxChatCommandGhost {
        display: none;
      }

      .qolboxChatCommandRichInput {
        caret-color: var(--qolbox-ui-text, #ebebeb);
        color: transparent !important;
      }

      .qolboxChatCommandName {
        color: var(--qolbox-chat-command);
      }

      .qolboxChatCommandArgument {
        color: var(--qolbox-chat-command-argument);
      }

      .qolboxChatCommandSuggestion {
        color: var(--qolbox-chat-command-suggestion);
      }

      html[data-qolbox-color-scheme="light"] .lobbyContainer .chatBox .input {
        color: var(--qolbox-ui-text, #171a1f) !important;
      }

      html[data-qolbox-color-scheme="light"] .lobbyContainer .qolboxChatCommandGhost {
        --qolbox-chat-command: #005ea8;
        --qolbox-chat-command-argument: #6b4d00;
        --qolbox-chat-command-suggestion: #596775;
      }
    `;
}
