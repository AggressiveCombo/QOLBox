import {
  FULLSCREEN_PLAY_LAYER_SELECTOR,
  JUKEBOX_DRAG_SENSITIVITY,
  JUKEBOX_WHEEL_STEP,
  RESIZE_SETTLE_PASSES,
  YOUTUBE_HOOK_MAX_RETRIES,
  YOUTUBE_HOOK_RETRY_DELAY_MS,
} from '../config/qolbox-constants';
import { findChangeControlsItem, findSettingsContainer } from '../dom/settings-menu-dom';
import type { ScheduledUiWorkRequest } from '../types/scheduled-work';
import { createGameVolumeController } from './game-volume-control';
import { createJukeboxController } from './jukebox-control';
import { createLobbyMusicController } from './lobby-music-control';

interface AudioFeatureBundleOptions {
  focusActiveRenderCanvas(): void;
  getActiveRenderCanvas(): Element | null;
  getActiveRenderMode(): string;
  isAudioEnabled(): boolean;
  isChatInput(target: unknown): boolean;
  playCustomSound(howl: unknown): number | null;
  stopCustomSound(howl: unknown, id?: unknown): boolean;
  isReserveRetryAudioSuppressed(): boolean;
  resetBrowserScroll(): void;
  scheduleUiWork(options: ScheduledUiWorkRequest): void;
}

export function createAudioFeatureBundle(options: AudioFeatureBundleOptions) {
  const gameVolume = createGameVolumeController({
    isAudioEnabled: options.isAudioEnabled,
    playCustomSound: options.playCustomSound,
    stopCustomSound: options.stopCustomSound,
    isReserveRetryAudioSuppressed: options.isReserveRetryAudioSuppressed,
  });

  const jukebox = createJukeboxController({
    jukeboxDragSensitivity: JUKEBOX_DRAG_SENSITIVITY,
    jukeboxWheelStep: JUKEBOX_WHEEL_STEP,
    resizeSettlePasses: RESIZE_SETTLE_PASSES,
    youTubeHookMaxRetries: YOUTUBE_HOOK_MAX_RETRIES,
    youTubeHookRetryDelayMs: YOUTUBE_HOOK_RETRY_DELAY_MS,
    findChangeControlsItem,
    findSettingsContainer,
    focusActiveRenderCanvas: options.focusActiveRenderCanvas,
    getActiveRenderCanvas: options.getActiveRenderCanvas,
    getActiveRenderMode: options.getActiveRenderMode,
    isAudioEnabled: options.isAudioEnabled,
    isChatInput: options.isChatInput,
    resetBrowserScroll: options.resetBrowserScroll,
    scheduleUiWork: options.scheduleUiWork,
  });

  const lobbyMusic = createLobbyMusicController({
    playLayerSelector: FULLSCREEN_PLAY_LAYER_SELECTOR,
    isAudioEnabled: options.isAudioEnabled,
  });

  return {
    ...gameVolume,
    ...jukebox,
    ...lobbyMusic,
  };
}
