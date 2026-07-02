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
  let trackedPlayers = new Set<unknown>();
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

  function restoreTrackedPlayers(volume: number): void {
    if (!playerStateApplied) {
      return;
    }

    for (const player of Array.from(trackedPlayers)) {
      const setVolume = readObjectProperty(player, 'setVolume');
      if (!player || !isNativeCallable(setVolume)) {
        trackedPlayers.delete(player);
        continue;
      }

      try {
        Reflect.apply(setVolume, player, [volume]);
        const unMute = readObjectProperty(player, 'unMute');
        if (isNativeCallable(unMute)) {
          Reflect.apply(unMute, player, []);
        }
      } catch {
        trackedPlayers.delete(player);
      }
    }
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
    retryCount = 0;

    if (hookInstalled || readBooleanProperty(playerConstructor, '__qolboxWrapped')) {
      hookInstalled = true;
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
    setObjectProperty(yt, 'Player', WrappedPlayer);
    hookInstalled = true;
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
