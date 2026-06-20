import {
  ADVANCED_SETTING_DEFINITIONS,
  getAdvancedSettingDefinition,
  getDefaultAdvancedSettings,
  loadAdvancedSettings,
  saveAdvancedSettings,
  sanitizeAdvancedSetting,
  type AdvancedSettingKey,
  type AdvancedSettingValue,
  type AdvancedSettings,
} from './advanced-settings';

interface AdvancedSettingsControllerOptions {
  onApplyPersistentFeatures(): void;
  onRenderMenu(): void;
  onScheduleLayoutRefresh(): void;
}

export function createAdvancedSettingsController(options: AdvancedSettingsControllerOptions) {
  const settings = loadAdvancedSettings();

  function getAdvancedSettings(): AdvancedSettings {
    return { ...settings };
  }

  function getAdvancedSetting(key: AdvancedSettingKey): AdvancedSettingValue {
    return settings[key];
  }

  function setAdvancedSetting(key: string | undefined, value: unknown): void {
    const definition = getAdvancedSettingDefinition(key);
    if (!definition) {
      return;
    }

    settings[definition.key] = sanitizeAdvancedSetting(definition, value) as never;
    applyAdvancedSettingsChange();
  }

  function setAdvancedSettings(nextSettings: AdvancedSettings): void {
    for (const definition of ADVANCED_SETTING_DEFINITIONS) {
      settings[definition.key] = sanitizeAdvancedSetting(definition, nextSettings[definition.key]) as never;
    }

    applyAdvancedSettingsChange();
  }

  function resetAdvancedSetting(key: string | undefined): void {
    const definition = getAdvancedSettingDefinition(key);
    if (!definition) {
      return;
    }

    settings[definition.key] = definition.defaultValue as never;
    applyAdvancedSettingsChange();
  }

  function resetAdvancedSettings(): void {
    const defaults = getDefaultAdvancedSettings();
    for (const definition of ADVANCED_SETTING_DEFINITIONS) {
      settings[definition.key] = defaults[definition.key] as never;
    }

    applyAdvancedSettingsChange();
  }

  function applyAdvancedSettingsChange(): void {
    saveAdvancedSettings(settings);
    options.onApplyPersistentFeatures();
    options.onScheduleLayoutRefresh();
    options.onRenderMenu();
  }

  return {
    getAdvancedSetting,
    getAdvancedSettings,
    resetAdvancedSetting,
    resetAdvancedSettings,
    setAdvancedSettings,
    setAdvancedSetting,
  };
}
