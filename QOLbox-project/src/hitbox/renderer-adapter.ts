import type { FullscreenDimensions } from '../features/fullscreen-types';
import { isNativeObject, readNativeProperty, setNativeReflectProperty } from './native-access';
import { getKnownFullscreenRenderers, getRendererHost, getRendererView } from './renderer-discovery';

export { getKnownFullscreenRenderers, getRendererHost } from './renderer-discovery';

interface RendererResizeOptions {
  dimensions: FullscreenDimensions;
  fitElementToFrame(element: unknown, dimensions: FullscreenDimensions, left?: number, top?: number): void;
  setImportantStyle(element: unknown, property: string, value: string): void;
  windowObject?: unknown;
}

function resizeKnownRenderer(renderer: unknown, width: number, height: number): void {
  const backing = readNativeProperty(renderer, 'Bc');
  if (isNativeObject(backing)) {
    setNativeReflectProperty(backing, 'wc', width);
    setNativeReflectProperty(backing, 'mc', height);
  }

  const pixelRatio = Math.max(1, Number(window.devicePixelRatio) || 1);
  const pixiRenderer = readNativeProperty(renderer, 'Ag');
  if (isNativeObject(pixiRenderer)) {
    if ('autoDensity' in pixiRenderer) {
      setNativeReflectProperty(pixiRenderer, 'autoDensity', true);
    }
    if (typeof readNativeProperty(pixiRenderer, 'resolution') === 'number') {
      setNativeReflectProperty(pixiRenderer, 'resolution', pixelRatio);
    }
    const options = readNativeProperty(pixiRenderer, 'options');
    if (isNativeObject(options)) {
      setNativeReflectProperty(options, 'autoDensity', true);
      setNativeReflectProperty(options, 'resolution', pixelRatio);
    }
  }

  try {
    const nativeResize = readNativeProperty(renderer, 'cg');
    if (typeof nativeResize === 'function') {
      Reflect.apply(nativeResize, renderer, [width, height]);
    } else {
      const pixiResize = readNativeProperty(pixiRenderer, 'resize');
      if (typeof pixiResize === 'function') {
        Reflect.apply(pixiResize, pixiRenderer, [width, height]);
      }
    }
  } catch {
    // Ignore incomplete renderers while the scene is rebuilding.
  }
}

export function resizeKnownFullscreenRenderers(options: RendererResizeOptions): void {
  const { dimensions, fitElementToFrame, setImportantStyle, windowObject = window } = options;
  const frameWidth = Math.max(1, Math.round(dimensions.width));
  const frameHeight = Math.max(1, Math.round(dimensions.height));

  for (const renderer of getKnownFullscreenRenderers(windowObject)) {
    resizeKnownRenderer(renderer, frameWidth, frameHeight);
    fitElementToFrame(getRendererHost(renderer), dimensions, dimensions.left, dimensions.top);

    const view = getRendererView(renderer);
    if (!view) {
      continue;
    }

    setImportantStyle(view, 'position', 'absolute');
    setImportantStyle(view, 'left', '0');
    setImportantStyle(view, 'top', '0');
    setImportantStyle(view, 'right', 'auto');
    setImportantStyle(view, 'bottom', 'auto');
    setImportantStyle(view, 'width', `${frameWidth}px`);
    setImportantStyle(view, 'height', `${frameHeight}px`);
    setImportantStyle(view, 'max-width', 'none');
    setImportantStyle(view, 'max-height', 'none');
    setImportantStyle(view, 'transform', 'none');

    fitElementToFrame(view.parentElement, dimensions, dimensions.left, dimensions.top);
  }
}
