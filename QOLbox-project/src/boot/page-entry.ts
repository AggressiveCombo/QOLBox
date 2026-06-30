import { IS_QOLBOX_GAME_PAGE } from '../config/qolbox-constants';
import { installTopLevelGameInputPassthrough, installTopLevelGameStartRelay } from '../features/top-level-page';

declare global {
  interface Window {
    __qolboxGamePageBootstrapInstalled?: boolean;
  }
}

export function shouldRunGamePageBootstrap(): boolean {
  if (IS_QOLBOX_GAME_PAGE) {
    if (window.__qolboxGamePageBootstrapInstalled) {
      return false;
    }

    window.__qolboxGamePageBootstrapInstalled = true;
    return true;
  }

  installTopLevelGameInputPassthrough();
  installTopLevelGameStartRelay();
  return false;
}
