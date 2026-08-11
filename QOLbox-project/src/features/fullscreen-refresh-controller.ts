import type { FullscreenDimensions, FullscreenLayoutProbe } from './fullscreen-types';
import type { ScheduledUiWorkRequest } from '../types/scheduled-work';

interface FullscreenRefreshControllerOptions {
  enforceFullscreenLayout(dimensions: FullscreenDimensions): void;
  getFullscreenDimensions(): FullscreenDimensions;
  getLayoutProbe(): FullscreenLayoutProbe;
  isFullscreenEnabled(): boolean;
  isMenuGameplayOverlap(): boolean;
  isRenderProbeAligned(probe: FullscreenLayoutProbe, dimensions: FullscreenDimensions): boolean;
  patchLobbyMusicController(): void;
  resizeKnownFullscreenRenderers(dimensions: FullscreenDimensions): void;
  scheduleUiWork(request: ScheduledUiWorkRequest): void;
  shouldWaitForNativeLayoutSeed(): boolean;
  syncNonFullscreenHud(): void;
  updateGameStartIndicator(): void;
}

export function createFullscreenRefreshController(options: FullscreenRefreshControllerOptions) {
  let nativeSeedRetryTimer = 0;

  function clearNativeSeedRetry(): void {
    if (!nativeSeedRetryTimer) {
      return;
    }
    window.clearTimeout(nativeSeedRetryTimer);
    nativeSeedRetryTimer = 0;
  }

  function refreshFullscreen(): boolean {
    if (!options.isFullscreenEnabled()) {
      clearNativeSeedRetry();
      options.syncNonFullscreenHud();
      return false;
    }

    if (options.shouldWaitForNativeLayoutSeed()) {
      if (!nativeSeedRetryTimer) {
        nativeSeedRetryTimer = window.setTimeout(() => {
          nativeSeedRetryTimer = 0;
          options.scheduleUiWork({ passes: 1 });
        }, 100);
      }
      return false;
    }

    clearNativeSeedRetry();

    const dimensions = options.getFullscreenDimensions();
    const transitionOverlap = options.isMenuGameplayOverlap();

    options.patchLobbyMusicController();
    options.updateGameStartIndicator();
    options.enforceFullscreenLayout(dimensions);

    if (!transitionOverlap) {
      options.resizeKnownFullscreenRenderers(dimensions);
    }

    if (options.isRenderProbeAligned(options.getLayoutProbe(), dimensions)) {
      return false;
    }

    options.enforceFullscreenLayout(dimensions);
    return true;
  }

  return {
    refreshFullscreen,
  };
}
