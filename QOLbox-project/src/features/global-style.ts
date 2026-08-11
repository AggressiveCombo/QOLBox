import { getFullscreenGlobalStyleText, type FullscreenGlobalStyleOptions } from './global-style-fullscreen';
import { getReserveGlobalStyleText } from './global-style-reserve';
import { getChatGlobalStyleText } from './global-style-chat';
import { getQolboxMenuGlobalStyleText } from './global-style-menu';
import { getMobileGrabGlobalStyleText, type MobileGrabGlobalStyleOptions } from './global-style-mobile-grab';
import { getTypingGlobalStyleText } from './global-style-typing';
import { getEditorMapGlobalStyleText } from './global-style-editor-map';
import { getLobbyInformationGlobalStyleText } from './global-style-lobby-information';
import { getActionIconographyGlobalStyleText } from './global-style-action-icons';

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

      :is(:disabled, [disabled], [aria-disabled="true"], .disabled, .unlockedClient, .lockedClient, .beenDeleted),
      :is(:disabled, [disabled], [aria-disabled="true"], .disabled, .unlockedClient, .lockedClient, .beenDeleted) *,
      :is([aria-readonly="true"], [readonly]),
      :is([aria-readonly="true"], [readonly]) * {
        cursor: not-allowed !important;
      }

      :is([aria-disabled="true"], .disabled, .unlockedClient, .lockedClient, .beenDeleted) {
        pointer-events: auto !important;
      }

      html[data-qolbox-color-scheme="light"]
      :is(:disabled, [disabled], [aria-disabled="true"], .disabled, .unlockedClient, .lockedClient, .beenDeleted) {
        filter: none !important;
        opacity: 0.58 !important;
      }

      .mainMenuFancy .rightContainer .bigButton:focus-visible {
        outline: none;
      }

      .mainMenuFancy .rightContainer .bigButton:focus-visible .bg {
        background-color: var(--qolbox-game-accent-focus, #5a8ac1);
      }

      .mapListContainer .mapsContainer .descriptionDiv span {
        max-height: 100%;
        overflow-y: auto;
      }

      .lobbyContainer .settingsBox .mapTextContainer .description {
        overflow-y: auto;
      }

      .lobbyContainer .voteSpan:not(:empty) {
        cursor: pointer;
      }

      ${getLobbyInformationGlobalStyleText()}

      ${getActionIconographyGlobalStyleText()}

      html.qolbox-feature-fullscreen #email,
      html.qolbox-feature-fullscreen #songcredit,
      html.qolbox-feature-fullscreen #betaLink {
        display: none !important;
      }

      ${getReserveGlobalStyleText()}

      ${getQolboxMenuGlobalStyleText()}

      ${getMobileGrabGlobalStyleText(options)}

      ${getEditorMapGlobalStyleText()}
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
