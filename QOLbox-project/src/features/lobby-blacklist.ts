import { banPlayer } from '../hitbox/lobby-actions';
import { installPlayerJoinHook } from '../hitbox/player-join-hooks';
import {
  getLocalPlayerId,
  getMultiplayerSession,
  getPlayerName,
  getSessionPlayers,
  hasLobbyPlayerState,
  isHostSession,
  isSamePlayerId,
} from '../hitbox/session-adapter';
import { MAX_BLACKLIST_ENTRIES, loadBlacklistNames, saveBlacklistNames } from '../settings/blacklist-storage';
import { normalizePlayerName } from './lobby-command-player-targets';

interface LobbyBlacklistOptions {
  areLobbyCommandsEnabled(): boolean;
  isEnforcementEnabled(): boolean;
  setEnforcementEnabled(enabled: boolean): void;
  showStatus(message: string, session?: unknown): void;
}

interface StoredNameLookup {
  matches: string[];
  status: 'ambiguous' | 'found' | 'missing';
}

interface ParsedBlacklistName {
  quoted: boolean;
  value: string;
}

interface CurrentPlayerNameLookup {
  match: string | null;
  partialMatches: string[];
}

function parseQuotedName(value: string): ParsedBlacklistName {
  const trimmed = value.trim();
  const match = trimmed.match(/^(["'])(.*)\1$/);
  return {
    quoted: Boolean(match),
    value: (match ? match[2] : trimmed).replace(/\s+/g, ' ').trim(),
  };
}

function findStoredName(names: readonly string[], query: string): StoredNameLookup {
  const normalizedQuery = normalizePlayerName(query);
  if (!normalizedQuery) {
    return { matches: [], status: 'missing' };
  }

  const tiers = [
    names.filter(name => normalizePlayerName(name) === normalizedQuery),
    names.filter(name => normalizePlayerName(name).startsWith(normalizedQuery)),
    names.filter(name => normalizePlayerName(name).includes(normalizedQuery)),
  ];

  for (const matches of tiers) {
    if (matches.length === 1) {
      return { matches, status: 'found' };
    }
    if (matches.length > 1) {
      return { matches, status: 'ambiguous' };
    }
  }

  return { matches: [], status: 'missing' };
}

function getUniqueCurrentPlayerNames(): string[] {
  const names: string[] = [];
  const seen = new Set<string>();
  for (const { player } of getSessionPlayers()) {
    const name = String(getPlayerName(player) || '').replace(/\s+/g, ' ').trim();
    const normalizedName = normalizePlayerName(name);
    if (!normalizedName || seen.has(normalizedName)) {
      continue;
    }

    seen.add(normalizedName);
    names.push(name);
  }

  return names;
}

function findCurrentPlayerName(requestedName: string): CurrentPlayerNameLookup {
  const normalizedRequest = normalizePlayerName(requestedName);
  if (!normalizedRequest) {
    return { match: null, partialMatches: [] };
  }

  const names = getUniqueCurrentPlayerNames();
  const exactMatch = names.find(name => normalizePlayerName(name) === normalizedRequest) || null;
  if (exactMatch) {
    return { match: exactMatch, partialMatches: [] };
  }

  const partialMatches = names
    .filter(name => normalizePlayerName(name).includes(normalizedRequest))
    .slice(0, 4);
  return { match: null, partialMatches };
}

function getQuotedCommandExample(name: string): string {
  return name.includes('"') ? `/blacklist '${name}'` : `/blacklist "${name}"`;
}

function getPartialCurrentPlayerMessage(requestedName: string, matches: readonly string[]): string {
  const matchText = matches.join(', ');
  return (
    `Blacklist uses exact names. '${requestedName}' partially matches ${matchText}. ` +
    `Type the full player name or use ${getQuotedCommandExample(requestedName)} to add exactly '${requestedName}'.`
  );
}

export function createLobbyBlacklistController(options: LobbyBlacklistOptions) {
  let blacklistNames = loadBlacklistNames();
  let hookTarget: unknown = null;
  let attemptedSession: unknown = null;
  let attemptedPlayers = new Set<string>();

  function saveNames(nextNames: readonly string[]): void {
    blacklistNames = saveBlacklistNames(nextNames);
  }

  function getBlacklistNameMap(): Map<string, string> {
    return new Map(blacklistNames.map(name => [normalizePlayerName(name), name]));
  }

  function resetAttemptsForSession(session: unknown): void {
    if (attemptedSession === session) {
      return;
    }

    attemptedSession = session;
    attemptedPlayers = new Set();
  }

  function enforceBlacklist(session: unknown = getMultiplayerSession()): number {
    if (
      !options.areLobbyCommandsEnabled() ||
      !options.isEnforcementEnabled() ||
      !hasLobbyPlayerState(session) ||
      !isHostSession(session)
    ) {
      return 0;
    }

    resetAttemptsForSession(session);
    const namesByNormalizedName = getBlacklistNameMap();
    if (!namesByNormalizedName.size) {
      return 0;
    }

    const localPlayerId = getLocalPlayerId(session);
    let banned = 0;
    for (const { id, player } of getSessionPlayers(session)) {
      if (isSamePlayerId(id, localPlayerId)) {
        continue;
      }

      const playerName = String(getPlayerName(player) || '').trim();
      const normalizedName = normalizePlayerName(playerName);
      const attemptKey = `${String(id)}\u0000${normalizedName}`;
      if (!namesByNormalizedName.has(normalizedName) || attemptedPlayers.has(attemptKey)) {
        continue;
      }

      attemptedPlayers.add(attemptKey);
      if (banPlayer(session, id)) {
        banned += 1;
        options.showStatus(`Automatically banned blacklisted player ${playerName || 'Player'}.`, session);
      } else {
        attemptedPlayers.delete(attemptKey);
        options.showStatus(`Could not automatically ban blacklisted player ${playerName || 'Player'}.`, session);
      }
    }

    return banned;
  }

  function installBlacklistHook(session: unknown = getMultiplayerSession()): boolean {
    if (!session || session === hookTarget) {
      return false;
    }

    if (installPlayerJoinHook(session, joinedSession => enforceBlacklist(joinedSession))) {
      hookTarget = session;
      return true;
    }

    return false;
  }

  function patchLobbyBlacklist(): void {
    const session = getMultiplayerSession();
    installBlacklistHook(session);
    enforceBlacklist(session);
  }

  function showBlacklist(): boolean {
    if (!blacklistNames.length) {
      options.showStatus('The blacklist is empty. Usage: /blacklist playername');
      return true;
    }

    options.showStatus(`Blacklisted names (${blacklistNames.length}):`);
    blacklistNames.forEach(name => options.showStatus(`- ${name}`));
    return true;
  }

  function addBlacklistName(rawName: string): boolean {
    const parsedName = parseQuotedName(rawName);
    const requestedName = parsedName.value;
    if (!requestedName) {
      options.showStatus('Usage: /blacklist playername');
      return false;
    }

    const currentPlayerName = parsedName.quoted ? { match: null, partialMatches: [] } : findCurrentPlayerName(requestedName);
    if (currentPlayerName.partialMatches.length) {
      options.showStatus(getPartialCurrentPlayerMessage(requestedName, currentPlayerName.partialMatches));
      return false;
    }

    const exactName = currentPlayerName.match || requestedName;
    if (blacklistNames.some(name => normalizePlayerName(name) === normalizePlayerName(exactName))) {
      options.showStatus(`${exactName} is already blacklisted.`);
      return true;
    }

    if (blacklistNames.length >= MAX_BLACKLIST_ENTRIES) {
      options.showStatus(`The blacklist is full (${MAX_BLACKLIST_ENTRIES} names). Remove a name before adding another.`);
      return false;
    }

    saveNames([...blacklistNames, exactName]);
    options.showStatus(`Added ${exactName} to the blacklist.`);
    if (!options.isEnforcementEnabled()) {
      options.showStatus('Automatic blacklist enforcement is currently off.');
    } else if (!isHostSession()) {
      options.showStatus('Automatic bans will apply when you are host.');
    }
    patchLobbyBlacklist();
    return true;
  }

  function removeBlacklistName(rawName: string): boolean {
    const requestedName = parseQuotedName(rawName).value;
    if (!requestedName) {
      options.showStatus('Usage: /blacklist remove playername');
      return false;
    }

    const result = findStoredName(blacklistNames, requestedName);
    if (result.status === 'missing') {
      options.showStatus(`Couldn't find '${requestedName}' in the blacklist.`);
      return false;
    }
    if (result.status === 'ambiguous') {
      options.showStatus(`Blacklist name '${requestedName}' is ambiguous: ${result.matches.slice(0, 4).join(', ')}.`);
      return false;
    }

    const removedName = result.matches[0];
    saveNames(blacklistNames.filter(name => normalizePlayerName(name) !== normalizePlayerName(removedName)));
    options.showStatus(`Removed ${removedName} from the blacklist.`);
    return true;
  }

  function clearBlacklist(): boolean {
    const removedCount = blacklistNames.length;
    saveNames([]);
    options.showStatus(
      removedCount
        ? `Cleared ${removedCount} ${removedCount === 1 ? 'name' : 'names'} from the blacklist.`
        : 'The blacklist is already empty.'
    );
    return true;
  }

  function setBlacklistEnforcement(enabled: boolean): boolean {
    if (options.isEnforcementEnabled() === enabled) {
      options.showStatus(`Automatic blacklist enforcement is already ${enabled ? 'on' : 'off'}.`);
      return true;
    }

    options.setEnforcementEnabled(enabled);
    options.showStatus(`Automatic blacklist enforcement is now ${enabled ? 'on' : 'off'}.`);
    if (enabled) {
      patchLobbyBlacklist();
    }
    return true;
  }

  function handleBlacklistSlashCommand(argument: string): boolean {
    const trimmed = argument.trim();
    if (!trimmed) {
      return showBlacklist();
    }

    const parsedName = parseQuotedName(trimmed);
    if (parsedName.quoted) {
      return addBlacklistName(trimmed);
    }

    const commandMatch = trimmed.match(/^(clear|on|off)$/i);
    if (commandMatch?.[1].toLowerCase() === 'clear') {
      return clearBlacklist();
    }
    if (commandMatch?.[1].toLowerCase() === 'on') {
      return setBlacklistEnforcement(true);
    }
    if (commandMatch?.[1].toLowerCase() === 'off') {
      return setBlacklistEnforcement(false);
    }

    const removeMatch = trimmed.match(/^(?:remove|delete|rm)(?:\s+(.+))?$/i);
    if (removeMatch) {
      return removeBlacklistName(removeMatch[1] || '');
    }

    return addBlacklistName(trimmed);
  }

  return {
    enforceBlacklist,
    handleBlacklistSlashCommand,
    patchLobbyBlacklist,
  };
}
