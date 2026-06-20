export function getTypingGlobalStyleText(): string {
  return `
      .scores .entryContainer .qolboxTypingIndicator {
        background-image: url("graphics/ui/typing.svg");
        background-position: center center;
        background-repeat: no-repeat;
        background-size: contain;
        display: inline-block;
        height: 14px;
        margin-left: 5px;
        pointer-events: none;
        vertical-align: -2px;
        width: 14px;
      }

      @supports ((-webkit-mask-image: url("graphics/ui/typing.svg")) or (mask-image: url("graphics/ui/typing.svg"))) {
        .scores .entryContainer .qolboxTypingIndicator {
          background-color: currentColor;
          background-image: none;
          -webkit-mask-image: url("graphics/ui/typing.svg");
          mask-image: url("graphics/ui/typing.svg");
          -webkit-mask-position: center center;
          mask-position: center center;
          -webkit-mask-repeat: no-repeat;
          mask-repeat: no-repeat;
          -webkit-mask-size: contain;
          mask-size: contain;
        }
      }

      .qolboxWorldTypingLayer {
        left: 0;
        pointer-events: none;
        position: fixed;
        top: 0;
        z-index: 12;
      }

      .qolboxWorldTypingIndicator {
        background-color: rgba(37, 38, 42, 0.82);
        background-image: url("graphics/ui/typing.svg");
        background-position: center center;
        background-repeat: no-repeat;
        background-size: 14px 14px;
        border-radius: 3px;
        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.35);
        height: 18px;
        pointer-events: none;
        position: fixed;
        transform: translate(-50%, -100%);
        width: 22px;
      }
    `;
}
