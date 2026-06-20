import type { FullscreenDimensions, FullscreenLayoutProbe } from './fullscreen-types';
import type { ScheduledUiWorkRequest } from '../types/scheduled-work';

interface FullscreenRefreshControllerOptions {
  buildFullscreenSignature(dimensions: FullscreenDimensions, probe: FullscreenLayoutProbe): string;
  clearFullscreenLayoutStyles(): void;
  enforceFullscreenLayout(dimensions: FullscreenDimensions): void;
  getFullscreenDimensions(): FullscreenDimensions;
  getLayoutProbe(): FullscreenLayoutProbe;
  installNativeFullscreenPatch(): void;
  isFullscreenEnabled(): boolean;
  isMenuGameplayOverlap(): boolean;
  isNativeProbeAligned(probe: FullscreenLayoutProbe, dimensions: FullscreenDimensions): boolean;
  isRenderProbeAligned(probe: FullscreenLayoutProbe, dimensions: FullscreenDimensions): boolean;
  patchLobbyMusicController(): void;
  resizeKnownFullscreenRenderers(dimensions: FullscreenDimensions): void;
  runNativeResize(dimensions: FullscreenDimensions): boolean;
  scheduleUiWork(request: ScheduledUiWorkRequest): void;
  setNativeFullscreenSize(dimensions: FullscreenDimensions): void;
  shouldWaitForNativeLayoutSeed(): boolean;
  stopLobbyMusicIfNeeded(): void;
  updateGameStartIndicator(): void;
}

export function createFullscreenRefreshController(options: FullscreenRefreshControllerOptions) {
  let lastFullscreenSignature = '';

  function clearFullscreenSignature(): void {
    lastFullscreenSignature = '';
  }

  function refreshFullscreen(force = false): boolean {
    if (!options.isFullscreenEnabled()) {
      options.clearFullscreenLayoutStyles();
      return false;
    }

    if (options.shouldWaitForNativeLayoutSeed()) {
      window.setTimeout(() => options.scheduleUiWork({ force: true, passes: 1 }), 100);
      return false;
    }

    const dimensions = options.getFullscreenDimensions();
    const probe = options.getLayoutProbe();
    const signature = options.buildFullscreenSignature(dimensions, probe);
    const transitionOverlap = options.isMenuGameplayOverlap();

    options.patchLobbyMusicController();
    options.stopLobbyMusicIfNeeded();
    options.updateGameStartIndicator();
    options.enforceFullscreenLayout(dimensions);
    options.installNativeFullscreenPatch();
    options.setNativeFullscreenSize(dimensions);

    if (
      !force &&
      signature === lastFullscreenSignature &&
      options.isRenderProbeAligned(probe, dimensions) &&
      options.isNativeProbeAligned(probe, dimensions)
    ) {
      return false;
    }

    lastFullscreenSignature = signature;
    const resizedNatively = options.runNativeResize(dimensions);
    const postNativeProbe = options.getLayoutProbe();

    if (!transitionOverlap && (!resizedNatively || !options.isRenderProbeAligned(postNativeProbe, dimensions))) {
      options.resizeKnownFullscreenRenderers(dimensions);
    }

    options.enforceFullscreenLayout(dimensions);
    lastFullscreenSignature = options.buildFullscreenSignature(dimensions, options.getLayoutProbe());
    return true;
  }

  return {
    clearFullscreenSignature,
    refreshFullscreen,
  };
}
