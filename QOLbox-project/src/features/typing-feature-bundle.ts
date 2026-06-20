import {
  SCORE_ROW_FALLBACK_RGB,
  TEAM_SCORE_COLORS,
} from '../config/qolbox-constants';
import { getAdvancedTypingIndicatorDurationMs } from '../settings/advanced-settings';
import { getScorePlayers as getScorePlayersForSession } from '../hitbox/scoreboard-adapter';
import {
  getLocalPlayerId,
  getMultiplayerSession,
  getPlayerTeamState,
  getSessionPlayers,
  isSamePlayerId,
  isSessionMatchActive,
} from '../hitbox/session-adapter';
import { createScoreRowColorController } from './score-row-colors';
import { createTypingIndicatorController } from './typing-indicators';
import { createWorldTypingPositioner } from './world-typing-position';

interface BaseGameSize {
  height: number;
  width: number;
}

interface TypingFeatureBundleOptions {
  getActiveRenderCanvas(mode?: string): Element | null;
  getBaseGameSize(): BaseGameSize;
  isChatFeatureEnabled(): boolean;
  setImportantStyle(element: Element, property: string, value: string): void;
}

export function createTypingFeatureBundle(options: TypingFeatureBundleOptions) {
  const scoreRows = createScoreRowColorController({
    fallbackRgb: SCORE_ROW_FALLBACK_RGB,
    teamScoreColors: TEAM_SCORE_COLORS,
    getPlayerTeamState,
    getScorePlayers: () => getScorePlayersForSession(getMultiplayerSession()),
    setImportantStyle: options.setImportantStyle,
  });

  const { getWorldTypingPosition } = createWorldTypingPositioner({
    getActiveGameplayCanvas: () => options.getActiveRenderCanvas('gameplay'),
    getBaseGameSize: options.getBaseGameSize,
    getSession: getMultiplayerSession,
  });

  const typingIndicators = createTypingIndicatorController({
    getTimeoutMs: getAdvancedTypingIndicatorDurationMs,
    getLocalPlayerId,
    getSession: getMultiplayerSession,
    getSessionPlayers,
    getWorldTypingPosition,
    isChatFeatureEnabled: options.isChatFeatureEnabled,
    isSamePlayerId,
    isSessionMatchActive,
  });

  return {
    ...scoreRows,
    ...typingIndicators,
    getWorldTypingPosition,
  };
}
