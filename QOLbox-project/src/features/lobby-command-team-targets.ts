import {
  getMultiplayerSession,
  getPlayerTeamState,
  getSessionPlayers,
  type SessionPlayerEntry,
} from '../hitbox/session-adapter';
import { TEAM_STATE_BLUE, TEAM_STATE_FFA, TEAM_STATE_RED, TEAM_STATE_SPECTATE } from '../hitbox/team-state';
import type { CommandTargetGroup } from './lobby-command-player-targets';

export function getBulkTeamTargets(
  team: number,
  session: unknown = getMultiplayerSession(),
  targetGroup: CommandTargetGroup = 'all'
): SessionPlayerEntry[] {
  return getSessionPlayers(session).filter(({ player }) => {
    const currentTeam = getPlayerTeamState(player);
    if (currentTeam === Number(team)) {
      return false;
    }

    if (targetGroup === 'playing' && currentTeam === TEAM_STATE_SPECTATE) {
      return false;
    }

    if (targetGroup === 'spectators' && currentTeam !== TEAM_STATE_SPECTATE) {
      return false;
    }

    if (team === TEAM_STATE_SPECTATE) {
      return currentTeam !== TEAM_STATE_SPECTATE;
    }

    if (team === TEAM_STATE_FFA) {
      return currentTeam === TEAM_STATE_SPECTATE;
    }

    return currentTeam === TEAM_STATE_SPECTATE || currentTeam === TEAM_STATE_RED || currentTeam === TEAM_STATE_BLUE;
  });
}

export function getSwitchableTeamPlayers(session: unknown = getMultiplayerSession()): SessionPlayerEntry[] {
  return getSessionPlayers(session).filter(({ player }) => {
    const team = getPlayerTeamState(player);
    return team === TEAM_STATE_RED || team === TEAM_STATE_BLUE;
  });
}
