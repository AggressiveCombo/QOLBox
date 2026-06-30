import {
  FEATURE_AUDIO,
  FEATURE_CHAT,
  FEATURE_EDITOR_MAP_TRANSFER,
  FEATURE_FULLSCREEN,
  FEATURE_GAME_START_ALERT,
  FEATURE_LOBBY_COMMANDS,
  FEATURE_MOBILE_GRAB,
  FEATURE_RESERVE,
  type FeatureKey,
} from '../settings/feature-settings';
import type { FeatureGateSet } from '../settings/feature-gates';

interface StopReserveOptions {
  hideNative?: boolean;
}

interface FeatureSideEffectsOptions {
  applyFeatureRootClasses(): void;
  applyGameVolume(): void;
  applyJukeboxState(): void;
  clearFullscreenLayoutStyles(): void;
  clearReservePasswordPromptPending(): void;
  clearTypingIndicators(): void;
  cleanupInGameChatScroll(): void;
  disableGameStartAlerts(): void;
  hookHowlPrototype(): void;
  hookYouTubePlayer(): void;
  installGameStartIndicatorHooks(): void;
  installPlayerPopupDismissal(): void;
  installTabFocusHooks(): void;
  installYouTubeReadyCallbackHook(): void;
  patchChatTabOrder(): void;
  patchInGameChatScroll(): void;
  patchGameVolumeMenu(): void;
  patchEditorMapFileTransfer(): void;
  patchJukeboxKnob(): void;
  patchJukeboxMenu(): void;
  patchLobbyMusicController(): void;
  patchLobbyBlacklist(): void;
  patchMobileGrabButton(): void;
  patchMobileQolboxHamburgerEntry(): void;
  patchReserveSpotFeature(): void;
  patchSlashCommands(): void;
  patchSwitchTeamsButton(): void;
  patchTypingIndicatorHooks(): void;
  removeJukeboxMenuItem(): void;
  removeEditorMapFileTransfer(): void;
  removeMobileGrabButton(): void;
  removeSwitchTeamsButton(): void;
  restoreChatTabOrder(): void;
  restoreJukeboxState(): void;
  featureGates: FeatureGateSet;
  stopReserveSpot(options?: StopReserveOptions): void;
  syncScoreRows(): void;
  syncReserveJoinButtonLabel(): void;
  syncTypingIndicators(): void;
  updateGameStartIndicator(): void;
}

export function createFeatureSideEffectsController(options: FeatureSideEffectsOptions) {
  function disableFeatureSideEffects(featureKey: FeatureKey): void {
    switch (featureKey) {
      case FEATURE_RESERVE:
        options.stopReserveSpot({ hideNative: false });
        options.clearReservePasswordPromptPending();
        options.syncReserveJoinButtonLabel();
        break;
      case FEATURE_GAME_START_ALERT:
        options.disableGameStartAlerts();
        break;
      case FEATURE_AUDIO:
        options.removeJukeboxMenuItem();
        options.restoreJukeboxState();
        options.applyGameVolume();
        break;
      case FEATURE_FULLSCREEN:
        options.clearFullscreenLayoutStyles();
        if (options.featureGates.isChatEnabled()) {
          options.syncScoreRows();
          options.syncTypingIndicators();
        }
        break;
      case FEATURE_EDITOR_MAP_TRANSFER:
        options.removeEditorMapFileTransfer();
        break;
      case FEATURE_MOBILE_GRAB:
        options.removeMobileGrabButton();
        break;
      case FEATURE_CHAT:
        options.cleanupInGameChatScroll();
        options.clearTypingIndicators();
        options.restoreChatTabOrder();
        break;
      case FEATURE_LOBBY_COMMANDS:
        options.removeSwitchTeamsButton();
        break;
      default:
        break;
    }
  }

  function applyPersistentFeatures(): void {
    options.applyFeatureRootClasses();
    options.installPlayerPopupDismissal();
    options.patchSlashCommands();
    options.patchLobbyBlacklist();
    options.patchSwitchTeamsButton();
    options.patchMobileQolboxHamburgerEntry();

    if (options.featureGates.isReserveEnabled()) {
      options.patchReserveSpotFeature();
    } else {
      options.syncReserveJoinButtonLabel();
    }

    if (options.featureGates.isGameStartAlertEnabled()) {
      options.installGameStartIndicatorHooks();
      options.updateGameStartIndicator();
    } else {
      disableFeatureSideEffects(FEATURE_GAME_START_ALERT);
    }

    if (options.featureGates.isChatEnabled()) {
      options.patchChatTabOrder();
      options.patchInGameChatScroll();
      options.patchTypingIndicatorHooks();
      options.syncScoreRows();
      options.syncTypingIndicators();
    } else {
      disableFeatureSideEffects(FEATURE_CHAT);
    }

    if (options.featureGates.isMobileGrabEnabled()) {
      options.patchMobileGrabButton();
    } else {
      disableFeatureSideEffects(FEATURE_MOBILE_GRAB);
    }

    if (options.featureGates.isEditorMapTransferEnabled()) {
      options.patchEditorMapFileTransfer();
    } else {
      disableFeatureSideEffects(FEATURE_EDITOR_MAP_TRANSFER);
    }

    if (options.featureGates.isAudioEnabled()) {
      options.installTabFocusHooks();
      options.hookHowlPrototype();
      options.patchLobbyMusicController();
      options.patchGameVolumeMenu();
      options.installYouTubeReadyCallbackHook();
      options.hookYouTubePlayer();
      options.patchJukeboxMenu();
      options.patchJukeboxKnob();
      options.applyJukeboxState();
    } else {
      disableFeatureSideEffects(FEATURE_AUDIO);
    }
  }

  return {
    applyPersistentFeatures,
    disableFeatureSideEffects,
  };
}
