interface GameStartFocusHookOptions {
  handleAway(): void;
  handleInteractionFocus(): void;
  handleReturn(): void;
  handleVisibilityChange(): void;
  initializeFocusState(): void;
}

export function createGameStartFocusHookInstaller({
  handleAway,
  handleInteractionFocus,
  handleReturn,
  handleVisibilityChange,
  initializeFocusState,
}: GameStartFocusHookOptions) {
  let hooksInstalled = false;

  function installGameStartIndicatorHooks(): void {
    if (hooksInstalled) {
      return;
    }

    hooksInstalled = true;
    initializeFocusState();

    document.addEventListener('pointerdown', handleInteractionFocus, true);
    document.addEventListener('mousedown', handleInteractionFocus, true);
    document.addEventListener('click', handleInteractionFocus, true);
    document.addEventListener('keydown', handleInteractionFocus, true);
    window.addEventListener('focus', handleReturn, true);
    window.addEventListener('blur', handleAway, true);
    document.addEventListener('visibilitychange', handleVisibilityChange, true);
  }

  return {
    installGameStartIndicatorHooks,
  };
}
