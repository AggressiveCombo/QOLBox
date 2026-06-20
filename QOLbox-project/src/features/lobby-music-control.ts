import { hasVisibleLayer } from '../dom/dom-helpers';
import { patchNativeLobbyMusicStart, stopNativeLobbyMusic } from '../hitbox/lobby-music-adapter';

interface LobbyMusicControllerOptions {
  playLayerSelector: string;
  isAudioEnabled(): boolean;
}

export function createLobbyMusicController(options: LobbyMusicControllerOptions) {
  let lobbyMusicPatchInstalled = false;

  function isLobbyMusicAllowed(): boolean {
    return !options.isAudioEnabled() || !hasVisibleLayer(options.playLayerSelector);
  }

  function stopLobbyMusicIfNeeded(): void {
    if (!options.isAudioEnabled() || isLobbyMusicAllowed()) {
      return;
    }

    stopNativeLobbyMusic();
  }

  function patchLobbyMusicController(): boolean {
    if (!options.isAudioEnabled() && !lobbyMusicPatchInstalled) {
      return false;
    }

    if (!patchNativeLobbyMusicStart(isLobbyMusicAllowed, !lobbyMusicPatchInstalled)) {
      return false;
    }

    lobbyMusicPatchInstalled = true;
    stopLobbyMusicIfNeeded();
    return true;
  }

  return {
    patchLobbyMusicController,
    stopLobbyMusicIfNeeded,
  };
}
