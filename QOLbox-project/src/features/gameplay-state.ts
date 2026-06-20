interface GameplayStateOptions {
  gameplayLayerSelector: string;
  lobbyLayerSelector: string;
  menuLayerSelector: string;
  playLayerSelector: string;
  spectateControlsSelector: string;
  getPlayerTeamState(player: unknown): number;
  getSession(): unknown;
  getSessionPlayer(session: unknown): unknown;
  hasVisibleLayer(selector: string): boolean;
  isSessionLobbyActive(session: unknown): boolean;
  isSessionMatchActive(session: unknown): boolean;
}

export function createGameplayStateController(options: GameplayStateOptions) {
  function hasReserveSuccessfulJoinLayer(): boolean {
    return options.hasVisibleLayer(options.lobbyLayerSelector) || options.hasVisibleLayer(options.gameplayLayerSelector);
  }

  function isMenuGameplayOverlap(): boolean {
    return options.hasVisibleLayer(options.menuLayerSelector) && options.hasVisibleLayer(options.playLayerSelector);
  }

  function isPageFocused(): boolean {
    return !document.hidden && (!document.hasFocus || document.hasFocus());
  }

  function isCurrentPlayerSpectating(session: unknown = options.getSession()): boolean {
    const player = options.getSessionPlayer(session);
    const team = options.getPlayerTeamState(player);
    if (Number.isFinite(team)) {
      return team === 0;
    }

    return options.hasVisibleLayer(options.spectateControlsSelector);
  }

  function isPlayableLobby(): boolean {
    const session = options.getSession();

    if (options.isSessionMatchActive(session)) {
      return false;
    }

    if (options.isSessionLobbyActive(session)) {
      return !isCurrentPlayerSpectating(session);
    }

    return (
      options.hasVisibleLayer(options.lobbyLayerSelector) &&
      !options.hasVisibleLayer(options.spectateControlsSelector)
    );
  }

  function isPlayingMatch(): boolean {
    const session = options.getSession();

    if (options.isSessionMatchActive(session)) {
      return !isCurrentPlayerSpectating(session);
    }

    return (
      options.hasVisibleLayer(options.gameplayLayerSelector) &&
      !options.hasVisibleLayer(options.spectateControlsSelector)
    );
  }

  return {
    hasReserveSuccessfulJoinLayer,
    isCurrentPlayerSpectating,
    isMenuGameplayOverlap,
    isPageFocused,
    isPlayableLobby,
    isPlayingMatch,
  };
}
