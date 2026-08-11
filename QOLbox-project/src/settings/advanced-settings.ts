import {
  GAME_START_FLASH_INTERVAL_MS,
  GAME_START_INDICATOR_DELAY_MS,
  RESERVE_RETRY_DELAY_MS,
  TYPING_INDICATOR_TIMEOUT_MS,
} from '../config/qolbox-constants';
import { isRecord } from '../utils/object-properties';
import { getLocalStorageItem, setLocalStorageItem } from '../utils/local-storage';

export const ADVANCED_RESERVE_RETRY_INTERVAL_MS = 'reserveRetryIntervalMs';
export const ADVANCED_COMMAND_ALIASES = 'commandAliases';
export const ADVANCED_BLACKLIST_ENFORCEMENT = 'blacklistEnforcement';
export const ADVANCED_EDITOR_MAP_READABLE_FILES = 'editorMapReadableFiles';
export const ADVANCED_ALERT_DELAY_MS = 'gameStartAlertDelayMs';
export const ADVANCED_ALERT_FLASH_INTERVAL_MS = 'gameStartAlertFlashIntervalMs';
export const ADVANCED_TYPING_DURATION_MS = 'typingIndicatorDurationMs';

export type AdvancedSettingKey =
  | typeof ADVANCED_RESERVE_RETRY_INTERVAL_MS
  | typeof ADVANCED_COMMAND_ALIASES
  | typeof ADVANCED_BLACKLIST_ENFORCEMENT
  | typeof ADVANCED_EDITOR_MAP_READABLE_FILES
  | typeof ADVANCED_ALERT_DELAY_MS
  | typeof ADVANCED_ALERT_FLASH_INTERVAL_MS
  | typeof ADVANCED_TYPING_DURATION_MS;

export type AdvancedSettingValue = boolean | number;

export type AdvancedSettings = {
  [ADVANCED_RESERVE_RETRY_INTERVAL_MS]: number;
  [ADVANCED_COMMAND_ALIASES]: boolean;
  [ADVANCED_BLACKLIST_ENFORCEMENT]: boolean;
  [ADVANCED_EDITOR_MAP_READABLE_FILES]: boolean;
  [ADVANCED_ALERT_DELAY_MS]: number;
  [ADVANCED_ALERT_FLASH_INTERVAL_MS]: number;
  [ADVANCED_TYPING_DURATION_MS]: number;
};

interface BaseAdvancedSettingDefinition {
  description: string;
  key: AdvancedSettingKey;
  title: string;
}

export interface NumberAdvancedSettingDefinition extends BaseAdvancedSettingDefinition {
  defaultValue: number;
  kind: 'number';
  max: number;
  min: number;
  step: number;
  unit?: string;
}

export interface BooleanAdvancedSettingDefinition extends BaseAdvancedSettingDefinition {
  defaultValue: boolean;
  kind: 'boolean';
}

export type AdvancedSettingDefinition =
  | NumberAdvancedSettingDefinition
  | BooleanAdvancedSettingDefinition;

const ADVANCED_SETTINGS_KEY = 'vm.hitbox.qolboxAdvancedSettings';

export const ADVANCED_SETTING_DEFINITIONS: readonly AdvancedSettingDefinition[] = [
  {
    key: ADVANCED_RESERVE_RETRY_INTERVAL_MS,
    kind: 'number',
    title: 'Reserve retry interval',
    description: 'Milliseconds between reserve join attempts.',
    defaultValue: RESERVE_RETRY_DELAY_MS,
    min: 500,
    max: 10000,
    step: 100,
    unit: 'ms',
  },
  {
    key: ADVANCED_COMMAND_ALIASES,
    kind: 'boolean',
    title: 'Command aliases',
    description: 'Enable shorthand commands such as /rec and /r.',
    defaultValue: true,
  },
  {
    key: ADVANCED_BLACKLIST_ENFORCEMENT,
    kind: 'boolean',
    title: 'Automatic blacklist',
    description: 'Ban exact-name blacklist matches while you are host.',
    defaultValue: true,
  },
  {
    key: ADVANCED_EDITOR_MAP_READABLE_FILES,
    kind: 'boolean',
    title: 'Readable map exports',
    description: 'Export readable JSON instead of compact map data. JSON import is always supported.',
    defaultValue: true,
  },
  {
    key: ADVANCED_ALERT_DELAY_MS,
    kind: 'number',
    title: 'Tab alert delay',
    description: 'Delay before the away-tab title changes.',
    defaultValue: GAME_START_INDICATOR_DELAY_MS,
    min: 200,
    max: 5000,
    step: 100,
    unit: 'ms',
  },
  {
    key: ADVANCED_ALERT_FLASH_INTERVAL_MS,
    kind: 'number',
    title: 'Tab flash speed',
    description: 'Milliseconds between title/favicon flashes.',
    defaultValue: GAME_START_FLASH_INTERVAL_MS,
    min: 250,
    max: 2000,
    step: 50,
    unit: 'ms',
  },
  {
    key: ADVANCED_TYPING_DURATION_MS,
    kind: 'number',
    title: 'Typing indicator duration',
    description: 'How long typing indicators stay visible.',
    defaultValue: TYPING_INDICATOR_TIMEOUT_MS,
    min: 500,
    max: 5000,
    step: 100,
    unit: 'ms',
  },
];

function clampNumber(value: number, definition: NumberAdvancedSettingDefinition): number {
  const stepped = Math.round(value / definition.step) * definition.step;
  return Math.min(definition.max, Math.max(definition.min, stepped));
}

export function getDefaultAdvancedSettings(): AdvancedSettings {
  const settings = {} as AdvancedSettings;
  for (const definition of ADVANCED_SETTING_DEFINITIONS) {
    settings[definition.key] = definition.defaultValue as never;
  }
  return settings;
}

export function sanitizeAdvancedSetting(
  definition: AdvancedSettingDefinition,
  value: unknown
): AdvancedSettingValue {
  switch (definition.kind) {
    case 'number': {
      const numericValue = Number(value);
      return Number.isFinite(numericValue) ? clampNumber(numericValue, definition) : definition.defaultValue;
    }
    case 'boolean':
      if (value === true || value === 'true') {
        return true;
      }
      if (value === false || value === 'false') {
        return false;
      }
      return definition.defaultValue;
  }
}

export function loadAdvancedSettings(): AdvancedSettings {
  const settings = getDefaultAdvancedSettings();

  try {
    const rawSettings = getLocalStorageItem(ADVANCED_SETTINGS_KEY);
    if (!rawSettings) {
      return settings;
    }

    const parsedSettings: unknown = JSON.parse(rawSettings);
    if (!isRecord(parsedSettings)) {
      return settings;
    }

    for (const definition of ADVANCED_SETTING_DEFINITIONS) {
      if (Object.prototype.hasOwnProperty.call(parsedSettings, definition.key)) {
        const storedValue = parsedSettings[definition.key];
        if (definition.kind !== 'boolean' || typeof storedValue === 'boolean') {
          settings[definition.key] = sanitizeAdvancedSetting(definition, storedValue) as never;
        }
      }
    }
  } catch {
    // Defaults keep the script usable when storage is unavailable.
  }

  return settings;
}

export function saveAdvancedSettings(settings: AdvancedSettings): void {
  setLocalStorageItem(ADVANCED_SETTINGS_KEY, JSON.stringify(settings));
}

export function getAdvancedSettingDefinition(key: string | undefined): AdvancedSettingDefinition | null {
  return ADVANCED_SETTING_DEFINITIONS.find(definition => definition.key === key) || null;
}

export function getAdvancedReserveRetryIntervalMs(settings: AdvancedSettings = loadAdvancedSettings()): number {
  return settings[ADVANCED_RESERVE_RETRY_INTERVAL_MS];
}

export function getAdvancedGameStartAlertDelayMs(settings: AdvancedSettings = loadAdvancedSettings()): number {
  return settings[ADVANCED_ALERT_DELAY_MS];
}

export function getAdvancedGameStartFlashIntervalMs(settings: AdvancedSettings = loadAdvancedSettings()): number {
  return settings[ADVANCED_ALERT_FLASH_INTERVAL_MS];
}

export function getAdvancedTypingIndicatorDurationMs(settings: AdvancedSettings = loadAdvancedSettings()): number {
  return settings[ADVANCED_TYPING_DURATION_MS];
}

export function areAdvancedCommandAliasesEnabled(settings: AdvancedSettings = loadAdvancedSettings()): boolean {
  return settings[ADVANCED_COMMAND_ALIASES];
}

export function isAdvancedBlacklistEnforcementEnabled(
  settings: AdvancedSettings = loadAdvancedSettings()
): boolean {
  return settings[ADVANCED_BLACKLIST_ENFORCEMENT];
}

export function areAdvancedEditorMapReadableFilesEnabled(
  settings: AdvancedSettings = loadAdvancedSettings()
): boolean {
  return settings[ADVANCED_EDITOR_MAP_READABLE_FILES];
}
