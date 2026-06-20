export interface GameStartTimerController {
  clearEndWatchTimer(): void;
  clearFlashTimer(): void;
  clearIndicatorTimer(): void;
  clearWatchTimer(): void;
  hasEndWatchTimer(): boolean;
  hasIndicatorTimer(): boolean;
  hasWatchTimer(): boolean;
  setEndWatchTimer(callback: () => void, delayMs: number): void;
  setFlashTimer(callback: () => void, delayMs: number): void;
  setIndicatorTimer(callback: () => void, delayMs: number): void;
  setWatchTimer(callback: () => void, delayMs: number): void;
}

export function createGameStartTimerController(): GameStartTimerController {
  let indicatorTimer = 0;
  let watchTimer = 0;
  let endWatchTimer = 0;
  let flashTimer = 0;

  function clearIndicatorTimer(): void {
    if (indicatorTimer) {
      window.clearTimeout(indicatorTimer);
      indicatorTimer = 0;
    }
  }

  function clearWatchTimer(): void {
    if (watchTimer) {
      window.clearTimeout(watchTimer);
      watchTimer = 0;
    }
  }

  function clearEndWatchTimer(): void {
    if (endWatchTimer) {
      window.clearTimeout(endWatchTimer);
      endWatchTimer = 0;
    }
  }

  function clearFlashTimer(): void {
    if (flashTimer) {
      window.clearTimeout(flashTimer);
      flashTimer = 0;
    }
  }

  function setIndicatorTimer(callback: () => void, delayMs: number): void {
    indicatorTimer = window.setTimeout(() => {
      indicatorTimer = 0;
      callback();
    }, delayMs);
  }

  function setWatchTimer(callback: () => void, delayMs: number): void {
    watchTimer = window.setTimeout(() => {
      watchTimer = 0;
      callback();
    }, delayMs);
  }

  function setEndWatchTimer(callback: () => void, delayMs: number): void {
    endWatchTimer = window.setTimeout(() => {
      endWatchTimer = 0;
      callback();
    }, delayMs);
  }

  function setFlashTimer(callback: () => void, delayMs: number): void {
    flashTimer = window.setTimeout(callback, delayMs);
  }

  function hasIndicatorTimer(): boolean {
    return Boolean(indicatorTimer);
  }

  function hasWatchTimer(): boolean {
    return Boolean(watchTimer);
  }

  function hasEndWatchTimer(): boolean {
    return Boolean(endWatchTimer);
  }

  return {
    clearEndWatchTimer,
    clearFlashTimer,
    clearIndicatorTimer,
    clearWatchTimer,
    hasEndWatchTimer,
    hasIndicatorTimer,
    hasWatchTimer,
    setEndWatchTimer,
    setFlashTimer,
    setIndicatorTimer,
    setWatchTimer,
  };
}
