import { writeChatLine } from '../hitbox/chat-adapter';
import { areAdvancedCommandAliasesEnabled } from '../settings/advanced-settings';

function getQolboxCommandHelpLines(): string[] {
  return [
    'QOLBox commands:',
    '/spec -- spectate yourself',
    '/spec playername -- spectate a player',
    '/spec all|playing|spectators -- spectate a group',
    '/join -- join play yourself (non-team modes)',
    '/join playername -- join a player (non-team modes)',
    '/join all|playing|spectators -- join a group (non-team modes)',
    '/red -- join red yourself (team modes)',
    '/red playername -- move a player to red (team modes)',
    '/red all|playing|spectators -- move a group to red (team modes)',
    '/blue -- join blue yourself (team modes)',
    '/blue playername -- move a player to blue (team modes)',
    '/blue all|playing|spectators -- move a group to blue (team modes)',
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
    'Native /kick and /ban accept exact or unique partial player names.',
    'Tip: to target players named all, playing, or spectators, quote the name: /spec "all".',
  ];
}

export function writeQolboxCommandHelp(session: unknown): void {
  for (const line of getQolboxCommandHelpLines()) {
    writeChatLine(session, line);
  }
}
