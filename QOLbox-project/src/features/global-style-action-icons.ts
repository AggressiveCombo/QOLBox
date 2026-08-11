export function getActionIconographyGlobalStyleText(): string {
  return `
      .qolboxActionIcon {
        display: inline-block;
        flex: 0 0 auto;
        height: 1em;
        margin-right: 0.38em;
        pointer-events: none;
        vertical-align: -0.14em;
        width: 1em;
      }

      .qolboxIconOnlyAction {
        align-items: center;
        background-image: none !important;
        display: flex;
        justify-content: center;
      }

      .qolboxIconOnlyAction > .qolboxActionIcon {
        height: 18px;
        margin: 0;
        width: 18px;
      }

      .cornerButton .square.qolboxIconOnlyAction > .icon {
        display: none;
      }

      .cornerButton .square.qolboxIconOnlyAction > .qolboxActionIcon {
        height: 23px;
        transform: rotate(28deg);
        width: 23px;
      }

      .lobbyContainer .teamLockButton.qolboxIconOnlyAction > .qolboxActionIcon {
        height: 18px;
        width: 14px;
      }

      .lobbyContainer .teamLockButton.qolboxIconOnlyAction {
        right: calc(33.5% - 8px);
        width: 16px;
      }

      .lobbyContainer .teamLockButton.lockedClient,
      .lobbyContainer .teamLockButton.lockedHost {
        background-color: var(--qolbox-game-accent) !important;
        color: var(--qolbox-game-accent-contrast) !important;
      }

      .lobbyContainer .teamLockButton.lockedHost:hover {
        background-color: var(--qolbox-game-accent-hover) !important;
        color: var(--qolbox-game-accent-hover-contrast) !important;
      }

      .cosmeticWindow .optionsContainer .singleContainer:first-child {
        position: relative;
      }

      .cosmeticWindow .qolboxPlayerHexInput {
        background: var(--qolbox-ui-input, #303030);
        border: 1px solid var(--qolbox-ui-input-border, #6c6c6c);
        box-sizing: border-box;
        color: var(--qolbox-ui-text, #ebebeb);
        font: 10px/18px "Bai Jamjuree", sans-serif;
        height: 20px;
        padding: 0 3px;
        position: absolute;
        right: 0;
        text-align: center;
        top: 34px;
        width: 74px;
      }

      .cosmeticWindow .qolboxPlayerHexInput[aria-invalid="true"] {
        border-color: #be4242;
      }

      .mainMenuFancy .rightContainer .bigButton .qolboxMainActionText {
        align-items: center;
        column-gap: 0.16em;
        display: flex;
        justify-content: center;
      }

      .mainMenuFancy .rightContainer .bigButton .text > .qolboxActionIcon {
        height: 0.42em;
        margin: 0;
        position: static;
        transform: translateY(-0.02em);
        width: 0.42em;
      }

      .mainMenuFancy .rightContainer .bigButton .qolboxMainActionLabel {
        display: inline-block;
      }

      .mainMenuFancy .rightContainer .bigButton .bg.qp {
        width: 480px;
      }

      .mainMenuFancy .rightContainer .bigButton .bg.custom {
        width: 575px;
      }

      .mainMenuFancy .rightContainer .bigButton .bg.training {
        width: 592px;
      }

      .cornerButton .items {
        min-width: 180px;
        width: max-content;
      }

      .cornerButton .items .item {
        box-sizing: border-box;
        min-height: 34px;
        padding: 7px 8px;
        white-space: nowrap;
      }

      .cornerButton .items .qolboxActionIcon {
        filter: drop-shadow(1px 1px 1px #000);
      }

      .cornerButton .items .qolboxAudioMenuGroup {
        position: relative;
      }

      .cornerButton .items .qolboxAudioMenuArrow {
        display: inline-block;
        margin-left: 0.35em;
        transition: transform 100ms ease;
      }

      .cornerButton .items .qolboxAudioMenuGroup.open > .qolboxAudioMenuArrow {
        transform: rotate(90deg);
      }

      .cornerButton .items .qolboxAudioMenuOptions {
        display: none;
        font-weight: 400;
        opacity: 0.9;
      }

      .cornerButton .items .qolboxAudioMenuGroup.open > .qolboxAudioMenuOptions {
        display: block;
      }

      .cornerButton .items .qolboxAudioMenuOption {
        font-size: 0.9em;
        padding-left: 8px;
        padding-right: 20px;
      }

      .cornerButton .items.left .qolboxAudioMenuOption {
        padding-left: 20px;
        padding-right: 8px;
      }

      .cornerButton .items .qolboxAudioMenuOption.qolboxMusicMenuOption {
        display: block !important;
      }

      .lobbyContainer .settingsBox .settingsButton {
        font-size: 14px;
      }

      .roomListContainer .bottomButton.middle,
      .roomListContainer .bottomButton.news {
        width: 96px;
      }

      .roomListContainer .topBar > .qolboxActionIcon {
        margin-right: 0.45em;
        vertical-align: -0.16em;
      }

      .roomListContainer .tableHeader .element > .qolboxActionIcon {
        height: 0.85em;
        margin-right: 0.28em;
        vertical-align: -0.1em;
        width: 0.85em;
      }

      .mapListContainer .topBar > .qolboxActionIcon {
        margin-right: 0.45em;
        vertical-align: -0.16em;
      }

      .mapListContainer .dropdownContainer .element > .qolboxActionIcon,
      .mapListContainer .secondaryContainer .secondaryElement > .qolboxActionIcon {
        height: 0.9em;
        margin-right: 0.35em;
        vertical-align: -0.11em;
        width: 0.9em;
      }

      .mapListContainer .dropdownContainer .qolboxDropdownArrow {
        color: var(--qolbox-game-accent-contrast, #ffffff);
        margin: 0;
      }

      .roomListContainer .qolboxRoomPasswordIcon {
        color: inherit;
        height: 15px;
        margin: 0;
        vertical-align: -2px;
        width: 13px;
      }

      .qolboxStatusIcon {
        flex: 0 0 auto;
        height: 16px;
        margin: 0;
        width: 16px;
      }

      .qolboxStatusLines {
        align-items: center;
        column-gap: 8px;
        display: grid;
        grid-template-columns: 16px minmax(0, 1fr);
        justify-content: center;
        margin: 0 auto;
        max-width: 100%;
        width: max-content;
      }

      .qolboxStatusLine {
        display: contents;
      }

      .qolboxStatusSeparator {
        display: none;
      }

      .qolboxStatusIconSpacer {
        width: 16px;
      }

      .qolboxStatusLabel {
        min-width: 0;
        overflow-wrap: anywhere;
        text-align: left;
        white-space: normal;
      }

      .mapListContainer .thumb > .qolboxMapPreviewPlaceholder {
        display: block;
        height: 28px;
        margin: auto;
        opacity: 0.45;
        width: 28px;
      }

      #editorContainer .topMenu .topLabel > .qolboxActionIcon {
        vertical-align: -0.16em;
      }

      #editorContainer .topMenu .container .item > .qolboxActionIcon {
        margin-left: -8px;
      }

      .qolboxMenuButton .qolboxActionIcon,
      .qolboxMenuTab .qolboxActionIcon,
      .qolboxMenuChoice .qolboxActionIcon,
      .qolboxMenuFeatureName > .qolboxActionIcon {
        height: 14px;
        width: 14px;
      }

      .qolboxEditorHelpTopic .qolboxActionIcon {
        height: 14px;
        width: 14px;
      }

      .qolboxReferenceTopic > .qolboxActionIcon {
        height: 14px;
        margin-right: 6px;
        width: 14px;
      }

      @media (prefers-reduced-motion: reduce) {
        .cornerButton .items .qolboxAudioMenuArrow {
          transition: none;
        }
      }
    `;
}
