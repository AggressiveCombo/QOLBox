import type { FullscreenDimensions } from '../features/fullscreen-types';
import { isNativeObject, readNativeProperty, setNativeReflectProperty } from './native-access';

type MetricName = '_P' | 'Qp' | 'lg' | 'ug';

interface MetricOriginal {
  descriptor: PropertyDescriptor | null;
}

type MetricOriginals = Record<MetricName, MetricOriginal>;

interface FullscreenMetricOverrideOptions {
  getFallbackDimensions(): FullscreenDimensions;
  getNativeUiZoom(dimensions: FullscreenDimensions): number;
}

const METRIC_NAMES: readonly MetricName[] = ['_P', 'Qp', 'lg', 'ug'];

function isFullscreenDimensions(value: unknown): value is FullscreenDimensions {
  return (
    isNativeObject(value) &&
    typeof readNativeProperty(value, 'scale') === 'number' &&
    typeof readNativeProperty(value, 'width') === 'number' &&
    typeof readNativeProperty(value, 'height') === 'number'
  );
}

function createMetricOriginals(game: object): MetricOriginals {
  return {
    _P: { descriptor: Object.getOwnPropertyDescriptor(game, '_P') || null },
    Qp: { descriptor: Object.getOwnPropertyDescriptor(game, 'Qp') || null },
    lg: { descriptor: Object.getOwnPropertyDescriptor(game, 'lg') || null },
    ug: { descriptor: Object.getOwnPropertyDescriptor(game, 'ug') || null },
  };
}

function makeMetricAccessor(getter: () => number): PropertyDescriptor {
  return {
    configurable: true,
    enumerable: true,
    get: getter,
    set: () => {
      // Native resize writes these during transitions; fullscreen keeps the authoritative metrics.
    },
  };
}

export function createFullscreenMetricOverrideController(options: FullscreenMetricOverrideOptions) {
  function getPinnedFullscreenDimensions(game: unknown): FullscreenDimensions {
    const pinned = readNativeProperty(game, '__qolboxPinnedDimensions');
    return isFullscreenDimensions(pinned) ? pinned : options.getFallbackDimensions();
  }

  function installNativeMetricOverride(game: unknown): boolean {
    if (!isNativeObject(game)) {
      return false;
    }

    if (readNativeProperty(game, '__qolboxMetricOverrideInstalled')) {
      return true;
    }

    setNativeReflectProperty(game, '__qolboxMetricOriginals', createMetricOriginals(game));

    try {
      Object.defineProperty(game, '_P', makeMetricAccessor(() => getPinnedFullscreenDimensions(game).scale));
      Object.defineProperty(
        game,
        'Qp',
        makeMetricAccessor(() => options.getNativeUiZoom(getPinnedFullscreenDimensions(game)))
      );
      Object.defineProperty(game, 'lg', makeMetricAccessor(() => getPinnedFullscreenDimensions(game).width));
      Object.defineProperty(game, 'ug', makeMetricAccessor(() => getPinnedFullscreenDimensions(game).height));
      setNativeReflectProperty(game, '__qolboxMetricOverrideInstalled', true);
      return true;
    } catch {
      return false;
    }
  }

  function restoreNativeMetricOverride(game: unknown): boolean {
    if (!isNativeObject(game) || !readNativeProperty(game, '__qolboxMetricOverrideInstalled')) {
      return false;
    }

    const originals = readNativeProperty(game, '__qolboxMetricOriginals');
    for (const metricName of METRIC_NAMES) {
      const original = isNativeObject(originals) ? readNativeProperty(originals, metricName) : undefined;
      const descriptor = isNativeObject(original) ? readNativeProperty(original, 'descriptor') : undefined;

      try {
        if (descriptor && typeof descriptor === 'object') {
          Object.defineProperty(game, metricName, descriptor);
        } else {
          Reflect.deleteProperty(game, metricName);
        }
      } catch {
        // Keep going; any restored metric is better than leaving the whole override active.
      }
    }

    Reflect.deleteProperty(game, '__qolboxPinnedDimensions');
    Reflect.deleteProperty(game, '__qolboxMetricOriginals');
    Reflect.deleteProperty(game, '__qolboxMetricOverrideInstalled');
    return true;
  }

  return {
    getPinnedFullscreenDimensions,
    installNativeMetricOverride,
    restoreNativeMetricOverride,
  };
}
