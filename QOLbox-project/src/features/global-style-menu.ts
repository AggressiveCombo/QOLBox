export function getQolboxMenuGlobalStyleText(): string {
  return `
      .qolboxMenuOverlay,
      .qolboxMenuPanel {
        --qolbox-menu-border: rgb(82, 89, 101);
        --qolbox-menu-control: rgb(47, 51, 58);
        --qolbox-menu-input: rgb(31, 34, 39);
        --qolbox-menu-muted: #c4c9d1;
        --qolbox-menu-panel: rgba(22, 24, 28, 0.98);
        --qolbox-menu-separator: rgba(255, 255, 255, 0.12);
        --qolbox-menu-strong: #ffffff;
        --qolbox-menu-text: #f4f4f4;
      }

      .qolboxMenuOverlay {
        align-items: center;
        background: rgba(0, 0, 0, 0.72);
        box-sizing: border-box;
        display: flex;
        font-family: inherit;
        inset: 0;
        justify-content: center;
        opacity: 0;
        padding: 10px;
        pointer-events: none;
        position: fixed;
        z-index: 2147483647;
      }

      html[data-qolbox-color-scheme="light"] .qolboxMenuOverlay,
      html[data-qolbox-color-scheme="light"] .qolboxMenuPanel {
        --qolbox-menu-border: #aeb6c2;
        --qolbox-menu-control: #e7eaf0;
        --qolbox-menu-input: #ffffff;
        --qolbox-menu-muted: #505862;
        --qolbox-menu-panel: rgba(244, 246, 248, 0.99);
        --qolbox-menu-separator: rgba(24, 28, 34, 0.16);
        --qolbox-menu-strong: #111419;
        --qolbox-menu-text: #171a1f;
      }

      html[data-qolbox-color-scheme="light"] .qolboxMenuOverlay {
        background: rgba(220, 225, 232, 0.76);
      }

      html.qolbox-menu-open .qolboxMenuOverlay {
        opacity: 1;
        pointer-events: auto;
      }

      .qolboxMenuPanel {
        background: var(--qolbox-menu-panel);
        border: 2px solid var(--qolbox-menu-border);
        border-radius: 4px;
        box-shadow: 0 8px 28px rgba(0, 0, 0, 0.55);
        box-sizing: border-box;
        color: var(--qolbox-menu-text);
        display: flex;
        flex-direction: column;
        max-height: calc(100vh - 20px);
        max-width: calc(100vw - 20px);
        min-width: min(320px, calc(100vw - 20px));
        overflow: hidden;
        resize: both;
        width: 470px;
      }

      .qolboxMenuBody.settings {
        overflow: hidden;
      }

      .qolboxMenuBody.settings .qolboxMenuPage {
        flex: 1 1 auto;
        overflow: auto;
      }

      .qolboxMenuBody.settings .qolboxMenuActions {
        margin-top: 0;
        padding-top: 4px;
      }

      .qolboxMenuBody {
        box-sizing: border-box;
        display: flex;
        flex: 1 1 auto;
        flex-direction: column;
        gap: 9px;
        min-height: 0;
        overflow: auto;
        padding: 14px;
      }

      .qolboxMenuPersistentHeader {
        flex: 0 0 auto;
        padding: 14px 14px 0;
      }

      .qolboxMenuTitle {
        color: var(--qolbox-menu-strong);
        font-size: 20px;
        font-weight: 700;
        letter-spacing: 0;
        line-height: 24px;
        margin: 0;
      }

      .qolboxMenuSectionTitle {
        color: var(--qolbox-menu-strong);
        font-size: 13px;
        font-weight: 700;
        line-height: 17px;
      }

      .qolboxMenuHeaderLine {
        align-items: center;
        display: flex;
        gap: 8px;
        justify-content: space-between;
      }

      .qolboxMenuText {
        color: var(--qolbox-menu-text);
        font-size: 13px;
        line-height: 16px;
        margin: 0;
      }

      .qolboxMenuUpdateRange {
        align-items: center;
        display: flex;
        flex-wrap: wrap;
        gap: 6px;
      }

      .qolboxMenuUpdateLabel {
        color: var(--qolbox-menu-muted);
        font-size: 11px;
        font-weight: 700;
        line-height: 14px;
        text-transform: uppercase;
      }

      .qolboxMenuVersionPill {
        background: var(--qolbox-menu-input);
        border: 1px solid var(--qolbox-menu-border);
        border-radius: 3px;
        color: var(--qolbox-menu-text);
        font-size: 13px;
        font-weight: 700;
        line-height: 16px;
        padding: 4px 7px;
      }

      .qolboxMenuVersionPill.current {
        border-color: rgb(var(--qolbox-accent-rgb, 255 98 0) / 0.8);
        color: var(--qolbox-accent, #ff6200);
      }

      .qolboxMenuVersionArrow {
        color: var(--qolbox-menu-muted);
        font-size: 13px;
        font-weight: 700;
        line-height: 15px;
      }

      .qolboxMenuProgress {
        align-items: center;
        display: flex;
        gap: 4px;
        margin-top: 2px;
      }

      .qolboxMenuDot {
        background: var(--qolbox-menu-separator);
        border-radius: 999px;
        height: 5px;
        width: 12px;
      }

      .qolboxMenuDot.active {
        background: var(--qolbox-accent, #ff6200);
      }

      .qolboxMenuToggleGroup {
        background: var(--qolbox-menu-input);
        border: 1px solid var(--qolbox-menu-border);
        border-radius: 3px;
        display: grid;
        grid-template-columns: 1fr 1fr;
        overflow: hidden;
      }

      .qolboxThemeMode {
        grid-template-columns: repeat(3, 1fr);
      }

      .qolboxThemeModeRow {
        grid-template-columns: minmax(0, 1fr) 220px;
      }

      .qolboxThemeMode .qolboxMenuToggle {
        font-size: 11px;
        padding: 0 5px;
      }

      .qolboxMenuButton,
      .qolboxMenuTab,
      .qolboxMenuToggle {
        align-items: center;
        appearance: none;
        border: 0;
        box-sizing: border-box;
        cursor: pointer;
        display: inline-flex;
        font-family: inherit;
        font-size: 13px;
        font-weight: 700;
        justify-content: center;
        letter-spacing: 0;
        line-height: 16px;
        min-height: 34px;
      }

      .qolboxMenuToggle {
        background: transparent;
        color: var(--qolbox-menu-text);
        padding: 0 8px;
      }

      .qolboxMenuToggle + .qolboxMenuToggle {
        border-left: 1px solid var(--qolbox-menu-separator);
      }

      .qolboxMenuToggle.active {
        background: var(--qolbox-accent, #ff6200);
        color: var(--qolbox-accent-contrast, #000000);
      }

      .qolboxMenuActions {
        display: flex;
        flex: 0 0 auto;
        flex-wrap: wrap;
        gap: 6px;
        justify-content: flex-end;
        margin-top: 4px;
      }

      .qolboxMenuActions.slim {
        margin-top: 0;
      }

      .qolboxMenuActions > [data-qolbox-action="restore-qolbox-defaults"] {
        margin-right: auto;
      }

      .qolboxMenuButton {
        background: var(--qolbox-menu-control);
        border: 1px solid var(--qolbox-menu-border);
        border-radius: 3px;
        color: var(--qolbox-menu-text);
        min-width: 76px;
        padding: 0 14px;
      }

      .qolboxMenuButton.primary {
        background: var(--qolbox-accent, #ff6200);
        color: var(--qolbox-accent-contrast, #000000);
      }

      .qolboxMenuButton:disabled {
        opacity: 0.45;
      }

      .qolboxMenuSettingsList {
        display: grid;
        gap: 6px;
      }

      .qolboxMenuTabs {
        border-bottom: 1px solid var(--qolbox-menu-separator);
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        justify-content: center;
        padding-bottom: 8px;
      }

      .qolboxMenuTab {
        background: var(--qolbox-menu-input);
        border: 1px solid var(--qolbox-menu-border);
        border-radius: 3px;
        color: var(--qolbox-menu-text);
        flex: 0 1 calc((100% - 8px) / 3);
        font-size: 12px;
        line-height: 14px;
        min-width: 0;
        padding: 0 6px;
      }

      .qolboxMenuTab.active {
        background: var(--qolbox-accent, #ff6200);
        border-color: var(--qolbox-accent, #ff6200);
        color: var(--qolbox-accent-contrast, #000000);
      }

      .qolboxMenuPage {
        align-content: start;
        display: grid;
        flex: 0 0 auto;
        gap: 8px;
      }

      .qolboxMenuChoiceGrid {
        display: grid;
        gap: 6px;
        grid-template-columns: 1fr 1fr;
      }

      .qolboxMenuChoice {
        appearance: none;
        background: var(--qolbox-menu-control);
        border: 1px solid var(--qolbox-menu-border);
        border-radius: 3px;
        color: var(--qolbox-menu-text);
        cursor: pointer;
        display: grid;
        font-family: inherit;
        gap: 3px;
        min-height: 62px;
        padding: 9px;
        text-align: left;
      }

      .qolboxMenuChoice.primary {
        border-color: var(--qolbox-accent, #ff6200);
      }

      .qolboxMenuChoice span {
        color: var(--qolbox-menu-strong);
        font-size: 14px;
        font-weight: 700;
        line-height: 16px;
      }

      .qolboxMenuChoice small {
        color: var(--qolbox-menu-muted);
        font-size: 11px;
        line-height: 14px;
      }

      .qolboxMenuFeatureRow {
        align-items: center;
        border-bottom: 1px solid var(--qolbox-menu-separator);
        display: grid;
        gap: 10px;
        grid-template-columns: minmax(0, 1fr) 116px;
        padding: 0 0 7px;
      }

      .qolboxMenuFeatureRow.compact {
        grid-template-columns: minmax(0, 1fr) 150px;
      }

      .qolboxMenuFeatureRow.compact.boolean {
        grid-template-columns: minmax(0, 1fr) 116px;
      }

      .qolboxMenuFeatureName {
        color: var(--qolbox-menu-strong);
        font-size: 13px;
        font-weight: 700;
        line-height: 16px;
      }

      .qolboxMenuFeatureSummary {
        color: var(--qolbox-menu-muted);
        font-size: 11px;
        line-height: 14px;
        margin-top: 1px;
      }

      .qolboxMenuFieldControl {
        display: grid;
        gap: 3px;
      }

      .qolboxSoundBanks {
        display: grid;
        gap: 8px;
      }

      .qolboxSoundBankControls,
      .qolboxSoundBankReplace {
        align-items: end;
        display: grid;
        gap: 8px;
        grid-template-columns: minmax(0, 1fr) auto;
      }

      .qolboxSoundBankReplace {
        border-top: 1px solid var(--qolbox-menu-separator);
        grid-template-columns: minmax(0, 1fr) auto;
        padding-top: 8px;
      }

      .qolboxSoundBankField {
        color: var(--qolbox-menu-muted);
        display: grid;
        font-size: 11px;
        gap: 4px;
        min-width: 0;
      }

      .qolboxSoundBankActions,
      .qolboxSoundReplacementActions {
        display: flex;
        gap: 6px;
      }

      .qolboxSoundBankControls .qolboxMenuButton,
      .qolboxSoundBankReplace .qolboxMenuButton {
        min-height: 34px;
      }

      .qolboxSoundReplacementHeader {
        align-items: center;
        color: var(--qolbox-menu-strong);
        display: flex;
        font-size: 11px;
        justify-content: space-between;
      }

      .qolboxSoundReplacementList {
        display: grid;
        gap: 5px;
      }

      .qolboxSoundReplacement {
        align-items: center;
        background: var(--qolbox-menu-input);
        border-radius: 3px;
        display: grid;
        gap: 8px;
        grid-template-columns: minmax(0, 1fr) auto;
        min-height: 44px;
        padding: 5px 6px 5px 9px;
      }

      .qolboxSoundReplacement > span {
        display: grid;
        min-width: 0;
      }

      .qolboxSoundReplacement strong,
      .qolboxSoundReplacement small {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .qolboxSoundReplacement strong {
        color: var(--qolbox-menu-strong);
        font-size: 12px;
      }

      .qolboxSoundReplacement small {
        color: var(--qolbox-menu-muted);
        font-size: 11px;
      }

      .qolboxSoundReplacement .qolboxMenuButton {
        height: 30px;
        min-width: 0;
        padding: 0 8px;
      }

      .qolboxThemeControls {
        align-items: end;
        display: grid;
        gap: 8px;
        grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
      }

      .qolboxThemeColorControl {
        display: grid;
        gap: 4px;
        min-width: 0;
      }

      .qolboxThemeLinkControls {
        display: grid;
        gap: 5px;
      }

      .qolboxThemeColorInputs {
        display: grid;
        gap: 5px;
        grid-template-columns: 34px minmax(0, 1fr);
      }

      .qolboxThemeColorPicker {
        appearance: none;
        background: var(--qolbox-menu-input);
        border: 1px solid var(--qolbox-menu-border);
        border-radius: 3px;
        box-sizing: border-box;
        cursor: pointer;
        height: 34px;
        padding: 3px;
        width: 34px;
      }

      .qolboxThemeColorPicker::-webkit-color-swatch-wrapper {
        padding: 0;
      }

      .qolboxThemeColorPicker::-webkit-color-swatch {
        border: 0;
        border-radius: 1px;
      }

      .qolboxThemeLinkButton {
        align-items: center;
        appearance: none;
        background: var(--qolbox-menu-control);
        border: 1px solid var(--qolbox-menu-border);
        border-radius: 3px;
        box-sizing: border-box;
        color: var(--qolbox-menu-text);
        cursor: pointer;
        display: inline-flex;
        font: inherit;
        font-size: 11px;
        font-weight: 700;
        height: 34px;
        justify-content: center;
        min-width: 82px;
        padding: 0 9px;
      }

      .qolboxThemeControls.linked .qolboxThemeLinkButton {
        border-color: var(--qolbox-accent, #ff6200);
      }

      .qolboxMenuInput {
        appearance: none;
        background: var(--qolbox-menu-input);
        border: 1px solid var(--qolbox-menu-border);
        border-radius: 3px;
        box-sizing: border-box;
        color: var(--qolbox-menu-text);
        font-family: inherit;
        font-size: 13px;
        height: 34px;
        line-height: 18px;
        margin: 0;
        min-height: 34px;
        min-width: 0;
        padding: 0 8px;
        width: 100%;
      }

      .qolboxMenuInput.invalid {
        border-color: #f05f57;
      }

      .qolboxMenuFieldError {
        color: #ffaaa4;
        font-size: 11px;
        line-height: 13px;
      }

      .qolboxMenuWarning,
      .qolboxMenuInfoBox {
        background: color-mix(in srgb, var(--qolbox-menu-control) 55%, transparent);
        border: 1px solid var(--qolbox-menu-separator);
        border-radius: 3px;
        color: var(--qolbox-menu-text);
        font-size: 11px;
        line-height: 14px;
        padding: 7px;
      }

      .qolboxMenuWarning {
        border-color: rgb(var(--qolbox-accent-rgb, 255 98 0) / 0.45);
      }

      .qolboxMenuNoteList {
        color: var(--qolbox-menu-text);
        font-size: 12px;
        line-height: 16px;
        margin: 5px 0 0;
        padding-left: 16px;
      }

      .qolboxMenuLoading {
        align-items: center;
        background: color-mix(in srgb, var(--qolbox-menu-control) 55%, transparent);
        border: 1px solid var(--qolbox-menu-separator);
        border-radius: 3px;
        color: var(--qolbox-menu-text);
        display: flex;
        font-size: 12px;
        gap: 9px;
        line-height: 16px;
        min-height: 58px;
        padding: 9px;
      }

      .qolboxMenuSpinner {
        animation: qolboxMenuSpin 0.8s linear infinite;
        border: 2px solid var(--qolbox-menu-separator);
        border-radius: 50%;
        border-top-color: var(--qolbox-accent, #ff6200);
        box-sizing: border-box;
        flex: 0 0 auto;
        height: 18px;
        width: 18px;
      }

      @keyframes qolboxMenuSpin {
        to {
          transform: rotate(360deg);
        }
      }

      .qolboxMenuAboutLinks {
        display: grid;
        gap: 6px;
      }

      .qolboxMenuCredit {
        align-items: center;
        background: var(--qolbox-menu-input);
        border: 1px solid var(--qolbox-menu-border);
        border-radius: 3px;
        color: var(--qolbox-menu-text);
        display: flex;
        gap: 8px;
        font-size: 11px;
        font-weight: 700;
        line-height: 15px;
        min-height: 34px;
        padding: 0 9px;
        text-decoration: none;
      }

      .qolboxMenuCreditIcon {
        background: var(--qolbox-menu-separator);
        border-radius: 2px;
        display: block;
        flex: 0 0 auto;
        height: 18px;
        object-fit: contain;
        padding: 1px;
        width: 18px;
      }

      .qolboxMenuCreditSvg {
        fill: currentColor;
        height: 16px;
        width: 16px;
      }

      .qolboxReferenceBody {
        overflow: hidden;
      }

      .qolboxReferenceLayout {
        border: 1px solid var(--qolbox-menu-separator);
        display: grid;
        flex: 1 1 auto;
        grid-template-columns: 136px minmax(0, 1fr);
        min-height: 260px;
        overflow: hidden;
      }

      .qolboxReferenceTopics {
        border-right: 1px solid var(--qolbox-menu-separator);
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        min-width: 0;
        padding: 4px;
      }

      .qolboxReferenceTopic {
        align-items: center;
        background: transparent;
        border: 0;
        border-radius: 3px;
        box-sizing: border-box;
        color: var(--qolbox-menu-text);
        display: flex;
        font: inherit;
        line-height: 18px;
        min-height: 32px;
        padding: 0 8px;
        text-align: left;
        white-space: nowrap;
        width: 100%;
      }

      .qolboxReferenceTopic:hover {
        background: var(--qolbox-menu-control);
      }

      .qolboxReferenceTopic.active {
        background: var(--qolbox-accent, #ff6200);
        color: var(--qolbox-accent-contrast, #000000);
        font-weight: 700;
      }

      .qolboxReferenceDetail {
        min-width: 0;
        overflow: auto;
        padding: 4px 10px;
      }

      .qolboxReferenceEntry {
        align-items: baseline;
        border-bottom: 1px solid var(--qolbox-menu-separator);
        display: grid;
        gap: 10px;
        grid-template-columns: minmax(100px, 0.7fr) minmax(0, 1.3fr);
        padding: 8px 0;
      }

      .qolboxReferenceEntry:last-child {
        border-bottom: 0;
      }

      .qolboxReferenceEntry.wide {
        display: block;
      }

      .qolboxReferenceEntry.command {
        grid-template-columns: 170px minmax(0, 1fr);
      }

      .qolboxReferenceEntry.command > code {
        font-size: 10px;
        white-space: nowrap;
      }

      .qolboxReferenceEntry h2,
      .qolboxReferenceEntry p {
        font-size: 11px;
        line-height: 15px;
        margin: 0;
      }

      .qolboxReferenceEntry h2,
      .qolboxReferenceEntry > code {
        color: var(--qolbox-menu-strong);
        font-weight: 700;
      }

      .qolboxReferenceEntry p {
        color: var(--qolbox-menu-muted);
      }

      .qolboxReferenceEntry pre,
      .qolboxReferenceCodes code {
        background: var(--qolbox-menu-input);
        color: var(--qolbox-menu-text);
        font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
        font-size: 10px;
      }

      .qolboxReferenceEntry pre {
        margin: 6px 0 0;
        overflow: auto;
        padding: 8px;
        white-space: pre;
      }

      .qolboxReferenceCodes {
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        margin-top: 6px;
      }

      .qolboxReferenceCodes code {
        padding: 3px 5px;
      }

      @media (max-height: 620px) {
        .qolboxMenuPersistentHeader {
          padding: 9px 9px 0;
        }

        .qolboxMenuBody {
          gap: 6px;
          padding: 9px;
        }
      }

      @media (max-width: 420px) {
        .qolboxMenuTab {
          flex-basis: calc((100% - 4px) / 2);
        }

        .qolboxMenuChoiceGrid,
        .qolboxMenuFeatureRow,
        .qolboxMenuFeatureRow.compact {
          grid-template-columns: 1fr;
        }

        .qolboxThemeControls {
          align-items: stretch;
          grid-template-columns: 1fr;
        }

        .qolboxReferenceLayout {
          grid-template-columns: 1fr;
        }

        .qolboxReferenceTopics {
          border-bottom: 1px solid var(--qolbox-menu-separator);
          border-right: 0;
          display: grid;
          grid-template-columns: repeat(2, 1fr);
        }

        .qolboxSoundBankControls,
        .qolboxSoundBankReplace,
        .qolboxSoundReplacement {
          grid-template-columns: 1fr;
        }

        .qolboxSoundBankActions,
        .qolboxSoundReplacementActions {
          justify-content: stretch;
        }

        .qolboxSoundBankActions .qolboxMenuButton,
        .qolboxSoundReplacementActions .qolboxMenuButton {
          flex: 1;
        }

        .qolboxThemeLinkControls {
          justify-self: center;
        }
      }

      @media (prefers-reduced-motion: reduce) {
        .qolboxMenuOverlay,
        .qolboxMenuSpinner {
          transition: none !important;
        }

        .qolboxMenuSpinner {
          animation-duration: 1.6s;
        }
      }
    `;
}
