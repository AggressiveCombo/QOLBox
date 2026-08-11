import { isRecord } from '../utils/object-properties';
import { getLocalStorageItem, setLocalStorageItem } from '../utils/local-storage';

export const STEP_PERCENT = 5;
export const DEFAULT_GAME_PERCENT = 100;
export const DEFAULT_JUKEBOX_PERCENT = 50;

const GAME_VOLUME_KEY = 'vm.hitbox.volumePercent';
const JUKEBOX_STATE_KEY = 'vm.hitbox.jukeboxState';

export interface JukeboxState {
  muted: boolean;
  percent: number | null;
}

export function clampPercent(value: unknown, fallback = 0): number {
  if (value === null || value === undefined || (typeof value === 'string' && value.trim() === '')) {
    return fallback;
  }

  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    return fallback;
  }

  return Math.max(0, Math.min(100, Math.round(numericValue)));
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
  return clampPercent(getLocalStorageItem(GAME_VOLUME_KEY), DEFAULT_GAME_PERCENT);
}

export function saveGamePercent(percent: number): void {
  setLocalStorageItem(GAME_VOLUME_KEY, String(percent));
}

export function loadJukeboxState(): JukeboxState {
  const fallback: JukeboxState = { percent: null, muted: false };

  try {
    const rawState = getLocalStorageItem(JUKEBOX_STATE_KEY);
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
      muted: parsed.muted === true,
    };
  } catch {
    return fallback;
  }
}

export function saveJukeboxState(state: JukeboxState): void {
  setLocalStorageItem(JUKEBOX_STATE_KEY, JSON.stringify(state));
}
