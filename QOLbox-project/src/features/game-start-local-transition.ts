interface LocalPlayTransitionOptions {
  timeoutMs: number;
  getSession(): unknown;
}

export interface LocalPlayTransitionTracker {
  clear(): void;
  consume(session?: unknown): boolean;
  has(session?: unknown): boolean;
  note(session?: unknown): boolean;
}

export function createLocalPlayTransitionTracker(options: LocalPlayTransitionOptions): LocalPlayTransitionTracker {
  let localTransitionSession: unknown = null;
  let localTransitionUntil = 0;

  function clear(): void {
    localTransitionSession = null;
    localTransitionUntil = 0;
  }

  // Native state echoes do not identify who initiated a start/join transition.
  function note(session: unknown = options.getSession()): boolean {
    if (!session) {
      return false;
    }

    localTransitionSession = session;
    localTransitionUntil = Date.now() + options.timeoutMs;
    return true;
  }

  function has(session: unknown = options.getSession()): boolean {
    if (!localTransitionSession || Date.now() > localTransitionUntil) {
      clear();
      return false;
    }

    return localTransitionSession === session;
  }

  function consume(session: unknown = options.getSession()): boolean {
    if (!has(session)) {
      return false;
    }

    clear();
    return true;
  }

  return {
    clear,
    consume,
    has,
    note,
  };
}
