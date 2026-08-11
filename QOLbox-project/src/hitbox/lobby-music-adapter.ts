import {
  isNativeReflectTarget,
  readNativeReflectProperty,
  replaceNativeReflectProperty,
  setNativeReflectProperty,
} from './native-access';
import { isCallable } from '../utils/object-properties';

const NATIVE_LOBBY_MUSIC_FILENAME = 'meganeko_Daydreamer128.mp3';

function getNativeLobbyMusicController(): unknown | null {
  const game = readNativeReflectProperty(window, 'a8');
  // `cR` is the observed native lobby-music controller with `start`/`stop` methods.
  const controller = readNativeReflectProperty(game, 'cR');
  return isNativeReflectTarget(controller) ? controller : null;
}

function isNativeLobbyMusicHowl(howl: unknown): boolean {
  const source = readNativeReflectProperty(howl, '_src');
  const sources = Array.isArray(source) ? source : [source];
  return sources.some(candidate =>
    typeof candidate === 'string' && candidate.includes(NATIVE_LOBBY_MUSIC_FILENAME)
  );
}

function getKnownLobbyMusicHowls(): unknown[] {
  const howler = readNativeReflectProperty(window, 'Howler');
  const howls = readNativeReflectProperty(howler, '_howls');
  return Array.isArray(howls) ? howls.filter(isNativeLobbyMusicHowl) : [];
}

function stopKnownLobbyMusicHowls(): boolean {
  let stopped = false;
  for (const howl of getKnownLobbyMusicHowls()) {
    if (!isNativeReflectTarget(howl)) {
      continue;
    }

    const stop = readNativeReflectProperty(howl, 'stop');
    if (!isCallable(stop)) {
      continue;
    }

    try {
      Reflect.apply(stop, howl, []);
      stopped = true;
    } catch {
      // Keep checking in case another matching Howl is usable.
    }
  }

  return stopped;
}

export function startNativeLobbyMusic(): boolean {
  const howls = getKnownLobbyMusicHowls();
  for (const howl of howls) {
    const playing = readNativeReflectProperty(howl, 'playing');
    if (!isCallable(playing)) {
      continue;
    }

    try {
      if (Reflect.apply(playing, howl, []) === true) {
        return true;
      }
    } catch {
      // A different matching Howl may still be usable.
    }
  }

  for (const howl of [...howls].reverse()) {
    const play = readNativeReflectProperty(howl, 'play');
    if (!isCallable(play)) {
      continue;
    }

    try {
      Reflect.apply(play, howl, []);
      return true;
    } catch {
      // Try an older matching Howl.
    }
  }

  return false;
}

export function stopNativeLobbyMusic(controller: unknown = getNativeLobbyMusicController()): boolean {
  const stop = readNativeReflectProperty(controller, 'stop');
  let controllerStopped = false;

  if (isCallable(stop)) {
    try {
      Reflect.apply(stop, controller, []);
      controllerStopped = true;
    } catch {
      // The private controller is optional; the identifiable Howl is authoritative.
    }
  }

  return stopKnownLobbyMusicHowls() || controllerStopped;
}

export function patchNativeLobbyMusicStart(shouldAllowStart: () => boolean, forcePatch = false): boolean {
  const controller = getNativeLobbyMusicController();
  const start = readNativeReflectProperty(controller, 'start');
  if (!isCallable(start)) {
    return false;
  }

  if (!forcePatch && readNativeReflectProperty(start, '__qolboxWrapped') === true) {
    return true;
  }

  const originalStart = start;
  const wrappedStart = function wrappedLobbyMusicStart(this: unknown, ...args: unknown[]): unknown {
    if (shouldAllowStart()) {
      return Reflect.apply(originalStart, this, args);
    }

    stopNativeLobbyMusic(this);
    return undefined;
  };

  setNativeReflectProperty(wrappedStart, '__qolboxWrapped', true);
  setNativeReflectProperty(wrappedStart, '__qolboxOriginal', originalStart);
  return replaceNativeReflectProperty(controller, 'start', wrappedStart);
}
