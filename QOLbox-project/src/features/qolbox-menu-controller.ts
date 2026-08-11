import {
  ADVANCED_BLACKLIST_ENFORCEMENT,
  ADVANCED_COMMAND_ALIASES,
  ADVANCED_SETTING_DEFINITIONS,
  getDefaultAdvancedSettings,
  sanitizeAdvancedSetting,
  type AdvancedSettingDefinition,
  type AdvancedSettingKey,
  type AdvancedSettings,
} from '../settings/advanced-settings';
import {
  getDefaultFeatureSettings,
  isKnownFeature,
  type FeatureKey,
  type FeatureSettings,
} from '../settings/feature-settings';
import {
  THEME_GAME_ACCENT,
  THEME_MODE,
  THEME_QOLBOX_ACCENT,
  getDefaultThemeSettings,
  normalizeThemeColor,
  type ThemeColorKey,
  type ThemeSettings,
} from '../settings/theme-settings';
import {
  isArrowLeftKey,
  isArrowRightKey,
  isEnterKey,
  isEscapeKey,
  isTabKey,
} from './chat-keyboard-events';
import { focusElementWithoutScroll } from '../dom/dom-helpers';
import type {
  QolboxSettingsDraft,
  QolboxReferenceTopic,
  QolboxSettingsPage,
  QolboxSettingsValidationErrors,
} from './qolbox-menu-markup';

function isQolboxMenuShortcut(event: KeyboardEvent, menuKey: string): boolean {
  return (
    !event.altKey &&
    !event.ctrlKey &&
    !event.metaKey &&
    !event.shiftKey &&
    (event.key === menuKey || event.code === menuKey)
  );
}
import { ensureQolboxMenuOverlay, renderQolboxMenuPanel } from './qolbox-menu-view';

export type QolboxMenuMode = 'closed' | 'onboarding' | 'patch-notes' | 'reference' | 'settings' | 'update';

interface QolboxMenuControllerOptions {
  createSettingsDraft(): QolboxSettingsDraft;
  getOnboardingStepMarkup(stepIndex: number): string;
  getOnboardingStepCount(): number;
  getPatchNotesMarkup(pageIndex: number): string;
  getPatchNotesPageCount(): number;
  getReferenceMarkup(topic: QolboxReferenceTopic): string;
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
  onCommitSettingsDraft(features: FeatureSettings, advanced: AdvancedSettings, theme: ThemeSettings): void;
  onCustomAction(action: string, element: HTMLElement): Promise<boolean>;
  onCustomInput(element: HTMLInputElement | HTMLSelectElement): Promise<boolean>;
  onMenuModeChanged(): void;
  onOpenPatchNotes(): void;
  onSetFeatureEnabled(featureKey: string | undefined, enabled: boolean): void;
}

export function createQolboxMenuController(options: QolboxMenuControllerOptions) {
  let onboardingComplete = options.initialOnboardingComplete;
  let onboardingStepIndex = 0;
  let settingsDraft: QolboxSettingsDraft | null = null;
  let settingsErrors: QolboxSettingsValidationErrors = {};
  let focusBeforeOpen: HTMLElement | null = null;
  let settingsPage: QolboxSettingsPage = 'features';
  let releaseNotesPageIndex = 0;
  let referenceTopic: QolboxReferenceTopic = 'commands';
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

    if (mode === 'update' || mode === 'patch-notes') {
      const pageCount = mode === 'update' ? options.getUpdateNoticePageCount() : options.getPatchNotesPageCount();
      releaseNotesPageIndex = Math.max(
        0,
        Math.min(releaseNotesPageIndex, Math.max(1, pageCount) - 1)
      );
    }

    const markup =
      mode === 'settings'
        ? options.getSettingsMenuMarkup(settingsDraft as QolboxSettingsDraft, settingsPage, settingsErrors)
        : mode === 'update'
          ? options.getUpdateNoticeMarkup(releaseNotesPageIndex)
          : mode === 'patch-notes'
            ? options.getPatchNotesMarkup(releaseNotesPageIndex)
            : mode === 'reference'
              ? options.getReferenceMarkup(referenceTopic)
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
    if (focusBeforeOpen?.isConnected) {
      focusElementWithoutScroll(focusBeforeOpen);
    }
    focusBeforeOpen = null;
  }

  function completeOnboarding(): void {
    onboardingComplete = true;
    closeQolboxMenu();
    options.onCompleteOnboarding();
  }

  function openQolboxMenu(nextMode: Exclude<QolboxMenuMode, 'closed'> = 'settings'): void {
    if (mode === 'closed') {
      focusBeforeOpen = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    }
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
    } else if (nextMode === 'update' || nextMode === 'patch-notes') {
      releaseNotesPageIndex = 0;
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

  function getErrorPage(key: AdvancedSettingKey | ThemeColorKey): QolboxSettingsPage {
    if (key === THEME_QOLBOX_ACCENT || key === THEME_GAME_ACCENT) {
      return 'appearance';
    }
    if (key === ADVANCED_COMMAND_ALIASES || key === ADVANCED_BLACKLIST_ENFORCEMENT) {
      return 'commands';
    }

    return 'advanced';
  }

  function getDraftThemeValue(key: ThemeColorKey): unknown {
    const input = document.querySelector<HTMLInputElement>(`#${options.menuId} [data-qolbox-theme-input="${key}"]`);
    return input?.value ?? settingsDraft?.theme[key];
  }

  function validateSettingsDraft(): { advanced: AdvancedSettings; theme: ThemeSettings } | null {
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

    const theme = { ...settingsDraft.theme };
    for (const key of [THEME_QOLBOX_ACCENT, THEME_GAME_ACCENT] as const) {
      const value = getDraftThemeValue(key);
      const normalized = normalizeThemeColor(value);
      if (!normalized) {
        errors[key] = 'Use a six-digit hex color, such as #FF6200.';
      } else {
        theme[key] = normalized;
      }
    }
    if (theme.linked) theme.gameAccent = theme.qolboxAccent;

    settingsErrors = errors;
    const firstError = ([THEME_QOLBOX_ACCENT, THEME_GAME_ACCENT] as const)
      .find(key => errors[key]) || ADVANCED_SETTING_DEFINITIONS.find(definition => errors[definition.key])?.key;
    if (firstError) {
      settingsPage = getErrorPage(firstError);
      return null;
    }

    return { advanced: sanitized, theme };
  }

  function restoreQolboxDefaultsDraft(): void {
    if (!settingsDraft) return;
    settingsDraft.features = getDefaultFeatureSettings();
    settingsDraft.advanced = getDefaultAdvancedSettings();
    settingsDraft.theme = getDefaultThemeSettings();
    settingsErrors = {};
    renderQolboxMenu();
  }

  function saveSettingsDraft(): void {
    const validated = validateSettingsDraft();
    if (!settingsDraft || !validated) {
      renderQolboxMenu();
      return;
    }

    const featureDraft = { ...settingsDraft.features };
    options.onCommitSettingsDraft(featureDraft, validated.advanced, validated.theme);
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

    if (action?.startsWith('sound-bank-')) {
      void options.onCustomAction(action, actionElement).then(handled => {
        if (handled && mode === 'settings') renderQolboxMenu();
      });
      return;
    }

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
      case 'draft-theme-mode':
        if (settingsDraft && ['system', 'dark', 'light'].includes(actionElement.dataset.mode || '')) {
          settingsDraft.theme[THEME_MODE] = actionElement.dataset.mode as ThemeSettings[typeof THEME_MODE];
          renderQolboxMenu();
        }
        break;
      case 'settings-page':
        if (isSettingsPage(actionElement.dataset.page)) {
          settingsPage = actionElement.dataset.page;
          renderQolboxMenu();
        }
        break;
      case 'link-theme-from-qolbox':
      case 'link-theme-from-game':
        if (settingsDraft) {
          const source = action === 'link-theme-from-game' ? THEME_GAME_ACCENT : THEME_QOLBOX_ACCENT;
          const target = source === THEME_GAME_ACCENT ? THEME_QOLBOX_ACCENT : THEME_GAME_ACCENT;
          settingsDraft.theme[target] = settingsDraft.theme[source];
          settingsDraft.theme.linked = true;
          renderQolboxMenu();
        }
        break;
      case 'unlink-theme':
        if (settingsDraft) {
          settingsDraft.theme.linked = false;
          renderQolboxMenu();
        }
        break;
      case 'restore-qolbox-defaults':
        restoreQolboxDefaultsDraft();
        break;
      case 'view-patch-notes':
        options.onOpenPatchNotes();
        openQolboxMenu('patch-notes');
        break;
      case 'view-reference':
        openQolboxMenu('reference');
        break;
      case 'reference-topic':
        if (isQolboxReferenceTopic(actionElement.dataset.topic)) {
          referenceTopic = actionElement.dataset.topic;
          renderQolboxMenu();
        }
        break;
      case 'back-to-settings':
        mode = 'settings';
        options.onMenuModeChanged();
        renderQolboxMenu();
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
        releaseNotesPageIndex = Math.max(0, releaseNotesPageIndex - 1);
        renderQolboxMenu();
        break;
      case 'update-older':
        releaseNotesPageIndex = Math.min(
          Math.max(1, mode === 'update' ? options.getUpdateNoticePageCount() : options.getPatchNotesPageCount()) - 1,
          releaseNotesPageIndex + 1
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
      value === 'appearance' ||
      value === 'advanced' ||
      value === 'about'
    );
  }

  function isQolboxReferenceTopic(value: unknown): value is QolboxReferenceTopic {
    return value === 'commands' || value === 'controls' || value === 'sound-banks';
  }

  function handleQolboxMenuInput(event: Event): void {
    if (mode !== 'settings' || !settingsDraft || !(event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement)) {
      return;
    }

    const themeKey = event.target.dataset.qolboxThemeInput || event.target.dataset.qolboxThemePicker;
    if (themeKey === THEME_QOLBOX_ACCENT || themeKey === THEME_GAME_ACCENT) {
      const normalized = normalizeThemeColor(event.target.value);
      const value = normalized || event.target.value;
      settingsDraft.theme[themeKey] = value;
      if (settingsDraft.theme.linked) {
        const otherKey = themeKey === THEME_QOLBOX_ACCENT ? THEME_GAME_ACCENT : THEME_QOLBOX_ACCENT;
        settingsDraft.theme[otherKey] = value;
      }
      const affectedKeys: readonly ThemeColorKey[] = settingsDraft.theme.linked
        ? [THEME_QOLBOX_ACCENT, THEME_GAME_ACCENT] as const
        : [themeKey];
      for (const key of affectedKeys) {
        const text = document.querySelector<HTMLInputElement>(`#${options.menuId} [data-qolbox-theme-input="${key}"]`);
        const picker = document.querySelector<HTMLInputElement>(`#${options.menuId} [data-qolbox-theme-picker="${key}"]`);
        if (text) text.value = value;
        if (picker && picker !== event.target && normalized) picker.value = normalized;
        if (settingsErrors[key]) delete settingsErrors[key];
      }
      return;
    }

    if (event.target.matches('[data-qolbox-sound-bank], [data-qolbox-sound-effect], [data-qolbox-sound-file], [data-qolbox-sound-manifest]')) {
      if (event.type !== 'change') return;
      void options.onCustomInput(event.target).then(handled => {
        if (handled && mode === 'settings') renderQolboxMenu();
      });
      return;
    }

    const advancedKey = event.target.dataset.qolboxAdvancedInput;
    if (advancedKey) updateDraftAdvancedValue(advancedKey, event.target.value);
  }

  function handleQolboxMenuKey(event: KeyboardEvent): void {
    if (mode !== 'closed' && isEscapeKey(event)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (mode === 'onboarding') {
        completeOnboarding();
        return;
      }

      closeQolboxMenu();
      return;
    }

    if (mode !== 'closed' && isTabKey(event)) {
      const menu = document.getElementById(options.menuId);
      const controls = menu
        ? Array.from(menu.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
          ))
        : [];
      if (controls.length) {
        const activeElement = document.activeElement;
        const currentIndex = controls.indexOf(activeElement as HTMLElement);
        const nextIndex = event.shiftKey
          ? currentIndex <= 0 ? controls.length - 1 : currentIndex - 1
          : currentIndex < 0 || currentIndex >= controls.length - 1 ? 0 : currentIndex + 1;
        event.preventDefault();
        event.stopImmediatePropagation();
        focusElementWithoutScroll(controls[nextIndex]);
      }
      return;
    }

    if (mode === 'settings' && (isArrowLeftKey(event) || isArrowRightKey(event))) {
      const activeElement = document.activeElement;
      const tabs = Array.from(document.querySelectorAll<HTMLElement>(`#${options.menuId} [role="tab"]`));
      const currentIndex = activeElement instanceof HTMLElement ? tabs.indexOf(activeElement) : -1;
      if (currentIndex >= 0 && tabs.length) {
        const direction = isArrowLeftKey(event) ? -1 : 1;
        const nextTab = tabs[(currentIndex + direction + tabs.length) % tabs.length];
        event.preventDefault();
        event.stopImmediatePropagation();
        focusElementWithoutScroll(nextTab);
        nextTab?.click();
      }
      return;
    }

    if (mode === 'reference' && (event.key === 'ArrowUp' || event.key === 'ArrowDown')) {
      const activeElement = document.activeElement;
      const topics = Array.from(document.querySelectorAll<HTMLElement>(`#${options.menuId} .qolboxReferenceTopic`));
      const index = topics.indexOf(activeElement as HTMLElement);
      if (index >= 0 && topics.length) {
        const nextIndex = (index + (event.key === 'ArrowUp' ? topics.length - 1 : 1)) % topics.length;
        const nextTopic = topics[nextIndex]?.dataset.topic;
        if (isQolboxReferenceTopic(nextTopic)) {
          event.preventDefault();
          event.stopImmediatePropagation();
          referenceTopic = nextTopic;
          renderQolboxMenu();
          focusElementWithoutScroll(document.querySelector<HTMLElement>(`#${options.menuId} .qolboxReferenceTopic.active`));
        }
      }
      return;
    }

    if ((mode === 'update' || mode === 'patch-notes') && (isArrowLeftKey(event) || isArrowRightKey(event))) {
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
