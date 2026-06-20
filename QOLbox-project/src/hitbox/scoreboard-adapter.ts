import { readNativePath } from './native-access';

export function getScorePlayers(session: unknown): unknown[] {
  const players = readNativePath(session, ['KR', 'uL', 'Ho']);
  return Array.isArray(players) ? players.filter(Boolean) : [];
}
