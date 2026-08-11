export function getLobbyInformationGlobalStyleText(): string {
  return `
      .qolboxPlayerInfoOverlay {
        z-index: 2147483004;
      }

      .qolboxPlayerInfo.postGameContainer {
        box-shadow: none;
        height: 315px;
      }

      .qolboxPlayerInfo.postGameContainer .title {
        top: 20px;
      }

      .qolboxPlayerInfo.postGameContainer .position {
        top: 62px;
        overflow: hidden;
        padding: 0 28px;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .qolboxPlayerInfo.postGameContainer .xpGroup {
        top: 92px;
      }

      .qolboxPlayerInfo.postGameContainer .xpGroup .barInner {
        background-color: var(--qolbox-game-accent) !important;
      }

      .qolboxPlayerInfo.postGameContainer .xpGroup .qolboxPlayerInfoUnknownProgress {
        opacity: 0.48;
      }

      .qolboxPlayerInfoDetails {
        display: grid;
        font-size: 14px;
        font-style: normal;
        gap: 4px;
        left: 48px;
        position: absolute;
        right: 48px;
        top: 200px;
      }

      .qolboxPlayerInfoRow {
        display: grid;
        grid-template-columns: 105px minmax(0, 1fr);
        min-height: 18px;
      }

      .qolboxPlayerInfoLabel {
        color: #838385;
        text-align: left;
      }

      .qolboxPlayerInfoValue {
        color: #cccccc;
        overflow: hidden;
        text-align: right;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .qolboxPlayerInfo.postGameContainer .closeButton {
        bottom: 20px;
      }
    `;
}
