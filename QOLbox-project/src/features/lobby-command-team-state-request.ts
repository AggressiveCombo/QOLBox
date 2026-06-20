import { movePlayerToTeam, requestOwnTeamChange } from '../hitbox/lobby-actions';
import { getLocalPlayerId, isSamePlayerId } from '../hitbox/session-adapter';

export function requestPlayerTeamState(
  session: unknown,
  playerId: unknown,
  team: number,
  localPlayerId: unknown = getLocalPlayerId(session)
): boolean {
  return isSamePlayerId(playerId, localPlayerId)
    ? requestOwnTeamChange(session, team)
    : movePlayerToTeam(session, playerId, team);
}
