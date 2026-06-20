import { getMultiplayerSession, type SessionPlayerEntry } from '../hitbox/session-adapter';
import {
  type PlayerLookupResult,
  findPlayerByName,
} from './lobby-command-player-targets';

interface CommandPlayerResolverOptions {
  getPlayerDisplayName(player: unknown): string;
  showStatus(message: string, session?: unknown): void;
}

function formatPlayerNameMatches(
  matches: readonly SessionPlayerEntry[],
  getPlayerDisplayName: (player: unknown) => string
): string {
  return matches
    .map(({ player }) => getPlayerDisplayName(player) || 'Unnamed Player')
    .filter(Boolean)
    .slice(0, 4)
    .join(', ');
}

export function createCommandPlayerResolver(options: CommandPlayerResolverOptions) {
  function resolveNamedCommandPlayer(
    argument: string,
    session: unknown = getMultiplayerSession()
  ): SessionPlayerEntry | null {
    const result = findPlayerByName(argument, session);
    if (result.status === 'missing') {
      options.showStatus(`Couldn't find player '${argument}'.`);
      return null;
    }

    if (result.status === 'ambiguous') {
      const matches = formatPlayerNameMatches(result.matches, options.getPlayerDisplayName);
      options.showStatus(`Player name '${argument}' is ambiguous${matches ? `: ${matches}` : ''}.`);
      return null;
    }

    return result.match;
  }

  return {
    resolveNamedCommandPlayer,
  };
}

export type { PlayerLookupResult };
