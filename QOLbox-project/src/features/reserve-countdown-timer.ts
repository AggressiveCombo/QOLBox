interface ReserveCountdownState {
  active?: boolean;
}

interface ReserveCountdownTimerOptions {
  getState(): ReserveCountdownState | null;
  intervalMs: number;
  onTick(): void;
}

export function createReserveCountdownTimer(options: ReserveCountdownTimerOptions) {
  let countdownTimer = 0;

  function clearReserveCountdownTimer(): void {
    if (countdownTimer) {
      window.clearTimeout(countdownTimer);
      countdownTimer = 0;
    }
  }

  function scheduleReserveCountdownUpdate(): void {
    if (countdownTimer || !options.getState()?.active) {
      return;
    }

    countdownTimer = window.setTimeout(() => {
      countdownTimer = 0;

      if (!options.getState()?.active) {
        return;
      }

      options.onTick();
      scheduleReserveCountdownUpdate();
    }, options.intervalMs);
  }

  return {
    clearReserveCountdownTimer,
    scheduleReserveCountdownUpdate,
  };
}
