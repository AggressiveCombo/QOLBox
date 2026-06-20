import { canWriteChatLine, writeChatLine } from '../hitbox/chat-adapter';
import { readAllHostSettingLines } from '../hitbox/host-settings-adapter';
import { getMultiplayerSession } from '../hitbox/session-adapter';
import { writeQolboxCommandHelp } from './lobby-command-help';

interface LobbyCommandOutputDependencies {
  showStatus(message: string, session?: unknown): void;
}

export interface LobbyCommandOutputActions {
  showAllHostSettings(): boolean;
  showQolboxCommandHelp(session?: unknown): void;
}

export function createLobbyCommandOutputActions(
  dependencies: LobbyCommandOutputDependencies
): LobbyCommandOutputActions {
  function showAllHostSettings(): boolean {
    const session = getMultiplayerSession();
    const lines = readAllHostSettingLines(session);
    if (!lines || !canWriteChatLine(session)) {
      dependencies.showStatus('Could not read the current host settings.', session);
      return false;
    }

    lines.forEach(line => writeChatLine(session, line));
    return true;
  }

  function showQolboxCommandHelp(session: unknown = getMultiplayerSession()): void {
    writeQolboxCommandHelp(session);
  }

  return { showAllHostSettings, showQolboxCommandHelp };
}
