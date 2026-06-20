interface TypingExpirationTrackerOptions {
  getTimeoutMs(): number;
  onExpire(): void;
}

export function createTypingExpirationTracker(options: TypingExpirationTrackerOptions) {
  const timers = new Map<string, number>();
  const expirations = new Map<string, number>();

  function clear(): void {
    for (const timer of timers.values()) {
      window.clearTimeout(timer);
    }

    timers.clear();
    expirations.clear();
  }

  function isTyping(playerId: unknown): boolean {
    const id = String(playerId);
    const expiresAt = expirations.get(id);
    if (!expiresAt) {
      return false;
    }

    if (expiresAt <= Date.now()) {
      expirations.delete(id);
      return false;
    }

    return true;
  }

  function note(playerId: unknown): boolean {
    if (playerId === null || playerId === undefined) {
      return false;
    }

    const id = String(playerId);
    const timeoutMs = options.getTimeoutMs();
    const expiresAt = Date.now() + timeoutMs;
    const existingTimer = timers.get(id);
    if (existingTimer) {
      window.clearTimeout(existingTimer);
    }

    expirations.set(id, expiresAt);
    timers.set(
      id,
      window.setTimeout(() => {
        if ((expirations.get(id) || 0) <= Date.now()) {
          expirations.delete(id);
          timers.delete(id);
          options.onExpire();
        }
      }, timeoutMs + 50)
    );

    return true;
  }

  return {
    clear,
    isTyping,
    note,
  };
}
