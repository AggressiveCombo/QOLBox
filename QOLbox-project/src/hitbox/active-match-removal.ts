import { callNativeMethod, readNativePath, readNativeProperty } from './native-access';

const ACTIVE_MATCH_BLACKLIST_CLEANUP_DELAYS_MS = [0, 250, 750, 1500, 3000, 5000] as const;

function getActiveMatchRuntime(session: unknown): unknown | null {
  const runtime = readNativePath(session, ['KR']);
  return readNativeProperty(runtime, 'SL') ? runtime : null;
}

function getRuntimeFrame(runtime: unknown): number {
  const frame = Number(readNativeProperty(runtime, 'hD') ?? readNativeProperty(runtime, 'AI'));
  return Number.isFinite(frame) && frame >= 0 ? frame : 0;
}

export function removeActiveMatchPlayer(session: unknown, playerId: unknown): boolean {
  const runtime = getActiveMatchRuntime(session);
  if (!runtime || playerId === null || playerId === undefined) {
    return false;
  }

  const numericId = Number(playerId);
  const id = Number.isFinite(numericId) ? numericId : playerId;
  return callNativeMethod(runtime, 'OL', [id, getRuntimeFrame(runtime)]).called;
}

export function scheduleActiveMatchPlayerRemoval(session: unknown, playerId: unknown): void {
  if (!getActiveMatchRuntime(session) || playerId === null || playerId === undefined) {
    return;
  }

  for (const delay of ACTIVE_MATCH_BLACKLIST_CLEANUP_DELAYS_MS) {
    window.setTimeout(() => {
      removeActiveMatchPlayer(session, playerId);
    }, delay);
  }
}
