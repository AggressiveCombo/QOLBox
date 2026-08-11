import {
  getLocalPlayerId,
  getMultiplayerSession,
  getSessionPlayers,
  isSamePlayerId,
} from '../hitbox/session-adapter';
import { readNativeProperty, replaceNativeReflectProperty } from '../hitbox/native-access';

interface KnownAccountXp {
  accountId: number;
  xp: number;
}

interface PlayerInformation {
  accountId: number | null;
  exactXp: number | null;
  level: number;
  name: string;
}

const ACCOUNT_RESPONSE_PATH = /\/scripts\/(?:login_auto_spice|login_register_multi)\.php(?:[?#]|$)/i;
const ROOM_LIST_ITEM_SELECTOR = '.item[data-qolbox-room-list-menu="true"]';
const PLAYER_INFO_ACTION_SELECTOR = '.item[data-qolbox-player-info-action="true"]';

function parseFiniteNumber(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function isVisible(element: Element | null): element is HTMLElement {
  if (!(element instanceof HTMLElement)) {
    return false;
  }

  const rect = element.getBoundingClientRect();
  const style = window.getComputedStyle(element);
  return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden';
}

function getPlayerForRow(row: HTMLElement): { id: unknown; player: unknown } | null {
  const rows = Array.from(document.querySelectorAll<HTMLElement>('.lobbyContainer .playerElement'));
  const entries = getSessionPlayers();
  const rowName = row.querySelector('.name')?.textContent?.trim() || '';
  const sameIndex = entries[rows.indexOf(row)];
  if (sameIndex && String(readNativeProperty(sameIndex.player, 'name') || '') === rowName) {
    return sameIndex;
  }

  const matchingRows = rows.filter(candidate => candidate.querySelector('.name')?.textContent?.trim() === rowName);
  const matchingPlayers = entries.filter(
    entry => String(readNativeProperty(entry.player, 'name') || '') === rowName
  );
  return matchingPlayers[matchingRows.indexOf(row)] || null;
}

export function getLevelXpBounds(level: number): { end: number; required: number; start: number } | null {
  if (!Number.isInteger(level) || level < 1) {
    return null;
  }

  const start = 100 * (level - 1) ** 2;
  const end = 100 * level ** 2;
  return { end, required: end - start, start };
}

function getPlayerInformation(
  playerId: unknown,
  player: unknown,
  knownAccountXp: KnownAccountXp | null
): PlayerInformation {
  const session = getMultiplayerSession();
  const accountId = parseFiniteNumber(readNativeProperty(player, 'VR'));
  const level = Math.max(0, Math.trunc(parseFiniteNumber(readNativeProperty(player, 'level')) ?? 0));
  const local = isSamePlayerId(playerId, getLocalPlayerId(session));
  return {
    accountId: accountId !== null && accountId >= 0 ? accountId : null,
    exactXp:
      local && accountId !== null && knownAccountXp?.accountId === accountId
        ? knownAccountXp.xp
        : null,
    level,
    name: String(readNativeProperty(player, 'name') || 'Unnamed Player'),
  };
}

function appendTextElement(parent: HTMLElement, className: string, text: string): HTMLElement {
  const element = document.createElement('div');
  element.className = className;
  element.textContent = text;
  parent.append(element);
  return element;
}

function appendDetailRow(parent: HTMLElement, label: string, value: string): void {
  const row = appendTextElement(parent, 'qolboxPlayerInfoRow', '');
  appendTextElement(row, 'qolboxPlayerInfoLabel', label);
  appendTextElement(row, 'qolboxPlayerInfoValue', value);
}

function closeNativePlayerMenu(menu: HTMLElement): void {
  const background = menu.querySelector<HTMLElement>('.background');
  if (background) {
    background.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
  } else {
    menu.remove();
  }
}

function renderProgress(parent: HTMLElement, info: PlayerInformation): void {
  const group = appendTextElement(parent, 'xpGroup', '');
  const bounds = getLevelXpBounds(info.level);
  const progressLabel = appendTextElement(group, 'xpGained', '');
  const bar = appendTextElement(group, 'barContainer', '');
  const inner = appendTextElement(bar, 'barInner', '');
  const currentLevel = appendTextElement(group, 'lvNow', `Lv${info.level}`);
  const nextLevel = appendTextElement(group, 'lvNext', bounds ? `Lv${info.level + 1}` : '');
  const progress = appendTextElement(group, 'xpSlash', '');

  if (!bounds) {
    progressLabel.textContent = `Level ${info.level}`;
    progress.textContent = '';
    nextLevel.textContent = '';
    bar.style.display = 'none';
    inner.style.width = '0%';
    return;
  }

  if (info.exactXp === null) {
    progressLabel.textContent = `${bounds.start.toLocaleString()}–${(bounds.end - 1).toLocaleString()} total XP`;
    progress.textContent = '';
    bar.classList.add('qolboxPlayerInfoUnknownProgress');
    inner.style.width = '0%';
    return;
  }

  const earned = Math.max(0, Math.min(bounds.required, info.exactXp - bounds.start));
  progressLabel.textContent = `${info.exactXp.toLocaleString()} total XP`;
  progress.textContent = `${earned.toLocaleString()}/${bounds.required.toLocaleString()}`;
  inner.style.width = `${(100 * earned) / bounds.required}%`;
  currentLevel.textContent = `Lv${info.level}`;
}

function showPlayerInformation(info: PlayerInformation): void {
  document.querySelector('.qolboxPlayerInfoOverlay')?.remove();

  const overlay = appendTextElement(document.querySelector<HTMLElement>('#appContainer') || document.body, 'mouseBlockContainer qolboxPlayerInfoOverlay', '');
  appendTextElement(overlay, 'behindBlocker', '');
  const panel = appendTextElement(overlay, 'postGameContainer qolboxPlayerInfo', '');
  const closeCross = appendTextElement(panel, 'crossButton', '');
  appendTextElement(panel, 'title', 'PLAYER INFO');
  appendTextElement(panel, 'position', info.name);
  renderProgress(panel, info);

  const details = appendTextElement(panel, 'qolboxPlayerInfoDetails', '');
  if (info.accountId !== null) {
    appendDetailRow(details, 'Account ID', String(info.accountId));
  }

  const closeButton = appendTextElement(panel, 'closeButton', 'CLOSE');
  const close = () => overlay.remove();
  closeCross.addEventListener('click', close);
  closeButton.addEventListener('click', close);
  closeButton.tabIndex = 0;
  closeButton.setAttribute('role', 'button');
  closeButton.focus({ preventScroll: true });
}

export function createLobbyInformationController() {
  let hooksInstalled = false;
  let hiddenLobby: { display: string; element: HTMLElement } | null = null;
  let knownAccountXp: KnownAccountXp | null = null;
  let roomListOpenedFromSession = false;
  let roomListMenuItem: HTMLElement | null = null;
  let selectedPlayerRow: HTMLElement | null = null;
  const patchedRoomJoinSessions = new WeakSet<object>();
  const patchedXpSessions = new WeakSet<object>();

  function restoreLobbyBehindRoomList(): void {
    if (!hiddenLobby) {
      return;
    }

    hiddenLobby.element.style.display = hiddenLobby.display;
    hiddenLobby = null;
  }

  function rememberAccountXp(xp: unknown, accountId: unknown): void {
    const parsedXp = parseFiniteNumber(xp);
    const parsedAccountId = parseFiniteNumber(accountId);
    if (parsedXp !== null && parsedXp >= 0 && parsedAccountId !== null && parsedAccountId >= 0) {
      knownAccountXp = { accountId: parsedAccountId, xp: Math.trunc(parsedXp) };
    }
  }

  function observeAccountResponse(response: Response): void {
    if (!response.ok || !ACCOUNT_RESPONSE_PATH.test(response.url)) {
      return;
    }

    response.clone().json().then(data => {
      if (data && typeof data === 'object' && Reflect.get(data, 'r') === 'success') {
        rememberAccountXp(Reflect.get(data, 'xp'), Reflect.get(data, 'id'));
      }
    }).catch(() => undefined);
  }

  function installAccountXpFetchObserver(): void {
    if (typeof window.fetch !== 'function') {
      return;
    }

    const nativeFetch = window.fetch;
    window.fetch = function (...args: Parameters<typeof fetch>): ReturnType<typeof fetch> {
      const request = Reflect.apply(nativeFetch, this, args) as ReturnType<typeof fetch>;
      request.then(observeAccountResponse, () => undefined);
      return request;
    };
  }

  function patchLocalXpUpdates(): void {
    const session = getMultiplayerSession();
    if (!session || patchedXpSessions.has(session)) {
      return;
    }

    const updateXp = readNativeProperty(session, 'dG');
    if (typeof updateXp !== 'function') {
      return;
    }

    const wrappedUpdateXp = function (this: unknown, ...args: unknown[]) {
      const result = Reflect.apply(updateXp, this, args);
      const localPlayer = getSessionPlayers(session).find(entry => isSamePlayerId(entry.id, getLocalPlayerId(session)))?.player;
      rememberAccountXp(args[1], readNativeProperty(localPlayer, 'VR'));
      return result;
    };
    if (replaceNativeReflectProperty(session, 'dG', wrappedUpdateXp)) {
      patchedXpSessions.add(session);
    }
  }

  function patchRoomListJoining(): void {
    const session = getMultiplayerSession();
    if (!session || patchedRoomJoinSessions.has(session)) {
      return;
    }

    const joinRoom = readNativeProperty(session, 'CG');
    if (typeof joinRoom !== 'function') {
      return;
    }

    const wrappedJoinRoom = function (this: unknown, ...args: unknown[]) {
      if (roomListOpenedFromSession) {
        roomListOpenedFromSession = false;
        restoreLobbyBehindRoomList();
        const leaveRoom = readNativeProperty(this, 'xJ');
        if (typeof leaveRoom === 'function') {
          Reflect.apply(leaveRoom, this, []);
        }
      }
      return Reflect.apply(joinRoom, this, args);
    };
    if (replaceNativeReflectProperty(session, 'CG', wrappedJoinRoom)) {
      patchedRoomJoinSessions.add(session);
    }
  }

  function closeHamburgerMenu(container: Element): void {
    const button = container.closest('.cornerButton')?.querySelector<HTMLElement>('.square');
    if (button && isVisible(container)) {
      button.click();
    }
  }

  function openRoomList(container: Element): void {
    const customGameButton = document.querySelector<HTMLElement>('.bigButton.custom');
    if (!customGameButton) {
      return;
    }

    const lobby = document.querySelector<HTMLElement>('.lobbyContainer');
    if (isVisible(lobby)) {
      hiddenLobby = { display: lobby.style.display, element: lobby };
      lobby.style.display = 'none';
    }
    roomListOpenedFromSession = true;
    customGameButton.click();
    const roomList = document.querySelector<HTMLElement>('.roomListContainer');
    if (!isVisible(roomList)) {
      roomListOpenedFromSession = false;
      restoreLobbyBehindRoomList();
    }
    closeHamburgerMenu(container);
  }

  function patchRoomListMenu(): void {
    const menus = Array.from(document.querySelectorAll<HTMLElement>('.cornerButton .items'));
    const hasActiveRoom = getSessionPlayers().length > 0;
    if (!menus.length || !hasActiveRoom) {
      document.querySelectorAll(ROOM_LIST_ITEM_SELECTOR).forEach(item => item.remove());
      roomListMenuItem = null;
      if (!hasActiveRoom) {
        roomListOpenedFromSession = false;
        restoreLobbyBehindRoomList();
      }
      return;
    }

    const items = menus.map(menu => {
      let item = menu.querySelector<HTMLElement>(ROOM_LIST_ITEM_SELECTOR);
      if (!item) {
        item = document.createElement('div');
        item.className = 'item';
        item.dataset.qolboxRoomListMenu = 'true';
        item.dataset.qolboxIcon = 'list';
        item.textContent = 'Room List';
        item.addEventListener('click', event => {
          event.preventDefault();
          event.stopImmediatePropagation();
          openRoomList(menu);
        }, true);
        const directItems = Array.from(menu.querySelectorAll<HTMLElement>(':scope > .item'));
        const volume = directItems
          .find(candidate => /^Volume:\s*\d+%$/.test(candidate.textContent?.trim() || ''));
        const audio = menu.querySelector<HTMLElement>(':scope > .qolboxAudioMenuGroup');
        const controls = directItems.find(candidate => candidate.textContent?.trim() === 'Change Controls');
        menu.insertBefore(item, volume || audio || controls || null);
      }
      return item;
    });
    roomListMenuItem = items.find(isVisible) || items[items.length - 1] || null;
  }

  function patchPlayerPopup(row: HTMLElement, openDirectly = false): void {
    const entry = getPlayerForRow(row);
    const menus = Array.from(document.querySelectorAll<HTMLElement>('.rightClickMenu'));
    const menu = menus.reverse().find(isVisible);
    const container = menu?.querySelector<HTMLElement>('.container');
    if (!entry || readNativeProperty(entry.player, 'GR')) {
      return;
    }
    if (!menu || !container) {
      if (!openDirectly) return;
      showPlayerInformation(getPlayerInformation(entry.id, entry.player, knownAccountXp));
      return;
    }
    if (container.querySelector(PLAYER_INFO_ACTION_SELECTOR)) {
      return;
    }

    const action = document.createElement('div');
    action.className = 'item';
    action.dataset.qolboxPlayerInfoAction = 'true';
    action.dataset.qolboxIcon = 'user';
    action.textContent = 'Player Info';
    action.addEventListener('click', event => {
      event.preventDefault();
      event.stopImmediatePropagation();
      closeNativePlayerMenu(menu);
      showPlayerInformation(getPlayerInformation(entry.id, entry.player, knownAccountXp));
    }, true);
    container.insertBefore(action, container.firstChild);
  }

  function handleDocumentClick(event: MouseEvent): void {
    const target = event.target instanceof Element ? event.target : null;
    const roomListClose = target?.closest('.roomListContainer .crossButton');
    if (roomListOpenedFromSession && roomListClose) {
      event.preventDefault();
      event.stopImmediatePropagation();
      const roomList = roomListClose.closest<HTMLElement>('.roomListContainer');
      if (roomList) {
        roomList.style.display = 'none';
      }
      roomListOpenedFromSession = false;
      restoreLobbyBehindRoomList();
      const menuButton = roomListMenuItem?.closest('.cornerButton')?.querySelector<HTMLElement>('.square');
      menuButton?.focus({ preventScroll: true });
      return;
    }

    const row = target?.closest<HTMLElement>('.lobbyContainer .playerElement');
    if (row) {
      selectedPlayerRow = row;
      window.requestAnimationFrame(() => patchPlayerPopup(row, true));
    } else if (!target?.closest('.rightClickMenu')) {
      selectedPlayerRow = null;
    }
  }

  function installLobbyInformationHooks(): void {
    if (hooksInstalled) {
      return;
    }

    hooksInstalled = true;
    installAccountXpFetchObserver();
    document.addEventListener('click', handleDocumentClick, true);
  }

  function patchLobbyInformation(): void {
    if (roomListOpenedFromSession && !isVisible(document.querySelector('.roomListContainer'))) {
      roomListOpenedFromSession = false;
      restoreLobbyBehindRoomList();
    }
    patchRoomListMenu();
    if (selectedPlayerRow?.isConnected) patchPlayerPopup(selectedPlayerRow);
    patchRoomListJoining();
    patchLocalXpUpdates();
  }

  return {
    getKnownAccountXp: () => knownAccountXp ? { ...knownAccountXp } : null,
    installLobbyInformationHooks,
    patchLobbyInformation,
  };
}
