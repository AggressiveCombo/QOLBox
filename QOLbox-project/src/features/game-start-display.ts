import { GAME_START_FAVICON_HREF } from './game-start-shared';

interface SavedFavicon {
  href: string | null;
  link: HTMLLinkElement | null;
  type: string | null;
}

interface GameStartRelayPayload {
  action: 'clear' | 'favicon' | 'title';
  active?: boolean;
  title?: string;
}

const HITBOX_ORIGIN_PATTERN = /^https:\/\/(www\.)?hitbox\.io$/i;

export interface GameStartDisplayController {
  getTitle(): string;
  postClear(): void;
  restoreFavicon(): void;
  setFavicon(active: boolean): void;
  setTitle(title: string): void;
}

export function createGameStartDisplayController(): GameStartDisplayController {
  let faviconLink: HTMLLinkElement | null = null;
  let originalFavicon: SavedFavicon | null = null;

  function getIndicatorDocument(): Document {
    try {
      const targetWindow = window.top;
      if (targetWindow && targetWindow.document) {
        return targetWindow.document;
      }
    } catch {
      // Cross-origin top frames are handled through postMessage relay instead.
    }

    return document;
  }

  function getFaviconLink(): HTMLLinkElement | null {
    return getIndicatorDocument().querySelector<HTMLLinkElement>('link[rel~="icon"]');
  }

  function shouldPostToTop(): boolean {
    const targetWindow = window.top;
    if (!targetWindow || targetWindow === window) {
      return false;
    }

    try {
      return !targetWindow.document;
    } catch {
      return true;
    }
  }

  function postToTop(payload: GameStartRelayPayload): void {
    if (!shouldPostToTop()) {
      return;
    }

    try {
      const targetOrigin = new URL(document.referrer).origin;
      if (!HITBOX_ORIGIN_PATTERN.test(targetOrigin)) {
        return;
      }
      window.top?.postMessage(
        {
          ...payload,
          feature: 'gameStartIndicator',
          source: 'QOLBox',
        },
        targetOrigin
      );
    } catch {
      // Cross-origin title relay is best-effort.
    }
  }

  function saveFavicon(): void {
    if (originalFavicon) {
      return;
    }

    const targetDocument = getIndicatorDocument();
    const link = getFaviconLink();
    originalFavicon = link
      ? {
          href: link.getAttribute('href'),
          link,
          type: link.getAttribute('type'),
        }
      : { href: null, link: null, type: null };
    faviconLink = link || targetDocument.createElement('link');

    if (!link) {
      faviconLink.rel = 'icon';
      (targetDocument.head || targetDocument.documentElement).appendChild(faviconLink);
    }
  }

  function setFavicon(active: boolean): void {
    saveFavicon();

    if (!faviconLink) {
      return;
    }

    if (active) {
      faviconLink.setAttribute('href', GAME_START_FAVICON_HREF);
      faviconLink.setAttribute('type', 'image/svg+xml');
      postToTop({ action: 'favicon', active: true });
      return;
    }

    if (originalFavicon?.href) {
      faviconLink.setAttribute('href', originalFavicon.href);
    } else {
      faviconLink.removeAttribute('href');
    }

    if (originalFavicon?.type) {
      faviconLink.setAttribute('type', originalFavicon.type);
    } else {
      faviconLink.removeAttribute('type');
    }

    postToTop({ action: 'favicon', active: false });
  }

  function restoreFavicon(): void {
    if (!originalFavicon || !faviconLink) {
      return;
    }

    if (!originalFavicon.link) {
      faviconLink.remove();
    } else {
      setFavicon(false);
    }

    faviconLink = null;
    originalFavicon = null;
  }

  function getTitle(): string {
    return getIndicatorDocument().title || '';
  }

  function setTitle(title: string): void {
    getIndicatorDocument().title = title;
    postToTop({ action: 'title', title });
  }

  function postClear(): void {
    postToTop({ action: 'clear' });
  }

  return {
    getTitle,
    postClear,
    restoreFavicon,
    setFavicon,
    setTitle,
  };
}
