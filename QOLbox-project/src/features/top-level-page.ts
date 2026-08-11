import { readObjectProperty } from '../utils/object-properties';
import { GAME_START_FAVICON_HREF, stripGameStartTitlePrefix } from './game-start-shared';

const TOP_LEVEL_INPUT_STYLE_ID = 'qolbox-top-level-input-style';
const HITBOX_ORIGIN_PATTERN = /^https:\/\/(www\.)?hitbox\.io$/i;

interface SavedRelayFavicon {
  href: string | null;
  link: HTMLLinkElement | null;
  type: string | null;
}

function isExpectedGameFrameMessage(event: MessageEvent): boolean {
  if (!HITBOX_ORIGIN_PATTERN.test(event.origin)) {
    return false;
  }

  return Array.from(document.querySelectorAll('iframe')).some(frame => {
    if (frame.contentWindow !== event.source) {
      return false;
    }

    try {
      const frameUrl = new URL(frame.src || frame.getAttribute('src') || '', document.baseURI);
      return frameUrl.origin === event.origin && /\/game2\.html$/i.test(frameUrl.pathname);
    } catch {
      return false;
    }
  });
}

declare global {
  interface Window {
    __qolboxGameStartRelayInstalled?: boolean;
  }
}

export function installTopLevelGameInputPassthrough(): void {
  const applyPassthroughStyle = () => {
    if (document.getElementById(TOP_LEVEL_INPUT_STYLE_ID)) {
      return true;
    }

    const root = document.head || document.documentElement;
    if (!root) {
      return false;
    }

    const style = document.createElement('style');
    style.id = TOP_LEVEL_INPUT_STYLE_ID;
    // Hide the page-side ad boxes so they cannot cover or catch input around the game.
    style.textContent = `
        #adboxverticalleft,
        #adboxverticalright {
          display: none !important;
          visibility: hidden !important;
          pointer-events: none !important;
        }
      `;
    root.appendChild(style);
    return true;
  };

  if (!applyPassthroughStyle()) {
    document.addEventListener('DOMContentLoaded', applyPassthroughStyle, { once: true });
  }
}

export function installTopLevelGameStartRelay(): void {
  if (window.top !== window || window.__qolboxGameStartRelayInstalled) {
    return;
  }

  window.__qolboxGameStartRelayInstalled = true;
  let relayActive = false;
  let relayOriginalTitle = '';
  let relayOriginalFavicon: SavedRelayFavicon | null = null;
  let relayFaviconLink: HTMLLinkElement | null = null;

  function saveRelayState(): void {
    if (relayActive) {
      return;
    }

    const link = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
    relayOriginalTitle = stripGameStartTitlePrefix(document.title || '');
    relayOriginalFavicon = link
      ? {
          href: link.getAttribute('href'),
          link,
          type: link.getAttribute('type'),
        }
      : { href: null, link: null, type: null };
    relayFaviconLink = link || document.createElement('link');

    if (!link) {
      relayFaviconLink.rel = 'icon';
      (document.head || document.documentElement).appendChild(relayFaviconLink);
    }

    relayActive = true;
  }

  function setRelayFavicon(active: boolean): void {
    saveRelayState();

    if (!relayFaviconLink) {
      return;
    }

    if (active) {
      relayFaviconLink.setAttribute('href', GAME_START_FAVICON_HREF);
      relayFaviconLink.setAttribute('type', 'image/svg+xml');
      return;
    }

    if (relayOriginalFavicon && relayOriginalFavicon.href) {
      relayFaviconLink.setAttribute('href', relayOriginalFavicon.href);
    } else {
      relayFaviconLink.removeAttribute('href');
    }

    if (relayOriginalFavicon && relayOriginalFavicon.type) {
      relayFaviconLink.setAttribute('type', relayOriginalFavicon.type);
    } else {
      relayFaviconLink.removeAttribute('type');
    }
  }

  function clearRelayState(): void {
    if (!relayActive) {
      return;
    }

    document.title = relayOriginalTitle;

    if (relayOriginalFavicon && relayFaviconLink) {
      if (!relayOriginalFavicon.link) {
        relayFaviconLink.remove();
      } else {
        setRelayFavicon(false);
      }
    }

    relayActive = false;
    relayOriginalTitle = '';
    relayOriginalFavicon = null;
    relayFaviconLink = null;
  }

  window.addEventListener(
    'message',
    event => {
      if (!isExpectedGameFrameMessage(event)) {
        return;
      }

      const data = event.data;
      if (readObjectProperty(data, 'source') !== 'QOLBox' || readObjectProperty(data, 'feature') !== 'gameStartIndicator') {
        return;
      }

      const action = readObjectProperty(data, 'action');
      if (action === 'title') {
        saveRelayState();
        document.title = String(readObjectProperty(data, 'title') || relayOriginalTitle);
      } else if (action === 'favicon') {
        setRelayFavicon(Boolean(readObjectProperty(data, 'active')));
      } else if (action === 'clear') {
        clearRelayState();
      }
    },
    true
  );
}
