export interface ChatInputElement extends Element {
  value: string;
}

export interface BlurrableValue {
  blur(): void;
}

export function hasEditableChatValue(value: unknown): value is ChatInputElement {
  return value instanceof Element && 'value' in value && typeof value.value === 'string';
}

export function canBlur(value: unknown): value is BlurrableValue {
  return typeof value === 'object' && value !== null && 'blur' in value && typeof value.blur === 'function';
}

export function isChatInputElement(element: unknown, selector: string): element is Element {
  return element instanceof Element && element.matches(selector);
}

export function isLobbyChatInputElement(element: unknown, selector: string): element is Element {
  return element instanceof Element && element.matches(selector);
}

export function getActiveChatInputElement(target: unknown, selector: string): Element | null {
  if (isChatInputElement(target, selector)) {
    return target;
  }

  if (target instanceof Element) {
    const closestChatInput = target.closest(selector);
    if (isChatInputElement(closestChatInput, selector)) {
      return closestChatInput;
    }
  }

  return document.querySelector('.inGameChat .input:focus, .lobbyContainer .chatBox .input:focus');
}
