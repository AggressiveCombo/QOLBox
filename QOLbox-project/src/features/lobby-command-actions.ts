import { TEAM_STATE_BLUE, TEAM_STATE_RED } from '../hitbox/team-state';
import {
  getLocalPlayerId,
  getMultiplayerSession,
} from '../hitbox/session-adapter';
import {
  type TeamStateOptions,
  createLobbyCommandTeamActions,
  getTeamStateName,
} from './lobby-command-team-actions';
import {
  type PlayerLookupResult,
  findPlayerByName,
  normalizePlayerName,
  parseCommandTarget,
} from './lobby-command-player-targets';
import { createCommandPlayerResolver } from './lobby-command-player-resolver';
import { createLobbyCommandHostActions } from './lobby-command-host-actions';
import { createLobbyCommandOutputActions } from './lobby-command-output-actions';
import { createLobbyCommandPlayActions } from './lobby-command-play-actions';

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
  const playerResolver = createCommandPlayerResolver({
    getPlayerDisplayName: dependencies.getPlayerDisplayName,
    showStatus: dependencies.showStatus,
  });
  const outputActions = createLobbyCommandOutputActions({
    showStatus: dependencies.showStatus,
  });
  const hostActions = createLobbyCommandHostActions({
    resolveNamedCommandPlayer: playerResolver.resolveNamedCommandPlayer,
    showStatus: dependencies.showStatus,
  });
  const playActions = createLobbyCommandPlayActions({
    isTeamMode: dependencies.isTeamMode,
    requestBulkTeamState,
    requestTeamState,
    resolveNamedCommandPlayer: playerResolver.resolveNamedCommandPlayer,
    showStatus: dependencies.showStatus,
  });

  function requestTeamState(playerId: unknown, team: number, options: TeamStateOptions = {}): boolean {
    return teamActions.requestTeamState(playerId, team, options);
  }

  function requestBulkTeamState(team: number, options: TeamStateOptions = {}): boolean {
    return teamActions.requestBulkTeamState(team, options);
  }

  function switchTeamPlayers(): boolean {
    return teamActions.switchTeamPlayers();
  }

  function setTeamsLocked(locked: boolean): boolean {
    return teamActions.setTeamsLocked(locked);
  }

  function isSwitchingTeams(): boolean {
    return teamActions.isSwitchingTeams();
  }

  function handleTeamSlashCommand(commandName: string, argument: string): boolean {
    const session = getMultiplayerSession();
    const targetTeam = commandName === '/blue' ? TEAM_STATE_BLUE : TEAM_STATE_RED;

    if (!argument) {
      return requestTeamState(getLocalPlayerId(session), targetTeam, { requireTeamMode: true });
    }

    const targetArgument = parseCommandTarget(argument);
    if (targetArgument.type === 'group') {
      return requestBulkTeamState(targetTeam, { requireTeamMode: true, targetGroup: targetArgument.group });
    }

    if (!dependencies.isTeamMode(session)) {
      dependencies.showStatus(`${getTeamStateName(targetTeam)} is only available in team modes.`);
      return false;
    }

    const target = playerResolver.resolveNamedCommandPlayer(targetArgument.value, session);
    return target ? requestTeamState(target.id, targetTeam, { requireTeamMode: true }) : false;
  }

  function handleJoinSlashCommand(argument: string): boolean {
    return playActions.handleJoinSlashCommand(argument);
  }

  function handleSpecSlashCommand(argument: string): boolean {
    return playActions.handleSpecSlashCommand(argument);
  }

  return {
    findPlayerByName,
    handleHostSlashCommand: hostActions.handleHostSlashCommand,
    handleJoinSlashCommand,
    handleSpecSlashCommand,
    handleTeamSlashCommand,
    normalizePlayerName,
    requestBulkTeamState,
    requestTeamState,
    setTeamsLocked,
    showAllHostSettings: outputActions.showAllHostSettings,
    showQolboxCommandHelp: outputActions.showQolboxCommandHelp,
    isSwitchingTeams,
    switchTeamPlayers,
  };
}
