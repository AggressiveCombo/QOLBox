import {
  isNativeReflectTarget,
  readNativeReflectProperty,
  setNativeReflectProperty,
} from './native-access';

type NativeCallable = (...args: unknown[]) => unknown;

interface HowlerGameAudioAdapterOptions {
  getGameVolumeScalar(): number;
  isAudioEnabled(): boolean;
  shouldSuppressReserveRetryAudio(): boolean;
}

function isNativeCallable(value: unknown): value is NativeCallable {
  return typeof value === 'function';
}

export function createHowlerGameAudioAdapter(options: HowlerGameAudioAdapterOptions) {
  let originalHowlVolume: NativeCallable | null = null;
  let settingGameVolumeInternally = false;

  function applyGameVolumeToHowls(): void {
    const howler = readNativeReflectProperty(window, 'Howler');
    const howls = readNativeReflectProperty(howler, '_howls');
    if (!Array.isArray(howls) || !originalHowlVolume) {
      return;
    }

    settingGameVolumeInternally = true;
    try {
      for (const howl of howls) {
        if (!isNativeReflectTarget(howl)) {
          continue;
        }

        const storedBaseVolume = readNativeReflectProperty(howl, '__qolboxBaseVolume');
        let baseVolume = typeof storedBaseVolume === 'number' ? storedBaseVolume : null;
        if (baseVolume === null) {
          // Howler stores each sound's current base volume on `_volume`.
          const initialVolume = Number(readNativeReflectProperty(howl, '_volume'));
          baseVolume = Number.isFinite(initialVolume) ? initialVolume : 1;
          setNativeReflectProperty(howl, '__qolboxBaseVolume', baseVolume);
        }

        Reflect.apply(originalHowlVolume, howl, [baseVolume * options.getGameVolumeScalar()]);
      }
    } finally {
      settingGameVolumeInternally = false;
    }
  }

  function hookHowlPrototype(): boolean {
    if (!options.isAudioEnabled() && !originalHowlVolume) {
      return false;
    }

    const howlConstructor = readNativeReflectProperty(window, 'Howl');
    const howlPrototype = readNativeReflectProperty(howlConstructor, 'prototype');
    if (!isNativeReflectTarget(howlPrototype)) {
      return false;
    }

    const currentVolumeMethod = readNativeReflectProperty(howlPrototype, 'volume');
    let volumePatched = Boolean(
      isNativeCallable(currentVolumeMethod) &&
        readNativeReflectProperty(currentVolumeMethod, '__qolboxWrapped') === true
    );

    if (!volumePatched && isNativeCallable(currentVolumeMethod)) {
      const baseVolumeMethod = currentVolumeMethod;
      originalHowlVolume = baseVolumeMethod;

      function wrappedVolume(this: unknown, value?: unknown, ...rest: unknown[]): unknown {
        if (arguments.length === 0) {
          const baseVolume = readNativeReflectProperty(this, '__qolboxBaseVolume');
          if (typeof baseVolume === 'number') {
            return baseVolume;
          }

          return Reflect.apply(baseVolumeMethod, this, []);
        }

        if (typeof value === 'number' && !settingGameVolumeInternally) {
          setNativeReflectProperty(this, '__qolboxBaseVolume', value);
          return Reflect.apply(baseVolumeMethod, this, [value * options.getGameVolumeScalar(), ...rest]);
        }

        return Reflect.apply(baseVolumeMethod, this, [value, ...rest]);
      }

      setNativeReflectProperty(wrappedVolume, '__qolboxWrapped', true);
      setNativeReflectProperty(howlPrototype, 'volume', wrappedVolume);
      volumePatched = true;
    }

    const currentPlayMethod = readNativeReflectProperty(howlPrototype, 'play');
    const playPatched =
      isNativeCallable(currentPlayMethod) &&
      readNativeReflectProperty(currentPlayMethod, '__qolboxReserveAudioWrapped');
    if (isNativeCallable(currentPlayMethod) && !playPatched) {
      const basePlayMethod = currentPlayMethod;

      function wrappedPlay(this: unknown, ...args: unknown[]): unknown {
        if (options.shouldSuppressReserveRetryAudio()) {
          return undefined;
        }

        return Reflect.apply(basePlayMethod, this, args);
      }

      setNativeReflectProperty(wrappedPlay, '__qolboxReserveAudioWrapped', true);
      setNativeReflectProperty(howlPrototype, 'play', wrappedPlay);
    }

    return volumePatched;
  }

  return {
    applyGameVolumeToHowls,
    hookHowlPrototype,
  };
}
