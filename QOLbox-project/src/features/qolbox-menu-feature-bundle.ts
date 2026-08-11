import {
  FEATURE_DEFINITIONS,
  getDefaultFeatureSettings,
  type FeatureKey,
  type FeatureSettings,
} from '../settings/feature-settings';
import { loadOnboardingComplete, saveOnboardingComplete } from '../settings/onboarding-storage';
import type { AdvancedSettings } from '../settings/advanced-settings';
import {
  createInitialReleaseHistoryState,
  loadReleaseHistoryState,
  type QolboxReleaseHistoryState,
} from '../config/qolbox-release-notes';
import {
  QOLBOX_GITHUB_URL,
  QOLBOX_GREASYFORK_URL,
  QOLBOX_VERSION,
  QOLBOX_VERSION_LABEL,
} from '../config/qolbox-version';
import {
  acknowledgeUpdateNotice,
  loadPendingUpdateNotice,
  type PendingUpdateNotice,
} from '../settings/update-notice-storage';
import {
  FULLSCREEN_SETTLE_PASSES,
  MENU_KEY,
  MENU_KEY_LABEL,
  QOLBOX_MENU_ID,
} from '../config/qolbox-constants';
import type { ScheduledUiWorkRequest } from '../types/scheduled-work';
import { createQolboxMenuController } from './qolbox-menu-controller';
import { createQolboxMenuMarkup, type QolboxSettingsDraft } from './qolbox-menu-markup';
import type { ThemeSettings } from '../settings/theme-settings';

interface QolboxMenuFeatureBundleOptions {
  applyFeatureRootClasses(): void;
  applyPersistentFeatures(): void;
  ensureGlobalStyle(): void;
  getAdvancedSettings(): AdvancedSettings;
  getThemeSettings(): ThemeSettings;
  isFeatureEnabled(featureKey: FeatureKey): boolean;
  scheduleUiWork(request: ScheduledUiWorkRequest): void;
  soundBanks: {
    getMarkup(): string;
    handleAction(action: string, element: HTMLElement): Promise<boolean>;
    handleInput(element: HTMLInputElement | HTMLSelectElement): Promise<boolean>;
  };
  setAdvancedSettings(settings: AdvancedSettings): void;
  setAllFeatureSettings(settings: FeatureSettings): void;
  setThemeSettings(settings: ThemeSettings): void;
  setFeatureEnabled(featureKey: string | undefined, enabled: boolean): void;
}

export function createQolboxMenuFeatureBundle(options: QolboxMenuFeatureBundleOptions) {
  const initialOnboardingComplete = loadOnboardingComplete();
  let pendingUpdateNotice: PendingUpdateNotice | null = loadPendingUpdateNotice(undefined, initialOnboardingComplete);
  let updateReleaseHistory: QolboxReleaseHistoryState | null = pendingUpdateNotice
    ? createInitialReleaseHistoryState(pendingUpdateNotice.previousVersion, pendingUpdateNotice.currentVersion)
    : null;
  let updateReleaseHistoryRefreshStarted = false;
  let patchNotesReleaseHistory = createInitialReleaseHistoryState(null);
  let patchNotesReleaseHistoryRefreshStarted = false;

  const { getOnboardingStepMarkup, getOnboardingSteps, getReferenceMarkup, getSettingsMenuMarkup, getUpdateNoticeMarkup } = createQolboxMenuMarkup({
    featureDefinitions: FEATURE_DEFINITIONS,
    getSoundBankMarkup: options.soundBanks.getMarkup,
    greaseForkUrl: QOLBOX_GREASYFORK_URL,
    githubUrl: QOLBOX_GITHUB_URL,
    isFeatureEnabled: options.isFeatureEnabled,
    menuKeyLabel: MENU_KEY_LABEL,
    versionLabel: QOLBOX_VERSION_LABEL,
  });

  function createSettingsDraft(): QolboxSettingsDraft {
    const features = {} as FeatureSettings;
    for (const definition of FEATURE_DEFINITIONS) {
      features[definition.key] = options.isFeatureEnabled(definition.key);
    }

    return {
      advanced: { ...options.getAdvancedSettings() },
      features,
      theme: options.getThemeSettings(),
    };
  }

  const menuController = createQolboxMenuController({
    createSettingsDraft,
    getOnboardingStepMarkup,
    getOnboardingStepCount: () => getOnboardingSteps().length,
    getPatchNotesMarkup: pageIndex => getUpdateNoticeMarkup(null, patchNotesReleaseHistory, pageIndex),
    getPatchNotesPageCount: () => Math.max(1, patchNotesReleaseHistory.notes.length),
    getReferenceMarkup,
    getSettingsMenuMarkup,
    getUpdateNoticeMarkup: pageIndex =>
      pendingUpdateNotice
        ? getUpdateNoticeMarkup(
            pendingUpdateNotice,
            updateReleaseHistory || createInitialReleaseHistoryState(
              pendingUpdateNotice.previousVersion,
              pendingUpdateNotice.currentVersion
            ),
            pageIndex
          )
        : getSettingsMenuMarkup(createSettingsDraft(), 'features', {}),
    getUpdateNoticePageCount: () => Math.max(1, updateReleaseHistory?.notes.length || 1),
    initialOnboardingComplete,
    menuId: QOLBOX_MENU_ID,
    menuKey: MENU_KEY,
    onAcknowledgeUpdateNotice: () => {
      acknowledgeUpdateNotice();
      pendingUpdateNotice = null;
      updateReleaseHistory = null;
    },
    onBeforeOpen: options.ensureGlobalStyle,
    onChooseExpressSetup: () => {
      options.setAllFeatureSettings(getDefaultFeatureSettings());
    },
    onCompleteOnboarding: () => {
      saveOnboardingComplete();
      options.applyFeatureRootClasses();
      options.applyPersistentFeatures();
      options.scheduleUiWork({ features: true, passes: FULLSCREEN_SETTLE_PASSES });
    },
    onCommitSettingsDraft: (features, advanced, theme) => {
      options.setAllFeatureSettings(features);
      options.setAdvancedSettings(advanced);
      options.setThemeSettings(theme);
    },
    onCustomAction: options.soundBanks.handleAction,
    onCustomInput: options.soundBanks.handleInput,
    onMenuModeChanged: options.applyFeatureRootClasses,
    onOpenPatchNotes: refreshPatchNotesReleaseHistory,
    onSetFeatureEnabled: options.setFeatureEnabled,
  });

  function scheduleFirstBootOnboarding(): void {
    if (!menuController.isOnboardingComplete()) {
      window.setTimeout(menuController.showFirstBootOnboarding, 0);
    }
  }

  function scheduleStartupQolboxNotice(): void {
    if (!menuController.isOnboardingComplete()) {
      scheduleFirstBootOnboarding();
      return;
    }

    if (!pendingUpdateNotice) {
      return;
    }

    refreshUpdateReleaseHistory();

    window.setTimeout(menuController.showUpdateNotice, 0);
  }

  function refreshUpdateReleaseHistory(): void {
    if (!pendingUpdateNotice || updateReleaseHistoryRefreshStarted) {
      return;
    }

    updateReleaseHistoryRefreshStarted = true;
    loadReleaseHistoryState(pendingUpdateNotice.previousVersion, pendingUpdateNotice.currentVersion, nextHistory => {
      updateReleaseHistory = nextHistory;
      if (menuController.getMode() === 'update') {
        menuController.renderQolboxMenu();
      }
    })
      .then(nextHistory => {
        updateReleaseHistory = nextHistory;
        if (menuController.getMode() === 'update') {
          menuController.renderQolboxMenu();
        }
      })
      .catch(() => {
        // loadReleaseHistoryState already converts failures into a fallback state.
      });
  }

  function refreshPatchNotesReleaseHistory(): void {
    if (patchNotesReleaseHistoryRefreshStarted) return;
    patchNotesReleaseHistoryRefreshStarted = true;
    loadReleaseHistoryState(null, QOLBOX_VERSION, nextHistory => {
      patchNotesReleaseHistory = nextHistory;
      if (menuController.getMode() === 'patch-notes') menuController.renderQolboxMenu();
    })
      .then(nextHistory => {
        patchNotesReleaseHistory = nextHistory;
        if (menuController.getMode() === 'patch-notes') menuController.renderQolboxMenu();
      })
      .catch(() => {
        // loadReleaseHistoryState already converts failures into a fallback state.
      });
  }

  return {
    ...menuController,
    getOnboardingSteps,
    scheduleFirstBootOnboarding: scheduleStartupQolboxNotice,
  };
}
