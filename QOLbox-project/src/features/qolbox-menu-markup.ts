import { escapeMenuText } from '../dom/dom-helpers';
import {
  ADVANCED_ALERT_DELAY_MS,
  ADVANCED_ALERT_FLASH_INTERVAL_MS,
  ADVANCED_BLACKLIST_ENFORCEMENT,
  ADVANCED_COMMAND_ALIASES,
  ADVANCED_RESERVE_RETRY_INTERVAL_MS,
  ADVANCED_SETTING_DEFINITIONS,
  ADVANCED_TYPING_DURATION_MS,
  type AdvancedSettingDefinition,
  type AdvancedSettingKey,
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
  type FeatureDefinition,
  type FeatureKey,
  type FeatureSettings,
} from '../settings/feature-settings';
import type { PendingUpdateNotice } from '../settings/update-notice-storage';
import type { QolboxReleaseHistoryState, QolboxReleaseNote } from '../config/qolbox-release-notes';

export type QolboxSettingsPage = 'features' | 'commands' | 'audio' | 'advanced' | 'about';
export type QolboxAdvancedDraft = Record<AdvancedSettingKey, unknown>;
export type QolboxSettingsValidationErrors = Partial<Record<AdvancedSettingKey, string>>;

export interface QolboxSettingsDraft {
  advanced: QolboxAdvancedDraft;
  features: FeatureSettings;
}

interface QolboxMenuMarkupOptions {
  featureDefinitions: readonly FeatureDefinition[];
  greaseForkUrl: string;
  githubUrl: string;
  isFeatureEnabled(featureKey: FeatureKey): boolean;
  menuKeyLabel: string;
  versionLabel: string;
}

export interface OnboardingStep {
  featureKey?: FeatureKey;
  text: string;
  title: string;
  type: 'intro' | 'feature' | 'finish';
}

const SETTINGS_PAGES: readonly { key: QolboxSettingsPage; title: string }[] = [
  { key: 'features', title: 'Features' },
  { key: 'commands', title: 'Commands' },
  { key: 'audio', title: 'Audio' },
  { key: 'advanced', title: 'Advanced' },
  { key: 'about', title: 'About' },
];

const SETTINGS_PAGE_TITLES: Record<QolboxSettingsPage, string> = {
  features: 'Feature Settings',
  commands: 'Command Settings',
  audio: 'Audio Settings',
  advanced: 'Advanced Settings',
  about: 'About QOLBox',
};

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

const GREASYFORK_ICON_DATA_URI =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABmJLR0QA/wD/AP+gvaeTAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH3ggEBCQHM3fXsAAAAVdJREFUOMudkz2qwkAUhc/goBaGJBgUtBCZyj0ILkpwAW7Bws4yO3AHLiCtEFD8KVREkoiFxZzX5A2KGfN4F04zMN+ce+5c4LMUgDmANYBnrnV+plBSi+FwyHq9TgA2LQpvCiEiABwMBtzv95RSfoNEHy8DYBzHrNVqVEr9BWKcqNFoxF6vx3a7zc1mYyC73a4MogBg7vs+z+czO50OW60Wt9stK5UKp9Mpj8cjq9WqDTBHnjAdxzGQZrPJw+HA31oulzbAWgLoA0CWZVBKIY5jzGYzdLtdE9DlcrFNrY98zobqOA6TJKHW2jg4nU5sNBpFDp6mhVe5rsvVasUwDHm9Xqm15u12o+/7Hy0gD8KatOd5vN/v1FozTVN6nkchxFuI6hsAAIMg4OPxMJCXdtTbR7JJCMEgCJhlGUlyPB4XfumozInrupxMJpRSRtZlKoNYl+m/6/wDuWAjtPfsQuwAAAAASUVORK5CYII=';

function getCheckedText(enabled: boolean): string {
  return enabled ? 'Enabled' : 'Off';
}

function getAdvancedSettingDefinition(key: AdvancedSettingKey): AdvancedSettingDefinition {
  return ADVANCED_SETTING_DEFINITIONS.find(definition => definition.key === key) as AdvancedSettingDefinition;
}

function getAdvancedSettingValueText(definition: AdvancedSettingDefinition, value: unknown): string {
  if (definition.kind === 'boolean') {
    return value === true || value === 'true' ? 'Enabled' : 'Off';
  }

  return `${value}${definition.unit ? ` ${definition.unit}` : ''}`;
}

function getFeatureDefinition(
  featureDefinitions: readonly FeatureDefinition[],
  featureKey: FeatureKey
): FeatureDefinition {
  return featureDefinitions.find(feature => feature.key === featureKey) as FeatureDefinition;
}

export function createQolboxMenuMarkup(options: QolboxMenuMarkupOptions) {
  function getOnboardingSteps(): OnboardingStep[] {
    const featureSteps: OnboardingStep[] = options.featureDefinitions.map(feature => ({
      type: 'feature',
      featureKey: feature.key,
      title: feature.title,
      text: feature.onboardingText || feature.summary,
    }));

    return [
      {
        type: 'intro',
        title: 'Welcome to QOLBox',
        text:
          `${options.versionLabel} adds fullscreen layout, full-lobby reserves, audio controls, away-tab alerts, mobile Grab, readable chat, lobby commands, map import/export, and setup controls. Choose Express for the recommended setup or Custom to decide feature by feature.`,
      },
      ...featureSteps,
      {
        type: 'finish',
        title: 'QOLBox is ready',
        text:
          `On desktop, press ${options.menuKeyLabel} to open QOLBox later. On mobile, open the site's hamburger dropdown and choose QOLBox. The menu lets you change features, advanced defaults, and setup choices at any time.`,
      },
    ];
  }

  function getToggleMarkup({
    action,
    active,
    ariaLabel,
    dataName,
    dataValue,
  }: {
    action: string;
    active: boolean;
    ariaLabel: string;
    dataName: string;
    dataValue: string;
  }): string {
    return `
      <div class="qolboxMenuToggleGroup" role="group" aria-label="${escapeMenuText(ariaLabel)}">
        <button class="qolboxMenuToggle${active ? ' active' : ''}" data-qolbox-action="${action}" ${dataName}="${escapeMenuText(dataValue)}" data-enabled="true" data-value="true" aria-pressed="${active ? 'true' : 'false'}">Enabled</button>
        <button class="qolboxMenuToggle${active ? '' : ' active'}" data-qolbox-action="${action}" ${dataName}="${escapeMenuText(dataValue)}" data-enabled="false" data-value="false" aria-pressed="${active ? 'false' : 'true'}">Off</button>
      </div>
    `;
  }

  function getOnboardingToggleMarkup(featureKey: FeatureKey): string {
    return getToggleMarkup({
      action: 'set-feature',
      active: options.isFeatureEnabled(featureKey),
      ariaLabel: `${featureKey} setting`,
      dataName: 'data-feature',
      dataValue: featureKey,
    });
  }

  function getDraftFeatureToggleMarkup(featureKey: FeatureKey, draft: QolboxSettingsDraft): string {
    return getToggleMarkup({
      action: 'draft-feature',
      active: draft.features[featureKey] !== false,
      ariaLabel: `${featureKey} setting`,
      dataName: 'data-feature',
      dataValue: featureKey,
    });
  }

  function getOnboardingSummaryMarkup(): string {
    const enabledFeatures = options.featureDefinitions
      .filter(feature => options.isFeatureEnabled(feature.key))
      .map(feature => feature.shortTitle)
      .join(', ');

    return `
      <div class="qolboxMenuInfoBox">
        <div class="qolboxMenuFeatureName">Selected setup</div>
        <div class="qolboxMenuFeatureSummary">${escapeMenuText(enabledFeatures || 'No optional features enabled')}</div>
      </div>
    `;
  }

  function getOnboardingStepMarkup(onboardingStepIndex: number): string {
    const steps = getOnboardingSteps();
    const step = steps[Math.max(0, Math.min(onboardingStepIndex, steps.length - 1))];
    const isFeatureStep = step.type === 'feature';
    const isFirstStep = onboardingStepIndex === 0;
    const isFinalStep = onboardingStepIndex === steps.length - 1;
    const progress = steps
      .map((_, index) => `<span class="qolboxMenuDot${index === onboardingStepIndex ? ' active' : ''}"></span>`)
      .join('');

    if (isFirstStep) {
      return `
        <div class="qolboxMenuBody">
          <div class="qolboxMenuHeaderLine">
            <h1 class="qolboxMenuTitle">${escapeMenuText(step.title)}</h1>
          </div>
          <p class="qolboxMenuText">${escapeMenuText(step.text)}</p>
          <div class="qolboxMenuChoiceGrid">
            <button class="qolboxMenuChoice primary" data-qolbox-action="choose-express">
              <span>Express</span>
              <small>Recommended defaults. You can change everything later.</small>
            </button>
            <button class="qolboxMenuChoice" data-qolbox-action="choose-custom">
              <span>Custom</span>
              <small>Review each feature during setup.</small>
            </button>
          </div>
          <div class="qolboxMenuActions">
            <button class="qolboxMenuButton" data-qolbox-action="skip-onboarding">Skip</button>
          </div>
        </div>
      `;
    }

    return `
      <div class="qolboxMenuBody">
        <div class="qolboxMenuHeaderLine">
          <h1 class="qolboxMenuTitle">${escapeMenuText(step.title)}</h1>
        </div>
        <p class="qolboxMenuText">${escapeMenuText(step.text)}</p>
        ${isFeatureStep && step.featureKey ? getOnboardingToggleMarkup(step.featureKey) : getOnboardingSummaryMarkup()}
        <div class="qolboxMenuProgress" aria-hidden="true">${progress}</div>
        <div class="qolboxMenuActions">
          <button class="qolboxMenuButton" data-qolbox-action="back">Back</button>
          <button class="qolboxMenuButton primary" data-qolbox-action="${isFinalStep ? 'finish-onboarding' : 'next'}">${isFinalStep ? 'Finish' : 'Next'}</button>
        </div>
      </div>
    `;
  }

  function getSettingsTabsMarkup(activePage: QolboxSettingsPage): string {
    return `
      <div class="qolboxMenuTabs" role="tablist" aria-label="QOLBox settings sections">
        ${SETTINGS_PAGES.map(page => `
          <button class="qolboxMenuTab${page.key === activePage ? ' active' : ''}" role="tab" aria-selected="${page.key === activePage ? 'true' : 'false'}" data-qolbox-action="settings-page" data-page="${page.key}">${escapeMenuText(page.title)}</button>
        `).join('')}
      </div>
    `;
  }

  function getFeatureRowMarkup(featureKey: FeatureKey, draft: QolboxSettingsDraft): string {
    const feature = getFeatureDefinition(options.featureDefinitions, featureKey);
    return `
      <div class="qolboxMenuFeatureRow">
        <div>
          <div class="qolboxMenuFeatureName">${escapeMenuText(feature.title)}</div>
          <div class="qolboxMenuFeatureSummary">${escapeMenuText(feature.summary)} Current draft: ${escapeMenuText(getCheckedText(draft.features[feature.key] !== false))}</div>
        </div>
        ${getDraftFeatureToggleMarkup(feature.key, draft)}
      </div>
    `;
  }

  function getAdvancedInputMarkup(
    definition: AdvancedSettingDefinition,
    draft: QolboxSettingsDraft,
    errors: QolboxSettingsValidationErrors
  ): string {
    const value = draft.advanced[definition.key];
    const error = errors[definition.key];
    const invalidClass = error ? ' invalid' : '';

    if (definition.kind === 'boolean') {
      const enabled = value === true || value === 'true';
      return getToggleMarkup({
        action: 'draft-advanced',
        active: enabled,
        ariaLabel: `${definition.title} setting`,
        dataName: 'data-advanced',
        dataValue: definition.key,
      });
    }

    return `
      <input class="qolboxMenuInput${invalidClass}" type="number" value="${escapeMenuText(String(value))}" min="${definition.min}" max="${definition.max}" step="${definition.step}" data-qolbox-advanced-input="${escapeMenuText(definition.key)}">
      ${error ? `<div class="qolboxMenuFieldError">${escapeMenuText(error)}</div>` : ''}
    `;
  }

  function getAdvancedRowMarkup(
    key: AdvancedSettingKey,
    draft: QolboxSettingsDraft,
    errors: QolboxSettingsValidationErrors
  ): string {
    const definition = getAdvancedSettingDefinition(key);
    const value = draft.advanced[definition.key];
    const rowKindClass = definition.kind === 'boolean' ? ' boolean' : ' numeric';
    return `
      <div class="qolboxMenuFeatureRow compact${rowKindClass}">
        <div>
          <div class="qolboxMenuFeatureName">${escapeMenuText(definition.title)}</div>
          <div class="qolboxMenuFeatureSummary">${escapeMenuText(definition.description)} Current draft: ${escapeMenuText(getAdvancedSettingValueText(definition, value))}</div>
        </div>
        <div class="qolboxMenuFieldControl">
          ${getAdvancedInputMarkup(definition, draft, errors)}
        </div>
      </div>
    `;
  }

  function getFeaturePageMarkup(draft: QolboxSettingsDraft): string {
    return `
      <div class="qolboxMenuSettingsList">
        ${FEATURE_PAGE_KEYS.map(featureKey => getFeatureRowMarkup(featureKey, draft)).join('')}
      </div>
      <div class="qolboxMenuActions slim">
        <button class="qolboxMenuButton" data-qolbox-action="reset-page">Reset Features</button>
      </div>
    `;
  }

  function getCommandsPageMarkup(
    draft: QolboxSettingsDraft,
    errors: QolboxSettingsValidationErrors
  ): string {
    return `
      <div class="qolboxMenuSettingsList">
        ${getFeatureRowMarkup(FEATURE_LOBBY_COMMANDS, draft)}
        ${getAdvancedRowMarkup(ADVANCED_COMMAND_ALIASES, draft, errors)}
        ${getAdvancedRowMarkup(ADVANCED_BLACKLIST_ENFORCEMENT, draft, errors)}
      </div>
      <div class="qolboxMenuInfoBox">Group targets: all, playing, spectators. Quote those words to target a player with that exact name. Native /kick and /ban accept exact or unique partial player names. Use /blacklist to manage exact-name automatic host bans.</div>
      <div class="qolboxMenuActions slim">
        <button class="qolboxMenuButton" data-qolbox-action="reset-page">Reset Commands</button>
      </div>
    `;
  }

  function getAudioPageMarkup(draft: QolboxSettingsDraft): string {
    return `
      <div class="qolboxMenuSettingsList">
        ${getFeatureRowMarkup(FEATURE_AUDIO, draft)}
      </div>
      <div class="qolboxMenuInfoBox">Game and jukebox volume levels are still adjusted from Hitbox's native hamburger menu.</div>
      <div class="qolboxMenuActions slim">
        <button class="qolboxMenuButton" data-qolbox-action="reset-page">Reset Audio</button>
      </div>
    `;
  }

  function getAdvancedPageMarkup(
    draft: QolboxSettingsDraft,
    errors: QolboxSettingsValidationErrors
  ): string {
    return `
      <p class="qolboxMenuText">Timing and behavior defaults. These are staged here and saved together with OK.</p>
      <div class="qolboxMenuSettingsList">
        ${ADVANCED_TIMING_KEYS.map(key => getAdvancedRowMarkup(key, draft, errors)).join('')}
      </div>
      <div class="qolboxMenuActions slim">
        <button class="qolboxMenuButton" data-qolbox-action="reset-page">Reset Advanced</button>
      </div>
    `;
  }

  function getCreditsMarkup(): string {
    return `
      <div class="qolboxMenuAboutLinks">
        <a class="qolboxMenuCredit" href="${escapeMenuText(options.greaseForkUrl)}" target="_blank" rel="noreferrer">
          <img class="qolboxMenuCreditIcon" src="${GREASYFORK_ICON_DATA_URI}" alt="" aria-hidden="true">
          <span>GreasyFork</span>
        </a>
        <a class="qolboxMenuCredit" href="${escapeMenuText(options.githubUrl)}" target="_blank" rel="noreferrer">
          <svg class="qolboxMenuCreditSvg" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38v-1.49c-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82A7.65 7.65 0 0 1 8 3.86c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48v2.2c0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"/></svg>
          <span>GitHub</span>
        </a>
      </div>
    `;
  }

  function getAboutPageMarkup(): string {
    return `
      <div class="qolboxMenuInfoBox">
        <div class="qolboxMenuFeatureName">QOLBox ${escapeMenuText(options.versionLabel)}</div>
        <div class="qolboxMenuFeatureSummary">Fullscreen layout, reserve spots, audio controls, away-tab alerts, mobile Grab, readable chat, lobby commands, map import/export, and setup options for hitbox.io.</div>
      </div>
      ${getCreditsMarkup()}
    `;
  }

  function getSettingsPageMarkup(
    draft: QolboxSettingsDraft,
    page: QolboxSettingsPage,
    errors: QolboxSettingsValidationErrors
  ): string {
    switch (page) {
      case 'commands':
        return getCommandsPageMarkup(draft, errors);
      case 'audio':
        return getAudioPageMarkup(draft);
      case 'advanced':
        return getAdvancedPageMarkup(draft, errors);
      case 'about':
        return getAboutPageMarkup();
      case 'features':
      default:
        return getFeaturePageMarkup(draft);
    }
  }

  function getSettingsMenuMarkup(
    draft: QolboxSettingsDraft,
    page: QolboxSettingsPage,
    errors: QolboxSettingsValidationErrors
  ): string {
    const pageTitle = SETTINGS_PAGES.find(candidate => candidate.key === page)?.title || 'Features';
    const settingsTitle = SETTINGS_PAGE_TITLES[page];

    return `
      <div class="qolboxMenuBody">
        <div class="qolboxMenuHeaderLine">
          <h1 class="qolboxMenuTitle">${escapeMenuText(settingsTitle)}</h1>
        </div>
        ${getSettingsTabsMarkup(page)}
        <div class="qolboxMenuPage" aria-label="${escapeMenuText(pageTitle)} settings">
          ${getSettingsPageMarkup(draft, page, errors)}
        </div>
        <div class="qolboxMenuActions">
          <button class="qolboxMenuButton" data-qolbox-action="redo-onboarding">Redo Setup</button>
          <button class="qolboxMenuButton" data-qolbox-action="cancel-settings">Cancel</button>
          <button class="qolboxMenuButton primary" data-qolbox-action="save-settings">OK</button>
        </div>
      </div>
    `;
  }

  function getReleaseSourceText(release: QolboxReleaseNote): string {
    switch (release.source) {
      case 'github':
        return 'GitHub release';
      case 'greasyfork':
        return 'GreasyFork version history';
      case 'local-fallback':
      default:
        return 'Bundled fallback';
    }
  }

  function getReleaseDateText(release: QolboxReleaseNote): string {
    if (!release.publishedAt) {
      return '';
    }

    const timestamp = Date.parse(release.publishedAt);
    return Number.isFinite(timestamp) ? ` - ${new Date(timestamp).toLocaleDateString()}` : '';
  }

  function getUpdateNoticeMarkup(
    notice: PendingUpdateNotice,
    releaseHistory: QolboxReleaseHistoryState,
    pageIndex: number
  ): string {
    if (releaseHistory.status === 'loading') {
      return `
        <div class="qolboxMenuBody">
          <div class="qolboxMenuHeaderLine">
            <h1 class="qolboxMenuTitle">QOLBox Updated</h1>
          </div>
          <p class="qolboxMenuText">Updated from ${escapeMenuText(notice.previousVersion)} to ${escapeMenuText(notice.currentVersion)}.</p>
          <div class="qolboxMenuLoading" role="status" aria-live="polite">
            <span class="qolboxMenuSpinner" aria-hidden="true"></span>
            <span>Loading release notes from GitHub and GreasyFork...</span>
          </div>
        </div>
      `;
    }

    const releaseNotes = releaseHistory.notes;
    const safePageIndex = Math.max(0, Math.min(pageIndex, Math.max(0, releaseNotes.length - 1)));
    const release = releaseNotes[safePageIndex] || null;
    const notes = release
      ? `
          <div class="qolboxMenuInfoBox">
            <div class="qolboxMenuFeatureName">${escapeMenuText(release.version)}</div>
            <div class="qolboxMenuFeatureSummary">${escapeMenuText(getReleaseSourceText(release))}${escapeMenuText(getReleaseDateText(release))}</div>
            <ul class="qolboxMenuNoteList">
              ${release.notes.map(note => `<li>${escapeMenuText(note)}</li>`).join('')}
            </ul>
          </div>
        `
      : '<p class="qolboxMenuText">No version-history entries are available for this upgrade range.</p>';
    const pageCount = Math.max(1, releaseNotes.length);

    return `
      <div class="qolboxMenuBody">
        <div class="qolboxMenuHeaderLine">
          <h1 class="qolboxMenuTitle">QOLBox Updated</h1>
        </div>
        <p class="qolboxMenuText">Updated from ${escapeMenuText(notice.previousVersion)} to ${escapeMenuText(notice.currentVersion)}.</p>
        <p class="qolboxMenuText">${escapeMenuText(releaseHistory.message)} Source: ${escapeMenuText(releaseHistory.sourceLabel)}.</p>
        ${notes}
        <div class="qolboxMenuHeaderLine">
          <button class="qolboxMenuButton" data-qolbox-action="update-older" ${safePageIndex >= releaseNotes.length - 1 ? 'disabled' : ''}>Older</button>
          <span class="qolboxMenuFeatureSummary">Version ${releaseNotes.length ? safePageIndex + 1 : 0} of ${pageCount}</span>
          <button class="qolboxMenuButton" data-qolbox-action="update-newer" ${safePageIndex <= 0 ? 'disabled' : ''}>Newer</button>
        </div>
        <div class="qolboxMenuActions">
          <button class="qolboxMenuButton primary" data-qolbox-action="acknowledge-update">OK</button>
        </div>
      </div>
    `;
  }

  return {
    getOnboardingStepMarkup,
    getOnboardingSteps,
    getSettingsMenuMarkup,
    getUpdateNoticeMarkup,
  };
}
