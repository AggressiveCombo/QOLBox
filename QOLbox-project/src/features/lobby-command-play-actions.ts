import {
  getLocalPlayerId,
  getMultiplayerSession,
  getPlayerTeamState,
  getSessionPlayerById,
  hasLobbyPlayerState,
  type SessionPlayerEntry,
} from '../hitbox/session-adapter';
import { TEAM_STATE_FFA, TEAM_STATE_SPECTATE } from '../hitbox/team-state';
import { formatCommandPlayerName, parseCommandTarget } from './lobby-command-player-targets';
import type { TeamStateOptions } from './lobby-command-team-actions';

interface LobbyCommandPlayActionDependencies {
  isTeamMode(session?: unknown): boolean;
  requestBulkTeamState(team: number, options?: TeamStateOptions): boolean;
  requestTeamState(playerId: unknown, team: number): boolean;
  resolveNamedCommandPlayer(argument: string, session?: unknown): SessionPlayerEntry | null;
  showStatus(message: string, session?: unknown): void;
}

export function createLobbyCommandPlayActions(dependencies: LobbyCommandPlayActionDependencies) {
  function handleJoinSlashCommand(argument: string): boolean {
    const session = getMultiplayerSession();
    if (!hasLobbyPlayerState(session)) {
      dependencies.showStatus('No active lobby or game session.');
      return false;
    }

    if (dependencies.isTeamMode(session)) {
      dependencies.showStatus('Use /red or /blue to join in team modes.');
      return false;
    }

    const targetArgument = parseCommandTarget(argument);
    if (targetArgument.type === 'group') {
      return dependencies.requestBulkTeamState(TEAM_STATE_FFA, { targetGroup: targetArgument.group });
    }

    const target = argument
      ? dependencies.resolveNamedCommandPlayer(targetArgument.value, session)
      : { id: getLocalPlayerId(session), player: null };
    if (!target) {
      return false;
    }

    const player = getSessionPlayerById(session, target.id);
    if (player && getPlayerTeamState(player) === TEAM_STATE_FFA) {
      dependencies.showStatus(`${formatCommandPlayerName(player)} is already playing.`);
      return true;
    }

    return dependencies.requestTeamState(target.id, TEAM_STATE_FFA);
  }

  function handleSpecSlashCommand(argument: string): boolean {
    const session = getMultiplayerSession();
    const targetArgument = parseCommandTarget(argument);
    if (targetArgument.type === 'group') {
      return dependencies.requestBulkTeamState(TEAM_STATE_SPECTATE, { targetGroup: targetArgument.group });
    }

    const target = argument
      ? dependencies.resolveNamedCommandPlayer(targetArgument.value, session)
      : { id: getLocalPlayerId(session), player: null };
    return target ? dependencies.requestTeamState(target.id, TEAM_STATE_SPECTATE) : false;
  }

  return {
    handleJoinSlashCommand,
    handleSpecSlashCommand,
  };
}
