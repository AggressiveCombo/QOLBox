import {
  FEATURE_PATCH_TARGET_SELECTOR,
  FULLSCREEN_LAYOUT_TARGET_SELECTOR,
  FULLSCREEN_SETTLE_PASSES,
  RESIZE_SETTLE_PASSES,
} from '../config/qolbox-constants';
import type { FullscreenDimensions, FullscreenLayoutProbe } from './fullscreen-types';
import { createFullscreenHookInstaller } from './fullscreen-hook-installer';
import { createFullscreenMutationObserver } from './fullscreen-mutation-observer';
import { createFullscreenRefreshController } from './fullscreen-refresh-controller';
import { createFullscreenWorkScheduler } from './fullscreen-work-scheduler';
import type { ScheduledUiWorkRequest } from '../types/scheduled-work';

interface FullscreenOrchestrationBundleOptions {
  applyFeatureRootClasses(): void;
  applyPersistentFeatures(): void;
  enforceFullscreenLayout(dimensions: FullscreenDimensions): void;
  ensureGlobalStyle(): void;
  getFullscreenDimensions(): FullscreenDimensions;
  getLayoutProbe(): FullscreenLayoutProbe;
  installChatCommandAliasHooks(): void;
  installChatEscapeHooks(): void;
  installGameStartIndicatorHooks(): void;
  installGameplayBackgroundFocusHooks(): void;
  installQolboxMenuHooks(): void;
  installReserveSocketCaptureHook(): void;
  installTabFocusHooks(): void;
  isAudioEnabled(): boolean;
  isFullscreenEnabled(): boolean;
  isGameStartAlertEnabled(): boolean;
  isMenuGameplayOverlap(): boolean;
  isRenderProbeAligned(probe: FullscreenLayoutProbe, dimensions: FullscreenDimensions): boolean;
  isReserveEnabled(): boolean;
  patchLobbyMusicController(): void;
  refreshObservedResizeTargets(): void;
  resizeKnownFullscreenRenderers(dimensions: FullscreenDimensions): void;
  setFullscreenResizeObserver(observer: ResizeObserver): void;
  shouldWaitForNativeLayoutSeed(): boolean;
  syncSpectateControlsBottomWithJukebox(): void;
  syncNonFullscreenHud(): void;
  updateGameStartIndicator(): void;
}

export function createFullscreenOrchestrationBundle(options: FullscreenOrchestrationBundleOptions) {
  let discardObservedMutations = (): void => {};
  const { refreshFullscreen } = createFullscreenRefreshController({
    enforceFullscreenLayout: options.enforceFullscreenLayout,
    getFullscreenDimensions: options.getFullscreenDimensions,
    getLayoutProbe: options.getLayoutProbe,
    isFullscreenEnabled: options.isFullscreenEnabled,
    isMenuGameplayOverlap: options.isMenuGameplayOverlap,
    isRenderProbeAligned: options.isRenderProbeAligned,
    patchLobbyMusicController: options.patchLobbyMusicController,
    resizeKnownFullscreenRenderers: options.resizeKnownFullscreenRenderers,
    scheduleUiWork: request => scheduleUiWork(request),
    shouldWaitForNativeLayoutSeed: options.shouldWaitForNativeLayoutSeed,
    syncNonFullscreenHud: options.syncNonFullscreenHud,
    updateGameStartIndicator: options.updateGameStartIndicator,
  });

  const { scheduleUiWork } = createFullscreenWorkScheduler({
    applyFeatureRootClasses: options.applyFeatureRootClasses,
    applyPersistentFeatures: options.applyPersistentFeatures,
    discardObservedMutations: () => discardObservedMutations(),
    ensureGlobalStyle: options.ensureGlobalStyle,
    installFullscreenHooks: () => installFullscreenHooks(),
    refreshFullscreen,
    refreshObservedResizeTargets: options.refreshObservedResizeTargets,
  });

  const mutationObserver = createFullscreenMutationObserver({
    featurePatchTargetSelector: FEATURE_PATCH_TARGET_SELECTOR,
    layoutTargetSelector: FULLSCREEN_LAYOUT_TARGET_SELECTOR,
    scheduleUiWork,
    settlePasses: FULLSCREEN_SETTLE_PASSES,
    syncSpectateControlsBottomWithJukebox: options.syncSpectateControlsBottomWithJukebox,
    updateGameStartIndicator: options.updateGameStartIndicator,
  });
  const { installFullscreenMutationObserver } = mutationObserver;
  discardObservedMutations = mutationObserver.discardFullscreenMutationRecords;

  const { installFullscreenHooks } = createFullscreenHookInstaller({
    fullscreenSettlePasses: FULLSCREEN_SETTLE_PASSES,
    installChatCommandAliasHooks: options.installChatCommandAliasHooks,
    installChatEscapeHooks: options.installChatEscapeHooks,
    installFullscreenMutationObserver,
    installGameStartIndicatorHooks: options.installGameStartIndicatorHooks,
    installGameplayBackgroundFocusHooks: options.installGameplayBackgroundFocusHooks,
    installQolboxMenuHooks: options.installQolboxMenuHooks,
    installReserveSocketCaptureHook: options.installReserveSocketCaptureHook,
    installTabFocusHooks: options.installTabFocusHooks,
    isAudioEnabled: options.isAudioEnabled,
    isGameStartAlertEnabled: options.isGameStartAlertEnabled,
    isReserveEnabled: options.isReserveEnabled,
    refreshObservedResizeTargets: options.refreshObservedResizeTargets,
    resizeSettlePasses: RESIZE_SETTLE_PASSES,
    scheduleUiWork,
    setFullscreenResizeObserver: options.setFullscreenResizeObserver,
  });

  return {
    installFullscreenHooks,
    installFullscreenMutationObserver,
    refreshFullscreen,
    scheduleUiWork: (request: ScheduledUiWorkRequest) => scheduleUiWork(request),
  };
}
