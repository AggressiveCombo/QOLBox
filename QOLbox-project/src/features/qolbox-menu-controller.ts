import {
  ADVANCED_ALERT_DELAY_MS,
  ADVANCED_ALERT_FLASH_INTERVAL_MS,
  ADVANCED_BLACKLIST_ENFORCEMENT,
  ADVANCED_COMMAND_ALIASES,
  ADVANCED_RESERVE_RETRY_INTERVAL_MS,
  ADVANCED_SETTING_DEFINITIONS,
  ADVANCED_TYPING_DURATION_MS,
  getDefaultAdvancedSettings,
  sanitizeAdvancedSetting,
  type AdvancedSettingDefinition,
  type AdvancedSettingKey,
  type AdvancedSettings,
} from '../settings/advanced-settings';
import {
  FEATURE_AUDIO,
  FEATURE_CHAT,
  FEATURE_EDITOR_MAP_TRANSFER,
  FEATURE_FULLSCREEN,
  FEATURE_GAME_START_ALERT,
  FEATURE_LOBBY_COMMANDS,
  FEATURE_MOBILE_GRAB,
  FEATURE_RESERVE,
  getDefaultFeatureSettings,
  isKnownFeature,
  type FeatureKey,
  type FeatureSettings,
} from '../settings/feature-settings';
import {
  isArrowLeftKey,
  isArrowRightKey,
  isEnterKey,
  isEscapeKey,
} from './chat-keyboard-events';
import { isQolboxMenuShortcut } from './qolbox-menu-keyboard';
import type {
  QolboxSettingsDraft,
  QolboxSettingsPage,
  QolboxSettingsValidationErrors,
} from './qolbox-menu-markup';
import { ensureQolboxMenuOverlay, renderQolboxMenuPanel } from './qolbox-menu-view';

export type QolboxMenuMode = 'closed' | 'onboarding' | 'settings' | 'update';

interface QolboxMenuControllerOptions {
  createSettingsDraft(): QolboxSettingsDraft;
  getOnboardingStepMarkup(stepIndex: number): string;
  getOnboardingStepCount(): number;
  getSettingsMenuMarkup(
    draft: QolboxSettingsDraft,
    page: QolboxSettingsPage,
    errors: QolboxSettingsValidationErrors
  ): string;
  getUpdateNoticeMarkup(pageIndex: number): string;
  getUpdateNoticePageCount(): number;
  initialOnboardingComplete: boolean;
  menuId: string;
  menuKey: string;
  onAcknowledgeUpdateNotice(): void;
  onBeforeOpen(): void;
  onChooseExpressSetup(): void;
  onCompleteOnboarding(): void;
  onCommitSettingsDraft(features: FeatureSettings, advanced: AdvancedSettings): void;
  onMenuModeChanged(): void;
  onSetFeatureEnabled(featureKey: string | undefined, enabled: boolean): void;
}

const FEATURE_PAGE_KEYS: readonly FeatureKey[] = [
  FEATURE_FULLSCREEN,
  FEATURE_RESERVE,
  FEATURE_CHAT,
  FEATURE_GAME_START_ALERT,
  FEATURE_EDITOR_MAP_TRANSFER,
  FEATURE_MOBILE_GRAB,
];

const ADVANCED_TIMING_KEYS: readonly AdvancedSettingKey[] = [
  ADVANCED_RESERVE_RETRY_INTERVAL_MS,
  ADVANCED_ALERT_DELAY_MS,
  ADVANCED_ALERT_FLASH_INTERVAL_MS,
  ADVANCED_TYPING_DURATION_MS,
];

export function createQolboxMenuController(options: QolboxMenuControllerOptions) {
  let onboardingComplete = options.initialOnboardingComplete;
  let onboardingStepIndex = 0;
  let settingsDraft: QolboxSettingsDraft | null = null;
  let settingsErrors: QolboxSettingsValidationErrors = {};
  let settingsPage: QolboxSettingsPage = 'features';
  let updateNoticePageIndex = 0;
  let mode: QolboxMenuMode = 'closed';
  let hooksInstalled = false;

  function isOnboardingComplete(): boolean {
    return onboardingComplete;
  }

  function getMode(): QolboxMenuMode {
    return mode;
  }

  function isClosed(): boolean {
    return mode === 'closed';
  }

  function renderQolboxMenu(): void {
    if (mode === 'settings' && !settingsDraft) {
      settingsDraft = options.createSettingsDraft();
    }

    if (mode === 'update') {
      updateNoticePageIndex = Math.max(
        0,
        Math.min(updateNoticePageIndex, Math.max(1, options.getUpdateNoticePageCount()) - 1)
      );
    }

    const markup =
      mode === 'settings'
        ? options.getSettingsMenuMarkup(settingsDraft as QolboxSettingsDraft, settingsPage, settingsErrors)
        : mode === 'update'
          ? options.getUpdateNoticeMarkup(updateNoticePageIndex)
          : options.getOnboardingStepMarkup(onboardingStepIndex);
    renderQolboxMenuPanel(options.menuId, markup);
  }

  function stopQolboxMenuPointerEvent(event: Event): void {
    if (mode !== 'closed') {
      event.stopPropagation();
    }
  }

  function closeQolboxMenu(): void {
    mode = 'closed';
    settingsDraft = null;
    settingsErrors = {};
    options.onMenuModeChanged();
    const menu = document.getElementById(options.menuId);
    if (menu) {
      menu.remove();
    }
  }

  function completeOnboarding(): void {
    onboardingComplete = true;
    closeQolboxMenu();
    options.onCompleteOnboarding();
  }

  function openQolboxMenu(nextMode: Exclude<QolboxMenuMode, 'closed'> = 'settings'): void {
    options.onBeforeOpen();
    if (!ensureQolboxMenu()) {
      return;
    }

    mode = nextMode;
    if (nextMode === 'onboarding') {
      settingsDraft = null;
      settingsErrors = {};
      onboardingStepIndex = 0;
    } else if (nextMode === 'settings') {
      settingsDraft = options.createSettingsDraft();
      settingsErrors = {};
      settingsPage = 'features';
    } else if (nextMode === 'update') {
      updateNoticePageIndex = 0;
    }

    options.onMenuModeChanged();
    renderQolboxMenu();
  }

  function getAdvancedDefinition(key: string | undefined): AdvancedSettingDefinition | null {
    return ADVANCED_SETTING_DEFINITIONS.find(definition => definition.key === key) || null;
  }

  function getDraftAdvancedValue(key: AdvancedSettingKey): unknown {
    const panel = document.getElementById(options.menuId);
    const input = panel
      ? Array.from(panel.querySelectorAll<HTMLInputElement | HTMLSelectElement>('[data-qolbox-advanced-input]'))
        .find(element => element.dataset.qolboxAdvancedInput === key)
      : null;
    return input ? input.value : settingsDraft?.advanced[key];
  }

  function updateDraftAdvancedValue(key: string | undefined, value: unknown): void {
    const definition = getAdvancedDefinition(key);
    if (!definition || !settingsDraft) {
      return;
    }

    settingsDraft.advanced[definition.key] = value;
    if (settingsErrors[definition.key]) {
      delete settingsErrors[definition.key];
    }
  }

  function validateAdvancedValue(definition: AdvancedSettingDefinition, value: unknown): string | null {
    if (definition.kind === 'number') {
      const numericValue = Number(value);
      if (!Number.isFinite(numericValue)) {
        return 'Enter a number.';
      }

      if (numericValue < definition.min || numericValue > definition.max) {
        return `Use ${definition.min}-${definition.max}${definition.unit ? ` ${definition.unit}` : ''}.`;
      }

      return null;
    }

    return value === true || value === false || value === 'true' || value === 'false'
      ? null
      : 'Choose Enabled or Off.';
  }

  function getErrorPage(key: AdvancedSettingKey): QolboxSettingsPage {
    if (key === ADVANCED_COMMAND_ALIASES || key === ADVANCED_BLACKLIST_ENFORCEMENT) {
      return 'commands';
    }

    return 'advanced';
  }

  function validateSettingsDraft(): AdvancedSettings | null {
    if (!settingsDraft) {
      return null;
    }

    const errors: QolboxSettingsValidationErrors = {};
    const sanitized = {} as AdvancedSettings;

    for (const definition of ADVANCED_SETTING_DEFINITIONS) {
      const value = getDraftAdvancedValue(definition.key);
      settingsDraft.advanced[definition.key] = value;
      const error = validateAdvancedValue(definition, value);
      if (error) {
        errors[definition.key] = error;
      } else {
        sanitized[definition.key] = sanitizeAdvancedSetting(definition, value) as never;
      }
    }

    settingsErrors = errors;
    const firstError = ADVANCED_SETTING_DEFINITIONS.find(definition => errors[definition.key]);
    if (firstError) {
      settingsPage = getErrorPage(firstError.key);
      return null;
    }

    return sanitized;
  }

  function resetFeatureDraft(keys: readonly FeatureKey[]): void {
    if (!settingsDraft) {
      return;
    }

    const defaults = getDefaultFeatureSettings();
    for (const key of keys) {
      settingsDraft.features[key] = defaults[key];
    }
  }

  function resetAdvancedDraft(keys: readonly AdvancedSettingKey[]): void {
    if (!settingsDraft) {
      return;
    }

    const defaults = getDefaultAdvancedSettings();
    for (const key of keys) {
      settingsDraft.advanced[key] = defaults[key];
      delete settingsErrors[key];
    }
  }

  function resetSettingsPageDraft(): void {
    switch (settingsPage) {
      case 'commands':
        resetFeatureDraft([FEATURE_LOBBY_COMMANDS]);
        resetAdvancedDraft([ADVANCED_COMMAND_ALIASES, ADVANCED_BLACKLIST_ENFORCEMENT]);
        break;
      case 'audio':
        resetFeatureDraft([FEATURE_AUDIO]);
        break;
      case 'advanced':
        resetAdvancedDraft(ADVANCED_TIMING_KEYS);
        break;
      case 'features':
        resetFeatureDraft(FEATURE_PAGE_KEYS);
        break;
      case 'about':
      default:
        break;
    }

    renderQolboxMenu();
  }

  function saveSettingsDraft(): void {
    const sanitized = validateSettingsDraft();
    if (!settingsDraft || !sanitized) {
      renderQolboxMenu();
      return;
    }

    const featureDraft = { ...settingsDraft.features };
    options.onCommitSettingsDraft(featureDraft, sanitized);
    closeQolboxMenu();
  }

  function handleQolboxMenuClick(event: MouseEvent): void {
    if (mode !== 'closed') {
      event.stopPropagation();
    }

    const actionElement =
      event.target instanceof Element ? event.target.closest<HTMLElement>('[data-qolbox-action]') : null;
    if (!actionElement) {
      return;
    }

    const action = actionElement.dataset.qolboxAction;
    event.preventDefault();
    event.stopImmediatePropagation();

    switch (action) {
      case 'set-feature':
        options.onSetFeatureEnabled(actionElement.dataset.feature, actionElement.dataset.enabled === 'true');
        break;
      case 'draft-feature':
        if (settingsDraft && isKnownFeature(actionElement.dataset.feature || '')) {
          settingsDraft.features[actionElement.dataset.feature as FeatureKey] = actionElement.dataset.enabled === 'true';
          renderQolboxMenu();
        }
        break;
      case 'draft-advanced':
        updateDraftAdvancedValue(actionElement.dataset.advanced, actionElement.dataset.value);
        renderQolboxMenu();
        break;
      case 'settings-page':
        if (isSettingsPage(actionElement.dataset.page)) {
          settingsPage = actionElement.dataset.page;
          renderQolboxMenu();
        }
        break;
      case 'reset-page':
        resetSettingsPageDraft();
        break;
      case 'save-settings':
        saveSettingsDraft();
        break;
      case 'cancel-settings':
        closeQolboxMenu();
        break;
      case 'choose-express':
        options.onChooseExpressSetup();
        onboardingStepIndex = options.getOnboardingStepCount() - 1;
        renderQolboxMenu();
        break;
      case 'choose-custom':
        onboardingStepIndex = Math.min(1, options.getOnboardingStepCount() - 1);
        renderQolboxMenu();
        break;
      case 'next':
        onboardingStepIndex = Math.min(onboardingStepIndex + 1, options.getOnboardingStepCount() - 1);
        renderQolboxMenu();
        break;
      case 'back':
        onboardingStepIndex = Math.max(0, onboardingStepIndex - 1);
        renderQolboxMenu();
        break;
      case 'skip-onboarding':
      case 'finish-onboarding':
        completeOnboarding();
        break;
      case 'acknowledge-update':
        options.onAcknowledgeUpdateNotice();
        closeQolboxMenu();
        break;
      case 'update-newer':
        updateNoticePageIndex = Math.max(0, updateNoticePageIndex - 1);
        renderQolboxMenu();
        break;
      case 'update-older':
        updateNoticePageIndex = Math.min(
          Math.max(1, options.getUpdateNoticePageCount()) - 1,
          updateNoticePageIndex + 1
        );
        renderQolboxMenu();
        break;
      case 'redo-onboarding':
        openQolboxMenu('onboarding');
        break;
      default:
        break;
    }
  }

  function ensureQolboxMenu(): HTMLElement | null {
    return ensureQolboxMenuOverlay({
      menuId: options.menuId,
      onClick: handleQolboxMenuClick,
      onInput: handleQolboxMenuInput,
      onPointerEvent: stopQolboxMenuPointerEvent,
    });
  }

  function isSettingsPage(value: unknown): value is QolboxSettingsPage {
    return (
      value === 'features' ||
      value === 'commands' ||
      value === 'audio' ||
      value === 'advanced' ||
      value === 'about'
    );
  }

  function handleQolboxMenuInput(event: Event): void {
    if (mode !== 'settings' || !settingsDraft || !(event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement)) {
      return;
    }

    const key = event.target.dataset.qolboxAdvancedInput;
    if (!key) {
      return;
    }

    updateDraftAdvancedValue(key, event.target.value);
  }

  function handleQolboxMenuKey(event: KeyboardEvent): void {
    if (mode !== 'closed' && isEscapeKey(event)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      closeQolboxMenu();
      return;
    }

    if (mode === 'update' && (isArrowLeftKey(event) || isArrowRightKey(event))) {
      const action = isArrowLeftKey(event) ? 'update-older' : 'update-newer';
      const actionElement = document.querySelector<HTMLElement>(
        `#${options.menuId} [data-qolbox-action="${action}"]:not([disabled])`
      );
      if (actionElement) {
        event.preventDefault();
        event.stopImmediatePropagation();
        actionElement.click();
      }
      return;
    }

    if (mode !== 'closed' && isEnterKey(event)) {
      const activeElement = document.activeElement;
      const actionElement =
        activeElement instanceof HTMLElement &&
        activeElement.closest(`#${options.menuId}`) &&
        activeElement.matches('[data-qolbox-action]:not([disabled])')
          ? activeElement
          : document.querySelector<HTMLElement>(
              `#${options.menuId} .qolboxMenuButton.primary:not([disabled]), ` +
              `#${options.menuId} .qolboxMenuChoice.primary:not([disabled])`
            );
      if (actionElement) {
        event.preventDefault();
        event.stopImmediatePropagation();
        actionElement.click();
      }
      return;
    }

    if (!isQolboxMenuShortcut(event, options.menuKey)) {
      return;
    }

    event.preventDefault();
    event.stopImmediatePropagation();

    if (mode === 'settings') {
      closeQolboxMenu();
      return;
    }

    if (mode === 'onboarding') {
      return;
    }

    openQolboxMenu(onboardingComplete ? 'settings' : 'onboarding');
  }

  function installQolboxMenuHooks(): void {
    if (hooksInstalled) {
      return;
    }

    hooksInstalled = true;
    window.addEventListener('keydown', handleQolboxMenuKey, true);
    document.addEventListener('keydown', handleQolboxMenuKey, true);
  }

  function showFirstBootOnboarding(): void {
    if (onboardingComplete || mode !== 'closed') {
      return;
    }

    openQolboxMenu('onboarding');
  }

  function showUpdateNotice(): void {
    if (!onboardingComplete || mode !== 'closed') {
      return;
    }

    openQolboxMenu('update');
  }

  return {
    closeQolboxMenu,
    getMode,
    installQolboxMenuHooks,
    isClosed,
    isOnboardingComplete,
    openQolboxMenu,
    renderQolboxMenu,
    showFirstBootOnboarding,
    showUpdateNotice,
  };
}
