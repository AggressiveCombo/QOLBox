export function getQolboxMenuGlobalStyleText(): string {
  return `
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

      html.qolbox-menu-open .qolboxMenuOverlay {
        opacity: 1;
        pointer-events: auto;
      }

      .qolboxMenuPanel {
        background: rgba(22, 24, 28, 0.98);
        border: 2px solid rgb(69, 75, 86);
        border-radius: 4px;
        box-shadow: 0 8px 28px rgba(0, 0, 0, 0.55);
        box-sizing: border-box;
        color: #f4f4f4;
        display: flex;
        flex-direction: column;
        max-height: calc(100vh - 20px);
        max-width: min(430px, calc(100vw - 20px));
        overflow: hidden;
        width: 430px;
      }

      .qolboxMenuBody {
        box-sizing: border-box;
        display: flex;
        flex: 1 1 auto;
        flex-direction: column;
        gap: 8px;
        min-height: 0;
        overflow: auto;
        padding: 12px;
      }

      .qolboxMenuTitle {
        color: #ffffff;
        font-size: 18px;
        font-weight: 700;
        letter-spacing: 0;
        line-height: 22px;
        margin: 0;
      }

      .qolboxMenuHeaderLine {
        align-items: center;
        display: flex;
        gap: 8px;
        justify-content: space-between;
      }

      .qolboxMenuText {
        color: #d7dbe1;
        font-size: 12px;
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
        color: #c4c9d1;
        font-size: 10px;
        font-weight: 700;
        line-height: 13px;
        text-transform: uppercase;
      }

      .qolboxMenuVersionPill {
        background: rgb(31, 34, 39);
        border: 1px solid rgb(72, 78, 89);
        border-radius: 3px;
        color: #f4f4f4;
        font-size: 12px;
        font-weight: 700;
        line-height: 15px;
        padding: 4px 7px;
      }

      .qolboxMenuVersionPill.current {
        border-color: rgba(245, 197, 66, 0.8);
        color: #f5c542;
      }

      .qolboxMenuVersionArrow {
        color: #c4c9d1;
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
        background: rgba(255, 255, 255, 0.25);
        border-radius: 999px;
        height: 5px;
        width: 12px;
      }

      .qolboxMenuDot.active {
        background: #f5c542;
      }

      .qolboxMenuToggleGroup {
        background: rgb(31, 34, 39);
        border: 1px solid rgb(72, 78, 89);
        border-radius: 3px;
        display: grid;
        grid-template-columns: 1fr 1fr;
        overflow: hidden;
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
        font-size: 12px;
        font-weight: 700;
        justify-content: center;
        letter-spacing: 0;
        line-height: 14px;
        min-height: 30px;
      }

      .qolboxMenuToggle {
        background: transparent;
        color: #cfd3da;
        padding: 0 8px;
      }

      .qolboxMenuToggle + .qolboxMenuToggle {
        border-left: 1px solid rgba(255, 255, 255, 0.14);
      }

      .qolboxMenuToggle.active {
        background: #f5c542;
        color: #111111;
      }

      .qolboxMenuActions {
        display: flex;
        gap: 6px;
        justify-content: flex-end;
        margin-top: 4px;
      }

      .qolboxMenuActions.slim {
        margin-top: 0;
      }

      .qolboxMenuButton {
        background: rgb(47, 51, 58);
        border: 1px solid rgb(92, 98, 108);
        border-radius: 3px;
        color: #f4f4f4;
        min-width: 72px;
        padding: 0 12px;
      }

      .qolboxMenuButton.primary {
        background: #f5c542;
        color: #111111;
      }

      .qolboxMenuButton:disabled {
        cursor: default;
        opacity: 0.45;
      }

      .qolboxMenuSettingsList {
        display: grid;
        gap: 6px;
      }

      .qolboxMenuTabs {
        border-bottom: 1px solid rgba(255, 255, 255, 0.12);
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        justify-content: center;
        padding-bottom: 8px;
      }

      .qolboxMenuTab {
        background: rgb(31, 34, 39);
        border: 1px solid rgb(72, 78, 89);
        border-radius: 3px;
        color: #cfd3da;
        flex: 0 1 calc((100% - 8px) / 3);
        font-size: 11px;
        line-height: 13px;
        min-width: 0;
        padding: 0 6px;
      }

      .qolboxMenuTab.active {
        background: #f5c542;
        border-color: #f5c542;
        color: #111111;
      }

      .qolboxMenuPage {
        align-content: start;
        display: grid;
        gap: 8px;
        min-height: 172px;
      }

      .qolboxMenuChoiceGrid {
        display: grid;
        gap: 6px;
        grid-template-columns: 1fr 1fr;
      }

      .qolboxMenuChoice {
        appearance: none;
        background: rgb(47, 51, 58);
        border: 1px solid rgb(92, 98, 108);
        border-radius: 3px;
        color: #f4f4f4;
        cursor: pointer;
        display: grid;
        font-family: inherit;
        gap: 3px;
        min-height: 62px;
        padding: 9px;
        text-align: left;
      }

      .qolboxMenuChoice.primary {
        border-color: #f5c542;
      }

      .qolboxMenuChoice span {
        color: #ffffff;
        font-size: 13px;
        font-weight: 700;
        line-height: 15px;
      }

      .qolboxMenuChoice small {
        color: #c4c9d1;
        font-size: 10px;
        line-height: 13px;
      }

      .qolboxMenuFeatureRow {
        align-items: center;
        border-bottom: 1px solid rgba(255, 255, 255, 0.09);
        display: grid;
        gap: 8px;
        grid-template-columns: minmax(0, 1fr) 108px;
        padding: 0 0 6px;
      }

      .qolboxMenuFeatureRow.compact {
        grid-template-columns: minmax(0, 1fr) 150px;
      }

      .qolboxMenuFeatureRow.compact.boolean {
        grid-template-columns: minmax(0, 1fr) 108px;
      }

      .qolboxMenuFeatureName {
        color: #ffffff;
        font-size: 12px;
        font-weight: 700;
        line-height: 15px;
      }

      .qolboxMenuFeatureSummary {
        color: #c4c9d1;
        font-size: 10px;
        line-height: 13px;
        margin-top: 1px;
      }

      .qolboxMenuFieldControl {
        display: grid;
        gap: 3px;
      }

      .qolboxMenuInput {
        appearance: none;
        background: rgb(31, 34, 39);
        border: 1px solid rgb(72, 78, 89);
        border-radius: 3px;
        box-sizing: border-box;
        color: #f4f4f4;
        font-family: inherit;
        font-size: 12px;
        height: 30px;
        line-height: 16px;
        min-height: 30px;
        min-width: 0;
        padding: 0 6px;
        width: 100%;
      }

      .qolboxMenuInput.invalid {
        border-color: #f05f57;
      }

      .qolboxMenuFieldError {
        color: #ffaaa4;
        font-size: 10px;
        line-height: 12px;
      }

      .qolboxMenuWarning,
      .qolboxMenuInfoBox {
        background: rgba(255, 255, 255, 0.06);
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 3px;
        color: #d7dbe1;
        font-size: 10px;
        line-height: 13px;
        padding: 6px;
      }

      .qolboxMenuWarning {
        border-color: rgba(245, 197, 66, 0.45);
      }

      .qolboxMenuNoteList {
        color: #d7dbe1;
        font-size: 11px;
        line-height: 15px;
        margin: 5px 0 0;
        padding-left: 16px;
      }

      .qolboxMenuLoading {
        align-items: center;
        background: rgba(255, 255, 255, 0.06);
        border: 1px solid rgba(255, 255, 255, 0.12);
        border-radius: 3px;
        color: #d7dbe1;
        display: flex;
        font-size: 11px;
        gap: 9px;
        line-height: 15px;
        min-height: 54px;
        padding: 8px;
      }

      .qolboxMenuSpinner {
        animation: qolboxMenuSpin 0.8s linear infinite;
        border: 2px solid rgba(255, 255, 255, 0.28);
        border-radius: 50%;
        border-top-color: #f5c542;
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
        background: rgb(31, 34, 39);
        border: 1px solid rgb(72, 78, 89);
        border-radius: 3px;
        color: #e6e9ee;
        display: flex;
        gap: 8px;
        font-size: 10px;
        font-weight: 700;
        line-height: 14px;
        min-height: 30px;
        padding: 0 8px;
        text-decoration: none;
      }

      .qolboxMenuCreditIcon {
        background: rgba(255, 255, 255, 0.12);
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

      @media (max-height: 620px) {
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
