import { giveHostToPlayer } from '../hitbox/lobby-actions';
import { TEAM_STATE_BLUE, TEAM_STATE_FFA, TEAM_STATE_RED, TEAM_STATE_SPECTATE } from '../hitbox/team-state';
import { canWriteChatLine, writeChatLine } from '../hitbox/chat-adapter';
import { readAllHostSettingLines } from '../hitbox/host-settings-adapter';
import {
  getLocalPlayerId,
  getMultiplayerSession,
  getPlayerTeamState,
  getSessionPlayerById,
  hasLobbyPlayerState,
  isHostSession,
  isSamePlayerId,
  type SessionPlayerEntry,
} from '../hitbox/session-adapter';
import {
  type TeamStateOptions,
  createLobbyCommandTeamActions,
  getTeamStateName,
} from './lobby-command-team-actions';
import {
  type PlayerLookupResult,
  findPlayerByName,
  formatCommandPlayerName,
  normalizePlayerName,
  parseCommandTarget,
} from './lobby-command-player-targets';
import { writeQolboxCommandHelp } from './lobby-command-help';

export type { PlayerLookupResult } from './lobby-command-player-targets';
export type { TeamStateOptions } from './lobby-command-team-actions';

interface LobbyCommandDependencies {
  getPlayerDisplayName(player: unknown): string;
  isCurrentPlayerSpectating(session?: unknown): boolean;
  isTeamMode(session?: unknown): boolean;
  noteLocallyInitiatedPlayTransition(session?: unknown): void;
  showStatus(message: string, session?: unknown): void;
}

export interface LobbyCommandActions {
  findPlayerByName(name: unknown, session?: unknown): PlayerLookupResult;
  handleHostSlashCommand(argument: string): boolean;
  handleJoinSlashCommand(argument: string): boolean;
  handleSpecSlashCommand(argument: string): boolean;
  handleTeamSlashCommand(commandName: string, argument: string): boolean;
  normalizePlayerName(name: unknown): string;
  requestBulkTeamState(team: number, options?: TeamStateOptions): boolean;
  requestTeamState(playerId: unknown, team: number, options?: TeamStateOptions): boolean;
  setTeamsLocked(locked: boolean): boolean;
  showAllHostSettings(): boolean;
  showQolboxCommandHelp(session?: unknown): void;
  isSwitchingTeams(): boolean;
  switchTeamPlayers(): boolean;
}

export function createLobbyCommandActions(dependencies: LobbyCommandDependencies): LobbyCommandActions {
  const teamActions = createLobbyCommandTeamActions({
    isCurrentPlayerSpectating: dependencies.isCurrentPlayerSpectating,
    isTeamMode: dependencies.isTeamMode,
    noteLocallyInitiatedPlayTransition: dependencies.noteLocallyInitiatedPlayTransition,
    showStatus: dependencies.showStatus,
  });

  function resolveNamedCommandPlayer(
    argument: string,
    session: unknown = getMultiplayerSession()
  ): SessionPlayerEntry | null {
    const result = findPlayerByName(argument, session);
    if (result.status === 'missing') {
      dependencies.showStatus(`Couldn't find player '${argument}'.`);
      return null;
    }

    if (result.status === 'ambiguous') {
      const matches = result.matches
        .map(({ player }) => dependencies.getPlayerDisplayName(player) || 'Unnamed Player')
        .slice(0, 4)
        .join(', ');
      dependencies.showStatus(`Player name '${argument}' is ambiguous${matches ? `: ${matches}` : ''}.`);
      return null;
    }

    return result.match;
  }

  function handleHostSlashCommand(argument: string): boolean {
    const session = getMultiplayerSession();
    if (!hasLobbyPlayerState(session)) {
      dependencies.showStatus('No active lobby or game session.');
      return false;
    }

    if (!argument) {
      dependencies.showStatus('Usage: /host playername');
      return false;
    }

    if (!isHostSession(session)) {
      dependencies.showStatus('Only the host can transfer host to another player.');
      return false;
    }

    const target = resolveNamedCommandPlayer(argument, session);
    if (!target) {
      return false;
    }

    if (isSamePlayerId(target.id, getLocalPlayerId(session))) {
      dependencies.showStatus('You are already host.');
      return true;
    }

    if (!giveHostToPlayer(session, target.id)) {
      dependencies.showStatus('Could not send the host transfer command.');
      return false;
    }

    dependencies.showStatus(`Giving host to ${formatCommandPlayerName(target.player)}.`);
    return true;
  }

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
      return teamActions.requestBulkTeamState(TEAM_STATE_FFA, { targetGroup: targetArgument.group });
    }

    const target = argument
      ? resolveNamedCommandPlayer(targetArgument.value, session)
      : { id: getLocalPlayerId(session), player: null };
    if (!target) {
      return false;
    }

    const player = getSessionPlayerById(session, target.id);
    if (player && getPlayerTeamState(player) === TEAM_STATE_FFA) {
      dependencies.showStatus(`${formatCommandPlayerName(player)} is already playing.`);
      return true;
    }

    return teamActions.requestTeamState(target.id, TEAM_STATE_FFA);
  }

  function handleSpecSlashCommand(argument: string): boolean {
    const session = getMultiplayerSession();
    const targetArgument = parseCommandTarget(argument);
    if (targetArgument.type === 'group') {
      return teamActions.requestBulkTeamState(TEAM_STATE_SPECTATE, { targetGroup: targetArgument.group });
    }

    const target = argument
      ? resolveNamedCommandPlayer(targetArgument.value, session)
      : { id: getLocalPlayerId(session), player: null };
    return target ? teamActions.requestTeamState(target.id, TEAM_STATE_SPECTATE) : false;
  }

  function handleTeamSlashCommand(commandName: string, argument: string): boolean {
    const session = getMultiplayerSession();
    const targetTeam = commandName === '/blue' ? TEAM_STATE_BLUE : TEAM_STATE_RED;

    if (!argument) {
      return teamActions.requestTeamState(getLocalPlayerId(session), targetTeam, { requireTeamMode: true });
    }

    const targetArgument = parseCommandTarget(argument);
    if (targetArgument.type === 'group') {
      return teamActions.requestBulkTeamState(targetTeam, { requireTeamMode: true, targetGroup: targetArgument.group });
    }

    if (!dependencies.isTeamMode(session)) {
      dependencies.showStatus(`${getTeamStateName(targetTeam)} is only available in team modes.`);
      return false;
    }

    const target = resolveNamedCommandPlayer(targetArgument.value, session);
    return target ? teamActions.requestTeamState(target.id, targetTeam, { requireTeamMode: true }) : false;
  }

  function showAllHostSettings(): boolean {
    const session = getMultiplayerSession();
    const lines = readAllHostSettingLines(session);
    if (!lines || !canWriteChatLine(session)) {
      dependencies.showStatus('Could not read the current host settings.', session);
      return false;
    }

    lines.forEach(line => writeChatLine(session, line));
    return true;
  }

  function showQolboxCommandHelp(session: unknown = getMultiplayerSession()): void {
    writeQolboxCommandHelp(session);
  }

  return {
    findPlayerByName,
    handleHostSlashCommand,
    handleJoinSlashCommand,
    handleSpecSlashCommand,
    handleTeamSlashCommand,
    normalizePlayerName,
    requestBulkTeamState: teamActions.requestBulkTeamState,
    requestTeamState: teamActions.requestTeamState,
    setTeamsLocked: teamActions.setTeamsLocked,
    showAllHostSettings,
    showQolboxCommandHelp,
    isSwitchingTeams: teamActions.isSwitchingTeams,
    switchTeamPlayers: teamActions.switchTeamPlayers,
  };
}
