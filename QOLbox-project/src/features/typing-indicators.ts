import { installNativeTypingPulseHook, isNativeTypingPulseHookInstalled } from '../hitbox/typing-pulse-adapter';
import { getPlayerDisplayName } from '../hitbox/player-appearance-adapter';
import { normalizeScoreName } from './score-row-colors';
import { createTypingExpirationTracker } from './typing-expiration-tracker';
import { clearScoreTypingIndicators, syncScoreTypingIndicators } from './typing-score-indicators';
import {
  createWorldTypingIndicatorController,
  type WorldTypingPosition,
} from './typing-world-indicators';

interface SessionPlayerEntry {
  id: unknown;
  player: unknown;
}

interface TypingPlayer {
  id: unknown;
  name: string;
}

interface TypingIndicatorOptions {
  getTimeoutMs(): number;
  getLocalPlayerId(session?: unknown): unknown;
  getSession(): unknown;
  getSessionPlayers(session?: unknown): readonly SessionPlayerEntry[];
  getWorldTypingPosition(playerId: unknown, session?: unknown): WorldTypingPosition | null;
  isChatFeatureEnabled(): boolean;
  isSamePlayerId(left: unknown, right: unknown): boolean;
  isSessionMatchActive(session?: unknown): boolean;
}

export function createTypingIndicatorController(options: TypingIndicatorOptions) {
  let typingIndicatorSession: unknown = null;
  const typingExpirations = createTypingExpirationTracker({
    getTimeoutMs: options.getTimeoutMs,
    onExpire: () => syncTypingIndicators(),
  });
  const worldTypingIndicators = createWorldTypingIndicatorController<TypingPlayer>({
    fallbackUpdateDelayMs: 100,
    getSession: options.getSession,
    getTypingPlayers: getTypingPlayers,
    getWorldTypingPosition: options.getWorldTypingPosition,
    isChatFeatureEnabled: options.isChatFeatureEnabled,
    isSessionMatchActive: options.isSessionMatchActive,
  });

  function clearTypingIndicators(): void {
    worldTypingIndicators.clearWorldTypingIndicators();
    typingExpirations.clear();
    clearScoreTypingIndicators();
  }

  function isPlayerTypingNow(playerId: unknown): boolean {
    return typingExpirations.isTyping(playerId);
  }

  function getTypingPlayers(session: unknown = options.getSession()): TypingPlayer[] {
    const localPlayerId = options.getLocalPlayerId(session);
    return options
      .getSessionPlayers(session)
      .filter(({ id }) => !options.isSamePlayerId(id, localPlayerId) && isPlayerTypingNow(id))
      .map(({ id, player }) => ({
        id,
        name: normalizeScoreName(getPlayerDisplayName(player)),
      }));
  }

  function syncWorldTypingIndicators(
    typingPlayers: readonly TypingPlayer[],
    session: unknown = options.getSession()
  ): boolean {
    return worldTypingIndicators.syncWorldTypingIndicators(typingPlayers, session);
  }

  function scheduleTypingIndicatorPositionLoop(session: unknown = options.getSession()): void {
    worldTypingIndicators.scheduleTypingIndicatorPositionLoop(session);
  }

  function syncTypingIndicators(scorePanel: Element | null = null): boolean {
    const session = options.getSession();
    if (!session) {
      worldTypingIndicators.stopTypingIndicatorPositionLoop();
      return false;
    }

    const typingPlayers = getTypingPlayers(session);
    let changed = syncScoreTypingIndicators(scorePanel, typingPlayers);

    changed = syncWorldTypingIndicators(typingPlayers, session) || changed;

    if (typingPlayers.length > 0 && options.isSessionMatchActive(session)) {
      scheduleTypingIndicatorPositionLoop(session);
    } else {
      worldTypingIndicators.stopTypingIndicatorPositionLoop();
    }

    return changed;
  }

  function notePlayerTyping(playerId: unknown): boolean {
    if (playerId === null || playerId === undefined) {
      return false;
    }

    if (options.isSamePlayerId(playerId, options.getLocalPlayerId())) {
      return false;
    }

    typingExpirations.note(playerId);
    syncTypingIndicators();
    return true;
  }

  function patchTypingIndicatorHooks(): boolean {
    const session = options.getSession();
    if (isNativeTypingPulseHookInstalled(session)) {
      return true;
    }

    if (typingIndicatorSession && typingIndicatorSession !== session) {
      clearTypingIndicators();
    }

    const installed = installNativeTypingPulseHook(session, notePlayerTyping);
    if (installed) {
      typingIndicatorSession = session;
    }
    return installed;
  }

  return {
    clearTypingIndicators,
    notePlayerTyping,
    patchTypingIndicatorHooks,
    syncTypingIndicators,
    syncWorldTypingIndicators,
  };
}
