import { isRecord } from '../utils/object-properties';
import { getLocalStorageItem, setLocalStorageItem } from '../utils/local-storage';

export const FEATURE_FULLSCREEN = 'fullscreen';
export const FEATURE_AUDIO = 'audio';
export const FEATURE_RESERVE = 'reserve';
export const FEATURE_CHAT = 'chat';
export const FEATURE_GAME_START_ALERT = 'gameStartAlert';
export const FEATURE_MOBILE_GRAB = 'mobileGrab';
export const FEATURE_LOBBY_COMMANDS = 'lobbyCommands';
export const FEATURE_EDITOR_MAP_TRANSFER = 'editorMapTransfer';
export const FEATURE_EDITOR_FORCE_SAVE = 'editorForceSave';

export type FeatureKey =
  | typeof FEATURE_FULLSCREEN
  | typeof FEATURE_AUDIO
  | typeof FEATURE_RESERVE
  | typeof FEATURE_CHAT
  | typeof FEATURE_GAME_START_ALERT
  | typeof FEATURE_MOBILE_GRAB
  | typeof FEATURE_LOBBY_COMMANDS
  | typeof FEATURE_EDITOR_MAP_TRANSFER
  | typeof FEATURE_EDITOR_FORCE_SAVE;

export interface FeatureDefinition {
  key: FeatureKey;
  onboardingText?: string;
  shortTitle: string;
  summary: string;
  title: string;
}

export type FeatureSettings = Record<FeatureKey, boolean>;

const FEATURE_SETTINGS_KEY = 'vm.hitbox.qolboxFeatures';

export const FEATURE_DEFINITIONS: readonly FeatureDefinition[] = [
  {
    key: FEATURE_FULLSCREEN,
    title: 'Fullscreen Layout',
    shortTitle: 'Fullscreen',
    summary: 'Center and scale hitbox.io so the play area uses the browser window cleanly.',
  },
  {
    key: FEATURE_AUDIO,
    title: 'Audio Controls',
    shortTitle: 'Audio',
    summary: 'Control volume and mute states.',
  },
  {
    key: FEATURE_RESERVE,
    title: 'Reserve Spots',
    shortTitle: 'Reserve',
    summary: 'Wait for a spot in full custom lobbies instead of stopping at the full-room message.',
  },
  {
    key: FEATURE_CHAT,
    title: 'Chat Improvements',
    shortTitle: 'Chat',
    summary: 'Press Esc to discard chat drafts, keep game chat readable, and show typing indicators.',
  },
  {
    key: FEATURE_GAME_START_ALERT,
    title: 'Away Game Alert',
    shortTitle: 'Game Alert',
    summary: 'Flash the tab title and favicon when you need to play while away from the tab.',
  },
  {
    key: FEATURE_MOBILE_GRAB,
    title: 'Mobile Grab Button',
    shortTitle: 'Mobile Grab',
    summary: 'Add the missing Grab control to the game\'s mobile ability buttons.',
  },
  {
    key: FEATURE_LOBBY_COMMANDS,
    title: 'Lobby Commands',
    shortTitle: 'Commands',
    summary: 'Add lobby controls, special player targets, and access to normal and hidden host settings.',
    onboardingText:
      'Use /spec, /join, /red, /blue, /switch, /lock, /unlock, /host, /start, /end, /restart, /record, /settings all, and /blacklist. With Command aliases enabled, /r runs /restart and /rec runs /record. Special targets: /spec all|playing, /join all|spectators, and /red or /blue all|playing|spectators. Named targets for /spec, /join, /red, /blue, /host, /kick, and /ban accept exact or unique partial player names. /blacklist stores exact names only.',
  },
  {
    key: FEATURE_EDITOR_MAP_TRANSFER,
    title: 'Map Import and Export',
    shortTitle: 'Map Files',
    summary: 'Add Import and Export to the editor File menu for saving map files on your computer.',
  },
  {
    key: FEATURE_EDITOR_FORCE_SAVE,
    title: 'Enable Editor Save',
    shortTitle: 'Editor Save',
    summary: 'Keep native Save available for loaded maps.',
  },
];

const DEFAULT_FEATURE_SETTINGS: FeatureSettings = {
  [FEATURE_FULLSCREEN]: true,
  [FEATURE_AUDIO]: true,
  [FEATURE_RESERVE]: true,
  [FEATURE_CHAT]: true,
  [FEATURE_GAME_START_ALERT]: true,
  [FEATURE_MOBILE_GRAB]: true,
  [FEATURE_LOBBY_COMMANDS]: true,
  [FEATURE_EDITOR_MAP_TRANSFER]: true,
  [FEATURE_EDITOR_FORCE_SAVE]: true,
};

export function getDefaultFeatureSettings(): FeatureSettings {
  return { ...DEFAULT_FEATURE_SETTINGS };
}

export function loadFeatureSettings(): FeatureSettings {
  const defaults = getDefaultFeatureSettings();

  try {
    const rawSettings = getLocalStorageItem(FEATURE_SETTINGS_KEY);
    if (!rawSettings) {
      return defaults;
    }

    const parsedSettings: unknown = JSON.parse(rawSettings);
    if (!isRecord(parsedSettings)) {
      return defaults;
    }

    for (const feature of FEATURE_DEFINITIONS) {
      if (Object.prototype.hasOwnProperty.call(parsedSettings, feature.key)) {
        const value = parsedSettings[feature.key];
        if (typeof value === 'boolean') {
          defaults[feature.key] = value;
        }
      }
    }
  } catch {
    // Defaults keep the script usable when storage is unavailable.
  }

  return defaults;
}

export function saveFeatureSettings(settings: FeatureSettings): void {
  setLocalStorageItem(FEATURE_SETTINGS_KEY, JSON.stringify(settings));
}

export function isKnownFeature(featureKey: string): featureKey is FeatureKey {
  return FEATURE_DEFINITIONS.some(feature => feature.key === featureKey);
}
