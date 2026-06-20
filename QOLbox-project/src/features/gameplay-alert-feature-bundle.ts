import {
  FULLSCREEN_GAMEPLAY_LAYER_SELECTOR,
  FULLSCREEN_MENU_LAYER_SELECTOR,
  FULLSCREEN_PLAY_LAYER_SELECTOR,
  GAME_START_END_WATCH_INTERVAL_MS,
  GAME_START_LOCAL_TRANSITION_TIMEOUT_MS,
  GAME_START_WATCH_INTERVAL_MS,
} from '../config/qolbox-constants';
import {
  getAdvancedGameStartAlertDelayMs,
  getAdvancedGameStartFlashIntervalMs,
} from '../settings/advanced-settings';
import { hasVisibleLayer } from '../dom/dom-helpers';
import {
  getMultiplayerSession,
  getPlayerTeamState,
  getSessionPlayer,
  isSessionLobbyActive,
  isSessionMatchActive,
} from '../hitbox/session-adapter';
import { createGameStartIndicatorController } from './game-start-indicator';
import { createGameplayStateController } from './gameplay-state';

interface GameplayAlertFeatureBundleOptions {
  isGameStartAlertEnabled(): boolean;
}

export function createGameplayAlertFeatureBundle(options: GameplayAlertFeatureBundleOptions) {
  const gameplayState = createGameplayStateController({
    gameplayLayerSelector: FULLSCREEN_GAMEPLAY_LAYER_SELECTOR,
    lobbyLayerSelector: '.lobbyContainer',
    menuLayerSelector: FULLSCREEN_MENU_LAYER_SELECTOR,
    playLayerSelector: FULLSCREEN_PLAY_LAYER_SELECTOR,
    spectateControlsSelector: '.spectateControls',
    getPlayerTeamState,
    getSession: getMultiplayerSession,
    getSessionPlayer,
    hasVisibleLayer,
    isSessionLobbyActive,
    isSessionMatchActive,
  });

  const gameStartIndicator = createGameStartIndicatorController({
    endWatchIntervalMs: GAME_START_END_WATCH_INTERVAL_MS,
    getFlashIntervalMs: getAdvancedGameStartFlashIntervalMs,
    getIndicatorDelayMs: getAdvancedGameStartAlertDelayMs,
    localTransitionTimeoutMs: GAME_START_LOCAL_TRANSITION_TIMEOUT_MS,
    watchIntervalMs: GAME_START_WATCH_INTERVAL_MS,
    getSession: getMultiplayerSession,
    isEnabled: options.isGameStartAlertEnabled,
    isPageFocused: gameplayState.isPageFocused,
    isPlayableLobby: gameplayState.isPlayableLobby,
    isPlayingMatch: gameplayState.isPlayingMatch,
  });

  return {
    ...gameplayState,
    ...gameStartIndicator,
  };
}
