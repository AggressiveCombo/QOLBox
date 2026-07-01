import {
  getLocalPlayerId,
  getMultiplayerSession,
  getPlayerTeamState,
  getSessionPlayerById,
  hasLobbyPlayerState,
  isHostSession,
  isSamePlayerId,
  isSessionMatchActive,
  isTeamsLocked,
} from '../hitbox/session-adapter';
import { setTeamsLocked as requestTeamsLocked } from '../hitbox/lobby-actions';
import { TEAM_STATE_BLUE, TEAM_STATE_RED, TEAM_STATE_SPECTATE } from '../hitbox/team-state';
import { type CommandTargetGroup, formatCommandPlayerName } from './lobby-command-player-targets';
import { getBulkTeamTargets, getSwitchableTeamPlayers } from './lobby-command-team-targets';
import {
  formatBulkTeamMoveMessage,
  getBulkTeamActionName,
  getTeamStateName,
} from './lobby-command-team-state-text';
import { requestPlayerTeamState } from './lobby-command-team-state-request';

export { getTeamStateName } from './lobby-command-team-state-text';

export interface TeamStateOptions {
  requireTeamMode?: boolean;
  targetGroup?: CommandTargetGroup;
}

interface LobbyCommandTeamActionDependencies {
  isCurrentPlayerSpectating(session?: unknown): boolean;
  isTeamMode(session?: unknown): boolean;
  noteLocallyInitiatedPlayTransition(session?: unknown): void;
  showStatus(message: string, session?: unknown): void;
}

export interface LobbyCommandTeamActions {
  isSwitchingTeams(): boolean;
  requestBulkTeamState(team: number, options?: TeamStateOptions): boolean;
  requestTeamState(playerId: unknown, team: number, options?: TeamStateOptions): boolean;
  setTeamsLocked(locked: boolean): boolean;
  switchTeamPlayers(): boolean;
}

const SWITCH_SETTLE_MS = 900;

export function createLobbyCommandTeamActions(
  dependencies: LobbyCommandTeamActionDependencies
): LobbyCommandTeamActions {
  let switchLockedUntil = 0;
  let switchUnlockTimer = 0;

  function isSwitchingTeams(): boolean {
    return Date.now() < switchLockedUntil;
  }

  function lockSwitchOperation(): void {
    switchLockedUntil = Date.now() + SWITCH_SETTLE_MS;
    if (switchUnlockTimer) {
      window.clearTimeout(switchUnlockTimer);
    }
    switchUnlockTimer = window.setTimeout(() => {
      switchUnlockTimer = 0;
      if (Date.now() >= switchLockedUntil) {
        switchLockedUntil = 0;
      }
    }, SWITCH_SETTLE_MS + 50);
  }

  function requestTeamState(playerId: unknown, team: number, { requireTeamMode = false }: TeamStateOptions = {}): boolean {
    const session = getMultiplayerSession();
    if (!hasLobbyPlayerState(session)) {
      dependencies.showStatus('No active lobby or game session.');
      return false;
    }

    if (requireTeamMode && !dependencies.isTeamMode(session)) {
      dependencies.showStatus(`${getTeamStateName(team)} is only available in team modes.`);
      return false;
    }

    const player = getSessionPlayerById(session, playerId);
    if (!player) {
      dependencies.showStatus('Could not find that player.');
      return false;
    }

    if (getPlayerTeamState(player) === team) {
      dependencies.showStatus(`${formatCommandPlayerName(player)} is already ${getTeamStateName(team)}.`);
      return true;
    }

    const localPlayerId = getLocalPlayerId(session);
    if (isSamePlayerId(playerId, localPlayerId)) {
      if (team !== TEAM_STATE_SPECTATE && isSessionMatchActive(session) && dependencies.isCurrentPlayerSpectating(session)) {
        dependencies.noteLocallyInitiatedPlayTransition(session);
      }

      if (!requestPlayerTeamState(session, playerId, team, localPlayerId)) {
        dependencies.showStatus('Could not send the team change command.');
        return false;
      }
      return true;
    }

    if (!isHostSession(session)) {
      dependencies.showStatus('Only the host can move other players between teams.');
      return false;
    }

    if (!requestPlayerTeamState(session, playerId, team, localPlayerId)) {
      dependencies.showStatus('Could not send the team move command.');
      return false;
    }

    return true;
  }

  function requestBulkTeamState(
    team: number,
    { requireTeamMode = false, targetGroup = 'all' }: TeamStateOptions = {}
  ): boolean {
    const session = getMultiplayerSession();
    if (!hasLobbyPlayerState(session)) {
      dependencies.showStatus('No active lobby or game session.');
      return false;
    }

    if (requireTeamMode && !dependencies.isTeamMode(session)) {
      dependencies.showStatus(`${getTeamStateName(team)} is only available in team modes.`);
      return false;
    }

    const players = getBulkTeamTargets(team, session, targetGroup);
    if (!players.length) {
      dependencies.showStatus(`No eligible players need to ${getBulkTeamActionName(team)}.`);
      return true;
    }

    const localPlayerId = getLocalPlayerId(session);
    if (!isHostSession(session) && players.some(({ id }) => !isSamePlayerId(id, localPlayerId))) {
      dependencies.showStatus('Only the host can move other players.');
      return false;
    }

    let moved = 0;
    for (const { id } of players) {
      if (
        isSamePlayerId(id, localPlayerId) &&
        team !== TEAM_STATE_SPECTATE &&
        isSessionMatchActive(session) &&
        dependencies.isCurrentPlayerSpectating(session)
      ) {
        dependencies.noteLocallyInitiatedPlayTransition(session);
      }

      if (requestPlayerTeamState(session, id, team, localPlayerId)) {
        moved += 1;
      }
    }

    if (moved !== players.length) {
      dependencies.showStatus('Could not move every eligible player.');
      return false;
    }

    dependencies.showStatus(formatBulkTeamMoveMessage(moved, team));
    return true;
  }

  function switchTeamPlayers(): boolean {
    const session = getMultiplayerSession();
    if (!hasLobbyPlayerState(session)) {
      dependencies.showStatus('No active lobby or game session.');
      return false;
    }

    if (!dependencies.isTeamMode(session)) {
      dependencies.showStatus('SWITCH is only available in team modes.');
      return false;
    }

    if (!isHostSession(session)) {
      dependencies.showStatus('Only the host can switch teams.');
      return false;
    }

    if (isSwitchingTeams()) {
      dependencies.showStatus('Team switch is still settling.');
      return false;
    }

    const localPlayerId = getLocalPlayerId(session);
    const players = getSwitchableTeamPlayers(session);
    if (!players.length) {
      dependencies.showStatus('There are no red or blue players to switch.');
      return false;
    }

    let moved = 0;
    let failed = 0;
    const switchTargets = players.map(({ id, player }) => ({
      id,
      nextTeam: getPlayerTeamState(player) === TEAM_STATE_RED ? TEAM_STATE_BLUE : TEAM_STATE_RED,
    }));

    lockSwitchOperation();

    for (const { id, nextTeam } of switchTargets) {
      if (requestPlayerTeamState(session, id, nextTeam, localPlayerId)) {
        moved += 1;
      } else {
        failed += 1;
      }
    }

    if (failed) {
      dependencies.showStatus('Could not switch every player.');
      return false;
    }

    dependencies.showStatus(`Switching ${moved} player${moved === 1 ? '' : 's'} between red and blue.`);
    return true;
  }

  function setTeamsLocked(locked: boolean): boolean {
    const session = getMultiplayerSession();
    if (!hasLobbyPlayerState(session)) {
      dependencies.showStatus('No active lobby or game session.');
      return false;
    }

    if (!isHostSession(session)) {
      dependencies.showStatus(`Only the host can ${locked ? 'lock' : 'unlock'} teams.`);
      return false;
    }

    if (isTeamsLocked(session) === locked) {
      dependencies.showStatus(`Teams are already ${locked ? 'locked' : 'unlocked'}.`);
      return true;
    }

    if (!requestTeamsLocked(session, locked)) {
      dependencies.showStatus('Could not send the team lock/unlock command.');
      return false;
    }

    return true;
  }

  return {
    isSwitchingTeams,
    requestBulkTeamState,
    requestTeamState,
    setTeamsLocked,
    switchTeamPlayers,
  };
}
