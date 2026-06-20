interface ReserveConnectingState {
  active?: boolean;
}

interface ReserveConnectingStateOptions {
  canAutoReserveCapturedJoin(): boolean;
  getNativeConnectingText(): string;
  getReserveNativeMessage(pattern: RegExp): string;
  getState(): ReserveConnectingState | null;
  hasSuccessfulJoinLayer(): boolean;
  hideNativeConnectingWindows(): void;
  isAutoJoinOnePersonRoom(): boolean;
  isEnabled(): boolean;
  isRoomFullSuppressed(): boolean;
  roomClosedPattern: RegExp;
  roomFullPattern: RegExp;
  scheduleReserveRetry(): void;
  showOnePersonUnavailable(): void;
  showTerminalMessage(reason: string, message: string): void;
  startReserveSpot(reason: string): void;
  stopAfterSuccessfulJoin(): void;
  stopReserveSpot(): void;
  wrongPasswordPattern: RegExp;
}

export function createReserveConnectingStateController(options: ReserveConnectingStateOptions) {
  function handleReserveConnectingState(): void {
    if (!options.isEnabled()) {
      if (options.getState()) {
        options.stopReserveSpot();
      }
      return;
    }

    const nativeText = options.getNativeConnectingText();

    if (
      options.isRoomFullSuppressed() &&
      options.hasSuccessfulJoinLayer() &&
      options.roomFullPattern.test(nativeText)
    ) {
      options.hideNativeConnectingWindows();
      return;
    }

    if (options.getState()?.active && options.hasSuccessfulJoinLayer()) {
      options.stopAfterSuccessfulJoin();
      return;
    }

    if (options.getState()?.active && options.roomClosedPattern.test(nativeText)) {
      options.stopReserveSpot();
      return;
    }

    if (options.getState()?.active && options.wrongPasswordPattern.test(nativeText)) {
      options.showTerminalMessage('wrong-password', options.getReserveNativeMessage(options.wrongPasswordPattern));
      return;
    }

    const canAutoReserve = options.canAutoReserveCapturedJoin();
    if (options.roomFullPattern.test(nativeText) && canAutoReserve) {
      if (options.isAutoJoinOnePersonRoom()) {
        options.showOnePersonUnavailable();
        options.hideNativeConnectingWindows();
        return;
      }

      options.startReserveSpot('room-full');
      options.scheduleReserveRetry();
    }
  }

  return {
    handleReserveConnectingState,
  };
}
