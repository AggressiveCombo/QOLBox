interface ReserveFeaturePatchState {
  active?: boolean;
}

interface ReserveFeaturePatchOptions {
  getState(): ReserveFeaturePatchState | null;
  handleConnectingState(): void;
  installDomEventHooks(): void;
  installSocketCaptureHook(): void;
  isEnabled(): boolean;
  isRoomFullSuppressed(): boolean;
  shouldWatchRecentCapture(): boolean;
  syncJoinButtonLabel(): void;
  syncPasswordPrompt(): void;
}

export function createReserveFeaturePatchController(options: ReserveFeaturePatchOptions) {
  function shouldContinueReserveStatusWatch(): boolean {
    if (options.getState()?.active) {
      return true;
    }

    if (options.isRoomFullSuppressed()) {
      return true;
    }

    return options.shouldWatchRecentCapture();
  }

  function patchReserveSpotFeature(): void {
    if (!options.isEnabled()) {
      options.syncJoinButtonLabel();
      return;
    }

    options.installSocketCaptureHook();
    options.syncJoinButtonLabel();
    options.syncPasswordPrompt();
    options.handleConnectingState();

    options.installDomEventHooks();
  }

  return {
    patchReserveSpotFeature,
    shouldContinueReserveStatusWatch,
  };
}
