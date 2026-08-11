import { keepOutOfBrowserTabOrder } from '../dom/dom-helpers';
import { isStyledElement } from '../dom/element-guards';
import {
  canBlur,
  getActiveChatInputElement,
  hasEditableChatValue,
  isChatInputElement,
} from './chat-input-elements';
import { isEnterKey, isEscapeKey } from './chat-keyboard-events';
import { getChatCommandCompletions, isKnownChatCommand } from './chat-command-completions';
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
  let completionIndex = 0;
  let completionInput: HTMLInputElement | null = null;
  let completionValue = '';
  let completionGhost: HTMLElement | null = null;
  const originalTabIndexByInput = new Map<Element, string | null>();

  function hideCommandCompletion(): void {
    completionGhost?.remove();
    completionInput?.classList.remove('qolboxChatCommandRichInput');
    completionGhost = null;
    completionInput = null;
    completionValue = '';
    completionIndex = 0;
  }

  function appendCommandPart(
    host: HTMLElement,
    text: string,
    start: number,
    end: number,
    typedLength: number,
    className: string
  ): void {
    const typedEnd = Math.min(end, Math.max(start, typedLength));
    if (typedEnd > start) {
      const entered = document.createElement('span');
      entered.className = className;
      entered.textContent = text.slice(start, typedEnd);
      host.append(entered);
    }
    if (end > typedEnd) {
      const suggestion = document.createElement('span');
      suggestion.className = `${className} qolboxChatCommandSuggestion qolboxChatCommandSuffix`;
      suggestion.textContent = text.slice(typedEnd, end);
      host.append(suggestion);
    }
  }

  function renderCommandText(host: HTMLElement, text: string, typedLength: number): void {
    const commandStart = text.search(/\S/);
    const commandEnd = text.indexOf(' ', Math.max(0, commandStart));
    if (commandStart > 0) host.append(document.createTextNode(text.slice(0, commandStart)));
    const split = commandEnd < 0 ? text.length : commandEnd;
    appendCommandPart(host, text, Math.max(0, commandStart), split, typedLength, 'qolboxChatCommandName');
    appendCommandPart(host, text, split, text.length, typedLength, 'qolboxChatCommandArgument');
  }

  function syncCommandCompletion(input: HTMLInputElement, keepIndex = false): void {
    if (!options.areLobbyCommandsEnabled() || document.activeElement !== input ||
      input.selectionStart !== input.value.length || input.selectionEnd !== input.value.length) {
      hideCommandCompletion();
      return;
    }
    const completions = getChatCommandCompletions(input.value);
    if (!completions.length && !isKnownChatCommand(input.value)) {
      hideCommandCompletion();
      return;
    }
    if (!keepIndex || completionInput !== input || completionValue !== input.value) completionIndex = 0;
    if (completions.length) completionIndex = (completionIndex + completions.length) % completions.length;
    const completion = completions[completionIndex] || input.value;
    if (!completion) return;

    completionGhost ||= document.createElement('span');
    completionGhost.className = 'qolboxChatCommandGhost';
    completionGhost.setAttribute('aria-hidden', 'true');
    const host = input.offsetParent instanceof HTMLElement ? input.offsetParent : input.parentElement;
    if (!host) return;
    host.append(completionGhost);
    if (completionInput && completionInput !== input) completionInput.classList.remove('qolboxChatCommandRichInput');
    input.classList.add('qolboxChatCommandRichInput');
    const style = getComputedStyle(input);
    Object.assign(completionGhost.style, {
      bottom: 'auto',
      boxSizing: style.boxSizing,
      font: style.font,
      height: `${input.offsetHeight}px`,
      left: `${input.offsetLeft}px`,
      letterSpacing: style.letterSpacing,
      lineHeight: style.lineHeight,
      padding: style.padding,
      textAlign: style.textAlign,
      textIndent: style.textIndent,
      top: `${input.offsetTop}px`,
      width: `${input.offsetWidth}px`,
    });
    completionGhost.replaceChildren();
    renderCommandText(completionGhost, completion, input.value.length);
    completionGhost.scrollLeft = input.scrollLeft;
    completionInput = input;
    completionValue = input.value;
  }

  function getCompletionInput(target: EventTarget | null): HTMLInputElement | null {
    return target instanceof HTMLInputElement && isChatInput(target) ? target : null;
  }

  function handleChatCompletionInput(event: Event): void {
    const input = getCompletionInput(event.target);
    if (input) syncCommandCompletion(input);
  }

  function handleChatCompletionKeydown(event: KeyboardEvent): boolean {
    const input = getCompletionInput(event.target);
    if (!input || !options.areLobbyCommandsEnabled()) return false;
    const completions = getChatCommandCompletions(input.value);
    if (!completions.length || input.selectionStart !== input.value.length || input.selectionEnd !== input.value.length) {
      if (input.selectionStart !== input.value.length || input.selectionEnd !== input.value.length) hideCommandCompletion();
      return false;
    }
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault();
      event.stopImmediatePropagation();
      completionIndex += event.key === 'ArrowDown' ? 1 : -1;
      syncCommandCompletion(input, true);
      return true;
    }
    if (event.key !== 'Tab' && event.key !== 'ArrowRight') return false;
    event.preventDefault();
    event.stopImmediatePropagation();
    completionIndex = (completionIndex + completions.length) % completions.length;
    input.value = completions[completionIndex] || input.value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    syncCommandCompletion(input);
    return true;
  }

  function isChatInput(element: unknown): element is Element {
    return isChatInputElement(element, options.chatInputSelector);
  }

  function isLobbyChatInput(element: unknown): element is Element {
    return isChatInputElement(element, options.lobbyChatInputSelector);
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
    if (handleChatCompletionKeydown(event)) return;
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
    document.addEventListener('input', handleChatCompletionInput, true);
    document.addEventListener('focusout', hideCommandCompletion, true);
    document.addEventListener('pointerup', handleChatCompletionInput, true);
  }

  function patchChatTabOrder(): void {
    if (!options.isChatFeatureEnabled()) {
      return;
    }

    if (!document.querySelector('.inGameChat, .lobbyContainer')) {
      return;
    }

    for (const input of originalTabIndexByInput.keys()) {
      if (!input.isConnected) {
        originalTabIndexByInput.delete(input);
      }
    }

    // Browser Tab focus bypasses the game's native chat-open path; Enter still focuses chat normally.
    for (const input of document.querySelectorAll(options.chatInputSelector)) {
      if (!originalTabIndexByInput.has(input)) {
        originalTabIndexByInput.set(input, input.getAttribute('tabindex'));
      }
      keepOutOfBrowserTabOrder(input);
    }
  }

  function restoreChatTabOrder(): void {
    for (const [input, originalTabIndex] of originalTabIndexByInput) {
      if (originalTabIndex === null) {
        input.removeAttribute('tabindex');
      } else {
        input.setAttribute('tabindex', originalTabIndex);
      }
    }
    originalTabIndexByInput.clear();
  }

  return {
    closeChatInput,
    getActiveChatInput,
    installChatCommandAliasHooks,
    installChatEscapeHooks,
    isChatInput,
    patchChatTabOrder,
    restoreChatTabOrder,
    restoreLobbyChatPrompt,
  };
}
