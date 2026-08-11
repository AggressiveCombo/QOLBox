import {
  type SessionPlayerEntry,
  getMultiplayerSession,
  getPlayerName,
  getSessionPlayers,
} from '../hitbox/session-adapter';

interface FoundPlayerResult {
  status: 'found';
  match: SessionPlayerEntry;
  matches: SessionPlayerEntry[];
}

interface MissingPlayerResult {
  status: 'missing';
  matches: SessionPlayerEntry[];
}

interface AmbiguousPlayerResult {
  status: 'ambiguous';
  matches: SessionPlayerEntry[];
}

export type PlayerLookupResult = FoundPlayerResult | MissingPlayerResult | AmbiguousPlayerResult;

export type CommandTargetGroup = 'all' | 'playing' | 'spectators';

export type CommandTarget =
  | { group: CommandTargetGroup; type: 'group'; value: string }
  | { type: 'player'; value: string };

const GROUP_TARGETS: ReadonlySet<string> = new Set(['all', 'playing', 'spectators']);

export function normalizePlayerName(name: unknown): string {
  return String(name || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function formatCommandPlayerName(player: unknown): string {
  const name = getPlayerName(player);
  return name ? String(name) : 'Player';
}

export function findPlayerByName(name: unknown, session: unknown = getMultiplayerSession()): PlayerLookupResult {
  const query = normalizePlayerName(name);
  if (!query) {
    return { status: 'missing', matches: [] };
  }

  const players = getSessionPlayers(session);
  const tiers = [
    players.filter(({ player }) => normalizePlayerName(getPlayerName(player)) === query),
    players.filter(({ player }) => normalizePlayerName(getPlayerName(player)).startsWith(query)),
    players.filter(({ player }) => normalizePlayerName(getPlayerName(player)).includes(query)),
  ];

  for (const matches of tiers) {
    const uniqueMatches: SessionPlayerEntry[] = [];
    const seenIds = new Set<string>();
    for (const match of matches) {
      const id = String(match.id);
      if (!seenIds.has(id)) {
        seenIds.add(id);
        uniqueMatches.push(match);
      }
    }

    const uniqueMatch = uniqueMatches[0];
    if (uniqueMatches.length === 1 && uniqueMatch) {
      return { status: 'found', match: uniqueMatch, matches: uniqueMatches };
    }

    if (uniqueMatches.length > 1) {
      return { status: 'ambiguous', matches: uniqueMatches };
    }
  }

  return { status: 'missing', matches: [] };
}

export function parseCommandTarget(argument: string): CommandTarget {
  const value = String(argument || '').trim();
  const quotedMatch = value.match(/^(["'])(.*)\1$/);
  const normalizedValue = normalizePlayerName(value);
  if (!quotedMatch && GROUP_TARGETS.has(normalizedValue)) {
    return { group: normalizedValue as CommandTargetGroup, type: 'group', value };
  }

  return { type: 'player', value: quotedMatch?.[2] ?? value };
}
