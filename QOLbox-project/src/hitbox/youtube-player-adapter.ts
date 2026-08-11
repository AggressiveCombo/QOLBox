import { readObjectProperty, setObjectProperty } from '../utils/object-properties';
import {
  isConstructableCallable,
  isNativeCallable,
  readBooleanProperty,
} from './youtube-player-native';
import { wrapYouTubePlayerOptions } from './youtube-player-options-wrapper';

interface YouTubeJukeboxAdapterOptions {
  getVolume(): number;
  isEnabled(): boolean;
  isMuted(): boolean;
  maxRetries: number;
  onPlayerStateNeeded(): void;
  retryDelayMs: number;
}

export function createYouTubeJukeboxAdapter(options: YouTubeJukeboxAdapterOptions) {
  const trackedPlayers = new Set<unknown>();
  const originalPlayerStates = new Map<unknown, { muted: boolean | null; volume: number | null }>();
  let hookInstalled = false;
  let playerStateApplied = false;
  let retryTimer = 0;
  let retryCount = 0;
  let readyCallbackHookInstalled = false;

  function trackPlayer(player: unknown): void {
    if (!player || !isNativeCallable(readObjectProperty(player, 'setVolume'))) {
      return;
    }

    trackedPlayers.add(player);
  }

  function discoverPlayers(): void {
    const yt = readObjectProperty(window, 'YT');
    const getPlayer = readObjectProperty(yt, 'get');
    if (!isNativeCallable(getPlayer)) {
      return;
    }

    for (const candidate of document.querySelectorAll('#ytContainer [id], #ytContainer iframe[id]')) {
      if (!candidate.id) {
        continue;
      }

      try {
        const player = Reflect.apply(getPlayer, yt, [candidate.id]);
        trackPlayer(player);
      } catch {
        // Ignore unresolved ids.
      }
    }
  }

  function applyPlayerState(player: unknown): void {
    if (!options.isEnabled()) {
      return;
    }

    const setVolume = readObjectProperty(player, 'setVolume');
    if (!player || !isNativeCallable(setVolume)) {
      trackedPlayers.delete(player);
      return;
    }

    try {
      const setPlaybackRate = readObjectProperty(player, 'setPlaybackRate');
      const getPlaybackRate = readObjectProperty(player, 'getPlaybackRate');
      const playbackRate =
        isNativeCallable(getPlaybackRate) ? Reflect.apply(getPlaybackRate, player, []) : null;
      if (isNativeCallable(setPlaybackRate) && playbackRate !== 1) {
        Reflect.apply(setPlaybackRate, player, [1]);
      }

      const getVolume = readObjectProperty(player, 'getVolume');
      const getMuted = readObjectProperty(player, 'isMuted');
      const currentVolume = isNativeCallable(getVolume) ? Reflect.apply(getVolume, player, []) : null;
      const currentlyMuted = isNativeCallable(getMuted) ? Reflect.apply(getMuted, player, []) : null;
      if (!originalPlayerStates.has(player)) {
        originalPlayerStates.set(player, {
          muted: typeof currentlyMuted === 'boolean' ? currentlyMuted : null,
          volume: typeof currentVolume === 'number' && Number.isFinite(currentVolume) ? currentVolume : null,
        });
      }
      if (options.isMuted()) {
        if (currentVolume !== 0) {
          Reflect.apply(setVolume, player, [0]);
        }
        const mute = readObjectProperty(player, 'mute');
        if (isNativeCallable(mute) && currentlyMuted !== true) {
          Reflect.apply(mute, player, []);
        }
      } else {
        const targetVolume = options.getVolume();
        if (currentVolume !== targetVolume) {
          Reflect.apply(setVolume, player, [targetVolume]);
        }
        const unMute = readObjectProperty(player, 'unMute');
        if (isNativeCallable(unMute) && currentlyMuted === true) {
          Reflect.apply(unMute, player, []);
        }
      }
      playerStateApplied = true;
    } catch {
      trackedPlayers.delete(player);
      originalPlayerStates.delete(player);
    }
  }

  function applyToTrackedPlayers(): void {
    if (!options.isEnabled()) {
      return;
    }

    discoverPlayers();
    for (const player of Array.from(trackedPlayers)) {
      applyPlayerState(player);
    }
  }

  function restoreTrackedPlayers(): void {
    if (!playerStateApplied) {
      return;
    }

    for (const player of Array.from(trackedPlayers)) {
      const setVolume = readObjectProperty(player, 'setVolume');
      if (!player || !isNativeCallable(setVolume)) {
        trackedPlayers.delete(player);
        originalPlayerStates.delete(player);
        continue;
      }

      try {
        const originalState = originalPlayerStates.get(player);
        if (typeof originalState?.volume === 'number') {
          Reflect.apply(setVolume, player, [originalState.volume]);
        }
        const muteMethod = readObjectProperty(player, originalState?.muted ? 'mute' : 'unMute');
        if (originalState?.muted !== null && originalState?.muted !== undefined && isNativeCallable(muteMethod)) {
          Reflect.apply(muteMethod, player, []);
        }
      } catch {
        trackedPlayers.delete(player);
      }
    }
    originalPlayerStates.clear();
    trackedPlayers.clear();
    playerStateApplied = false;
  }

  function scheduleRetry(): void {
    if (!options.isEnabled() || hookInstalled || retryTimer || retryCount >= options.maxRetries) {
      return;
    }

    retryCount += 1;
    retryTimer = window.setTimeout(() => {
      retryTimer = 0;
      hookPlayerConstructor();
      options.onPlayerStateNeeded();
    }, options.retryDelayMs);
  }

  function wrapReadyCallback(callback: unknown): unknown {
    if (!isNativeCallable(callback) || readBooleanProperty(callback, '__qolboxWrapped')) {
      return callback;
    }

    const nativeCallback = callback;
    function wrappedYouTubeReadyCallback(this: unknown, ...args: unknown[]): unknown {
      if (options.isEnabled()) {
        hookPlayerConstructor();
        options.onPlayerStateNeeded();
      }
      try {
        return Reflect.apply(nativeCallback, this, args);
      } finally {
        if (options.isEnabled()) {
          hookPlayerConstructor();
          window.setTimeout(options.onPlayerStateNeeded, 0);
        }
      }
    }

    setObjectProperty(wrappedYouTubeReadyCallback, '__qolboxWrapped', true);
    setObjectProperty(wrappedYouTubeReadyCallback, '__qolboxOriginal', callback);
    return wrappedYouTubeReadyCallback;
  }

  function installReadyCallbackHook(): void {
    if (!options.isEnabled() || readyCallbackHookInstalled) {
      return;
    }

    const descriptor = Object.getOwnPropertyDescriptor(window, 'onYouTubeIframeAPIReady');
    if (descriptor && (!descriptor.configurable || descriptor.get || descriptor.set)) {
      return;
    }

    readyCallbackHookInstalled = true;
    let readyCallback = wrapReadyCallback(
      descriptor ? descriptor.value : readObjectProperty(window, 'onYouTubeIframeAPIReady')
    );

    try {
      Object.defineProperty(window, 'onYouTubeIframeAPIReady', {
        configurable: true,
        enumerable: true,
        get() {
          return readyCallback;
        },
        set(value) {
          readyCallback = wrapReadyCallback(value);
        },
      });
    } catch {
      readyCallbackHookInstalled = false;
    }
  }

  function hookPlayerConstructor(): boolean {
    if (!options.isEnabled()) {
      return false;
    }

    installReadyCallbackHook();

    const yt = readObjectProperty(window, 'YT');
    const playerConstructor = readObjectProperty(yt, 'Player');
    if (!isConstructableCallable(playerConstructor)) {
      scheduleRetry();
      return false;
    }

    if (retryTimer) {
      window.clearTimeout(retryTimer);
      retryTimer = 0;
    }
    if (hookInstalled || readBooleanProperty(playerConstructor, '__qolboxWrapped')) {
      hookInstalled = true;
      retryCount = 0;
      discoverPlayers();
      return true;
    }

    const OriginalPlayer = playerConstructor;

    function WrappedPlayer(this: unknown, ...args: unknown[]): unknown {
      let instance: unknown = null;
      const wrappedArgs = wrapYouTubePlayerOptions(args, {
        getPlayer: () => instance,
        onPlayerReady: trackPlayer,
        onPlayerStateNeeded: applyPlayerState,
      });
      instance = new OriginalPlayer(...wrappedArgs);
      return instance;
    }

    Object.setPrototypeOf(WrappedPlayer, OriginalPlayer);
    setObjectProperty(WrappedPlayer, 'prototype', readObjectProperty(OriginalPlayer, 'prototype'));
    setObjectProperty(WrappedPlayer, '__qolboxWrapped', true);
    if (!setObjectProperty(yt, 'Player', WrappedPlayer) || readObjectProperty(yt, 'Player') !== WrappedPlayer) {
      scheduleRetry();
      return false;
    }
    hookInstalled = true;
    retryCount = 0;
    discoverPlayers();
    return true;
  }

  return {
    applyToTrackedPlayers,
    hookPlayerConstructor,
    installReadyCallbackHook,
    restoreTrackedPlayers,
  };
}
