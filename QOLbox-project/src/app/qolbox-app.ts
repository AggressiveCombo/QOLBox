import { shouldRunGamePageBootstrap } from '../boot/page-entry';
import { runQolboxStartupSequence } from '../boot/startup-sequence';
import { FULLSCREEN_SETTLE_PASSES, RESIZE_SETTLE_PASSES } from '../config/qolbox-constants';
import { createAdvancedSettingsController } from '../settings/advanced-settings-controller';
import {
  ADVANCED_BLACKLIST_ENFORCEMENT,
  isAdvancedBlacklistEnforcementEnabled,
} from '../settings/advanced-settings';
import { createFeatureGateSet } from '../settings/feature-gates';
import { createFeatureSettingsController } from '../settings/feature-settings-controller';
import { createAudioFeatureBundle } from '../features/audio-feature-bundle';
import { createEditorMapFileTransferController } from '../features/editor-map-file-transfer';
import { createFeatureSideEffectsController } from '../features/feature-side-effects';
import { createFullscreenFoundationBundle } from '../features/fullscreen-foundation-bundle';
import { createFullscreenLayoutFeatureBundle } from '../features/fullscreen-layout-feature-bundle';
import { createFullscreenOrchestrationBundle } from '../features/fullscreen-orchestration-bundle';
import { createGameplayAlertFeatureBundle } from '../features/gameplay-alert-feature-bundle';
import { createInGameChatScrollController } from '../features/in-game-chat-scroll';
import { createInputFocusFeatureBundle } from '../features/input-focus-feature-bundle';
import { createLobbyCommandsFeatureBundle } from '../features/lobby-commands-feature-bundle';
import { createMobileFeatureBundle } from '../features/mobile-feature-bundle';
import { createPopupKeyboardController } from '../features/popup-keyboard-controls';
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

  const { patchEditorMapFileTransfer, removeEditorMapFileTransfer } = createEditorMapFileTransferController({
    isEditorMapTransferEnabled: featureGates.isEditorMapTransferEnabled,
  });

  const { cleanupInGameChatScroll, patchInGameChatScroll } = createInGameChatScrollController({
    isChatFeatureEnabled: featureGates.isChatEnabled,
  });

  const {
    getAdvancedSettings,
    setAdvancedSetting,
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
    cleanupInGameChatScroll: () => cleanupInGameChatScroll(),
    disableGameStartAlerts: () => disableGameStartAlerts(),
    hookHowlPrototype: () => hookHowlPrototype(),
    hookYouTubePlayer: () => hookYouTubePlayer(),
    installGameStartIndicatorHooks: () => installGameStartIndicatorHooks(),
    installPlayerPopupDismissal: () => installPlayerPopupDismissal(),
    installTabFocusHooks: () => installTabFocusHooks(),
    installYouTubeReadyCallbackHook: () => installYouTubeReadyCallbackHook(),
    patchChatTabOrder: () => patchChatTabOrder(),
    patchEditorMapFileTransfer: () => patchEditorMapFileTransfer(),
    patchInGameChatScroll,
    patchGameVolumeMenu: () => patchGameVolumeMenu(),
    patchJukeboxKnob: () => patchJukeboxKnob(),
    patchJukeboxMenu: () => patchJukeboxMenu(),
    patchLobbyMusicController: () => patchLobbyMusicController(),
    patchLobbyBlacklist: () => patchLobbyBlacklist(),
    patchMobileGrabButton: () => patchMobileGrabButton(),
    patchMobileQolboxHamburgerEntry: () => patchMobileQolboxHamburgerEntry(),
    patchReserveSpotFeature: () => patchReserveSpotFeature(),
    patchSlashCommands: () => patchSlashCommands(),
    patchSwitchTeamsButton: () => patchSwitchTeamsButton(),
    patchTypingIndicatorHooks: () => patchTypingIndicatorHooks(),
    removeEditorMapFileTransfer: () => removeEditorMapFileTransfer(),
    removeJukeboxMenuItem: () => removeJukeboxMenuItem(),
    removeMobileGrabButton: () => removeMobileGrabButton(),
    removeSwitchTeamsButton: () => removeSwitchTeamsButton(),
    restoreChatTabOrder: () => restoreChatTabOrder(),
    restoreJukeboxState: () => restoreJukeboxState(),
    featureGates,
    stopReserveSpot: options => stopReserveSpot(options),
    syncScoreRows: () => syncAllScoreRowsFromPlayers(),
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

  const {
    handleMobileGrabPointerStart,
    hideMobileGrabButton,
    isMobileGameMode,
    isMobileQolboxMenuContext,
    layoutMobileGrabButton,
    patchMobileGrabButton,
    removeMobileGrabButton,
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
    restoreChatTabOrder,
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
    syncAllScoreRowsFromPlayers,
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
  const { handlePopupKeyboard, installPopupKeyboardHooks } = createPopupKeyboardController();

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
    restoreJukeboxState,
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
    handleBlacklistSlashCommand,
    handleSpecSlashCommand,
    patchSlashCommands,
    patchLobbyBlacklist,
    enforceBlacklist,
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
    isBlacklistEnforcementEnabled: () =>
      isAdvancedBlacklistEnforcementEnabled(getAdvancedSettings()),
    installStartAlertHooks: session => patchMultiplayerSessionGameStartHooks(session),
    isCurrentPlayerSpectating,
    noteLocallyInitiatedPlayTransition,
    setBlacklistEnforcementEnabled: enabled =>
      setAdvancedSetting(ADVANCED_BLACKLIST_ENFORCEMENT, enabled),
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
    syncNonFullscreenHud: () => {
      if (featureGates.isChatEnabled()) {
        syncAllScoreRowsFromPlayers();
        syncTypingIndicators();
      }
    },
    updateGameStartIndicator,
  });

  // The local regression harness injects into the generated IIFE and reads these closure-scoped handles.
  // Keep this as an explicit contract so stricter unused-symbol scans do not mistake it for dead wiring.
  void captureGameplayInputFocus;
  void clearGameStartIndicator;
  void endCurrentGame;
  void enforceBlacklist;
  void findPlayerByName;
  void fitEditorCanvasToNative;
  void fitEditorLayerToFrame;
  void getEffectiveJukeboxPercent;
  void getOnboardingSteps;
  void getScaledEditorFrame;
  void getWorldTypingPosition;
  void handleBlacklistSlashCommand;
  void handleGameStartInteractionFocus;
  void handleGameplayBackgroundFocus;
  void handleJoinSlashCommand;
  void handleMobileGrabPointerStart;
  void hideMobileGrabButton;
  void handlePopupKeyboard;
  void handleQolboxSlashCommand;
  void handleSpecSlashCommand;
  void hasPendingLocalPlayTransition;
  void isMobileGameMode;
  void isMobileQolboxMenuContext;
  void isPageFocused;
  void isPlayableLobby;
  void layoutMobileGrabButton;
  void layoutRelativeHud;
  void notePlayerTyping;
  void requestBulkTeamState;
  void requestTeamState;
  void restartCurrentGame;
  void restoreLobbyChatPrompt;
  void setGameStartPageFocused;
  void setGameStartWasInLobbyWhenUnfocused;
  void setGameStartWasPlayingWhenUnfocused;
  void setJukeboxState;
  void setMobileGrabPressed;
  void shouldCaptureGameplayBackgroundFocus;
  void shouldShowMobileGrabButton;
  void showAllHostSettings;
  void switchTeamPlayers;
  void syncAllScoreRowsFromPlayers;
  void syncMobileGrabButton;
  void syncWorldTypingIndicators;

  runQolboxStartupSequence({
    applyFeatureRootClasses,
    ensureGlobalStyle,
    installFullscreenHooks,
    installPopupKeyboardHooks,
    installQolboxMenuHooks,
    installReserveSocketCaptureHook,
    installYouTubeReadyCallbackHook,
    isAudioEnabled: featureGates.isAudioEnabled,
    isReserveEnabled: featureGates.isReserveEnabled,
    scheduleFirstBootOnboarding,
    scheduleUiWork,
  });
})();
