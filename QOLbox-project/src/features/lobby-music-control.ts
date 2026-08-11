import { hasVisibleLayer } from '../dom/dom-helpers';
import {
  patchNativeLobbyMusicStart,
  startNativeLobbyMusic,
  stopNativeLobbyMusic,
} from '../hitbox/lobby-music-adapter';
import { getLocalStorageItem, removeLocalStorageItem, setLocalStorageItem } from '../utils/local-storage';

interface LobbyMusicControllerOptions {
  playLayerSelector: string;
  isAudioEnabled(): boolean;
}

export function createLobbyMusicController(options: LobbyMusicControllerOptions) {
  let lobbyMusicPatchInstalled = false;

  function updateNativeMusicMenuItems(): void {
    const muted = isNativeMusicMuted();
    for (const item of document.querySelectorAll<HTMLElement>('.cornerButton .items .item')) {
      if (!item.dataset.qolboxMusicMenu && !/^(?:Mute|Unmute) Music$/.test(item.textContent?.trim() || '')) {
        continue;
      }
      if (!options.isAudioEnabled()) {
        item.classList.remove('qolboxMusicMenuOption');
        item.removeAttribute('data-qolbox-icon');
        continue;
      }
      if (item.dataset.qolboxMusicMenu !== 'true') item.dataset.qolboxMusicMenu = 'true';
      const icon = muted ? 'music-off' : 'music';
      if (item.dataset.qolboxIcon !== icon) item.dataset.qolboxIcon = icon;
      item.classList.add('qolboxMusicMenuOption');
      const label = muted ? 'Unmute Music' : 'Mute Music';
      if (item.textContent?.trim() !== label) item.textContent = label;
      if (!item.dataset.qolboxMusicMenuPatched) {
        item.dataset.qolboxMusicMenuPatched = 'true';
        item.addEventListener('click', event => {
          if (!options.isAudioEnabled()) return;
          event.preventDefault();
          event.stopImmediatePropagation();
          const saved = isNativeMusicMuted()
            ? removeLocalStorageItem('music_mute')
            : setLocalStorageItem('music_mute', 'true');
          if (!saved) return;
          updateNativeMusicMenuItems();
          syncLobbyMusic();
        }, true);
      }
    }
  }

  function isNativeMusicMuted(): boolean {
    return Boolean(getLocalStorageItem('music_mute'));
  }

  function isLobbyMusicAllowed(): boolean {
    return (
      !options.isAudioEnabled() ||
      (!hasVisibleLayer(options.playLayerSelector) && !hasVisibleLayer('.lobbyContainer'))
    );
  }

  function syncLobbyMusic(): void {
    if (!options.isAudioEnabled()) {
      return;
    }

    if (isLobbyMusicAllowed() && !isNativeMusicMuted()) {
      startNativeLobbyMusic();
    } else {
      stopNativeLobbyMusic();
    }
  }

  function patchLobbyMusicController(): boolean {
    updateNativeMusicMenuItems();
    if (!options.isAudioEnabled() && !lobbyMusicPatchInstalled) {
      return false;
    }

    const patched = patchNativeLobbyMusicStart(isLobbyMusicAllowed, !lobbyMusicPatchInstalled);
    if (patched) {
      lobbyMusicPatchInstalled = true;
    }

    syncLobbyMusic();
    return patched;
  }

  return {
    patchLobbyMusicController,
  };
}
