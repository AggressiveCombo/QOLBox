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
} from './feature-settings';

export interface FeatureGateSet {
  isAudioEnabled(): boolean;
  isChatEnabled(): boolean;
  isEditorMapTransferEnabled(): boolean;
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
    isEditorMapTransferEnabled: () => shouldRunFeature(FEATURE_EDITOR_MAP_TRANSFER),
    isFullscreenEnabled: () => shouldRunFeature(FEATURE_FULLSCREEN),
    isGameStartAlertEnabled: () => shouldRunFeature(FEATURE_GAME_START_ALERT),
    isLobbyCommandsEnabled: () => shouldRunFeature(FEATURE_LOBBY_COMMANDS),
    isMobileGrabEnabled: () => shouldRunFeature(FEATURE_MOBILE_GRAB),
    isReserveEnabled: () => shouldRunFeature(FEATURE_RESERVE),
    shouldRunFeature,
  };
}
