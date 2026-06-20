import {
  FEATURE_AUDIO,
  FEATURE_CHAT,
  FEATURE_FULLSCREEN,
  FEATURE_GAME_START_ALERT,
  FEATURE_LOBBY_COMMANDS,
  FEATURE_MOBILE_GRAB,
  FEATURE_RESERVE,
  type FeatureKey,
} from './feature-settings';

export interface FeatureGateSet {
  isAudioEnabled(): boolean;
  isChatEnabled(): boolean;
  isFullscreenEnabled(): boolean;
  isGameStartAlertEnabled(): boolean;
  isLobbyCommandsEnabled(): boolean;
  isMobileGrabEnabled(): boolean;
  isReserveEnabled(): boolean;
  shouldRunFeature(featureKey: FeatureKey): boolean;
}

export function createFeatureGateSet(shouldRunFeature: (featureKey: FeatureKey) => boolean): FeatureGateSet {
  return {
    isAudioEnabled: () => shouldRunFeature(FEATURE_AUDIO),
    isChatEnabled: () => shouldRunFeature(FEATURE_CHAT),
    isFullscreenEnabled: () => shouldRunFeature(FEATURE_FULLSCREEN),
    isGameStartAlertEnabled: () => shouldRunFeature(FEATURE_GAME_START_ALERT),
    isLobbyCommandsEnabled: () => shouldRunFeature(FEATURE_LOBBY_COMMANDS),
    isMobileGrabEnabled: () => shouldRunFeature(FEATURE_MOBILE_GRAB),
    isReserveEnabled: () => shouldRunFeature(FEATURE_RESERVE),
    shouldRunFeature,
  };
}
