import { TEAM_STATE_BLUE, TEAM_STATE_FFA, TEAM_STATE_RED, TEAM_STATE_SPECTATE } from '../hitbox/team-state';

export function getTeamStateName(team: number): string {
  switch (Number(team)) {
    case TEAM_STATE_SPECTATE:
      return 'spectator';
    case TEAM_STATE_RED:
      return 'red';
    case TEAM_STATE_BLUE:
      return 'blue';
    case TEAM_STATE_FFA:
    default:
      return 'playing';
  }
}

export function getBulkTeamActionName(team: number): string {
  if (team === TEAM_STATE_SPECTATE) {
    return 'spectate';
  }

  if (team === TEAM_STATE_FFA) {
    return 'join';
  }

  return `move to ${getTeamStateName(team)}`;
}

export function formatBulkTeamMoveMessage(moved: number, team: number): string {
  if (team === TEAM_STATE_FFA) {
    return `Moving ${moved} eligible player${moved === 1 ? '' : 's'} into play.`;
  }

  return `Moving ${moved} eligible player${moved === 1 ? '' : 's'} to ${getTeamStateName(team)}.`;
}
