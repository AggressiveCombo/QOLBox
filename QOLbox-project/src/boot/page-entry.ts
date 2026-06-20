import { IS_QOLBOX_GAME_PAGE } from '../config/qolbox-constants';
import { installTopLevelGameInputPassthrough, installTopLevelGameStartRelay } from '../features/top-level-page';

export function shouldRunGamePageBootstrap(): boolean {
  if (IS_QOLBOX_GAME_PAGE) {
    return true;
  }

  installTopLevelGameInputPassthrough();
  installTopLevelGameStartRelay();
  return false;
}
