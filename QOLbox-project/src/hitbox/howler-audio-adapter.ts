import {
  isNativeReflectTarget,
  readNativeReflectProperty,
  replaceNativeReflectProperty,
  setNativeReflectProperty,
} from './native-access';
import { isCallable } from '../utils/object-properties';

type NativeCallable = (...args: unknown[]) => unknown;

interface HowlerGameAudioAdapterOptions {
  getGameVolumeScalar(): number;
  isAudioEnabled(): boolean;
  playCustomSound?(howl: unknown): number | null;
  stopCustomSound?(howl: unknown, id?: unknown): boolean;
  shouldSuppressReserveRetryAudio(): boolean;
}

export function createHowlerGameAudioAdapter(options: HowlerGameAudioAdapterOptions) {
  let originalHowlVolume: NativeCallable | null = null;
  let originalHowlStop: NativeCallable | null = null;
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
      isCallable(currentVolumeMethod) &&
        readNativeReflectProperty(currentVolumeMethod, '__qolboxWrapped') === true
    );

    if (!volumePatched && isCallable(currentVolumeMethod)) {
      const baseVolumeMethod = currentVolumeMethod;
      originalHowlVolume = baseVolumeMethod;

      function wrappedVolume(this: unknown, ...args: unknown[]): unknown {
        if (!args.length) {
          const baseVolume = readNativeReflectProperty(this, '__qolboxBaseVolume');
          if (typeof baseVolume === 'number') {
            return baseVolume;
          }

          return Reflect.apply(baseVolumeMethod, this, []);
        }

        const [value, ...rest] = args;
        if (typeof value === 'number' && !settingGameVolumeInternally) {
          setNativeReflectProperty(this, '__qolboxBaseVolume', value);
          return Reflect.apply(baseVolumeMethod, this, [value * options.getGameVolumeScalar(), ...rest]);
        }

        return Reflect.apply(baseVolumeMethod, this, [value, ...rest]);
      }

      setNativeReflectProperty(wrappedVolume, '__qolboxWrapped', true);
      volumePatched = replaceNativeReflectProperty(howlPrototype, 'volume', wrappedVolume);
    }

    const currentPlayMethod = readNativeReflectProperty(howlPrototype, 'play');
    const playPatched =
      isCallable(currentPlayMethod) &&
      readNativeReflectProperty(currentPlayMethod, '__qolboxReserveAudioWrapped');
    if (isCallable(currentPlayMethod) && !playPatched) {
      const basePlayMethod = currentPlayMethod;

      function wrappedPlay(this: unknown, ...args: unknown[]): unknown {
        if (options.isAudioEnabled() && options.shouldSuppressReserveRetryAudio()) {
          return undefined;
        }

        const customPlaybackId = options.isAudioEnabled() ? options.playCustomSound?.(this) : null;
        if (typeof customPlaybackId === 'number') {
          if (originalHowlStop) Reflect.apply(originalHowlStop, this, []);
          return customPlaybackId;
        }

        return Reflect.apply(basePlayMethod, this, args);
      }

      setNativeReflectProperty(wrappedPlay, '__qolboxReserveAudioWrapped', true);
      replaceNativeReflectProperty(howlPrototype, 'play', wrappedPlay);
    }

    const currentStopMethod = readNativeReflectProperty(howlPrototype, 'stop');
    const stopPatched = isCallable(currentStopMethod) && readNativeReflectProperty(currentStopMethod, '__qolboxSoundBankWrapped');
    if (isCallable(currentStopMethod) && !stopPatched) {
      const baseStopMethod = currentStopMethod;
      originalHowlStop = baseStopMethod;
      function wrappedStop(this: unknown, id?: unknown, ...rest: unknown[]): unknown {
        if (options.stopCustomSound?.(this, id)) return this;
        return Reflect.apply(baseStopMethod, this, [id, ...rest]);
      }
      setNativeReflectProperty(wrappedStop, '__qolboxSoundBankWrapped', true);
      replaceNativeReflectProperty(howlPrototype, 'stop', wrappedStop);
    }

    return volumePatched;
  }

  return {
    applyGameVolumeToHowls,
    hookHowlPrototype,
  };
}
