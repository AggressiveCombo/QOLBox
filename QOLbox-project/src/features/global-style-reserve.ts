export function getReserveGlobalStyleText(): string {
  return `
      html.qolbox-feature-reserve body.qolbox-reserve-active .connectingWindowContainer:not(.qolboxReserveWindowContainer) {
        display: none !important;
      }

      .qolboxReserveWindowContainer {
        display: none;
        z-index: 10000;
      }

      html.qolbox-feature-reserve body.qolbox-reserve-active .qolboxReserveWindowContainer {
        display: block !important;
      }

      html.qolbox-feature-reserve .roomListContainer .bottomButton.right.qolboxReserveUnavailable {
        cursor: not-allowed !important;
        filter: grayscale(1) saturate(0.35) !important;
        opacity: 0.48 !important;
      }

      .qolboxReserveWindowContainer .qolboxReserveContent {
        align-items: center;
        bottom: 48px;
        display: flex;
        flex-direction: column;
        gap: 4px;
        justify-content: center;
        left: 16px;
        pointer-events: none;
        position: absolute;
        right: 16px;
        text-align: center;
        top: 50px;
      }

      .qolboxReserveWindowContainer .connectingWindow .spinner {
        bottom: auto !important;
        flex: 0 0 auto;
        left: auto !important;
        margin: 0 auto;
        order: 2;
        position: static !important;
        right: auto !important;
        top: auto !important;
      }

      .qolboxReserveWindowContainer .qolboxReserveStatus,
      .qolboxReserveWindowContainer .qolboxReserveCountdown,
      .qolboxReserveWindowContainer .qolboxReserveMessage {
        width: 100%;
      }

      .qolboxReserveWindowContainer .qolboxReserveStatus {
        color: rgb(205, 210, 218);
        font-size: 11px;
        line-height: 14px;
        min-height: 14px;
        order: 1;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .qolboxReserveWindowContainer .qolboxReserveCountdown {
        color: rgb(242, 242, 242);
        font-size: 13px;
        line-height: 16px;
        min-height: 16px;
        order: 3;
        white-space: nowrap;
      }

      .qolboxReserveWindowContainer .qolboxReserveMessage {
        color: rgb(242, 242, 242);
        font-size: 13px;
        line-height: 16px;
        order: 1;
        white-space: normal;
      }
`;
}
