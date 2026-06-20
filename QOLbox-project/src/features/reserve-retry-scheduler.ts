export interface ReserveRetryState {
  active?: boolean;
  nextRetryAt?: number;
  retries?: number;
  retryTimer?: number;
}

interface ReserveRetrySchedulerOptions {
  emitJoinAttempt(): boolean;
  getState(): ReserveRetryState | null;
  hasSuccessfulJoinLayer(): boolean;
  isEnabled(): boolean;
  onSuccessfulJoin(): void;
  getRetryDelayMs(): number;
  scheduleCountdownUpdate(): void;
  updateWaitingWindow(): void;
}

export function createReserveRetryScheduler(options: ReserveRetrySchedulerOptions) {
  function clearReserveRetryTimer(state = options.getState()): void {
    if (state?.retryTimer) {
      window.clearTimeout(state.retryTimer);
      state.retryTimer = 0;
    }
  }

  function scheduleReserveRetry(): void {
    const state = options.getState();
    if (!options.isEnabled() || !state?.active || state.retryTimer) {
      return;
    }

    const retryDelayMs = options.getRetryDelayMs();
    state.nextRetryAt = Date.now() + retryDelayMs;
    options.updateWaitingWindow();
    options.scheduleCountdownUpdate();

    state.retryTimer = window.setTimeout(() => {
      const currentState = options.getState();
      if (!currentState?.active) {
        return;
      }

      currentState.retryTimer = 0;
      currentState.nextRetryAt = 0;
      options.updateWaitingWindow();

      if (options.hasSuccessfulJoinLayer()) {
        options.onSuccessfulJoin();
        return;
      }

      if (options.emitJoinAttempt()) {
        currentState.retries = (currentState.retries || 0) + 1;
      }

      scheduleReserveRetry();
    }, retryDelayMs);
  }

  return {
    clearReserveRetryTimer,
    scheduleReserveRetry,
  };
}
