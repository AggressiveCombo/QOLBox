import {
  isNativeReflectTarget,
  readNativePath,
  readNativeProperty,
  setNativeReflectProperty,
} from '../hitbox/native-access';

let installed = false;
let selectionDecodeAllowedUntil = 0;
let patchedMapStatePrototype: object | null = null;
const MAX_AUTOMATIC_PREVIEW_BYTES = 50_000;

declare global {
  interface Window {
    __qolboxDeferredMapPreviews?: number;
    __qolboxSkippedLargeMapPreviews?: number;
  }
}

function isMapListOpen(): boolean {
  return Array.from(document.querySelectorAll('.mapListContainer'))
    .some(container => container.getClientRects().length > 0);
}

export function patchLargeMapPreviewDecode(): void {
  if (patchedMapStatePrototype || !isMapListOpen()) return;
  const currentMapState = readNativePath(window, ['multiplayerSession', 'TJ', 'JD', 'tP', 0, 'state']);
  if (!isNativeReflectTarget(currentMapState)) return;
  const prototype = Object.getPrototypeOf(currentMapState) as object | null;
  const nativeDecode = readNativeProperty(prototype, 'ac');
  if (!isNativeReflectTarget(prototype) || typeof nativeDecode !== 'function') return;

  const wrappedDecode = function (this: unknown, ...args: unknown[]): unknown {
    const encoded = args.find(value => typeof value === 'string');
    const isOversizedPreview =
      performance.now() > selectionDecodeAllowedUntil &&
      this !== currentMapState &&
      isMapListOpen() &&
      typeof encoded === 'string' &&
      encoded.length > MAX_AUTOMATIC_PREVIEW_BYTES;
    if (!isOversizedPreview) return Reflect.apply(nativeDecode, this, args);
    window.__qolboxSkippedLargeMapPreviews = (window.__qolboxSkippedLargeMapPreviews ?? 0) + 1;
    return undefined;
  };
  if (setNativeReflectProperty(prototype, 'ac', wrappedDecode)) patchedMapStatePrototype = prototype;
}

export function installMapListPreviewThrottling(): void {
  if (installed) return;
  installed = true;

  const nativeSetTimeout = window.setTimeout.bind(window);
  const nativeClearTimeout = window.clearTimeout.bind(window);
  const queuedPreviews: Array<() => void> = [];
  let drainTimer = 0;
  let pausedUntil = 0;

  const scheduleDrain = (delay = 16) => {
    if (drainTimer || !queuedPreviews.length) return;
    drainTimer = nativeSetTimeout(() => {
      drainTimer = 0;
      const remainingPause = pausedUntil - performance.now();
      if (remainingPause > 0) {
        scheduleDrain(remainingPause);
        return;
      }
      if (!isMapListOpen()) {
        queuedPreviews.length = 0;
        return;
      }
      const startedAt = performance.now();
      const preview = queuedPreviews.shift();
      if (!preview) return;
      try {
        preview();
      } finally {
        if (performance.now() - startedAt > 32) pausedUntil = performance.now() + 250;
        scheduleDrain();
      }
    }, delay);
  };

  document.addEventListener('wheel', event => {
    if (!(event.target instanceof Element) || !event.target.closest('.mapListContainer .mapsContainer')) return;
    pausedUntil = performance.now() + 250;
    if (drainTimer) nativeClearTimeout(drainTimer);
    drainTimer = 0;
    scheduleDrain(250);
  }, { capture: true, passive: true });

  document.addEventListener('click', event => {
    if (!(event.target instanceof Element) || !event.target.closest('.mapListContainer .mapsContainer > .element')) {
      return;
    }
    // Native map loading may decode after the click task. Keep the selected map
    // exempt long enough for its asynchronous load path to finish.
    selectionDecodeAllowedUntil = performance.now() + 5_000;
  }, true);

  window.setTimeout = ((callback: TimerHandler, delay?: number, ...args: unknown[]) => {
    const isMapPreview =
      typeof callback === 'function' &&
      delay === 1 &&
      /\.IC\(\)/.test(Function.prototype.toString.call(callback)) &&
      Boolean(document.querySelector('.mapListContainer .mapsContainer'));
    if (!isMapPreview) return nativeSetTimeout(callback, delay, ...args);

    window.__qolboxDeferredMapPreviews = (window.__qolboxDeferredMapPreviews ?? 0) + 1;
    return nativeSetTimeout(() => {
      queuedPreviews.push(() => Reflect.apply(callback, window, args));
      scheduleDrain();
    }, 0);
  }) as typeof window.setTimeout;
}
