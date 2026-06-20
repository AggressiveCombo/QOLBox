import { type NativeObject, isNativeObject, readNativeProperty } from './native-access';

export interface SessionPlayerEntry {
  id: unknown;
  player: unknown;
}

declare global {
  interface Window {
    multiplayerSession?: unknown;
  }
}

function readNativeCollectionValue(collection: unknown, key: unknown): unknown | null {
  if (!isNativeObject(collection) || key === null || key === undefined) {
    return null;
  }

  const propertyValue = readNativeProperty(collection, String(key));
  if (propertyValue) {
    return propertyValue;
  }

  const getter = readNativeProperty(collection, 'get');
  if (typeof getter === 'function') {
    const value = Reflect.apply(getter, collection, [key]);
    return value ?? null;
  }

  return propertyValue ?? null;
}

export function getMultiplayerSession(): NativeObject | null {
  return isNativeObject(window.multiplayerSession) ? window.multiplayerSession : null;
}

function getNativeLobbyState(session: unknown): unknown {
  // `JD` is the observed live lobby/player state container in the public client.
  return readNativeProperty(session, 'JD');
}

export function getSessionPlayer(session: unknown = getMultiplayerSession()): unknown | null {
  const lobbyState = getNativeLobbyState(session);
  return readNativeCollectionValue(readNativeProperty(lobbyState, 'Pi'), readNativeProperty(lobbyState, 'vL'));
}

export function getSessionPlayers(session: unknown = getMultiplayerSession()): SessionPlayerEntry[] {
  const players = readNativeProperty(getNativeLobbyState(session), 'Pi');
  if (!isNativeObject(players)) {
    return [];
  }

  if (Array.isArray(players)) {
    return players
      .map((player, id) => ({ id, player }))
      .filter(entry => Boolean(entry.player));
  }

  const forEach = readNativeProperty(players, 'forEach');
  if (typeof forEach === 'function') {
    const entries: SessionPlayerEntry[] = [];
    Reflect.apply(forEach, players, [
      (player: unknown, id: unknown) => {
        if (player) {
          entries.push({ id, player });
        }
      },
    ]);
    return entries;
  }

  return Object.keys(players)
    .map(id => ({ id, player: readNativeProperty(players, id) }))
    .filter(entry => Boolean(entry.player));
}

export function getSessionPlayerById(session: unknown, playerId: unknown): unknown | null {
  const players = readNativeProperty(getNativeLobbyState(session), 'Pi');
  return readNativeCollectionValue(players, playerId);
}

export function getLocalPlayerId(session: unknown = getMultiplayerSession()): unknown | null {
  const playerId = readNativeProperty(getNativeLobbyState(session), 'vL');
  return playerId === null || playerId === undefined ? null : playerId;
}

export function hasLobbyPlayerState(session: unknown = getMultiplayerSession()): boolean {
  return isNativeObject(getNativeLobbyState(session));
}

export function getPlayerTeamState(player: unknown): number {
  return Number(player ? readNativeProperty(player, 'N') : player);
}

export function getPlayerName(player: unknown): unknown {
  return readNativeProperty(player, 'name');
}

export function isSamePlayerId(left: unknown, right: unknown): boolean {
  return left !== null && left !== undefined && right !== null && right !== undefined && String(left) === String(right);
}

export function isNativeTeamMode(session: unknown = getMultiplayerSession()): boolean {
  const nativeTeamMode = readNativeProperty(getNativeLobbyState(session), 'Qn');
  return nativeTeamMode === true || nativeTeamMode === 1;
}

export function isTeamsLocked(session: unknown = getMultiplayerSession()): boolean {
  const locked = readNativeProperty(getNativeLobbyState(session), 'VL');
  return locked === true || locked === 1;
}

export function isHostSession(session: unknown = getMultiplayerSession()): boolean {
  const lobbyState = getNativeLobbyState(session);
  const hostCheck = readNativeProperty(lobbyState, 'XD');
  return typeof hostCheck === 'function' && Boolean(Reflect.apply(hostCheck, lobbyState, []));
}

export function isSessionLobbyActive(session: unknown = getMultiplayerSession()): boolean {
  const lobbyUi = readNativeProperty(session, 'TJ');
  const match = readNativeProperty(session, 'KR');
  return Boolean(readNativeProperty(lobbyUi, 'NS') && !readNativeProperty(match, 'SL'));
}

export function isSessionMatchActive(session: unknown = getMultiplayerSession()): boolean {
  return Boolean(readNativeProperty(readNativeProperty(session, 'KR'), 'SL'));
}
