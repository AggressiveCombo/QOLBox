interface ReserveRetryAudioSuppressionOptions {
  suppressMs: number;
}

export function createReserveRetryAudioSuppression(options: ReserveRetryAudioSuppressionOptions) {
  let suppressUntil = 0;

  function isReserveRetryAudioSuppressed(): boolean {
    return Date.now() < suppressUntil;
  }

  function suppressReserveRetryAudio(): void {
    suppressUntil = Date.now() + options.suppressMs;
  }

  return {
    isReserveRetryAudioSuppressed,
    suppressReserveRetryAudio,
  };
}
