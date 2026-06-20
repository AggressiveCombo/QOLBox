import { keepOutOfBrowserTabOrder } from '../dom/dom-helpers';
import { isStyledElement } from '../dom/element-guards';
import {
  canBlur,
  getActiveChatInputElement,
  hasEditableChatValue,
  isChatInputElement,
  isLobbyChatInputElement,
} from './chat-input-elements';
import { isEnterKey, isEscapeKey } from './chat-keyboard-events';
export { isEscapeKey, isTabKey } from './chat-keyboard-events';

interface ChatInputControlOptions {
  chatInputSelector: string;
  lobbyChatInputSelector: string;
  desktopLobbyChatPrompt: string;
  touchLobbyChatPrompt: string;
  isChatFeatureEnabled(): boolean;
  areLobbyCommandsEnabled(): boolean;
  isTouchLobbyChatPrompt(): boolean;
  focusActiveRenderCanvas(): void;
  expandNativeChatAlias(value: string): string;
}

export function createChatInputController(options: ChatInputControlOptions) {
  let escapeHooksInstalled = false;
  let commandAliasHooksInstalled = false;
  let suppressEscapeKeyUntil = 0;

  function isChatInput(element: unknown): element is Element {
    return isChatInputElement(element, options.chatInputSelector);
  }

  function isLobbyChatInput(element: unknown): element is Element {
    return isLobbyChatInputElement(element, options.lobbyChatInputSelector);
  }

  function getActiveChatInput(target: unknown = document.activeElement): Element | null {
    return getActiveChatInputElement(target, options.chatInputSelector);
  }

  function restoreLobbyChatPrompt(input: unknown): void {
    if (!isLobbyChatInput(input)) {
      return;
    }

    const chatBox = input.closest('.lobbyContainer .chatBox');
    const instruction = chatBox ? chatBox.querySelector<HTMLElement>('.lowerInstruction') : null;
    if (instruction) {
      instruction.style.visibility = 'inherit';

      if (!(instruction.textContent || '').trim()) {
        instruction.textContent = options.isTouchLobbyChatPrompt()
          ? options.touchLobbyChatPrompt
          : options.desktopLobbyChatPrompt;
      }
    }

    if (!options.isTouchLobbyChatPrompt() && isStyledElement(input)) {
      input.style.pointerEvents = 'none';
    }
  }

  function closeChatInput(input: unknown): boolean {
    if (!options.isChatFeatureEnabled() || !isChatInput(input) || !hasEditableChatValue(input) || !canBlur(input)) {
      return false;
    }

    const closingLobbyChat = isLobbyChatInput(input);
    input.value = '';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.blur();
    input.classList.remove('bgActive');

    if (closingLobbyChat) {
      restoreLobbyChatPrompt(input);
    } else {
      options.focusActiveRenderCanvas();
    }

    return true;
  }

  function handleChatEscape(event: Event): void {
    if (!options.isChatFeatureEnabled() || !isEscapeKey(event)) {
      return;
    }

    const input = getActiveChatInput(event.target);
    const suppressingKeyup = event.type === 'keyup' && Date.now() < suppressEscapeKeyUntil;
    if (!input && !suppressingKeyup) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    if (event.type === 'keydown' && input) {
      suppressEscapeKeyUntil = Date.now() + 500;
      closeChatInput(input);
    }
  }

  function installChatEscapeHooks(): void {
    if (escapeHooksInstalled) {
      return;
    }

    escapeHooksInstalled = true;
    window.addEventListener('keydown', handleChatEscape, true);
    window.addEventListener('keyup', handleChatEscape, true);
    document.addEventListener('keydown', handleChatEscape, true);
    document.addEventListener('keyup', handleChatEscape, true);
  }

  function handleChatCommandAliasKeydown(event: KeyboardEvent): void {
    if (!options.areLobbyCommandsEnabled() || !isEnterKey(event)) {
      return;
    }

    const input = event.target;
    if (!isChatInput(input)) {
      return;
    }

    if (hasEditableChatValue(input)) {
      input.value = options.expandNativeChatAlias(input.value);
    }
  }

  function installChatCommandAliasHooks(): void {
    if (commandAliasHooksInstalled) {
      return;
    }

    commandAliasHooksInstalled = true;
    document.addEventListener('keydown', handleChatCommandAliasKeydown, true);
  }

  function patchChatTabOrder(): void {
    if (!options.isChatFeatureEnabled()) {
      return;
    }

    if (!document.querySelector('.inGameChat, .lobbyContainer')) {
      return;
    }

    // Browser Tab focus bypasses the game's native chat-open path; Enter still focuses chat normally.
    for (const input of document.querySelectorAll(options.chatInputSelector)) {
      keepOutOfBrowserTabOrder(input);
    }
  }

  return {
    closeChatInput,
    getActiveChatInput,
    installChatCommandAliasHooks,
    installChatEscapeHooks,
    isChatInput,
    patchChatTabOrder,
    restoreLobbyChatPrompt,
  };
}
