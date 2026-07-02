import { readObjectProperty, setObjectProperty } from '../utils/object-properties';
import { isNativeCallable, isRecord, readBooleanProperty } from './youtube-player-native';

interface YouTubePlayerOptionsWrapperOptions {
  getPlayer(): unknown;
  onPlayerReady(player: unknown): void;
  onPlayerStateNeeded(player: unknown): void;
}

export function wrapYouTubePlayerOptions(
  args: readonly unknown[],
  options: YouTubePlayerOptionsWrapperOptions
): unknown[] {
  const wrappedArgs = Array.from(args);
  const optionsArg = wrappedArgs[1];
  if (!isRecord(optionsArg)) {
    return wrappedArgs;
  }

  const events = isRecord(optionsArg.events) ? optionsArg.events : {};
  const originalOnReady = events.onReady;
  if (readBooleanProperty(originalOnReady, '__qolboxWrapped')) {
    return wrappedArgs;
  }

  const wrappedEvents = {
    ...events,
    onReady(this: unknown, event: unknown, ...readyArgs: unknown[]): unknown {
      const player = readObjectProperty(event, 'target') || options.getPlayer();
      options.onPlayerReady(player);

      try {
        return isNativeCallable(originalOnReady)
          ? Reflect.apply(originalOnReady, this, [event, ...readyArgs])
          : undefined;
      } finally {
        window.setTimeout(() => {
          options.onPlayerStateNeeded(player || options.getPlayer());
        }, 0);
      }
    },
  };
  setObjectProperty(wrappedEvents.onReady, '__qolboxWrapped', true);
  setObjectProperty(wrappedEvents.onReady, '__qolboxOriginal', originalOnReady);

  wrappedArgs[1] = {
    ...optionsArg,
    events: wrappedEvents,
  };

  return wrappedArgs;
}
