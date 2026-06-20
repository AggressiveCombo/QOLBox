import { getFullscreenGlobalStyleText, type FullscreenGlobalStyleOptions } from './global-style-fullscreen';
import { getReserveGlobalStyleText } from './global-style-reserve';
import { getChatGlobalStyleText } from './global-style-chat';
import { getQolboxMenuGlobalStyleText } from './global-style-menu';
import { getMobileGrabGlobalStyleText, type MobileGrabGlobalStyleOptions } from './global-style-mobile-grab';
import { getTypingGlobalStyleText } from './global-style-typing';

interface GlobalStyleOptions extends FullscreenGlobalStyleOptions, MobileGrabGlobalStyleOptions {
  styleId: string;
}

function getGlobalStyleText(options: GlobalStyleOptions): string {
  return `
      ${getFullscreenGlobalStyleText(options)}

      ${getTypingGlobalStyleText()}

      ${getChatGlobalStyleText()}

      .qolboxSwitchTeamsButton.qolboxSwitchTeamsButtonBusy {
        cursor: not-allowed !important;
        opacity: 0.62;
      }

      html.qolbox-feature-fullscreen #email,
      html.qolbox-feature-fullscreen #songcredit,
      html.qolbox-feature-fullscreen #betaLink {
        display: none !important;
      }

      ${getReserveGlobalStyleText()}

      ${getQolboxMenuGlobalStyleText()}

      ${getMobileGrabGlobalStyleText(options)}
    `;
}

export function createGlobalStyleController(options: GlobalStyleOptions) {
  function ensureGlobalStyle(): boolean {
    if (document.getElementById(options.styleId)) {
      return true;
    }

    const styleHost = document.head || document.documentElement;
    if (!styleHost) {
      return false;
    }

    const style = document.createElement('style');
    style.id = options.styleId;
    style.textContent = getGlobalStyleText(options);

    styleHost.appendChild(style);
    return true;
  }

  return {
    ensureGlobalStyle,
  };
}
