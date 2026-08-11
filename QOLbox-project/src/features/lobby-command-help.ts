import { writeChatLine } from '../hitbox/chat-adapter';
import { areAdvancedCommandAliasesEnabled } from '../settings/advanced-settings';

export function getQolboxCommandHelpLines(): string[] {
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

export function getQolboxCommandReferenceLines(): string[] {
  return [
    'QOLBox commands:',
    '/help -- show Hitbox and QOLBox command help',
    '/spec [target] -- move yourself, one player, or active players to spectators',
    '/join [target] -- move yourself, one player, or spectators into play in non-team modes',
    '/red | /blue [target] -- move yourself or matching players to a team',
    '/switch -- swap red and blue teams',
    '/lock | /unlock -- lock or unlock team switching',
    '/host | /kick | /ban playername -- give host to, kick, or ban a player',
    '/blacklist [action or name] -- view or manage exact-name automatic host bans',
    '/start | /end | /restart -- control the current game as host',
    '/r -- same as /restart when Command aliases is enabled',
    '/record | /rec -- record the current replay; /rec requires Command aliases',
    '/settings [all] -- view normal settings, or include hidden settings with all',
    'Targets accept exact or unique partial player names. Depending on the command, all, playing, and spectators select groups. Blacklist actions are remove, clear, on, and off. Quote a reserved word to use it as a player name.',
  ];
}

export function writeQolboxCommandHelp(session: unknown): void {
  for (const line of getQolboxCommandHelpLines()) {
    writeChatLine(session, line);
  }
}
