import { getPlayerName, getSessionPlayers } from '../hitbox/session-adapter';
import { areAdvancedCommandAliasesEnabled } from '../settings/advanced-settings';

const COMMANDS = [
  '/ban',
  '/blacklist',
  '/blacklist clear',
  '/blacklist off',
  '/blacklist on',
  '/blue',
  '/end',
  '/help',
  '/host',
  '/join',
  '/kick',
  '/lock',
  '/record',
  '/red',
  '/restart',
  '/settings',
  '/settings all',
  '/spec',
  '/start',
  '/switch',
  '/unlock',
] as const;
const PLAYER_COMMANDS = ['/ban', '/blacklist', '/blue', '/host', '/join', '/kick', '/red', '/spec'] as const;
const GROUP_COMMANDS = ['/blue', '/join', '/red', '/spec'] as const;
const GROUPS = ['all', 'playing', 'spectators'] as const;

function formatPlayerName(name: string): string {
  return /^(?:all|playing|spectators|clear|on|off)$/i.test(name) ? `"${name}"` : name;
}

function getChatCommandCandidates(): Set<string> {
  const players = getSessionPlayers()
    .map(({ player }) => String(getPlayerName(player) || '').trim())
    .filter(Boolean);
  const candidates = new Set<string>(COMMANDS);
  if (areAdvancedCommandAliasesEnabled()) {
    candidates.add('/r');
    candidates.add('/rec');
  }
  for (const command of GROUP_COMMANDS) {
    for (const group of GROUPS) candidates.add(`${command} ${group}`);
  }
  for (const name of players) {
    const formattedName = formatPlayerName(name);
    for (const command of PLAYER_COMMANDS) candidates.add(`${command} ${formattedName}`);
    candidates.add(`/blacklist remove ${formattedName}`);
  }
  return candidates;
}

export function isKnownChatCommand(value: string): boolean {
  const typed = value.trimStart().toLowerCase();
  return typed.startsWith('/') && [...getChatCommandCandidates()]
    .some(candidate => candidate.toLowerCase() === typed);
}

export function getChatCommandCompletions(value: string): string[] {
  const leadingSpace = value.match(/^\s*/)?.[0] || '';
  const typed = value.slice(leadingSpace.length);
  if (!typed.startsWith('/')) return [];

  const normalized = typed.toLowerCase();
  return [...getChatCommandCandidates()]
    .filter(candidate => candidate.length > typed.length && candidate.toLowerCase().startsWith(normalized))
    .sort((left, right) => left.localeCompare(right) || left.length - right.length)
    .map(candidate => `${leadingSpace}${candidate}`);
}
