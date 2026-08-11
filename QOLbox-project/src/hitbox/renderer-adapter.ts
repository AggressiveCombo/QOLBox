import type { FullscreenDimensions } from '../features/fullscreen-types';
import {
  isNativeObject,
  readNativeProperty,
  readNativeReflectProperty,
  setNativeReflectProperty,
} from './native-access';
import {
  getLastRendererDrawArguments,
  getKnownFullscreenRenderers,
  getRendererHost,
  getRendererView,
  isSyntheticRendererWrapper,
  rerenderKnownNativeRenderer,
  rerenderKnownRenderer,
} from './renderer-discovery';

export { getKnownFullscreenRenderers, getRendererHost, getRendererView } from './renderer-discovery';

export function getRendererLogicalSize(
  canvas: Element | null,
  windowObject: unknown = window
): { height: number; width: number } | null {
  for (const renderer of getKnownFullscreenRenderers(windowObject)) {
    if (getRendererView(renderer) !== canvas) {
      continue;
    }

    const backing = readNativeProperty(renderer, 'Bc');
    const width = readPositiveNumber(backing, 'wc');
    const height = readPositiveNumber(backing, 'mc');
    if (width && height) {
      return { width, height };
    }
  }

  return null;
}

interface RendererResizeOptions {
  dimensions: FullscreenDimensions;
  fitElementToFrame(element: unknown, dimensions: FullscreenDimensions): void;
  windowObject?: unknown;
}
const DENSITY_SNAPSHOT = '__qolboxDensitySnapshot';
const RESIZE_GUARD_MARKER = '__qolboxResizeGuard';
const physicalFrameWidths = new WeakMap<object, number>();
const rendererLogicalSizes = new WeakMap<object, { height: number; width: number }>();
type ResizeFunction = (this: unknown, width: number, height: number) => unknown;
interface RendererViewSnapshot {
  camera: unknown;
  drawArguments: unknown[] | null;
  renderer: object;
  scale: unknown;
  x: unknown;
  y: unknown;
}

function readPositiveNumber(source: unknown, property: PropertyKey): number | null {
  const value = Number(readNativeProperty(source, property));
  return Number.isFinite(value) && value > 0 ? value : null;
}

function captureRendererView(renderer: object): RendererViewSnapshot {
  const camera = readNativeProperty(renderer, 'fg');
  const scale = readNativeProperty(readNativeProperty(renderer, 'Bc'), 'scale');
  const drawArguments = getLastRendererDrawArguments(renderer)?.slice() ?? null;
  return {
    camera,
    drawArguments,
    renderer,
    scale,
    x: readNativeProperty(camera, 'x'),
    y: readNativeProperty(camera, 'y'),
  };
}

function restoreRendererView(view: RendererViewSnapshot): void {
  const backing = readNativeProperty(view.renderer, 'Bc');
  if (isNativeObject(backing) && typeof view.scale === 'number') {
    setNativeReflectProperty(backing, 'scale', view.scale);
  }
  if (isNativeObject(view.camera)) {
    if (typeof view.x === 'number') setNativeReflectProperty(view.camera, 'x', view.x);
    if (typeof view.y === 'number') setNativeReflectProperty(view.camera, 'y', view.y);
  }
  const draw = readNativeProperty(view.renderer, 'Dg');
  if (view.drawArguments && typeof draw === 'function') {
    Reflect.apply(draw, view.renderer, view.drawArguments);
  }
  rerenderKnownNativeRenderer(view.renderer);
}

function isRendererOutputCurrent(renderer: unknown, width: number, height: number): boolean {
  const screen = readNativeProperty(renderer, 'screen');
  const view = readNativeProperty(renderer, 'view');
  const screenWidth = readPositiveNumber(screen, 'width');
  const screenHeight = readPositiveNumber(screen, 'height');
  const backingWidth = readPositiveNumber(view, 'width');
  const backingHeight = readPositiveNumber(view, 'height');
  const resolution = readPositiveNumber(renderer, 'resolution');
  return Boolean(
    screenWidth &&
    screenHeight &&
    backingWidth &&
    backingHeight &&
    resolution &&
    Math.abs(screenWidth - width) <= 1 &&
    Math.abs(screenHeight - height) <= 1 &&
    Math.abs(backingWidth - Math.round(width * resolution)) <= 2 &&
    Math.abs(backingHeight - Math.round(height * resolution)) <= 2
  );
}

function setRendererDensity(renderer: object, density: number): void {
  const options = readNativeProperty(renderer, 'options');
  const interaction = readNativeProperty(readNativeProperty(renderer, 'plugins'), 'interaction');
  setNativeReflectProperty(renderer, 'autoDensity', true);
  setNativeReflectProperty(renderer, 'resolution', density);
  if (isNativeObject(options)) {
    setNativeReflectProperty(options, 'autoDensity', true);
    setNativeReflectProperty(options, 'resolution', density);
  }
  if (isNativeObject(interaction)) setNativeReflectProperty(interaction, 'resolution', density);
}

function guardRedundantResize(renderer: object, resize: ResizeFunction): void {
  const currentResize = readNativeProperty(renderer, 'resize');
  if (readNativeReflectProperty(currentResize, RESIZE_GUARD_MARKER)) return;

  const guardedResize = function (this: unknown, width: number, height: number): unknown {
    if (isNativeObject(this)) {
      const physicalWidth = physicalFrameWidths.get(this);
      if (physicalWidth && width > 0) setRendererDensity(this, physicalWidth / width);
    }
    if (!isRendererOutputCurrent(this, width, height)) {
      return Reflect.apply(resize, this, [width, height]);
    }
    return undefined;
  };
  setNativeReflectProperty(guardedResize, RESIZE_GUARD_MARKER, true);
  setNativeReflectProperty(renderer, 'resize', guardedResize);
}

function resizeKnownRenderer(
  renderer: unknown,
  logicalWidth: number,
  logicalHeight: number,
  frameWidth: number,
  pixelRatio: number
): void {
  if (isNativeObject(renderer)) {
    const previous = rendererLogicalSizes.get(renderer);
    const camera = readNativeProperty(renderer, 'fg');
    if (previous && isNativeObject(camera)) {
      const x = Number(readNativeProperty(camera, 'x')) + (logicalWidth - previous.width) / 2;
      const y = Number(readNativeProperty(camera, 'y')) + (logicalHeight - previous.height) / 2;
      if (Number.isFinite(x) && Number.isFinite(y)) {
        setNativeReflectProperty(camera, 'x', x);
        setNativeReflectProperty(camera, 'y', y);
      }
    }
    rendererLogicalSizes.set(renderer, { height: logicalHeight, width: logicalWidth });
  }

  const pixiRenderer = readNativeProperty(renderer, 'Ag');
  if (!isNativeObject(pixiRenderer)) {
    return;
  }

  const pixiResize = readNativeProperty(pixiRenderer, 'resize');
  if (typeof pixiResize !== 'function') {
    return;
  }

  const options = readNativeProperty(pixiRenderer, 'options');
  const interaction = readNativeProperty(readNativeProperty(pixiRenderer, 'plugins'), 'interaction');
  let snapshot = readNativeProperty(pixiRenderer, DENSITY_SNAPSHOT);
  if (!isNativeObject(snapshot)) {
    const newSnapshot = {
      resize: pixiResize,
      autoDensity: readNativeProperty(pixiRenderer, 'autoDensity'),
      optionsAutoDensity: readNativeProperty(options, 'autoDensity'),
      optionsResolution: readNativeProperty(options, 'resolution'),
      interactionResolution: readNativeProperty(interaction, 'resolution'),
      resolution: readNativeProperty(pixiRenderer, 'resolution'),
    };
    snapshot = newSnapshot;
    setNativeReflectProperty(pixiRenderer, DENSITY_SNAPSHOT, newSnapshot);
  }

  const density = pixelRatio * frameWidth / logicalWidth;
  physicalFrameWidths.set(pixiRenderer, pixelRatio * frameWidth);
  setRendererDensity(pixiRenderer, density);

  try {
    const nativeResize = readNativeProperty(snapshot, 'resize');
    if (typeof nativeResize === 'function') {
      guardRedundantResize(pixiRenderer, nativeResize as ResizeFunction);
      if (!isRendererOutputCurrent(pixiRenderer, logicalWidth, logicalHeight)) {
        Reflect.apply(nativeResize, pixiRenderer, [logicalWidth, logicalHeight]);
        rerenderKnownRenderer(renderer);
      }
    }
  } catch {
    // Ignore incomplete renderers while the scene is rebuilding.
  }
}

function restoreKnownRenderer(renderer: unknown, pixelRatio: number): void {
  const pixiRenderer = readNativeProperty(renderer, 'Ag');
  if (!isNativeObject(pixiRenderer)) {
    return;
  }
  const snapshot = readNativeProperty(pixiRenderer, DENSITY_SNAPSHOT);
  if (!isNativeObject(snapshot)) {
    return;
  }

  const options = readNativeProperty(pixiRenderer, 'options');
  const interaction = readNativeProperty(readNativeProperty(pixiRenderer, 'plugins'), 'interaction');
  const nativeResize = readNativeProperty(snapshot, 'resize');
  if (typeof nativeResize === 'function') {
    setNativeReflectProperty(pixiRenderer, 'resize', nativeResize);
  }
  const originalResolution = readPositiveNumber(snapshot, 'resolution');
  if (originalResolution && Math.abs(originalResolution - pixelRatio) <= 0.001) {
    setNativeReflectProperty(pixiRenderer, 'autoDensity', readNativeProperty(snapshot, 'autoDensity'));
    setNativeReflectProperty(pixiRenderer, 'resolution', originalResolution);
    if (isNativeObject(options)) {
      setNativeReflectProperty(options, 'autoDensity', readNativeProperty(snapshot, 'optionsAutoDensity'));
      setNativeReflectProperty(options, 'resolution', readNativeProperty(snapshot, 'optionsResolution'));
    }
    if (isNativeObject(interaction)) {
      setNativeReflectProperty(interaction, 'resolution', readNativeProperty(snapshot, 'interactionResolution'));
    }
  } else {
    setRendererDensity(pixiRenderer, pixelRatio);
  }

  const screen = readNativeProperty(pixiRenderer, 'screen');
  const logicalWidth = readPositiveNumber(screen, 'width');
  const logicalHeight = readPositiveNumber(screen, 'height');
  const pixiResize = readNativeProperty(pixiRenderer, 'resize');
  if (logicalWidth && logicalHeight && typeof pixiResize === 'function') {
    try {
      Reflect.apply(pixiResize, pixiRenderer, [logicalWidth, logicalHeight]);
      const draw = readNativeProperty(renderer, 'Dg');
      const drawArguments = isNativeObject(renderer) ? getLastRendererDrawArguments(renderer) : null;
      if (drawArguments && typeof draw === 'function') Reflect.apply(draw, renderer, drawArguments);
      rerenderKnownRenderer(renderer);
    } catch {
      // Native resize remains the fallback during teardown.
    }
  }

  Reflect.deleteProperty(pixiRenderer, DENSITY_SNAPSHOT);
  physicalFrameWidths.delete(pixiRenderer);
  if (isNativeObject(renderer)) rendererLogicalSizes.delete(renderer);
}

export function resizeKnownFullscreenRenderers(options: RendererResizeOptions): void {
  const { dimensions, fitElementToFrame, windowObject = window } = options;
  const frameWidth = Math.max(1, Math.round(dimensions.width));
  const fallbackLogicalWidth = Math.max(1, dimensions.baseWidth ?? frameWidth);
  const fallbackLogicalHeight = Math.max(1, dimensions.baseHeight ?? dimensions.height);
  const rawPixelRatio = Number(readNativeProperty(windowObject, 'devicePixelRatio'));
  const pixelRatio = Number.isFinite(rawPixelRatio) && rawPixelRatio > 0 ? rawPixelRatio : 1;

  for (const renderer of getKnownFullscreenRenderers(windowObject)) {
    const view = getRendererView(renderer);
    const backing = readNativeProperty(renderer, 'Bc');
    const useNativeCameraSize = !isSyntheticRendererWrapper(renderer);
    const logicalWidth = useNativeCameraSize
      ? readPositiveNumber(backing, 'wc') ?? fallbackLogicalWidth
      : fallbackLogicalWidth;
    const logicalHeight = useNativeCameraSize
      ? readPositiveNumber(backing, 'mc') ?? fallbackLogicalHeight
      : fallbackLogicalHeight;
    resizeKnownRenderer(renderer, logicalWidth, logicalHeight, frameWidth, pixelRatio);
    fitElementToFrame(getRendererHost(renderer), dimensions);
    fitElementToFrame(view, dimensions);
    fitElementToFrame(view?.parentElement, dimensions);
  }
}

export function restoreKnownFullscreenRenderers(
  windowObject: unknown = window
): void {
  const rawPixelRatio = Number(readNativeProperty(windowObject, 'devicePixelRatio'));
  const pixelRatio = Number.isFinite(rawPixelRatio) && rawPixelRatio > 0 ? rawPixelRatio : 1;
  const renderers = getKnownFullscreenRenderers(windowObject);
  const views = renderers.map(captureRendererView);
  for (const renderer of renderers) {
    restoreKnownRenderer(renderer, pixelRatio);
  }
  const restoreViews = () => views.forEach(restoreRendererView);
  restoreViews();
  const requestFrame = readNativeProperty(windowObject, 'requestAnimationFrame');
  if (typeof requestFrame === 'function') Reflect.apply(requestFrame, windowObject, [restoreViews]);
}
