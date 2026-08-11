import { shouldRunGamePageBootstrap } from '../boot/page-entry';
import { runQolboxStartupSequence } from '../boot/startup-sequence';
import { FULLSCREEN_SETTLE_PASSES, RESIZE_SETTLE_PASSES } from '../config/qolbox-constants';
import { extractMarkdownNotes, getReleaseNotesBetween } from '../config/qolbox-release-notes';
import { createAdvancedSettingsController } from '../settings/advanced-settings-controller';
import {
  ADVANCED_BLACKLIST_ENFORCEMENT,
  areAdvancedEditorMapReadableFilesEnabled,
  isAdvancedBlacklistEnforcementEnabled,
  loadAdvancedSettings,
} from '../settings/advanced-settings';
import { createFeatureGateSet } from '../settings/feature-gates';
import { createFeatureSettingsController } from '../settings/feature-settings-controller';
import { loadFeatureSettings } from '../settings/feature-settings';
import {
  createThemeSettingsController,
  getDefaultThemeSettings,
  loadThemeSettings,
  normalizeThemeColor,
  sanitizeThemeSettings,
} from '../settings/theme-settings';
import { createAudioFeatureBundle } from '../features/audio-feature-bundle';
import { createActionIconographyController } from '../features/action-iconography';
import { createEditorMapFileTransferController } from '../features/editor-map-file-transfer';
import {
  angleToJukeboxPercent,
  getKeyboardPercentTarget,
  parseJukeboxAngleFromTransform,
  percentToJukeboxAngle,
  percentToJukeboxVolume,
} from '../features/audio-levels';
import { createFeatureSideEffectsController } from '../features/feature-side-effects';
import { createFullscreenFoundationBundle } from '../features/fullscreen-foundation-bundle';
import { createFullscreenLayoutFeatureBundle } from '../features/fullscreen-layout-feature-bundle';
import { createFullscreenOrchestrationBundle } from '../features/fullscreen-orchestration-bundle';
import { createGameplayAlertFeatureBundle } from '../features/gameplay-alert-feature-bundle';
import { createGameStartFocusHookInstaller } from '../features/game-start-focus-hooks';
import { createGameVolumeMenuController } from '../features/game-volume-menu-control';
import { createLobbyMusicController } from '../features/lobby-music-control';
import { restoreJukeboxKnobViews, setJukeboxKnobVisual } from '../features/jukebox-knob-view';
import { createInGameChatScrollController } from '../features/in-game-chat-scroll';
import { getChatCommandCompletions } from '../features/chat-command-completions';
import { createInputFocusFeatureBundle } from '../features/input-focus-feature-bundle';
import { createLobbyCommandsFeatureBundle } from '../features/lobby-commands-feature-bundle';
import { createLobbyInformationController, getLevelXpBounds } from '../features/lobby-information';
import { createMobileFeatureBundle } from '../features/mobile-feature-bundle';
import { installMapListPreviewThrottling } from '../features/map-list-performance';
import { createPopupKeyboardController } from '../features/popup-keyboard-controls';
import { createQolboxMenuFeatureBundle } from '../features/qolbox-menu-feature-bundle';
import { createQolboxShellFeatureBundle } from '../features/qolbox-shell-feature-bundle';
import { createReserveFeatureBundle } from '../features/reserve-feature-bundle';
import { createReserveSelectionState } from '../features/reserve-selection-state';
import { createSoundBankController } from '../features/sound-bank';
import { createTypingFeatureBundle } from '../features/typing-feature-bundle';
import { expandNativeChatAlias } from '../features/slash-command-interceptor';
import { isTeamMode } from '../features/team-mode-detector';
import {
  clampJukeboxPercent,
  clampPercent,
  loadGamePercent,
  loadJukeboxState,
} from '../settings/audio-storage';
import { acknowledgeUpdateNotice, loadPendingUpdateNotice } from '../settings/update-notice-storage';
import {
  decodeEditorMapData,
  encodeEditorMapData,
  getEditorMapDataFromParsedJson,
  getReadableEditorMapJson,
  getValidatedEditorMapData,
} from '../hitbox/editor-map-codec';
import {
  getEditorBodyTestPosition,
  getEditorSelectionTestState,
  getEditorSelectionTargetTestState,
  patchEditorSelectionControls,
  setEditorPaintPreviewTestColors,
  setEditorSelectionPaintTestState,
  setEditorSelectionTestIds,
  setEditorSelectionTestTypes,
} from '../hitbox/editor-selection-adapter';
import { createHowlerGameAudioAdapter } from '../hitbox/howler-audio-adapter';
import { installNativeChatSendInterceptor } from '../hitbox/chat-send-adapter';
import { installGameStartSessionHooks } from '../hitbox/game-start-hooks';
import { installPlayerJoinHook } from '../hitbox/player-join-hooks';
import { inspectNativeCompatibility } from '../hitbox/native-contract';
import { patchReserveSocketEmitTarget } from '../hitbox/reserve-socket-emit-patcher';
import { installNativeTypingPulseHook } from '../hitbox/typing-pulse-adapter';
import { createYouTubeJukeboxAdapter } from '../hitbox/youtube-player-adapter';
import {
  getKnownFullscreenRenderers,
  resizeKnownFullscreenRenderers as resizeRendererForTest,
  restoreKnownFullscreenRenderers,
} from '../hitbox/renderer-adapter';
import { isFullscreenRenderProbeAligned } from '../features/fullscreen-probe-alignment';
import type { ScheduledUiWorkRequest } from '../types/scheduled-work';
import { readObjectProperty } from '../utils/object-properties';

declare global {
  interface Window {
    __qolboxTest?: Record<string, unknown>;
  }
}

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
  const {
    decorateActions,
    patchHamburgerAudioGroup,
    removeHamburgerAudioGroup,
  } = createActionIconographyController();

  const { patchEditorMapFileTransfer, removeEditorMapFileTransfer } = createEditorMapFileTransferController({
    isEditorMapTransferEnabled: featureGates.isEditorMapTransferEnabled,
    isForceSaveEnabled: featureGates.isEditorForceSaveEnabled,
    useReadableMapFiles: () => areAdvancedEditorMapReadableFilesEnabled(getAdvancedSettings()),
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
      scheduleAppUiWork({ features: true, passes: FULLSCREEN_SETTLE_PASSES }),
  });

  const {
    applyPersistentFeatures,
    disableFeatureSideEffects,
  } = createFeatureSideEffectsController({
    applyGameVolume: () => applyGameVolume(),
    applyJukeboxState: () => applyJukeboxState(),
    decorateActions: () => decorateActions(),
    cleanupGameVolumeMenu: () => cleanupGameVolumeMenu(),
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
    patchEditorSelectionControls: () => patchEditorSelectionControls(),
    patchInGameChatScroll,
    patchGameVolumeMenu: () => patchGameVolumeMenu(),
    patchJukeboxKnob: () => patchJukeboxKnob(),
    patchJukeboxMenu: () => patchJukeboxMenu(),
    patchHamburgerAudioGroup: () => patchHamburgerAudioGroup(),
    patchLobbyMusicController: () => patchLobbyMusicController(),
    patchLobbyBlacklist: () => patchLobbyBlacklist(),
    patchLobbyInformation: () => patchLobbyInformation(),
    patchMobileGrabButton: () => patchMobileGrabButton(),
    patchMobileQolboxHamburgerEntry: () => patchMobileQolboxHamburgerEntry(),
    patchReserveSpotFeature: () => patchReserveSpotFeature(),
    patchSlashCommands: () => patchSlashCommands(),
    patchSwitchTeamsButton: () => patchSwitchTeamsButton(),
    patchTypingIndicatorHooks: () => patchTypingIndicatorHooks(),
    removeEditorMapFileTransfer: () => removeEditorMapFileTransfer(),
    removeJukeboxMenuItem: () => removeJukeboxMenuItem(),
    removeHamburgerAudioGroup: () => removeHamburgerAudioGroup(),
    removeMobileGrabButton: () => removeMobileGrabButton(),
    removeSwitchTeamsButton: () => removeSwitchTeamsButton(),
    restoreChatTabOrder: () => restoreChatTabOrder(),
    restoreJukeboxState: () => restoreJukeboxState(),
    featureGates,
    stopReserveSpot: options => stopReserveSpot(options),
    stopCustomSounds: () => soundBanks.stopAllReplacements(),
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

  const { applyThemeSettings, getThemeSettings, setThemeSettings } = createThemeSettingsController();
  const { applyFeatureRootClasses, ensureGlobalStyle: ensureBaseGlobalStyle } = createQolboxShellFeatureBundle({
    isMenuClosed: () => qolboxMenuController.isClosed(),
    isFeatureActive: featureGates.shouldRunFeature,
  });
  function ensureGlobalStyle(): boolean {
    const ready = ensureBaseGlobalStyle();
    if (ready) applyThemeSettings();
    return ready;
  }

  const {
    clearFullscreenStyleSnapshots,
    getActiveRenderCanvas,
    getActiveRenderMode,
    getBaseGameSize,
    getFullscreenDimensions,
    getLayoutProbe,
    getRelativeContainerBounds,
    isRenderProbeAligned,
    restoreFullscreenStyles,
    restoreNativeLayoutSizeFallback,
    setImportantStyle,
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
    layoutRelativeHud,
    refreshObservedResizeTargets,
    resizeKnownFullscreenRenderers,
    setFullscreenResizeObserver,
    syncSpectateControlsBottomWithJukebox,
  } = createFullscreenLayoutFeatureBundle({
    clearFullscreenStyleSnapshots,
    ensureGlobalStyle,
    getFullscreenDimensions,
    getRelativeContainerBounds,
    isFullscreenEnabled: featureGates.isFullscreenEnabled,
    makeScoreRowsOpaque,
    restoreFullscreenStyles,
    restoreNativeLayoutSizeFallback,
    setImportantStyle,
    syncScoreRowsFromPlayers,
    syncTypingIndicators,
  });

  const soundBanks = createSoundBankController();

  const qolboxMenuController = createQolboxMenuFeatureBundle({
    applyFeatureRootClasses,
    applyPersistentFeatures,
    ensureGlobalStyle,
    getAdvancedSettings,
    getThemeSettings,
    isFeatureEnabled,
    scheduleUiWork: scheduleAppUiWork,
    soundBanks,
    setAdvancedSettings,
    setAllFeatureSettings,
    setFeatureEnabled,
    setThemeSettings,
  });
  const { getOnboardingSteps, installQolboxMenuHooks, openQolboxMenu, renderQolboxMenu, scheduleFirstBootOnboarding } =
    qolboxMenuController;
  const { handlePopupKeyboard, installPopupKeyboardHooks } = createPopupKeyboardController({ decorateActions });
  const { installLobbyInformationHooks, patchLobbyInformation } = createLobbyInformationController();

  const {
    applyGameVolume,
    cleanupGameVolumeMenu,
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
  } = createAudioFeatureBundle({
    focusActiveRenderCanvas,
    getActiveRenderCanvas,
    getActiveRenderMode,
    isAudioEnabled: featureGates.isAudioEnabled,
    isChatInput,
    playCustomSound: soundBanks.playReplacement,
    stopCustomSound: soundBanks.stopReplacement,
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
  const { installFullscreenHooks, scheduleUiWork } = createFullscreenOrchestrationBundle({
    applyFeatureRootClasses,
    applyPersistentFeatures,
    enforceFullscreenLayout,
    ensureGlobalStyle,
    getFullscreenDimensions,
    getLayoutProbe,
    installChatCommandAliasHooks,
    installChatEscapeHooks,
    installGameStartIndicatorHooks,
    installGameplayBackgroundFocusHooks,
    installQolboxMenuHooks,
    installReserveSocketCaptureHook,
    installTabFocusHooks,
    isAudioEnabled: featureGates.isAudioEnabled,
    isFullscreenEnabled: featureGates.isFullscreenEnabled,
    isGameStartAlertEnabled: featureGates.isGameStartAlertEnabled,
    isMenuGameplayOverlap,
    isRenderProbeAligned,
    isReserveEnabled: featureGates.isReserveEnabled,
    patchLobbyMusicController,
    refreshObservedResizeTargets,
    resizeKnownFullscreenRenderers,
    setFullscreenResizeObserver,
    shouldWaitForNativeLayoutSeed,
    syncSpectateControlsBottomWithJukebox,
    syncNonFullscreenHud: () => {
      if (featureGates.isChatEnabled()) {
        syncAllScoreRowsFromPlayers();
        syncTypingIndicators();
      }
    },
    updateGameStartIndicator,
  });

  QOLBOX_TEST: {
    window.__qolboxTest = {
      acknowledgeUpdateNotice,
      angleToJukeboxPercent,
      captureGameplayInputFocus,
      clampJukeboxPercent,
      clampPercent,
      clearFullscreenLayoutStyles,
      clearGameStartIndicator,
      cleanupInGameChatScroll,
      createEditorMapFileTransferController,
      createGameStartFocusHookInstaller,
      createGameVolumeMenuController,
      createHowlerGameAudioAdapter,
      createLobbyMusicController,
      createLobbyInformationController,
      createReserveSelectionState,
      createSoundBankController,
      createYouTubeJukeboxAdapter,
      decodeEditorMapData,
      encodeEditorMapData,
      endCurrentGame,
      enforceBlacklist,
      extractMarkdownNotes,
      enforceFullscreenLayout,
      expandNativeChatAlias,
      findPlayerByName,
      getEditorMapDataFromParsedJson,
      getChatCommandCompletions,
      getEditorBodyTestPosition,
      getEditorSelectionTestState,
      getEditorSelectionTargetTestState,
      getEffectiveJukeboxPercent,
      getFullscreenDimensions,
      getKeyboardPercentTarget,
      getLevelXpBounds,
      getKnownFullscreenRenderers,
      getOnboardingSteps,
      getDefaultThemeSettings,
      getReadableEditorMapJson,
      getReleaseNotesBetween,
      getValidatedEditorMapData,
      getWorldTypingPosition,
      handleBlacklistSlashCommand,
      handleGameStartInteractionFocus,
      handleGameplayBackgroundFocus,
      handleJoinSlashCommand,
      handleMobileGrabPointerStart,
      handlePopupKeyboard,
      handleQolboxSlashCommand,
      handleSpecSlashCommand,
      hasPendingLocalPlayTransition,
      hideMobileGrabButton,
      installGameStartIndicatorHooks,
      installGameStartSessionHooks,
      installNativeChatSendInterceptor,
      installNativeTypingPulseHook,
      installPlayerJoinHook,
      inspectNativeCompatibility,
      isFeatureEnabled,
      isMobileGameMode,
      isMobileQolboxMenuContext,
      isPlayableLobby,
      isPlayingMatch,
      isFullscreenRenderProbeAligned,
      isTeamMode,
      layoutMobileGrabButton,
      layoutRelativeHud,
      loadGamePercent,
      loadJukeboxState,
      loadAdvancedSettings,
      loadFeatureSettings,
      loadPendingUpdateNotice,
      loadThemeSettings,
      makeScoreRowsOpaque,
      noteLocallyInitiatedPlayTransition,
      notePlayerTyping,
      normalizeThemeColor,
      parseJukeboxAngleFromTransform,
      patchInGameChatScroll,
      patchEditorSelectionControls,
      setEditorPaintPreviewTestColors,
      setEditorSelectionPaintTestState,
      setEditorSelectionTestIds,
      setEditorSelectionTestTypes,
      sanitizeThemeSettings,
      patchLobbyBlacklist,
      patchMobileGrabButton,
      patchMobileQolboxHamburgerEntry,
      patchMultiplayerSessionGameStartHooks,
      patchSlashCommands,
      patchSwitchTeamsButton,
      patchTypingIndicatorHooks,
      percentToJukeboxAngle,
      percentToJukeboxVolume,
      requestBulkTeamState,
      requestTeamState,
      patchReserveSocketEmitTarget,
      readObjectProperty,
      restartCurrentGame,
      resizeKnownFullscreenRenderers: resizeRendererForTest,
      restoreKnownFullscreenRenderers,
      restoreJukeboxKnobViews,
      restoreLobbyChatPrompt,
      restoreNativeLayoutSizeFallback,
      runQolboxStartupSequence,
      setFeatureEnabled,
      setGameStartPageFocused,
      setGameStartWasInLobbyWhenUnfocused,
      setGameStartWasPlayingWhenUnfocused,
      setImportantStyle,
      setJukeboxState,
      setJukeboxKnobVisual,
      setMobileGrabPressed,
      setThemeSettings,
      shouldCaptureGameplayBackgroundFocus,
      shouldShowMobileGrabButton,
      showAllHostSettings,
      switchTeamPlayers,
      syncAllScoreRowsFromPlayers,
      syncMobileGrabButton,
      syncScoreRowsFromPlayers,
      syncTypingIndicators,
      syncWorldTypingIndicators,
      updateGameStartIndicator,
    };
  }

  installMapListPreviewThrottling();
  runQolboxStartupSequence({
    applyFeatureRootClasses,
    ensureGlobalStyle,
    installFullscreenHooks,
    installLobbyInformationHooks,
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
