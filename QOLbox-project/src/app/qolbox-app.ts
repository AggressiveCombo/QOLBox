import { shouldRunGamePageBootstrap } from '../boot/page-entry';
import { runQolboxStartupSequence } from '../boot/startup-sequence';
import { FULLSCREEN_SETTLE_PASSES, RESIZE_SETTLE_PASSES } from '../config/qolbox-constants';
import { createAdvancedSettingsController } from '../settings/advanced-settings-controller';
import { createFeatureGateSet } from '../settings/feature-gates';
import { createFeatureSettingsController } from '../settings/feature-settings-controller';
import { createAudioFeatureBundle } from '../features/audio-feature-bundle';
import { createFeatureSideEffectsController } from '../features/feature-side-effects';
import { createFullscreenFoundationBundle } from '../features/fullscreen-foundation-bundle';
import { createFullscreenLayoutFeatureBundle } from '../features/fullscreen-layout-feature-bundle';
import { createFullscreenOrchestrationBundle } from '../features/fullscreen-orchestration-bundle';
import { createGameplayAlertFeatureBundle } from '../features/gameplay-alert-feature-bundle';
import { createInGameChatScrollController } from '../features/in-game-chat-scroll';
import { createInputFocusFeatureBundle } from '../features/input-focus-feature-bundle';
import { createLobbyCommandsFeatureBundle } from '../features/lobby-commands-feature-bundle';
import { createMobileFeatureBundle } from '../features/mobile-feature-bundle';
import { createQolboxMenuFeatureBundle } from '../features/qolbox-menu-feature-bundle';
import { createQolboxShellFeatureBundle } from '../features/qolbox-shell-feature-bundle';
import { createReserveFeatureBundle } from '../features/reserve-feature-bundle';
import { createTypingFeatureBundle } from '../features/typing-feature-bundle';
import type { ScheduledUiWorkRequest } from '../types/scheduled-work';

(function () {
  'use strict';

  if (!shouldRunGamePageBootstrap()) {
    return;
  }

  function scheduleAppUiWork(request: ScheduledUiWorkRequest): void {
    scheduleUiWork(request);
  }

  const { isFeatureEnabled, setAllFeatureSettings, setFeatureEnabled, shouldRunFeature } = createFeatureSettingsController({
    isOnboardingComplete: () => qolboxMenuController.isOnboardingComplete(),
    onApplyFeatureRootClasses: () => applyFeatureRootClasses(),
    onApplyPersistentFeatures: () => applyPersistentFeatures(),
    onDisableFeatureSideEffects: featureKey => disableFeatureSideEffects(featureKey),
    onRenderMenu: () => renderQolboxMenu(),
    onScheduleUiWork: scheduleAppUiWork,
    resizeSettlePasses: RESIZE_SETTLE_PASSES,
  });
  const featureGates = createFeatureGateSet(shouldRunFeature);

  const { patchInGameChatScroll } = createInGameChatScrollController();

  const {
    getAdvancedSettings,
    setAdvancedSettings,
  } = createAdvancedSettingsController({
    onApplyPersistentFeatures: () => applyPersistentFeatures(),
    onRenderMenu: () => renderQolboxMenu(),
    onScheduleLayoutRefresh: () =>
      scheduleAppUiWork({ force: true, features: true, passes: FULLSCREEN_SETTLE_PASSES }),
  });

  const {
    applyPersistentFeatures,
    disableFeatureSideEffects,
  } = createFeatureSideEffectsController({
    applyFeatureRootClasses: () => applyFeatureRootClasses(),
    applyGameVolume: () => applyGameVolume(),
    applyJukeboxState: () => applyJukeboxState(),
    clearFullscreenLayoutStyles: () => clearFullscreenLayoutStyles(),
    clearReservePasswordPromptPending: () => clearReservePasswordPromptPending(),
    clearTypingIndicators: () => clearTypingIndicators(),
    disableGameStartAlerts: () => disableGameStartAlerts(),
    getReserveState: () => getReserveState(),
    hideMobileGrabButton: () => hideMobileGrabButton(),
    hookHowlPrototype: () => hookHowlPrototype(),
    hookYouTubePlayer: () => hookYouTubePlayer(),
    installGameStartIndicatorHooks: () => installGameStartIndicatorHooks(),
    installPlayerPopupDismissal: () => installPlayerPopupDismissal(),
    installTabFocusHooks: () => installTabFocusHooks(),
    installYouTubeReadyCallbackHook: () => installYouTubeReadyCallbackHook(),
    patchChatTabOrder: () => patchChatTabOrder(),
    patchInGameChatScroll,
    patchGameVolumeMenu: () => patchGameVolumeMenu(),
    patchJukeboxKnob: () => patchJukeboxKnob(),
    patchJukeboxMenu: () => patchJukeboxMenu(),
    patchLobbyMusicController: () => patchLobbyMusicController(),
    patchMobileGrabButton: () => patchMobileGrabButton(),
    patchMobileQolboxHamburgerEntry: () => patchMobileQolboxHamburgerEntry(),
    patchReserveSpotFeature: () => patchReserveSpotFeature(),
    patchSlashCommands: () => patchSlashCommands(),
    patchSwitchTeamsButton: () => patchSwitchTeamsButton(),
    patchTypingIndicatorHooks: () => patchTypingIndicatorHooks(),
    removeJukeboxMenuItem: () => removeJukeboxMenuItem(),
    removeSwitchTeamsButton: () => removeSwitchTeamsButton(),
    featureGates,
    stopReserveSpot: options => stopReserveSpot(options),
    syncReserveJoinButtonLabel: () => syncReserveJoinButtonLabel(),
    syncTypingIndicators: () => syncTypingIndicators(),
    updateGameStartIndicator: () => updateGameStartIndicator(),
  });

  const {
    clearReservePasswordPromptPending,
    getReserveState,
    installReserveSocketCaptureHook,
    isReserveRetryAudioSuppressed,
    patchReserveSpotFeature,
    stopReserveSpot,
    syncReserveJoinButtonLabel,
  } = createReserveFeatureBundle({
    hasSuccessfulJoinLayer: () => hasReserveSuccessfulJoinLayer(),
    isReserveEnabled: featureGates.isReserveEnabled,
  });

  // Some controller handles below are intentionally kept in this closure for generated regression harness injection.
  const {
    handleMobileGrabPointerStart,
    hideMobileGrabButton,
    isMobileGameMode,
    isMobileQolboxMenuContext,
    layoutMobileGrabButton,
    patchMobileGrabButton,
    setMobileGrabPressed,
    shouldShowMobileGrabButton,
    syncMobileGrabButton,
    patchMobileQolboxHamburgerEntry,
  } = createMobileFeatureBundle({
    isMobileGrabEnabled: featureGates.isMobileGrabEnabled,
    openMenu: () => openQolboxMenu(qolboxMenuController.isOnboardingComplete() ? 'settings' : 'onboarding'),
  });

  const {
    clearGameStartIndicator,
    disableGameStartAlerts,
    handleGameStartInteractionFocus,
    hasPendingLocalPlayTransition,
    hasReserveSuccessfulJoinLayer,
    installGameStartIndicatorHooks,
    isCurrentPlayerSpectating,
    isMenuGameplayOverlap,
    isPageFocused,
    isPlayableLobby,
    isPlayingMatch,
    noteLocallyInitiatedPlayTransition,
    patchMultiplayerSessionGameStartHooks,
    setGameStartPageFocused,
    setGameStartWasInLobbyWhenUnfocused,
    setGameStartWasPlayingWhenUnfocused,
    updateGameStartIndicator,
  } = createGameplayAlertFeatureBundle({
    isGameStartAlertEnabled: featureGates.isGameStartAlertEnabled,
  });

  const { applyFeatureRootClasses, ensureGlobalStyle } = createQolboxShellFeatureBundle({
    isMenuClosed: () => qolboxMenuController.isClosed(),
    isFeatureActive: featureGates.shouldRunFeature,
  });

  const {
    buildFullscreenSignature,
    clearFullscreenStyleSnapshots,
    getActiveRenderCanvas,
    getActiveRenderMode,
    getBaseGameSize,
    getFullscreenDimensions,
    getLayoutProbe,
    getNativeUiZoom,
    getRelativeContainerBounds,
    installNativeFullscreenPatch,
    isEditorCanvas,
    isEditorLayer,
    isNativeProbeAligned,
    isRenderProbeAligned,
    restoreFullscreenStyles,
    restoreNativeFullscreenPatch,
    restoreNativeLayoutSizeFallback,
    runNativeResize,
    setImportantStyle,
    setNativeFullscreenSize,
    shouldWaitForNativeLayoutSeed,
  } = createFullscreenFoundationBundle();

  const {
    captureGameplayInputFocus,
    focusActiveRenderCanvas,
    handleGameplayBackgroundFocus,
    installChatCommandAliasHooks,
    installChatEscapeHooks,
    installGameplayBackgroundFocusHooks,
    isChatInput,
    patchChatTabOrder,
    resetBrowserScroll,
    restoreLobbyChatPrompt,
    shouldCaptureGameplayBackgroundFocus,
  } = createInputFocusFeatureBundle({
    getActiveRenderCanvas,
    isChatFeatureEnabled: featureGates.isChatEnabled,
    areLobbyCommandsEnabled: featureGates.isLobbyCommandsEnabled,
    isPlayingMatch,
    isQolboxMenuClosed: () => qolboxMenuController.isClosed(),
  });

  const {
    clearTypingIndicators,
    getWorldTypingPosition,
    makeScoreRowsOpaque,
    notePlayerTyping,
    patchTypingIndicatorHooks,
    syncScoreRowsFromPlayers,
    syncTypingIndicators,
    syncWorldTypingIndicators,
  } = createTypingFeatureBundle({
    getActiveRenderCanvas,
    getBaseGameSize,
    isChatFeatureEnabled: featureGates.isChatEnabled,
    setImportantStyle,
  });
  const {
    clearFullscreenLayoutStyles,
    enforceFullscreenLayout,
    fitEditorCanvasToNative,
    fitEditorLayerToFrame,
    getScaledEditorFrame,
    installGameReadyHook,
    layoutRelativeHud,
    refreshObservedResizeTargets,
    resizeKnownFullscreenRenderers,
    setFullscreenResizeObserver,
    syncSpectateControlsBottomWithJukebox,
  } = createFullscreenLayoutFeatureBundle({
    clearFullscreenSignature: () => clearFullscreenSignature(),
    clearFullscreenStyleSnapshots,
    ensureGlobalStyle,
    getFullscreenDimensions,
    getNativeUiZoom,
    getRelativeContainerBounds,
    isEditorCanvas,
    isEditorLayer,
    isFullscreenEnabled: featureGates.isFullscreenEnabled,
    makeScoreRowsOpaque,
    restoreFullscreenStyles,
    restoreNativeFullscreenPatch,
    restoreNativeLayoutSizeFallback,
    scheduleUiWork: scheduleAppUiWork,
    setImportantStyle,
    syncScoreRowsFromPlayers,
    syncTypingIndicators,
  });

  const qolboxMenuController = createQolboxMenuFeatureBundle({
    applyFeatureRootClasses,
    applyPersistentFeatures,
    ensureGlobalStyle,
    getAdvancedSettings,
    isFeatureEnabled,
    scheduleUiWork: scheduleAppUiWork,
    setAdvancedSettings,
    setAllFeatureSettings,
    setFeatureEnabled,
  });
  const { getOnboardingSteps, installQolboxMenuHooks, openQolboxMenu, renderQolboxMenu, scheduleFirstBootOnboarding } =
    qolboxMenuController;

  const {
    applyGameVolume,
    applyJukeboxState,
    getEffectiveJukeboxPercent,
    hookHowlPrototype,
    hookYouTubePlayer,
    installTabFocusHooks,
    installYouTubeReadyCallbackHook,
    patchGameVolumeMenu,
    patchJukeboxKnob,
    patchJukeboxMenu,
    patchLobbyMusicController,
    removeJukeboxMenuItem,
    setJukeboxState,
    stopLobbyMusicIfNeeded,
  } = createAudioFeatureBundle({
    focusActiveRenderCanvas,
    getActiveRenderCanvas,
    getActiveRenderMode,
    isAudioEnabled: featureGates.isAudioEnabled,
    isChatInput,
    isReserveRetryAudioSuppressed: () =>
      Boolean(
        featureGates.isReserveEnabled() &&
          getReserveState()?.active &&
          isReserveRetryAudioSuppressed()
      ),
    resetBrowserScroll,
    scheduleUiWork: scheduleAppUiWork,
  });
  const {
    endCurrentGame,
    findPlayerByName,
    installPlayerPopupDismissal,
    handleJoinSlashCommand,
    handleQolboxSlashCommand,
    handleSpecSlashCommand,
    patchSlashCommands,
    patchSwitchTeamsButton,
    requestBulkTeamState,
    requestTeamState,
    restartCurrentGame,
    removeSwitchTeamsButton,
    showAllHostSettings,
    switchTeamPlayers,
  } = createLobbyCommandsFeatureBundle({
    areGameStartAlertsEnabled: featureGates.isGameStartAlertEnabled,
    areLobbyCommandsEnabled: featureGates.isLobbyCommandsEnabled,
    installStartAlertHooks: session => patchMultiplayerSessionGameStartHooks(session),
    isCurrentPlayerSpectating,
    noteLocallyInitiatedPlayTransition,
  });
  const {
    clearFullscreenSignature,
    installFullscreenHooks,
    scheduleUiWork,
  } = createFullscreenOrchestrationBundle({
    applyFeatureRootClasses,
    applyPersistentFeatures,
    buildFullscreenSignature,
    clearFullscreenLayoutStyles,
    enforceFullscreenLayout,
    ensureGlobalStyle,
    getFullscreenDimensions,
    getLayoutProbe,
    installChatCommandAliasHooks,
    installChatEscapeHooks,
    installGameReadyHook,
    installGameStartIndicatorHooks,
    installGameplayBackgroundFocusHooks,
    installQolboxMenuHooks,
    installReserveSocketCaptureHook,
    installTabFocusHooks,
    installNativeFullscreenPatch,
    isAudioEnabled: featureGates.isAudioEnabled,
    isFullscreenEnabled: featureGates.isFullscreenEnabled,
    isGameStartAlertEnabled: featureGates.isGameStartAlertEnabled,
    isMenuGameplayOverlap,
    isNativeProbeAligned,
    isRenderProbeAligned,
    isReserveEnabled: featureGates.isReserveEnabled,
    patchLobbyMusicController,
    refreshObservedResizeTargets,
    resizeKnownFullscreenRenderers,
    runNativeResize,
    setFullscreenResizeObserver,
    setNativeFullscreenSize,
    shouldWaitForNativeLayoutSeed,
    stopLobbyMusicIfNeeded,
    syncSpectateControlsBottomWithJukebox,
    updateGameStartIndicator,
  });

  runQolboxStartupSequence({
    applyFeatureRootClasses,
    ensureGlobalStyle,
    installFullscreenHooks,
    installQolboxMenuHooks,
    installReserveSocketCaptureHook,
    installYouTubeReadyCallbackHook,
    isAudioEnabled: featureGates.isAudioEnabled,
    isReserveEnabled: featureGates.isReserveEnabled,
    scheduleFirstBootOnboarding,
    scheduleUiWork,
  });
})();
