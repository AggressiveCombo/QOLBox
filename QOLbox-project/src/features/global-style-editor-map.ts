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
    `;
}
