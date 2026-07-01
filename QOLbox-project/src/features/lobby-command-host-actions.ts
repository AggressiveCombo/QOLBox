import { giveHostToPlayer } from '../hitbox/lobby-actions';
import {
  getLocalPlayerId,
  getMultiplayerSession,
  hasLobbyPlayerState,
  isHostSession,
  isSamePlayerId,
  type SessionPlayerEntry,
} from '../hitbox/session-adapter';
import { formatCommandPlayerName } from './lobby-command-player-targets';

interface LobbyCommandHostActionDependencies {
  resolveNamedCommandPlayer(argument: string, session?: unknown): SessionPlayerEntry | null;
  showStatus(message: string, session?: unknown): void;
}

export function createLobbyCommandHostActions(dependencies: LobbyCommandHostActionDependencies) {
  function handleHostSlashCommand(argument: string): boolean {
    const session = getMultiplayerSession();
    if (!hasLobbyPlayerState(session)) {
      dependencies.showStatus('No active lobby or game session.');
      return false;
    }

    if (!argument) {
      dependencies.showStatus('Usage: /host playername');
      return false;
    }

    if (!isHostSession(session)) {
      dependencies.showStatus('Only the host can transfer host to another player.');
      return false;
    }

    const target = dependencies.resolveNamedCommandPlayer(argument, session);
    if (!target) {
      return false;
    }

    if (isSamePlayerId(target.id, getLocalPlayerId(session))) {
      dependencies.showStatus('You are already host.');
      return true;
    }

    if (!giveHostToPlayer(session, target.id)) {
      dependencies.showStatus('Could not send the host transfer command.');
      return false;
    }

    dependencies.showStatus(`Giving host to ${formatCommandPlayerName(target.player)}.`);
    return true;
  }

  return {
    handleHostSlashCommand,
  };
}
