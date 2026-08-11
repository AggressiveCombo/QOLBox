export function getEditorMapGlobalStyleText(): string {
  return `
      .qolboxEditorMapStatus {
        background: rgba(22, 24, 28, 0.96);
        border: 1px solid rgb(92, 98, 108);
        border-radius: 3px;
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.42);
        box-sizing: border-box;
        color: #f4f4f4;
        font-family: inherit;
        font-size: 12px;
        font-weight: 700;
        left: 50%;
        line-height: 15px;
        max-width: calc(100vw - 20px);
        opacity: 0;
        padding: 6px 10px;
        pointer-events: none;
        position: fixed;
        top: 36px;
        transform: translateX(-50%);
        transition: opacity 120ms ease;
        z-index: 2147483646;
      }

      .qolboxEditorMapStatus.visible {
        opacity: 1;
      }

      .qolboxEditorMapStatus.error {
        border-color: rgba(240, 95, 87, 0.8);
        color: #ffaaa4;
      }

      #editorContainer .sideBar .qolboxColorPicker:hover .tooltip {
        display: block;
      }

      #editorContainer.qolboxEditorPrecisionTool > canvas,
      #editorContainer.qolboxEditorMarquee > canvas {
        cursor: crosshair !important;
      }

      #editorContainer.qolboxEditorFillTool > canvas {
        cursor: url("./graphics/ui/format-color-fill.svg") 19 15, crosshair !important;
      }

      #editorContainer.qolboxColorPickerActive > canvas {
        cursor: var(--qolbox-editor-color-picker-cursor, crosshair) !important;
      }

      #editorContainer.qolboxEditorDragging > canvas {
        cursor: grabbing !important;
      }

      #editorContainer .sideBar > .qolboxHexInput {
        box-sizing: border-box;
        display: block;
        font-size: 8px;
        font-variant-numeric: tabular-nums;
        line-height: 10px;
        margin: 3px 0 2px;
        padding: 0;
        width: 36px;
      }

      #editorContainer .sideBar .qolboxHexPreview {
        margin-bottom: 0;
      }

      #editorContainer .paramContainer > .qolboxHexInput {
        font-size: 9px;
        font-variant-numeric: tabular-nums;
        width: 59px;
      }

      #editorContainer .qolboxHexInput[aria-invalid="true"] {
        color: #ffaaa4;
      }

      .editorPropertiesWindow .qolboxUngroupButton {
        cursor: pointer;
        font-family: inherit;
        font-size: 10px;
        font-weight: 700;
        line-height: 20px;
        margin: 0;
        min-height: 24px;
        padding: 1px 6px;
        position: absolute;
        right: 48px;
        top: 3px;
      }

      #editorContainer .qolboxEditorHelp .topLabel {
        box-sizing: border-box;
        cursor: pointer;
        height: 28px !important;
        line-height: 28px !important;
        min-height: 0;
        padding-bottom: 0;
        padding-top: 0;
      }

      .qolboxEditorHelpWindow {
        background: var(--qolbox-menu-panel) !important;
        color: var(--qolbox-menu-text) !important;
        cursor: auto;
        height: min(560px, calc(100vh - 40px));
        inset: 0;
        margin: auto;
        max-height: calc(100vh - 20px);
        max-width: calc(100vw - 20px);
        min-height: min(320px, calc(100vh - 20px));
        min-width: min(470px, calc(100vw - 20px));
        overflow: auto;
        padding: 0;
        position: fixed;
        resize: both;
        width: min(760px, calc(100vw - 40px));
      }

      #editorContainer .qolboxEditorHelp .topLabel[aria-expanded="true"] {
        background-color: var(--qolbox-game-accent, #4a7ab1);
        color: var(--qolbox-game-accent-contrast, #ffffff);
      }

      .qolboxEditorHelpWindow:not([open]) {
        display: none;
      }

      .qolboxEditorHelpWindow [hidden] {
        display: none !important;
      }

      .qolboxEditorHelpWindow::backdrop {
        background: rgba(0, 0, 0, 0.72);
      }

      .qolboxEditorHelpBody {
        height: 100%;
        overflow: hidden;
      }

      .qolboxEditorHelpWindow .contentDiv {
        display: grid;
        flex: 1 1 auto;
        grid-template-columns: minmax(7.5em, 30%) minmax(0, 1fr);
        min-height: 0;
        overscroll-behavior: contain;
        overflow: hidden;
      }

      .qolboxEditorHelpTopics {
        border-right: 1px solid var(--qolbox-menu-separator);
        display: flex;
        flex-direction: column;
        gap: 2px;
        overflow-y: auto;
        padding-right: 6px;
      }

      .qolboxEditorHelpTopic {
        background: transparent;
        border: 0;
        border-radius: 3px;
        color: var(--qolbox-menu-muted);
        cursor: pointer;
        flex: 0 0 auto;
        font: inherit;
        font-size: 12px;
        line-height: 15px;
        min-height: 30px;
        padding: 7px 8px;
        text-align: left;
        width: 100%;
      }

      .qolboxEditorHelpTopic:hover {
        background: var(--qolbox-menu-control);
      }

      .qolboxEditorHelpTopic[aria-selected="true"] {
        background: var(--qolbox-accent, #ff6200);
        color: var(--qolbox-accent-contrast, #000000);
      }

      .qolboxEditorHelpDetail {
        overflow-y: auto;
        padding: 8px 10px 8px 14px;
      }

      .qolboxEditorHelpEntry + .qolboxEditorHelpEntry {
        border-top: 1px solid var(--qolbox-menu-separator);
        margin-top: 12px;
        padding-top: 12px;
      }

      .qolboxEditorHelpDetail h2 {
        font-size: 16px;
        line-height: 20px;
        margin: 0 0 8px;
        text-wrap: balance;
      }

      .qolboxEditorHelpDetail p {
        color: var(--qolbox-menu-muted);
        font-size: 13px;
        line-height: 18px;
        margin: 0;
        text-wrap: pretty;
      }

      .qolboxEditorIntroProgress {
        align-self: center;
        color: var(--qolbox-menu-muted);
        font-size: 12px;
      }

      .qolboxEditorHelpBody.intro .qolboxEditorHelpClose {
        margin-right: auto;
      }

      #editorContainer .topMenu .container .qolboxMirrorItem {
        padding-right: 36px;
        position: relative;
      }

      #editorContainer .qolboxMirrorArrow {
        pointer-events: none;
        position: absolute;
        right: 12px;
      }

      #editorContainer .topMenu .container .qolboxMirrorSubmenu {
        left: 100%;
        top: -5px;
      }

      #editorContainer .qolboxMirrorItem:hover > .qolboxMirrorSubmenu,
      #editorContainer .qolboxMirrorItem:focus-within > .qolboxMirrorSubmenu,
      #editorContainer .qolboxMirrorItem.qolboxMirrorOpen > .qolboxMirrorSubmenu {
        display: block;
      }
    `;
}
