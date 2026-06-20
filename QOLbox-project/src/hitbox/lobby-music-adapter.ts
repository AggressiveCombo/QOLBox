import {
  isNativeReflectTarget,
  readNativeReflectProperty,
  setNativeReflectProperty,
} from './native-access';

type NativeCallable = (...args: unknown[]) => unknown;

function isNativeCallable(value: unknown): value is NativeCallable {
  return typeof value === 'function';
}

function getNativeLobbyMusicController(): unknown | null {
  const game = readNativeReflectProperty(window, 'a8');
  // `cR` is the observed native lobby-music controller with `start`/`stop` methods.
  const controller = readNativeReflectProperty(game, 'cR');
  return isNativeReflectTarget(controller) ? controller : null;
}

export function stopNativeLobbyMusic(controller: unknown = getNativeLobbyMusicController()): boolean {
  const stop = readNativeReflectProperty(controller, 'stop');
  if (!isNativeCallable(stop)) {
    return false;
  }

  try {
    Reflect.apply(stop, controller, []);
    return true;
  } catch {
    return false;
  }
}

export function patchNativeLobbyMusicStart(shouldAllowStart: () => boolean, forcePatch = false): boolean {
  const controller = getNativeLobbyMusicController();
  const start = readNativeReflectProperty(controller, 'start');
  if (!isNativeCallable(start)) {
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
  return setNativeReflectProperty(controller, 'start', wrappedStart);
}
