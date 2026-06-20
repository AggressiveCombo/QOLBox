import { emitReserveSocketJoinAttempt } from '../hitbox/reserve-socket-adapter';
import {
  cloneReserveJoinValue,
  getReserveJoinPayload,
  getReserveJoinPayloadJoinId,
  getReserveJoinPayloadPassword,
  type ReserveJoinPayload,
} from './reserve-join-payload';

export interface ReserveCapturedJoin {
  args: unknown[];
  autoReserve: boolean;
  eventName: unknown;
  socket: unknown;
  time: number;
}

interface ReserveActiveState {
  active?: boolean;
  capturedJoin?: ReserveCapturedJoin | null;
}

interface ReserveCapturedJoinOptions {
  capturedJoinFreshMs: number;
  getState(): ReserveActiveState | null;
  hasSuccessfulJoinLayer(): boolean;
  isEnabled(): boolean;
  isAutoJoinMatch(joinId: unknown, password: unknown): boolean;
  onCaptured(): void;
  suppressRetryAudio(): void;
}

function isAutoReserveJoin(payload: ReserveJoinPayload | null, options: ReserveCapturedJoinOptions): boolean {
  if (!payload) {
    return false;
  }

  return options.isAutoJoinMatch(getReserveJoinPayloadJoinId(payload), getReserveJoinPayloadPassword(payload));
}

export function createReserveCapturedJoinController(options: ReserveCapturedJoinOptions) {
  let capturedJoin: ReserveCapturedJoin | null = null;

  function clearReserveCapturedJoin(): void {
    capturedJoin = null;
  }

  function getReserveCapturedJoin(): ReserveCapturedJoin | null {
    return capturedJoin;
  }

  function getRetryCapturedJoin(): ReserveCapturedJoin | null {
    return options.getState()?.capturedJoin || capturedJoin;
  }

  function captureReserveJoin(socket: unknown, eventName: unknown, args: readonly unknown[]): void {
    if (!options.isEnabled()) {
      return;
    }

    const payload = getReserveJoinPayload(args);
    if (!payload) {
      return;
    }

    capturedJoin = {
      socket,
      eventName,
      args: args.map(cloneReserveJoinValue),
      autoReserve: isAutoReserveJoin(payload, options),
      time: Date.now(),
    };

    const state = options.getState();
    if (state?.active) {
      state.capturedJoin = capturedJoin;
    }

    options.onCaptured();
  }

  function shouldWatchRecentReserveCapture(): boolean {
    return Boolean(
      capturedJoin &&
        Date.now() - capturedJoin.time < options.capturedJoinFreshMs &&
        !options.hasSuccessfulJoinLayer()
    );
  }

  function canAutoReserveCapturedJoin(): boolean {
    return Boolean(options.getState()?.active || capturedJoin?.autoReserve);
  }

  function emitReserveJoinAttempt(): boolean {
    return emitReserveSocketJoinAttempt(getRetryCapturedJoin(), {
      beforeEmit: options.suppressRetryAudio,
      cloneValue: cloneReserveJoinValue,
    });
  }

  return {
    canAutoReserveCapturedJoin,
    captureReserveJoin,
    clearReserveCapturedJoin,
    emitReserveJoinAttempt,
    getReserveCapturedJoin,
    shouldWatchRecentReserveCapture,
  };
}
