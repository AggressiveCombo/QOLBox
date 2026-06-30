export interface WorldTypingPosition {
  left: number;
  top: number;
}

export interface WorldTypingPlayer {
  id: unknown;
}

interface WorldTypingIndicatorOptions<TypingPlayer extends WorldTypingPlayer> {
  fallbackUpdateDelayMs: number;
  getSession(): unknown;
  getTypingPlayers(session?: unknown): readonly TypingPlayer[];
  getWorldTypingPosition(playerId: unknown, session?: unknown): WorldTypingPosition | null;
  isChatFeatureEnabled(): boolean;
  isSessionMatchActive(session?: unknown): boolean;
}

function ensureWorldTypingLayer(): HTMLElement | null {
  if (!document.body) {
    return null;
  }

  const existingLayer = document.querySelector<HTMLElement>('.qolboxWorldTypingLayer');
  if (existingLayer) {
    return existingLayer;
  }

  const layer = document.createElement('div');
  layer.className = 'qolboxWorldTypingLayer';
  layer.setAttribute('aria-hidden', 'true');
  document.body.appendChild(layer);
  return layer;
}

export function createWorldTypingIndicatorController<TypingPlayer extends WorldTypingPlayer>(
  options: WorldTypingIndicatorOptions<TypingPlayer>
) {
  let typingIndicatorPositionRaf = 0;

  function stopTypingIndicatorPositionLoop(): void {
    if (!typingIndicatorPositionRaf) {
      return;
    }

    if (typeof window.cancelAnimationFrame === 'function') {
      window.cancelAnimationFrame(typingIndicatorPositionRaf);
    } else {
      window.clearTimeout(typingIndicatorPositionRaf);
    }

    typingIndicatorPositionRaf = 0;
  }

  function syncWorldTypingIndicators(
    typingPlayers: readonly TypingPlayer[],
    session: unknown = options.getSession()
  ): boolean {
    const shouldShowWorldIndicators =
      options.isChatFeatureEnabled() && options.isSessionMatchActive(session) && typingPlayers.length > 0;
    const existingLayer = document.querySelector('.qolboxWorldTypingLayer');

    if (!shouldShowWorldIndicators) {
      if (existingLayer) {
        existingLayer.remove();
        return true;
      }
      return false;
    }

    const layer = ensureWorldTypingLayer();
    if (!layer) {
      return false;
    }

    const activeIds = new Set<string>();
    let changed = false;

    for (const player of typingPlayers) {
      const position = options.getWorldTypingPosition(player.id, session);
      if (!position) {
        continue;
      }

      const id = String(player.id);
      activeIds.add(id);
      let indicator = Array.from(layer.querySelectorAll<HTMLElement>('.qolboxWorldTypingIndicator')).find(
        element => element.dataset.playerId === id
      );
      if (!indicator) {
        indicator = document.createElement('span');
        indicator.className = 'qolboxWorldTypingIndicator';
        indicator.dataset.playerId = id;
        indicator.setAttribute('aria-label', 'typing');
        layer.appendChild(indicator);
        changed = true;
      }

      const left = `${Math.round(position.left)}px`;
      const top = `${Math.round(position.top)}px`;
      if (indicator.style.left !== left) {
        indicator.style.left = left;
      }
      if (indicator.style.top !== top) {
        indicator.style.top = top;
      }
    }

    for (const indicator of Array.from(layer.querySelectorAll<HTMLElement>('.qolboxWorldTypingIndicator'))) {
      if (!activeIds.has(indicator.dataset.playerId || '')) {
        indicator.remove();
        changed = true;
      }
    }

    if (!activeIds.size && layer.children.length === 0) {
      layer.remove();
      changed = true;
    }

    return changed;
  }

  function scheduleTypingIndicatorPositionLoop(session: unknown = options.getSession()): void {
    if (typingIndicatorPositionRaf || !options.isSessionMatchActive(session)) {
      return;
    }

    const updateTypingIndicatorPositions = () => {
      typingIndicatorPositionRaf = 0;

      if (!options.isChatFeatureEnabled() || !options.isSessionMatchActive()) {
        syncWorldTypingIndicators([], options.getSession());
        return;
      }

      const typingPlayers = options.getTypingPlayers();
      syncWorldTypingIndicators(typingPlayers);

      if (typingPlayers.length > 0) {
        scheduleTypingIndicatorPositionLoop();
      }
    };

    typingIndicatorPositionRaf =
      typeof window.requestAnimationFrame === 'function'
        ? window.requestAnimationFrame(updateTypingIndicatorPositions)
        : window.setTimeout(updateTypingIndicatorPositions, options.fallbackUpdateDelayMs);
  }

  function clearWorldTypingIndicators(): void {
    stopTypingIndicatorPositionLoop();

    const worldLayer = document.querySelector('.qolboxWorldTypingLayer');
    if (worldLayer) {
      worldLayer.remove();
    }
  }

  return {
    clearWorldTypingIndicators,
    scheduleTypingIndicatorPositionLoop,
    stopTypingIndicatorPositionLoop,
    syncWorldTypingIndicators,
  };
}
