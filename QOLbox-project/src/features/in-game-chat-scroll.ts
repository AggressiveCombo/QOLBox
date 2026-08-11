const CHAT_READING_CLASS = 'qolboxChatReading';
const CHAT_INTERACTIVE_CLASS = 'qolboxChatInteractive';
const RESTORED_CHAT_MESSAGE_ATTR = 'data-qolbox-restored-chat-message';
const JUKEBOX_TITLE_CLASS = 'qolboxInGameJukeboxTitle';
const MAX_RETAINED_MESSAGES = 1000;
const RESTORED_HISTORY_DISPLAY_MS = 6500;

interface ChatScrollState {
  fadeSyncTimerId: number;
  focusInListener: () => void;
  focusOutListener: () => void;
  historyInteractionActive: boolean;
  historyHtml: string[];
  historyNodes: ChildNode[];
  historySignatures: string[];
  historyVisibleUntil: number;
  offsetPx: number;
  pointerEnterListener: () => void;
  pointerLeaveListener: () => void;
  restoredDomActive: boolean;
  restoredNodes: WeakSet<Node>;
  restoring: boolean;
  syncScheduled: boolean;
  wheelListener: ((event: WheelEvent) => void) | null;
  wheelListenerTarget: HTMLElement | null;
}

interface InGameChatScrollControllerOptions {
  isChatFeatureEnabled(): boolean;
}

function getChatContent(chat: Element): HTMLElement | null {
  return chat.querySelector<HTMLElement>('.content');
}

function hasVisibleGameplayCanvas(): boolean {
  const canvas = document.querySelector('#pixiContainer canvas');
  if (!canvas || typeof canvas.getBoundingClientRect !== 'function') {
    return false;
  }

  const rect = canvas.getBoundingClientRect();
  const style = typeof window.getComputedStyle === 'function' ? getComputedStyle(canvas) : null;
  if (!style) {
    return false;
  }

  return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
}

function getChatMessageViewportHeight(chat: HTMLElement): number {
  const input = chat.querySelector<HTMLElement>('.input');
  if (!input) {
    return chat.clientHeight;
  }

  const chatRect = chat.getBoundingClientRect();
  const inputRect = input.getBoundingClientRect();
  return Math.max(20, inputRect.top - chatRect.top);
}

function getMaxChatOffset(chat: HTMLElement, content: HTMLElement): number {
  return Math.max(0, content.scrollHeight - getChatMessageViewportHeight(chat));
}

function getChatOpacity(chat: HTMLElement): number {
  const opacity = Number(getComputedStyle(chat).opacity);
  return Number.isFinite(opacity) ? opacity : 1;
}

function isChatShellVisible(chat: HTMLElement): boolean {
  const rect = chat.getBoundingClientRect();
  const style = getComputedStyle(chat);
  return (
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    rect.width > 0 &&
    rect.height > 0 &&
    getChatOpacity(chat) > 0.04
  );
}

function isChatVisible(chat: HTMLElement): boolean {
  const hasFocusedInput = Boolean(chat.querySelector('.input:focus'));
  const hasMessageText = Boolean((getChatContent(chat)?.textContent || '').trim());
  return isChatShellVisible(chat) && (hasFocusedInput || hasMessageText);
}

function hasLostRetainedHistory(content: HTMLElement, state: ChatScrollState): boolean {
  const messages = getContentMessages(content);
  return messages.signatures.length > 0 && messages.signatures.length < state.historySignatures.length;
}

function shouldRestoreRetainedHistory(chat: HTMLElement, content: HTMLElement, state: ChatScrollState): boolean {
  return (
    state.historyInteractionActive ||
    state.offsetPx > 0 ||
    chat.classList.contains(CHAT_READING_CLASS) ||
    chat.matches(':hover') ||
    Boolean(chat.querySelector('.input:focus')) ||
    hasLostRetainedHistory(content, state)
  );
}

function hasFocusedChatInput(chat: HTMLElement): boolean {
  return Boolean(chat.querySelector('.input:focus'));
}

function getMessageNodes(content: HTMLElement): ChildNode[] {
  const nodes = Array.from(content.childNodes).filter(node => (node.textContent || '').trim());
  return nodes;
}

function decorateJukeboxMessage(node: Node): void {
  if (!(node instanceof HTMLElement) || node.querySelector(`.${JUKEBOX_TITLE_CLASS}`)) return;
  const message = node.querySelector<HTMLElement>(':scope > .message:not(.link)');
  if (!message || !node.querySelector(':scope > .message.link')) return;
  const text = message.textContent || '';
  const titleStart = text.indexOf(' suggests ');
  if (titleStart < 0) return;
  const split = titleStart + ' suggests '.length;
  const title = text.slice(split);
  if (!title) return;
  message.textContent = text.slice(0, split);
  const titleElement = document.createElement('span');
  titleElement.className = JUKEBOX_TITLE_CLASS;
  titleElement.textContent = title;
  message.append(titleElement);
}

function decorateJukeboxMessages(nodes: readonly Node[]): void {
  nodes.forEach(decorateJukeboxMessage);
}

function getMessageHtml(node: Node): string {
  if (node instanceof Element) {
    return node.outerHTML;
  }

  const container = document.createElement('span');
  container.textContent = node.textContent || '';
  return container.outerHTML;
}

function getContentMessages(content: HTMLElement): { html: string[]; nodes: ChildNode[]; signatures: string[] } {
  const nodes = getMessageNodes(content);
  const html = nodes.map(getMessageHtml);
  return {
    html,
    nodes,
    signatures: html.map(value => `${value.length}:${value}`),
  };
}

function getMessageSignatures(html: readonly string[]): string[] {
  return html.map(value => `${value.length}:${value}`);
}

function getOverlapLength(left: readonly string[], right: readonly string[]): number {
  const maxOverlap = Math.min(left.length, right.length);
  for (let overlap = maxOverlap; overlap > 0; overlap -= 1) {
    let matches = true;
    for (let index = 0; index < overlap; index += 1) {
      if (left[left.length - overlap + index] !== right[index]) {
        matches = false;
        break;
      }
    }

    if (matches) {
      return overlap;
    }
  }

  return 0;
}

function rememberMessageRecords(
  messages: { html: readonly string[]; nodes: readonly ChildNode[] },
  state: ChatScrollState
): boolean {
  if (state.restoring) {
    return false;
  }

  const html = messages.html;
  const signatures = getMessageSignatures(html);
  if (!signatures.length) {
    return false;
  }

  const overlap = getOverlapLength(state.historySignatures, signatures);
  const newHtml = html.slice(overlap);
  const newNodes = messages.nodes.slice(overlap);
  const newSignatures = signatures.slice(overlap);
  state.historyHtml.push(...newHtml);
  state.historyNodes.push(...newNodes);
  state.historySignatures.push(...newSignatures);

  if (state.historyHtml.length > MAX_RETAINED_MESSAGES) {
    const excess = state.historyHtml.length - MAX_RETAINED_MESSAGES;
    state.historyHtml.splice(0, excess);
    state.historyNodes.splice(0, excess);
    state.historySignatures.splice(0, excess);
  }

  return newHtml.length > 0;
}

function rememberChatMessages(content: HTMLElement, state: ChatScrollState): void {
  if (state.restoredDomActive) {
    return;
  }

  decorateJukeboxMessages(Array.from(content.children));
  rememberMessageRecords(getContentMessages(content), state);
}

function rememberAddedChatNodes(nodes: readonly Node[], state: ChatScrollState): void {
  decorateJukeboxMessages(nodes);
  const retainedNodes = nodes.filter(node => !isRestoredChatMessageNode(node, state) && (node.textContent || '').trim()) as ChildNode[];
  const html = retainedNodes.map(getMessageHtml);
  if (rememberMessageRecords({ html, nodes: retainedNodes }, state)) {
    state.historyVisibleUntil = performance.now() + RESTORED_HISTORY_DISPLAY_MS;
  }
}

function getNodePath(root: Node, target: Node): number[] | null {
  const path: number[] = [];
  let current: Node | null = target;

  while (current && current !== root) {
    const parent: Node | null = current.parentNode;
    if (!parent) {
      return null;
    }

    path.unshift(Array.prototype.indexOf.call(parent.childNodes, current));
    current = parent;
  }

  return current === root ? path : null;
}

function getNodeByPath(root: Node, path: readonly number[]): Node | null {
  let current: Node | null = root;
  for (const index of path) {
    current = current.childNodes[index] || null;
    if (!current) {
      return null;
    }
  }

  return current;
}

function markRestoredChatMessageNode(node: Node, state: ChatScrollState): void {
  state.restoredNodes.add(node);
  if (node instanceof Element) {
    node.setAttribute(RESTORED_CHAT_MESSAGE_ATTR, 'true');
  }
}

function cloneRetainedMessageNode(retainedNode: ChildNode, state: ChatScrollState): ChildNode {
  const restoredNode = retainedNode.cloneNode(true) as ChildNode;
  markRestoredChatMessageNode(restoredNode, state);
  if (!(retainedNode instanceof Element) || !(restoredNode instanceof Element)) {
    return restoredNode;
  }

  restoredNode.addEventListener(
    'click',
    event => {
      const target = event.target instanceof Node ? event.target : restoredNode;
      const path = getNodePath(restoredNode, target);
      const retainedTarget = path ? getNodeByPath(retainedNode, path) : retainedNode;
      const clickTarget =
        retainedTarget instanceof HTMLElement
          ? retainedTarget
          : retainedNode instanceof HTMLElement
            ? retainedNode
            : null;

      if (!clickTarget) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      clickTarget.click();
    },
    true
  );

  return restoredNode;
}

function isRestoredChatMessageNode(node: Node, state: ChatScrollState): boolean {
  return (
    state.restoredNodes.has(node) ||
    (node instanceof Element &&
      (node.hasAttribute(RESTORED_CHAT_MESSAGE_ATTR) || Boolean(node.closest(`[${RESTORED_CHAT_MESSAGE_ATTR}]`))))
  );
}

function restoreRetainedChatMessages(content: HTMLElement, state: ChatScrollState): void {
  if (!state.historyHtml.length) {
    return;
  }

  const messages = getContentMessages(content);
  if (messages.signatures.length >= state.historySignatures.length) {
    return;
  }

  state.restoring = true;
  content.innerHTML = '';
  for (let index = 0; index < state.historyHtml.length; index += 1) {
    const retainedNode = state.historyNodes[index];
    if (retainedNode) {
      content.appendChild(cloneRetainedMessageNode(retainedNode, state));
    }
  }
  state.restoring = false;
  state.restoredDomActive = true;
}

function clearRestoredChatDom(content: HTMLElement, state: ChatScrollState, force = false): void {
  if (!force && !state.historyInteractionActive) {
    return;
  }

  if (state.restoredDomActive) {
    state.restoring = true;
    content.innerHTML = '';
    state.restoring = false;
  }
  state.restoredDomActive = false;
  state.historyInteractionActive = false;
  state.historyVisibleUntil = 0;
  if (state.fadeSyncTimerId) {
    window.clearTimeout(state.fadeSyncTimerId);
    state.fadeSyncTimerId = 0;
  }
  state.offsetPx = 0;
  content.style.transform = '';
  content.style.willChange = '';
}

function applyChatOffset(chat: HTMLElement, content: HTMLElement, state: ChatScrollState): void {
  const maxOffset = getMaxChatOffset(chat, content);
  state.offsetPx = Math.max(0, Math.min(maxOffset, state.offsetPx));
  if (state.offsetPx > 0) {
    content.style.transform = `translateY(${Math.round(state.offsetPx)}px)`;
    content.style.willChange = 'transform';
    chat.classList.add(CHAT_READING_CLASS);
    chat.dataset.qolboxChatOffset = String(Math.round(state.offsetPx));
  } else {
    content.style.transform = '';
    content.style.willChange = '';
    delete chat.dataset.qolboxChatOffset;
    if (!chat.matches(':hover')) {
      chat.classList.remove(CHAT_READING_CLASS);
    }
  }
}

export function createInGameChatScrollController(options: InGameChatScrollControllerOptions) {
  const patchedChats = new Set<Element>();
  const chatStates = new WeakMap<Element, ChatScrollState>();
  const chatObservers = new WeakMap<Element, MutationObserver>();
  let keyHooksInstalled = false;
  let patchScheduled = false;

  function removeContentWheelListener(state: ChatScrollState): void {
    if (!state.wheelListenerTarget || !state.wheelListener) {
      state.wheelListenerTarget = null;
      return;
    }

    state.wheelListenerTarget.removeEventListener('wheel', state.wheelListener, true);
    state.wheelListenerTarget = null;
  }

  function handleChatWheel(chat: HTMLElement, state: ChatScrollState, event: WheelEvent): void {
    if (!options.isChatFeatureEnabled()) {
      cleanupInGameChatScroll();
      return;
    }

    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest('input, textarea, select, button, .qolboxMenuOverlay')) {
      return;
    }

    const content = getChatContent(chat);
    if (!content || getMaxChatOffset(chat, content) <= 0) {
      removeContentWheelListener(state);
      return;
    }

    state.offsetPx -= event.deltaY;
    applyChatOffset(chat, content, state);
    syncContentWheelListener(chat, content, state);
    event.preventDefault();
    event.stopPropagation();
  }

  function syncContentWheelListener(chat: HTMLElement, content: HTMLElement, state: ChatScrollState): void {
    const shouldListen = options.isChatFeatureEnabled() && isChatShellVisible(chat) && getMaxChatOffset(chat, content) > 0;
    if (!shouldListen) {
      removeContentWheelListener(state);
      return;
    }

    if (!state.wheelListener) {
      state.wheelListener = event => handleChatWheel(chat, state, event);
    }

    if (state.wheelListenerTarget === content) {
      return;
    }

    removeContentWheelListener(state);
    content.addEventListener('wheel', state.wheelListener, { capture: true, passive: false });
    state.wheelListenerTarget = content;
  }

  function cleanupChatScroll(chat: Element): void {
    if (!(chat instanceof HTMLElement)) {
      return;
    }

    const content = getChatContent(chat);
    const state = chatStates.get(chat);
    if (state) {
      removeContentWheelListener(state);
      if (state.fadeSyncTimerId) {
        window.clearTimeout(state.fadeSyncTimerId);
        state.fadeSyncTimerId = 0;
      }
      if (content) {
        clearRestoredChatDom(content, state, true);
        content.style.transform = '';
        content.style.willChange = '';
      }
      state.offsetPx = 0;
      state.historyVisibleUntil = 0;
      state.syncScheduled = false;
    }

    chat.classList.remove(CHAT_INTERACTIVE_CLASS);
    chat.classList.remove(CHAT_READING_CLASS);
    delete chat.dataset.qolboxChatOffset;
  }

  function clearRetainedChatState(state: ChatScrollState): void {
    state.historyHtml = [];
    state.historyNodes = [];
    state.historySignatures = [];
    state.historyVisibleUntil = 0;
    state.restoredNodes = new WeakSet<Node>();
    state.restoredDomActive = false;
    state.historyInteractionActive = false;
    state.restoring = false;
    state.syncScheduled = false;
  }

  function unpatchChatScroll(chat: Element): void {
    cleanupChatScroll(chat);

    const state = chatStates.get(chat);
    if (state) {
      chat.removeEventListener('pointerenter', state.pointerEnterListener);
      chat.removeEventListener('pointerleave', state.pointerLeaveListener);
      chat.removeEventListener('focusin', state.focusInListener, true);
      chat.removeEventListener('focusout', state.focusOutListener, true);
      clearRetainedChatState(state);
    }

    chatObservers.get(chat)?.disconnect();
    chatObservers.delete(chat);
    chatStates.delete(chat);
    patchedChats.delete(chat);
    if (chat instanceof HTMLElement) {
      delete chat.dataset.qolboxChatScrollPatched;
    }
  }

  function isUserReadingChat(chat: HTMLElement, state: ChatScrollState): boolean {
    return (
      hasFocusedChatInput(chat) ||
      state.offsetPx > 0 ||
      chat.matches(':hover') ||
      chat.classList.contains(CHAT_READING_CLASS)
    );
  }

  function scheduleFadeSync(chat: Element, state: ChatScrollState, delayMs: number): void {
    if (state.fadeSyncTimerId) {
      return;
    }

    state.fadeSyncTimerId = window.setTimeout(() => {
      state.fadeSyncTimerId = 0;
      syncChat(chat);
    }, Math.max(50, delayMs));
  }

  function syncChat(chat: Element): void {
    if (!(chat instanceof HTMLElement)) {
      return;
    }

    const content = getChatContent(chat);
    const state = chatStates.get(chat);
    if (!content || !state) {
      return;
    }

    if (!options.isChatFeatureEnabled()) {
      cleanupInGameChatScroll();
      return;
    }

    rememberChatMessages(content, state);

    const visible =
      isChatVisible(chat) || (isChatShellVisible(chat) && state.historyInteractionActive && state.historyHtml.length > 0);

    if (visible) {
      const now = performance.now();
      const userReading = isUserReadingChat(chat, state);
      if (userReading) {
        state.historyVisibleUntil = 0;
        if (state.fadeSyncTimerId) {
          window.clearTimeout(state.fadeSyncTimerId);
          state.fadeSyncTimerId = 0;
        }
      } else if (state.historyInteractionActive && state.historyVisibleUntil <= 0) {
        state.historyVisibleUntil = now + RESTORED_HISTORY_DISPLAY_MS;
      }

      if (!userReading && state.historyVisibleUntil > 0 && now >= state.historyVisibleUntil) {
        clearRestoredChatDom(content, state);
        chat.classList.remove(CHAT_INTERACTIVE_CLASS);
        chat.classList.remove(CHAT_READING_CLASS);
        syncContentWheelListener(chat, content, state);
        return;
      }

      chat.classList.add(CHAT_INTERACTIVE_CLASS);
      if (shouldRestoreRetainedHistory(chat, content, state)) {
        if (hasFocusedChatInput(chat) || state.offsetPx > 0) {
          state.historyInteractionActive = true;
        }
        restoreRetainedChatMessages(content, state);
      } else {
        clearRestoredChatDom(content, state);
      }
      applyChatOffset(chat, content, state);
      syncContentWheelListener(chat, content, state);
      if (!userReading && state.historyVisibleUntil > 0) {
        scheduleFadeSync(chat, state, state.historyVisibleUntil - now + 50);
      }
      return;
    }

    clearRestoredChatDom(content, state, true);
    chat.classList.remove(CHAT_INTERACTIVE_CLASS);
    if (state.offsetPx <= 0) {
      chat.classList.remove(CHAT_READING_CLASS);
    }
    syncContentWheelListener(chat, content, state);
  }

  function scheduleChatSync(chat: Element): void {
    const state = chatStates.get(chat);
    if (state?.syncScheduled) {
      return;
    }

    if (state) {
      state.syncScheduled = true;
    }

    window.setTimeout(() => {
      if (state) {
        state.syncScheduled = false;
      }
      syncChat(chat);
      window.requestAnimationFrame(() => syncChat(chat));
    }, 0);
  }

  function schedulePatchInGameChatScroll(delayMs = 100): void {
    if (!options.isChatFeatureEnabled()) {
      cleanupInGameChatScroll();
      return;
    }

    if (patchScheduled) {
      return;
    }

    patchScheduled = true;
    window.setTimeout(() => {
      patchScheduled = false;
      patchInGameChatScroll();
    }, delayMs);
  }

  function patchChat(chat: Element): void {
    if (patchedChats.has(chat)) {
      return;
    }

    patchedChats.add(chat);
    if (chat instanceof HTMLElement) {
      chat.dataset.qolboxChatScrollPatched = 'true';
    }

    let state: ChatScrollState;
    const focusInListener = () => scheduleChatSync(chat);
    const focusOutListener = () => scheduleChatSync(chat);
    const pointerEnterListener = () => {
      if (!options.isChatFeatureEnabled()) {
        return;
      }

      if (chat instanceof HTMLElement && isChatVisible(chat)) {
        chat.classList.add(CHAT_READING_CLASS);
      }
    };
    const pointerLeaveListener = () => {
      if (!options.isChatFeatureEnabled()) {
        cleanupInGameChatScroll();
        return;
      }

      if (state.offsetPx <= 0) {
        chat.classList.remove(CHAT_READING_CLASS);
      }
      scheduleChatSync(chat);
    };

    state = {
      historyInteractionActive: false,
      historyHtml: [],
      historyNodes: [],
      historySignatures: [],
      historyVisibleUntil: 0,
      fadeSyncTimerId: 0,
      focusInListener,
      focusOutListener,
      offsetPx: 0,
      pointerEnterListener,
      pointerLeaveListener,
      restoredDomActive: false,
      restoredNodes: new WeakSet<Node>(),
      restoring: false,
      syncScheduled: false,
      wheelListener: null,
      wheelListenerTarget: null,
    };
    chatStates.set(chat, state);

    chat.addEventListener('pointerenter', state.pointerEnterListener);
    chat.addEventListener('pointerleave', state.pointerLeaveListener);
    chat.addEventListener('focusin', state.focusInListener, true);
    chat.addEventListener('focusout', state.focusOutListener, true);

    const chatObserver = new MutationObserver(records => {
      if (!options.isChatFeatureEnabled()) {
        cleanupInGameChatScroll();
        return;
      }

      const content = getChatContent(chat);
      const currentState = chatStates.get(chat);
      if (content && currentState) {
        for (const record of records) {
          if (record.type === 'childList' && record.target === content && record.addedNodes.length) {
            rememberAddedChatNodes(Array.from(record.addedNodes), currentState);
          }
        }
      }

      scheduleChatSync(chat);
    });
    chatObserver.observe(chat, {
      attributes: true,
      attributeFilter: ['class', 'style'],
      childList: true,
      subtree: true,
    });
    chatObservers.set(chat, chatObserver);
    syncChat(chat);
  }

  function installKeyHooks(): void {
    if (keyHooksInstalled) {
      return;
    }

    keyHooksInstalled = true;
    document.addEventListener('keydown', () => schedulePatchInGameChatScroll(0), true);
    document.addEventListener('keyup', () => schedulePatchInGameChatScroll(0), true);
  }

  function patchInGameChatScroll(): void {
    installKeyHooks();

    for (const chat of Array.from(patchedChats)) {
      if (!chat.isConnected) {
        unpatchChatScroll(chat);
      }
    }

    if (!options.isChatFeatureEnabled()) {
      cleanupInGameChatScroll();
      return;
    }

    if (!hasVisibleGameplayCanvas()) {
      return;
    }

    for (const chat of document.querySelectorAll('.inGameChat')) {
      patchChat(chat);
      syncChat(chat);
    }
  }

  function cleanupInGameChatScroll(): void {
    for (const chat of Array.from(patchedChats)) {
      unpatchChatScroll(chat);
    }
  }

  return {
    cleanupInGameChatScroll,
    patchInGameChatScroll,
  };
}
