import {
  DEFAULT_JUKEBOX_PERCENT,
  clampJukeboxPercent,
  loadJukeboxState,
  saveJukeboxState,
  type JukeboxState,
} from '../settings/audio-storage';

interface JukeboxStatePatch {
  muted?: boolean;
  percent?: number | null;
}

export interface JukeboxStateController {
  ensurePercent(readPercent: () => number | null): void;
  getEffectivePercent(): number;
  getMenuLabel(): string;
  getPercent(): number | null;
  getState(): JukeboxState;
  isMuted(): boolean;
  setPercent(nextPercent: number): void;
  setState(nextState: JukeboxStatePatch): void;
  toggleMuted(): void;
  unmuteIfMuted(): boolean;
}

export function createJukeboxStateController(): JukeboxStateController {
  let state = loadJukeboxState();

  function persistState(): void {
    saveJukeboxState(state);
  }

  function getEffectivePercent(): number {
    return clampJukeboxPercent(state.percent ?? DEFAULT_JUKEBOX_PERCENT);
  }

  function ensurePercent(readPercent: () => number | null): void {
    if (state.percent !== null) {
      return;
    }

    state.percent = readPercent() ?? DEFAULT_JUKEBOX_PERCENT;
    persistState();
  }

  function setPercent(nextPercent: number): void {
    state.percent = clampJukeboxPercent(nextPercent);
    state.muted = false;
    persistState();
  }

  function toggleMuted(): void {
    state.muted = !state.muted;
    persistState();
  }

  function unmuteIfMuted(): boolean {
    if (!state.muted) {
      return false;
    }

    state.muted = false;
    persistState();
    return true;
  }

  function setState(nextState: JukeboxStatePatch): void {
    state = {
      muted: Boolean(nextState.muted),
      percent: nextState.percent ?? null,
    };
  }

  function getState(): JukeboxState {
    return state;
  }

  function getPercent(): number | null {
    return state.percent;
  }

  function isMuted(): boolean {
    return state.muted;
  }

  function getMenuLabel(): string {
    return state.muted ? 'Unmute Jukebox' : 'Mute Jukebox';
  }

  return {
    ensurePercent,
    getEffectivePercent,
    getMenuLabel,
    getPercent,
    getState,
    isMuted,
    setPercent,
    setState,
    toggleMuted,
    unmuteIfMuted,
  };
}
