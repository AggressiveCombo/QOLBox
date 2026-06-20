import {
  DEFAULT_GAME_PERCENT,
  STEP_PERCENT,
  clampPercent,
  loadGamePercent,
  saveGamePercent,
} from '../settings/audio-storage';
import { createHowlerGameAudioAdapter } from '../hitbox/howler-audio-adapter';
import { percentToGameScalar } from './audio-levels';
import { createGameVolumeMenuController } from './game-volume-menu-control';

interface GameVolumeControllerOptions {
  isAudioEnabled(): boolean;
  isReserveRetryAudioSuppressed(): boolean;
}

export function createGameVolumeController(options: GameVolumeControllerOptions) {
  let gamePercent = loadGamePercent();
  const howlerAudio = createHowlerGameAudioAdapter({
    getGameVolumeScalar: () => (options.isAudioEnabled() ? percentToGameScalar(gamePercent) : 1),
    isAudioEnabled: options.isAudioEnabled,
    shouldSuppressReserveRetryAudio: options.isReserveRetryAudioSuppressed,
  });
  const menuController = createGameVolumeMenuController({
    stepPercent: STEP_PERCENT,
    getGamePercent: () => gamePercent,
    isAudioEnabled: options.isAudioEnabled,
    setGamePercent,
  });

  function updateGameVolumeText(): void {
    menuController.updateGameVolumeText();
  }

  function applyGameVolume(): void {
    updateGameVolumeText();
    howlerAudio.applyGameVolumeToHowls();
  }

  function setGamePercent(nextPercent: number): void {
    gamePercent = clampPercent(nextPercent, DEFAULT_GAME_PERCENT);
    saveGamePercent(gamePercent);
    applyGameVolume();
  }

  function patchGameVolumeMenu(): boolean {
    return menuController.patchGameVolumeMenu();
  }

  function shouldSuppressReserveRetryAudio(): boolean {
    return options.isReserveRetryAudioSuppressed();
  }

  function hookHowlPrototype(): boolean {
    const volumePatched = howlerAudio.hookHowlPrototype();
    if (volumePatched) {
      applyGameVolume();
    }

    return volumePatched;
  }

  return {
    applyGameVolume,
    hookHowlPrototype,
    patchGameVolumeMenu,
    setGamePercent,
    shouldSuppressReserveRetryAudio,
  };
}
