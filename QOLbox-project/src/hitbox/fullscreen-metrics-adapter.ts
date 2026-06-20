import type { FullscreenDimensions } from '../features/fullscreen-types';
import { isNativeObject, readNativeProperty, setNativeReflectProperty } from './native-access';
import { createFullscreenMetricOverrideController } from './fullscreen-metric-overrides';

interface FullscreenMetricsOptions {
  getFullscreenDimensions(): FullscreenDimensions;
  getNativeUiZoom(dimensions: FullscreenDimensions): number;
  windowObject?: unknown;
}

export function createFullscreenMetricsAdapter(options: FullscreenMetricsOptions) {
  const getWindowObject = () => options.windowObject || window;
  const getGame = () => readNativeProperty(getWindowObject(), 'a8');
  const metricOverrides = createFullscreenMetricOverrideController({
    getFallbackDimensions: options.getFullscreenDimensions,
    getNativeUiZoom: options.getNativeUiZoom,
  });

  function installNativeMetricOverride(game: unknown = getGame()): boolean {
    return metricOverrides.installNativeMetricOverride(game);
  }

  function restoreNativeMetricOverride(game: unknown = getGame()): boolean {
    return metricOverrides.restoreNativeMetricOverride(game);
  }

  function setNativeFullscreenSize(dimensions: FullscreenDimensions = options.getFullscreenDimensions()): boolean {
    const game = getGame();
    if (!isNativeObject(game)) {
      return false;
    }

    setNativeReflectProperty(game, '__qolboxPinnedDimensions', dimensions);
    installNativeMetricOverride(game);

    setNativeReflectProperty(game, '_P', dimensions.scale);
    setNativeReflectProperty(game, 'lg', dimensions.width);
    setNativeReflectProperty(game, 'ug', dimensions.height);

    if ('Qp' in game) {
      setNativeReflectProperty(game, 'Qp', options.getNativeUiZoom(dimensions));
    }

    const layoutMethod = readNativeProperty(game, 'PP');
    if (typeof layoutMethod === 'function') {
      try {
        Reflect.apply(layoutMethod, game, []);
      } catch {
        // Ignore intermediate layout failures while the game is booting.
      }
    }

    return true;
  }

  function restoreNativeFullscreenPatch(game: unknown = getGame()): boolean {
    if (!isNativeObject(game)) {
      return false;
    }

    const resizeMethod = readNativeProperty(game, 'ag');
    const originalResize = readNativeProperty(resizeMethod, '__qolboxOriginal');
    if (
      typeof resizeMethod === 'function' &&
      readNativeProperty(resizeMethod, '__qolboxWrapped') &&
      typeof originalResize === 'function'
    ) {
      setNativeReflectProperty(game, 'ag', originalResize);
    }

    restoreNativeMetricOverride(game);

    const restoredResize = readNativeProperty(game, 'ag');
    if (typeof restoredResize === 'function') {
      try {
        Reflect.apply(restoredResize, game, []);
      } catch {
        // Ignore native resize failures while the game is transitioning.
      }
    }

    return true;
  }

  function installNativeFullscreenPatch(): boolean {
    const game = getGame();
    if (!isNativeObject(game)) {
      return false;
    }

    installNativeMetricOverride(game);

    const originalResize = readNativeProperty(game, 'ag');
    if (typeof originalResize !== 'function' || readNativeProperty(originalResize, '__qolboxWrapped')) {
      return true;
    }

    const wrappedResize = function wrappedResize(this: unknown, ...args: unknown[]) {
      setNativeFullscreenSize(options.getFullscreenDimensions());

      if (readNativeProperty(game, '__qolboxRunningNativeResize')) {
        return Reflect.apply(originalResize, this, args);
      }

      setNativeReflectProperty(game, '__qolboxRunningNativeResize', true);
      try {
        const result = Reflect.apply(originalResize, this, args);
        setNativeFullscreenSize(options.getFullscreenDimensions());
        return result;
      } finally {
        setNativeReflectProperty(game, '__qolboxRunningNativeResize', false);
      }
    };

    setNativeReflectProperty(wrappedResize, '__qolboxWrapped', true);
    setNativeReflectProperty(wrappedResize, '__qolboxOriginal', originalResize);
    setNativeReflectProperty(game, 'ag', wrappedResize);
    return true;
  }

  function runNativeResize(dimensions: FullscreenDimensions = options.getFullscreenDimensions()): boolean {
    const game = getGame();
    const resizeMethod = readNativeProperty(game, 'ag');
    if (!isNativeObject(game) || typeof resizeMethod !== 'function') {
      return false;
    }

    setNativeFullscreenSize(dimensions);

    try {
      Reflect.apply(resizeMethod, game, [dimensions]);
      return true;
    } catch {
      return false;
    }
  }

  return {
    installNativeFullscreenPatch,
    restoreNativeFullscreenPatch,
    runNativeResize,
    setNativeFullscreenSize,
  };
}
