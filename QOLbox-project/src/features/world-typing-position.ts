import { isElementVisible } from '../dom/dom-helpers';
import {
  getPlayerWorldEntityPosition,
  getWorldCameraState,
  type WorldEntityPosition,
} from '../hitbox/world-state-adapter';

interface BaseGameSize {
  width: number;
  height: number;
}

interface WorldTypingPositionOptions {
  getActiveGameplayCanvas(): Element | null;
  getBaseGameSize(): BaseGameSize;
  getSession(): unknown;
}

export function createWorldTypingPositioner(options: WorldTypingPositionOptions) {
  function getPlayerWorldEntity(playerId: unknown, session: unknown = options.getSession()): WorldEntityPosition | null {
    return getPlayerWorldEntityPosition(playerId, session);
  }

  function getWorldTypingViewport(session: unknown = options.getSession()) {
    const canvas = options.getActiveGameplayCanvas();
    if (!canvas || !isElementVisible(canvas)) {
      return null;
    }

    const rect = canvas.getBoundingClientRect();
    const camera = getWorldCameraState(session);
    const baseGameSize = options.getBaseGameSize();

    return {
      rect,
      worldLeft: Number.isFinite(camera.left) ? camera.left : 0,
      worldTop: Number.isFinite(camera.top) && camera.top >= 0 ? camera.top : 0,
      worldWidth: Number.isFinite(camera.width) && camera.width > 0 ? camera.width : baseGameSize.width,
      worldHeight:
        Number.isFinite(camera.height) && camera.height > 0
          ? camera.height
          : (Number.isFinite(camera.width) && camera.width > 0 ? camera.width : baseGameSize.width) * (rect.height / rect.width),
    };
  }

  function getWorldTypingPosition(playerId: unknown, session: unknown = options.getSession()): { left: number; top: number } | null {
    const entity = getPlayerWorldEntity(playerId, session);
    const viewport = getWorldTypingViewport(session);
    if (!entity || !viewport) {
      return null;
    }

    const { rect, worldLeft, worldTop, worldWidth, worldHeight } = viewport;
    const rectRight = Number.isFinite(rect.right) ? rect.right : rect.left + rect.width;
    const rectBottom = Number.isFinite(rect.bottom) ? rect.bottom : rect.top + rect.height;
    const x = rect.left + ((entity.x - worldLeft) / worldWidth) * rect.width;
    const y = rect.top + ((entity.y - worldTop) / worldHeight) * rect.height - 42;

    return {
      left: Math.max(rect.left + 11, Math.min(rectRight - 11, x)),
      top: Math.max(rect.top + 18, Math.min(rectBottom - 6, y)),
    };
  }

  return {
    getPlayerWorldEntity,
    getWorldTypingPosition,
    getWorldTypingViewport,
  };
}
