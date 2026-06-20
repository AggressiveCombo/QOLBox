interface ReserveStatusWatchTimerOptions {
  defaultDelayMs: number;
  onTick(): void;
  shouldContinue(): boolean;
}

export function createReserveStatusWatchTimer(options: ReserveStatusWatchTimerOptions) {
  let statusWatchTimer = 0;

  function clearReserveStatusWatchTimer(): void {
    if (statusWatchTimer) {
      window.clearTimeout(statusWatchTimer);
      statusWatchTimer = 0;
    }
  }

  function scheduleReserveStatusWatch(delay = options.defaultDelayMs): void {
    if (statusWatchTimer) {
      return;
    }

    statusWatchTimer = window.setTimeout(() => {
      statusWatchTimer = 0;
      options.onTick();

      if (options.shouldContinue()) {
        scheduleReserveStatusWatch(delay);
      }
    }, delay);
  }

  return {
    clearReserveStatusWatchTimer,
    scheduleReserveStatusWatch,
  };
}
