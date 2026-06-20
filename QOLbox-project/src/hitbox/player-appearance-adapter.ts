import { isNativeObject, readNativeProperty } from './native-access';

const PLAYER_NAME_FIELDS: readonly PropertyKey[] = ['name', 'Nm', 'username', 'playerName'];

export function getPlayerDisplayName(player: unknown): string {
  if (!isNativeObject(player)) {
    return '';
  }

  for (const key of PLAYER_NAME_FIELDS) {
    const value = readNativeProperty(player, key);
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return '';
}

export function getPlayerColorCandidates(player: unknown): unknown[] {
  if (!isNativeObject(player)) {
    return [];
  }

  return Object.entries(player)
    .filter(([key]) => /(colou?r|color|fill|tint)/i.test(key))
    .map(([, value]) => value);
}
