import type { LobbyCommandActions } from './lobby-command-actions';
import { canEndMatch, canStartMatch, endMatch, startMatch } from '../hitbox/match-actions';
import { getMultiplayerSession, isHostSession, isSessionMatchActive } from '../hitbox/session-adapter';
import { areAdvancedCommandAliasesEnabled } from '../settings/advanced-settings';

type DispatchActions = Pick<
  LobbyCommandActions,
  | 'handleHostSlashCommand'
  | 'handleJoinSlashCommand'
  | 'handleSpecSlashCommand'
  | 'handleTeamSlashCommand'
  | 'normalizePlayerName'
  | 'setTeamsLocked'
  | 'showAllHostSettings'
  | 'switchTeamPlayers'
>;

interface CommandDispatcherDependencies {
  actions: DispatchActions;
  areGameStartAlertsEnabled(): boolean;
  handleBlacklistSlashCommand(argument: string): boolean;
  installStartAlertHooks(session: unknown): void;
  noteLocallyInitiatedPlayTransition(session: unknown): void;
  showStatus(message: string): void;
}

export interface LobbyCommandDispatcher {
  endCurrentGame(): boolean;
  handleQolboxSlashCommand(message: unknown): boolean;
  restartCurrentGame(): boolean;
  startCurrentGame(): boolean;
}

function hasTextValue(value: unknown): value is { value: string } {
  return typeof value === 'object' && value !== null && 'value' in value && typeof value.value === 'string';
}

function clearHandledChatDraft(): void {
  for (const input of document.querySelectorAll('.inGameChat .input, .lobbyContainer .chatBox .input')) {
    if (hasTextValue(input)) {
      input.value = '';
    }
  }
}

export function createLobbyCommandDispatcher(dependencies: CommandDispatcherDependencies): LobbyCommandDispatcher {
  function endCurrentGame(): boolean {
    const session = getMultiplayerSession();
    if (!isSessionMatchActive(session)) {
      dependencies.showStatus('There is no active game to end.');
      return false;
    }

    if (!isHostSession(session)) {
      dependencies.showStatus('Only the host can end the current game.');
      return false;
    }

    if (!canEndMatch(session)) {
      dependencies.showStatus('The native end-game action is unavailable.');
      return false;
    }

    // Ending a game destroys the active chat before its normal submit cleanup completes.
    clearHandledChatDraft();
    endMatch(session);
    return true;
  }

  function restartCurrentGame(): boolean {
    const session = getMultiplayerSession();
    if (!isSessionMatchActive(session)) {
      dependencies.showStatus('There is no active game to restart.');
      return false;
    }

    if (!isHostSession(session)) {
      dependencies.showStatus('Only the host can restart the current game.');
      return false;
    }

    if (!canEndMatch(session) || !canStartMatch(session)) {
      dependencies.showStatus('The native restart actions are unavailable.');
      return false;
    }

    if (dependencies.areGameStartAlertsEnabled()) {
      dependencies.installStartAlertHooks(session);
    }

    clearHandledChatDraft();
    endMatch(session);
    dependencies.noteLocallyInitiatedPlayTransition(session);
    startMatch(session);
    return true;
  }

  function startCurrentGame(): boolean {
    const session = getMultiplayerSession();
    if (isSessionMatchActive(session)) {
      dependencies.showStatus('There is already an active game.');
      return false;
    }

    if (!isHostSession(session)) {
      dependencies.showStatus('Only the host can start the game.');
      return false;
    }

    if (!canStartMatch(session)) {
      dependencies.showStatus('The native start-game action is unavailable.');
      return false;
    }

    if (dependencies.areGameStartAlertsEnabled()) {
      dependencies.installStartAlertHooks(session);
    }

    clearHandledChatDraft();
    dependencies.noteLocallyInitiatedPlayTransition(session);
    startMatch(session);
    return true;
  }

  function handleQolboxSlashCommand(message: unknown): boolean {
    const text = String(message || '').trim();
    const match = text.match(/^\/(switch|lock|unlock|spec|red|blue|join|host|start|end|restart|r|settings|blacklist)(?:\s+(.+))?$/i);
    if (!match) {
      return false;
    }

    const commandName = `/${match[1].toLowerCase()}`;
    const argument = (match[2] || '').trim();

    if (commandName === '/r' && !areAdvancedCommandAliasesEnabled()) {
      return false;
    }

    if (commandName === '/switch') {
      if (argument) {
        dependencies.showStatus('/switch does not take a player name.');
        return true;
      }

      dependencies.actions.switchTeamPlayers();
      return true;
    }

    if (commandName === '/lock' || commandName === '/unlock') {
      if (argument) {
        dependencies.showStatus(`${commandName} does not take an argument.`);
        return true;
      }

      dependencies.actions.setTeamsLocked(commandName === '/lock');
      return true;
    }

    if (commandName === '/spec') {
      dependencies.actions.handleSpecSlashCommand(argument);
      return true;
    }

    if (commandName === '/join') {
      dependencies.actions.handleJoinSlashCommand(argument);
      return true;
    }

    if (commandName === '/host') {
      dependencies.actions.handleHostSlashCommand(argument);
      return true;
    }

    if (commandName === '/blacklist') {
      dependencies.handleBlacklistSlashCommand(argument);
      return true;
    }

    if (commandName === '/end') {
      if (argument) {
        dependencies.showStatus('/end does not take an argument.');
        return true;
      }

      endCurrentGame();
      return true;
    }

    if (commandName === '/start') {
      if (argument) {
        dependencies.showStatus('/start does not take an argument.');
        return true;
      }

      startCurrentGame();
      return true;
    }

    if (commandName === '/restart' || commandName === '/r') {
      if (argument) {
        dependencies.showStatus(`${commandName} does not take an argument.`);
        return true;
      }

      restartCurrentGame();
      return true;
    }

    if (commandName === '/settings') {
      if (dependencies.actions.normalizePlayerName(argument) !== 'all') {
        return false;
      }

      dependencies.actions.showAllHostSettings();
      return true;
    }

    dependencies.actions.handleTeamSlashCommand(commandName, argument);
    return true;
  }

  return { endCurrentGame, handleQolboxSlashCommand, restartCurrentGame, startCurrentGame };
}
