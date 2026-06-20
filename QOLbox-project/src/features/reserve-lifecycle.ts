import type { ReserveCapturedJoin } from './reserve-captured-join';
import type { ReserveRetryState } from './reserve-retry-scheduler';

export interface ReserveLifecycleState extends ReserveRetryState {
  active: boolean;
  capturedJoin?: ReserveCapturedJoin | null;
  lastStatusText?: string;
  message?: string;
  reason?: string;
  terminal?: boolean;
  unavailable?: boolean;
}

interface StopReserveOptions {
  clearCaptured?: boolean;
  clearSelection?: boolean;
  hideNative?: boolean;
}

interface ReserveLifecycleOptions {
  clearCapturedJoin(): void;
  clearCountdownTimer(): void;
  clearPasswordPromptPending(): void;
  clearRetryTimer(state?: ReserveRetryState | null): void;
  clearStatusWatchTimer(): void;
  clearVisibleRoomSelection(): void;
  getCapturedJoin(): ReserveCapturedJoin | null;
  hideNativeConnectingWindows(): void;
  isEnabled(): boolean;
  onePersonText: string;
  rememberSelectedRoom(row: unknown): Element | null;
  getRetryDelayMs(): number;
  scheduleCountdownUpdate(): void;
  scheduleStatusWatch(): void;
  setWaitingVisible(visible: boolean): void;
  statusFallbackText: string;
  suppressRoomFullAfterJoin(): void;
  syncJoinButtonLabel(): void;
  updateWaitingWindow(): void;
}

export function createReserveLifecycleController(options: ReserveLifecycleOptions) {
  let reserveState: ReserveLifecycleState | null = null;

  function getReserveState(): ReserveLifecycleState | null {
    return reserveState;
  }

  function startReserveSpot(reason: string): void {
    if (!options.isEnabled()) {
      return;
    }

    if (!reserveState?.active) {
      reserveState = {
        active: true,
        unavailable: false,
        reason,
        retryTimer: 0,
        nextRetryAt: Date.now() + options.getRetryDelayMs(),
        retries: 0,
        capturedJoin: options.getCapturedJoin(),
        lastStatusText: '',
      };
    } else {
      reserveState.reason = reserveState.reason || reason;
      reserveState.capturedJoin = reserveState.capturedJoin || options.getCapturedJoin();
      reserveState.nextRetryAt = reserveState.nextRetryAt || Date.now() + options.getRetryDelayMs();
      reserveState.unavailable = false;
    }

    options.updateWaitingWindow();
    options.setWaitingVisible(true);
    options.scheduleStatusWatch();
    options.scheduleCountdownUpdate();
  }

  function stopReserveSpot({ hideNative = false, clearCaptured = true, clearSelection = false }: StopReserveOptions = {}): void {
    options.clearRetryTimer(reserveState);
    options.clearStatusWatchTimer();
    options.clearCountdownTimer();

    if (clearCaptured) {
      options.clearCapturedJoin();
    }

    reserveState = null;
    options.clearPasswordPromptPending();
    options.setWaitingVisible(false);

    if (hideNative) {
      options.hideNativeConnectingWindows();
    }

    if (clearSelection) {
      options.clearVisibleRoomSelection();
    } else {
      options.syncJoinButtonLabel();
    }
  }

  function showReserveOnePersonUnavailable(row: unknown = null): void {
    if (!options.isEnabled()) {
      return;
    }

    if (row) {
      options.rememberSelectedRoom(row);
    }

    options.clearRetryTimer(reserveState);
    options.clearStatusWatchTimer();
    options.clearCountdownTimer();
    options.clearCapturedJoin();
    options.clearPasswordPromptPending();
    reserveState = {
      active: false,
      unavailable: true,
      reason: 'one-person-room',
      message: options.onePersonText,
    };

    options.updateWaitingWindow();
    options.setWaitingVisible(true);
    options.syncJoinButtonLabel();
  }

  function showReserveTerminalMessage(reason: string, message: string): void {
    if (!options.isEnabled()) {
      return;
    }

    options.clearRetryTimer(reserveState);
    options.clearStatusWatchTimer();
    options.clearCountdownTimer();
    options.clearCapturedJoin();
    options.clearPasswordPromptPending();
    reserveState = {
      active: false,
      unavailable: false,
      terminal: true,
      reason,
      message: message || options.statusFallbackText,
    };

    options.updateWaitingWindow();
    options.setWaitingVisible(true);
    options.hideNativeConnectingWindows();
    options.syncJoinButtonLabel();
  }

  function stopReserveAfterSuccessfulJoin(): void {
    options.suppressRoomFullAfterJoin();
    stopReserveSpot({ hideNative: true });
    options.scheduleStatusWatch();
  }

  return {
    getReserveState,
    showReserveOnePersonUnavailable,
    showReserveTerminalMessage,
    startReserveSpot,
    stopReserveAfterSuccessfulJoin,
    stopReserveSpot,
  };
}
