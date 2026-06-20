export const FEATURE_FULLSCREEN = 'fullscreen';
export const FEATURE_AUDIO = 'audio';
export const FEATURE_RESERVE = 'reserve';
export const FEATURE_CHAT = 'chat';
export const FEATURE_GAME_START_ALERT = 'gameStartAlert';
export const FEATURE_MOBILE_GRAB = 'mobileGrab';
export const FEATURE_LOBBY_COMMANDS = 'lobbyCommands';

export type FeatureKey =
  | typeof FEATURE_FULLSCREEN
  | typeof FEATURE_AUDIO
  | typeof FEATURE_RESERVE
  | typeof FEATURE_CHAT
  | typeof FEATURE_GAME_START_ALERT
  | typeof FEATURE_MOBILE_GRAB
  | typeof FEATURE_LOBBY_COMMANDS;

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
    summary: 'Remember volume choices, make the sliders easier to adjust, and keep jukebox mute behavior stable.',
  },
  {
    key: FEATURE_RESERVE,
    title: 'Reserve Spots',
    shortTitle: 'Reserve',
    summary: 'Wait for a spot in full custom lobbies instead of immediately giving up on room_full.',
  },
  {
    key: FEATURE_CHAT,
    title: 'Chat Improvements',
    shortTitle: 'Chat',
    summary: 'Press Esc to discard drafts, keep readable game chat scrollable, and show remote typing indicators.',
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
    summary: 'Add practical lobby controls, bulk player targets, and the complete host-settings listing.',
    onboardingText:
      'Use /spec, /join, /red, /blue, /switch, /lock, /unlock, /host, /start, /end and /restart. /rec is shorthand for /record, and /r is shorthand for /restart. Use all, playing, or spectators for group targets, /settings all for every host setting, and exact or unique partial names with native /kick and /ban.',
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
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function getDefaultFeatureSettings(): FeatureSettings {
  return { ...DEFAULT_FEATURE_SETTINGS };
}

export function loadFeatureSettings(): FeatureSettings {
  const defaults = getDefaultFeatureSettings();

  try {
    const rawSettings = localStorage.getItem(FEATURE_SETTINGS_KEY);
    if (!rawSettings) {
      return defaults;
    }

    const parsedSettings: unknown = JSON.parse(rawSettings);
    if (!isRecord(parsedSettings)) {
      return defaults;
    }

    for (const feature of FEATURE_DEFINITIONS) {
      if (Object.prototype.hasOwnProperty.call(parsedSettings, feature.key)) {
        defaults[feature.key] = parsedSettings[feature.key] !== false;
      }
    }
  } catch {
    // Defaults keep the script usable when storage is unavailable.
  }

  return defaults;
}

export function saveFeatureSettings(settings: FeatureSettings): void {
  try {
    localStorage.setItem(FEATURE_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // Storage may be unavailable in privacy-restricted browser contexts.
  }
}

export function isKnownFeature(featureKey: string): featureKey is FeatureKey {
  return FEATURE_DEFINITIONS.some(feature => feature.key === featureKey);
}
