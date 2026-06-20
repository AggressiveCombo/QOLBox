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
  buildFullscreenSignature(dimensions: FullscreenDimensions, probe: FullscreenLayoutProbe): string;
  clearFullscreenLayoutStyles(): void;
  enforceFullscreenLayout(dimensions: FullscreenDimensions): void;
  ensureGlobalStyle(): void;
  getFullscreenDimensions(): FullscreenDimensions;
  getLayoutProbe(): FullscreenLayoutProbe;
  installChatCommandAliasHooks(): void;
  installChatEscapeHooks(): void;
  installGameReadyHook(): void;
  installGameStartIndicatorHooks(): void;
  installGameplayBackgroundFocusHooks(): void;
  installQolboxMenuHooks(): void;
  installReserveSocketCaptureHook(): void;
  installTabFocusHooks(): void;
  installNativeFullscreenPatch(): void;
  isAudioEnabled(): boolean;
  isFullscreenEnabled(): boolean;
  isGameStartAlertEnabled(): boolean;
  isMenuGameplayOverlap(): boolean;
  isNativeProbeAligned(probe: FullscreenLayoutProbe, dimensions: FullscreenDimensions): boolean;
  isRenderProbeAligned(probe: FullscreenLayoutProbe, dimensions: FullscreenDimensions): boolean;
  isReserveEnabled(): boolean;
  patchLobbyMusicController(): void;
  refreshObservedResizeTargets(): void;
  resizeKnownFullscreenRenderers(dimensions: FullscreenDimensions): void;
  runNativeResize(dimensions: FullscreenDimensions): boolean;
  setFullscreenResizeObserver(observer: ResizeObserver): void;
  setNativeFullscreenSize(dimensions: FullscreenDimensions): void;
  shouldWaitForNativeLayoutSeed(): boolean;
  stopLobbyMusicIfNeeded(): void;
  syncSpectateControlsBottomWithJukebox(): void;
  updateGameStartIndicator(): void;
}

export function createFullscreenOrchestrationBundle(options: FullscreenOrchestrationBundleOptions) {
  const { clearFullscreenSignature, refreshFullscreen } = createFullscreenRefreshController({
    buildFullscreenSignature: options.buildFullscreenSignature,
    clearFullscreenLayoutStyles: options.clearFullscreenLayoutStyles,
    enforceFullscreenLayout: options.enforceFullscreenLayout,
    getFullscreenDimensions: options.getFullscreenDimensions,
    getLayoutProbe: options.getLayoutProbe,
    installNativeFullscreenPatch: options.installNativeFullscreenPatch,
    isFullscreenEnabled: options.isFullscreenEnabled,
    isMenuGameplayOverlap: options.isMenuGameplayOverlap,
    isNativeProbeAligned: options.isNativeProbeAligned,
    isRenderProbeAligned: options.isRenderProbeAligned,
    patchLobbyMusicController: options.patchLobbyMusicController,
    resizeKnownFullscreenRenderers: options.resizeKnownFullscreenRenderers,
    runNativeResize: options.runNativeResize,
    scheduleUiWork: request => scheduleUiWork(request),
    setNativeFullscreenSize: options.setNativeFullscreenSize,
    shouldWaitForNativeLayoutSeed: options.shouldWaitForNativeLayoutSeed,
    stopLobbyMusicIfNeeded: options.stopLobbyMusicIfNeeded,
    updateGameStartIndicator: options.updateGameStartIndicator,
  });

  const { scheduleUiWork } = createFullscreenWorkScheduler({
    applyFeatureRootClasses: options.applyFeatureRootClasses,
    applyPersistentFeatures: options.applyPersistentFeatures,
    ensureGlobalStyle: options.ensureGlobalStyle,
    installFullscreenHooks: () => installFullscreenHooks(),
    refreshFullscreen,
    refreshObservedResizeTargets: options.refreshObservedResizeTargets,
  });

  const { installFullscreenMutationObserver } = createFullscreenMutationObserver({
    featurePatchTargetSelector: FEATURE_PATCH_TARGET_SELECTOR,
    layoutTargetSelector: FULLSCREEN_LAYOUT_TARGET_SELECTOR,
    scheduleUiWork,
    settlePasses: FULLSCREEN_SETTLE_PASSES,
    syncSpectateControlsBottomWithJukebox: options.syncSpectateControlsBottomWithJukebox,
    updateGameStartIndicator: options.updateGameStartIndicator,
  });

  const { installFullscreenHooks } = createFullscreenHookInstaller({
    fullscreenSettlePasses: FULLSCREEN_SETTLE_PASSES,
    installChatCommandAliasHooks: options.installChatCommandAliasHooks,
    installChatEscapeHooks: options.installChatEscapeHooks,
    installFullscreenMutationObserver,
    installGameReadyHook: options.installGameReadyHook,
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
    clearFullscreenSignature,
    installFullscreenHooks,
    installFullscreenMutationObserver,
    refreshFullscreen,
    scheduleUiWork: (request: ScheduledUiWorkRequest) => scheduleUiWork(request),
  };
}
