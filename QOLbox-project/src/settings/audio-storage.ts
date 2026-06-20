export const STEP_PERCENT = 5;
export const DEFAULT_GAME_PERCENT = 100;
export const DEFAULT_JUKEBOX_PERCENT = 50;

const GAME_VOLUME_KEY = 'vm.hitbox.volumePercent';
const JUKEBOX_STATE_KEY = 'vm.hitbox.jukeboxState';

export interface JukeboxState {
  muted: boolean;
  percent: number | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function clampPercent(value: unknown, fallback = 0): number {
  if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) {
    return fallback;
  }

  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return fallback;
  }

  return Math.max(0, Math.min(100, Math.round(numericValue / STEP_PERCENT) * STEP_PERCENT));
}

export function clampJukeboxPercent(value: unknown): number {
  if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) {
    return DEFAULT_JUKEBOX_PERCENT;
  }

  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return DEFAULT_JUKEBOX_PERCENT;
  }

  return Math.max(0, Math.min(100, Math.round(numericValue)));
}

export function loadGamePercent(): number {
  try {
    return clampPercent(localStorage.getItem(GAME_VOLUME_KEY), DEFAULT_GAME_PERCENT);
  } catch {
    return DEFAULT_GAME_PERCENT;
  }
}

export function saveGamePercent(percent: number): void {
  try {
    localStorage.setItem(GAME_VOLUME_KEY, String(percent));
  } catch {
    // Storage may be unavailable in privacy-restricted browser contexts.
  }
}

export function loadJukeboxState(): JukeboxState {
  const fallback: JukeboxState = { percent: null, muted: false };

  try {
    const rawState = localStorage.getItem(JUKEBOX_STATE_KEY);
    if (!rawState) {
      return fallback;
    }

    const parsed: unknown = JSON.parse(rawState);
    if (!isRecord(parsed)) {
      return fallback;
    }

    return {
      percent:
        parsed.percent !== null && parsed.percent !== undefined
          ? clampJukeboxPercent(parsed.percent)
          : null,
      muted: Boolean(parsed.muted),
    };
  } catch {
    return fallback;
  }
}

export function saveJukeboxState(state: JukeboxState): void {
  try {
    localStorage.setItem(JUKEBOX_STATE_KEY, JSON.stringify(state));
  } catch {
    // Storage may be unavailable in privacy-restricted browser contexts.
  }
}
