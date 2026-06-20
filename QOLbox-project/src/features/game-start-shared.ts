export const GAME_START_TITLE_PREFIX = '[GAME STARTED] ';
export const GAME_PULLED_TITLE_PREFIX = '[PULLED INTO GAME] ';
export const GAME_START_TITLE_PREFIXES: readonly string[] = [GAME_START_TITLE_PREFIX, GAME_PULLED_TITLE_PREFIX];
export const GAME_START_FAVICON_HREF =
  'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2212%22 fill=%22%23f5c542%22/%3E%3Cpath d=%22M32 10 56 54H8Z%22 fill=%22%23111111%22/%3E%3Crect x=%2229%22 y=%2223%22 width=%226%22 height=%2217%22 rx=%223%22 fill=%22%23f5c542%22/%3E%3Ccircle cx=%2232%22 cy=%2247%22 r=%223%22 fill=%22%23f5c542%22/%3E%3C/svg%3E';

export function stripGameStartTitlePrefix(title: unknown): string {
  const value = String(title);
  for (const prefix of GAME_START_TITLE_PREFIXES) {
    if (value.startsWith(prefix)) {
      return value.slice(prefix.length);
    }
  }
  return value;
}
