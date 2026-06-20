import {
  FEATURE_DEFINITIONS,
  getDefaultFeatureSettings,
  isKnownFeature,
  loadFeatureSettings,
  saveFeatureSettings,
  type FeatureKey,
  type FeatureSettings,
} from './feature-settings';
import type { ScheduledUiWorkRequest } from '../types/scheduled-work';

interface FeatureSettingsControllerOptions {
  isOnboardingComplete(): boolean;
  onApplyFeatureRootClasses(): void;
  onApplyPersistentFeatures(): void;
  onDisableFeatureSideEffects(featureKey: FeatureKey): void;
  onRenderMenu(): void;
  onScheduleUiWork(request: ScheduledUiWorkRequest): void;
  resizeSettlePasses: number;
}

export function createFeatureSettingsController(options: FeatureSettingsControllerOptions) {
  const featureSettings = loadFeatureSettings();

  function isFeatureEnabled(featureKey: string): boolean {
    return isKnownFeature(featureKey) && featureSettings[featureKey] !== false;
  }

  function shouldRunFeature(featureKey: string): boolean {
    return options.isOnboardingComplete() && isFeatureEnabled(featureKey);
  }

  function setFeatureEnabled(featureKey: string, enabled: boolean): void {
    if (!isKnownFeature(featureKey)) {
      return;
    }

    featureSettings[featureKey] = Boolean(enabled);
    applySettingsChange([featureKey]);
  }

  function applySettingsChange(featuresToRefresh: readonly FeatureKey[] = []): void {
    saveFeatureSettings(featureSettings);
    options.onApplyFeatureRootClasses();

    for (const featureKey of featuresToRefresh) {
      if (!shouldRunFeature(featureKey)) {
        options.onDisableFeatureSideEffects(featureKey);
      }
    }

    if (options.isOnboardingComplete()) {
      options.onApplyPersistentFeatures();
      options.onScheduleUiWork({ force: true, features: true, passes: options.resizeSettlePasses });
    }

    options.onRenderMenu();
  }

  function setAllFeatureSettings(nextSettings: FeatureSettings): void {
    const changedFeatures: FeatureKey[] = [];

    for (const { key } of FEATURE_DEFINITIONS) {
      if (featureSettings[key] !== nextSettings[key]) {
        changedFeatures.push(key);
      }

      featureSettings[key] = nextSettings[key];
    }

    applySettingsChange(changedFeatures);
  }

  function resetFeatureSettingsToDefaults(): void {
    setAllFeatureSettings(getDefaultFeatureSettings());
  }

  return {
    isFeatureEnabled,
    resetFeatureSettingsToDefaults,
    setAllFeatureSettings,
    setFeatureEnabled,
    shouldRunFeature,
  };
}
