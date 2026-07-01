import { writeChatLine } from '../hitbox/chat-adapter';
import { areAdvancedCommandAliasesEnabled } from '../settings/advanced-settings';

function getQolboxCommandHelpLines(): string[] {
  return [
    'QOLBox commands:',
    '/spec -- move yourself to spectators',
    '/spec playername -- move a player to spectators',
    '/spec all|playing -- move active players to spectators',
    '/join -- move yourself into play (non-team modes)',
    '/join playername -- move a player into play (non-team modes)',
    '/join all|spectators -- move spectators into play (non-team modes)',
    '/red -- move yourself to red (team modes)',
    '/red playername -- move a player to red (team modes)',
    '/red all|playing|spectators -- move players to red (team modes)',
    '/blue -- move yourself to blue (team modes)',
    '/blue playername -- move a player to blue (team modes)',
    '/blue all|playing|spectators -- move players to blue (team modes)',
    '/switch -- swap red and blue teams',
    '/lock -- lock team switching',
    '/unlock -- unlock team switching',
    '/host playername -- give host to a player',
    '/blacklist playername -- add an exact name to automatic host bans',
    '/blacklist -- show blacklisted names',
    '/blacklist remove playername -- remove a blacklisted name',
    '/blacklist clear|on|off -- manage the blacklist',
    '/start -- start the game',
    '/end -- end the current game',
    '/restart -- end and start a new game',
    ...(areAdvancedCommandAliasesEnabled() ? ['/r -- same as /restart'] : []),
    '/record -- record the current replay',
    ...(areAdvancedCommandAliasesEnabled() ? ['/rec -- same as /record'] : []),
    '/settings -- view normal gameplay settings',
    '/settings all -- view normal and hidden gameplay settings',
    'Named targets for /spec, /join, /red, /blue, /host, /kick, and /ban accept exact or unique partial player names.',
    'Tip: all, playing, and spectators are special targets where shown above. Quote them to use them as player names: /spec "all".',
    'Tip: quote blacklist names like "clear", "on", or "off" to add those exact names.',
  ];
}

export function writeQolboxCommandHelp(session: unknown): void {
  for (const line of getQolboxCommandHelpLines()) {
    writeChatLine(session, line);
  }
}
