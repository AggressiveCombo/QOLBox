import { isNativeObject, readNativePath, readNativeProperty } from './native-access';

declare global {
  interface Window {
    a8?: unknown;
  }
}

function getLobbySocket(session: unknown): unknown {
  return readNativePath(session, ['JD', 'ZD']);
}

function getCommandEventId(): unknown {
  const eventId = readNativeProperty(window.a8, 'VP');
  return eventId === undefined ? 1 : eventId;
}

function getCommandId(property: string, fallback: number): unknown {
  const commandId = readNativeProperty(window.a8, property);
  return commandId === undefined ? fallback : commandId;
}

function emitLobbyCommand(session: unknown, payload: readonly unknown[]): boolean {
  const socket = getLobbySocket(session);
  const emit = readNativeProperty(socket, 'emit');
  if (!isNativeObject(socket) || typeof emit !== 'function') {
    return false;
  }

  Reflect.apply(emit, socket, [getCommandEventId(), [...payload]]);
  return true;
}

export function requestOwnTeamChange(session: unknown, team: number): boolean {
  return emitLobbyCommand(session, [getCommandId('gE', 24), team]);
}

export function movePlayerToTeam(session: unknown, playerId: unknown, team: number): boolean {
  // Vanilla host player menus send command 47 with the selected player and target team.
  return emitLobbyCommand(session, [getCommandId('jE', 47), { i: playerId, t: team }]);
}

export function setTeamsLocked(session: unknown, locked: boolean): boolean {
  // Vanilla teamLockButton toggles command 52 with the next locked state.
  return emitLobbyCommand(session, [getCommandId('HE', 52), Boolean(locked)]);
}

export function giveHostToPlayer(session: unknown, playerId: unknown): boolean {
  // Vanilla host player menus send command 44 with the selected player id.
  return emitLobbyCommand(session, [getCommandId('qolboxGiveHost', 44), playerId]);
}
