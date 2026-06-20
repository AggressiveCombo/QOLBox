import { getMultiplayerSession } from '../hitbox/session-adapter';
import { getPlayerDisplayName } from '../hitbox/player-appearance-adapter';
import { formatCommandPlayerName } from './lobby-command-player-targets';
import { createLobbyCommandActions } from './lobby-command-actions';
import { createLobbyCommandDispatcher } from './lobby-command-dispatcher';
import { createQolboxChatStatusWriter } from './qolbox-chat-status';
import { installSlashCommandInterceptor } from './slash-command-interceptor';
import { installPlayerPopupDismissal } from './player-popup-dismissal';
import { createSwitchTeamsButtonController } from './switch-teams-button';
import { isTeamMode } from './team-mode-detector';

interface LobbyCommandsFeatureBundleOptions {
  areGameStartAlertsEnabled(): boolean;
  areLobbyCommandsEnabled(): boolean;
  installStartAlertHooks(session: unknown): void;
  isCurrentPlayerSpectating(session?: unknown): boolean;
  noteLocallyInitiatedPlayTransition(session?: unknown): void;
}

export function createLobbyCommandsFeatureBundle(options: LobbyCommandsFeatureBundleOptions) {
  const { showQolboxChatStatus } = createQolboxChatStatusWriter({
    getSession: getMultiplayerSession,
  });

  const lobbyCommandActions = createLobbyCommandActions({
    getPlayerDisplayName,
    isCurrentPlayerSpectating: options.isCurrentPlayerSpectating,
    isTeamMode,
    noteLocallyInitiatedPlayTransition: options.noteLocallyInitiatedPlayTransition,
    showStatus: showQolboxChatStatus,
  });

  const dispatcher = createLobbyCommandDispatcher({
    actions: lobbyCommandActions,
    areGameStartAlertsEnabled: options.areGameStartAlertsEnabled,
    installStartAlertHooks: options.installStartAlertHooks,
    noteLocallyInitiatedPlayTransition: options.noteLocallyInitiatedPlayTransition,
    showStatus: showQolboxChatStatus,
  });

  const switchTeamsButton = createSwitchTeamsButtonController({
    isEnabled: options.areLobbyCommandsEnabled,
    isSwitching: lobbyCommandActions.isSwitchingTeams,
    isTeamMode,
    switchTeams: lobbyCommandActions.switchTeamPlayers,
  });

  function prepareNativePlayerCommand(message: unknown): unknown | null {
    if (typeof message !== 'string') {
      return message;
    }

    const match = message.match(/^(\s*)\/(kick|ban)\s+(.+?)\s*$/i);
    if (!match) {
      return message;
    }

    const [, leadingSpace, commandName, rawTarget] = match;
    const quotedTarget = rawTarget.match(/^(["'])(.*)\1$/);
    const targetName = quotedTarget ? quotedTarget[2] : rawTarget;
    const result = lobbyCommandActions.findPlayerByName(targetName);
    if (result.status === 'found') {
      return `${leadingSpace}/${commandName.toLowerCase()} ${formatCommandPlayerName(result.match.player)}`;
    }

    if (result.status === 'ambiguous') {
      const matches = result.matches
        .map(({ player }) => getPlayerDisplayName(player) || 'Unnamed Player')
        .slice(0, 4)
        .join(', ');
      showQolboxChatStatus(`Player name '${targetName}' is ambiguous${matches ? `: ${matches}` : ''}.`);
      return null;
    }

    showQolboxChatStatus(`Couldn't find player '${targetName}'.`);
    return null;
  }

  function patchSlashCommands(): boolean {
    return installSlashCommandInterceptor(getMultiplayerSession(), {
      areCommandsEnabled: options.areLobbyCommandsEnabled,
      handleCommand: dispatcher.handleQolboxSlashCommand,
      prepareNativeCommand: prepareNativePlayerCommand,
      showHelp: lobbyCommandActions.showQolboxCommandHelp,
    });
  }

  return {
    ...lobbyCommandActions,
    ...dispatcher,
    ...switchTeamsButton,
    installPlayerPopupDismissal,
    patchSlashCommands,
    showQolboxChatStatus,
  };
}
