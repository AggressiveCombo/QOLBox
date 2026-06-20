interface ReserveRoomFullSuppressionOptions {
  suppressMs: number;
}

export function createReserveRoomFullSuppression(options: ReserveRoomFullSuppressionOptions) {
  let suppressUntil = 0;

  function isReserveJoinedRoomFullSuppressed(): boolean {
    return Date.now() < suppressUntil;
  }

  function suppressReserveRoomFullAfterJoin(): void {
    suppressUntil = Date.now() + options.suppressMs;
  }

  return {
    isReserveJoinedRoomFullSuppressed,
    suppressReserveRoomFullAfterJoin,
  };
}
