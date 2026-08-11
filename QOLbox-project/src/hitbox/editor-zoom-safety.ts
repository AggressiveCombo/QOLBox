import {
  callNativeMethodSafely,
  isNativeObject,
  readNativePath,
  readNativeProperty,
  setNativeReflectProperty,
} from './native-access';
import { getLastRendererDrawArguments, getRendererHost } from './renderer-discovery';

type NativeFunction = (this: unknown, ...args: unknown[]) => unknown;

const EDITOR_ZOOM_STEP = 1.1;
const FALLBACK_EDITOR_TEXTURE_SIZE = 4096;
const MAX_EDITOR_GRID_TEXTURE_SIZE = 4096;
const zoomRenderersByHost = new WeakMap<Element, object>();
const mapFitZoomRenderers = new WeakSet<object>();
const pendingMapFitZoom = new WeakMap<object, number>();

const callMethod = callNativeMethodSafely;

function readDeviceTextureLimit(renderer: object): number {
  const gl = readNativePath(renderer, ['Ag', 'gl']);
  const getParameter = readNativeProperty(gl, 'getParameter');
  let limit = Infinity;
  if (!isNativeObject(gl) || typeof getParameter !== 'function') return FALLBACK_EDITOR_TEXTURE_SIZE;

  for (const property of ['MAX_TEXTURE_SIZE', 'MAX_RENDERBUFFER_SIZE']) {
    const parameter = readNativeProperty(gl, property);
    if (typeof parameter !== 'number') continue;
    try {
      const value = Number(Reflect.apply(getParameter, gl, [parameter]));
      if (Number.isFinite(value) && value > 0) limit = Math.min(limit, value);
    } catch {
      // Use the fallback below if the context is rebuilding.
    }
  }
  return Number.isFinite(limit) ? limit : FALLBACK_EDITOR_TEXTURE_SIZE;
}

function readGradientCanvasHeight(renderer: object): number {
  const graphicsData = readNativePath(renderer, ['gg', 'Ac', 'geometry', 'graphicsData']);
  if (!Array.isArray(graphicsData)) return 0;

  for (const item of graphicsData) {
    const source = readNativePath(item, ['fillStyle', 'texture', 'baseTexture', 'resource', 'source']);
    const width = Number(readNativeProperty(source, 'width'));
    const height = Number(readNativeProperty(source, 'height'));
    if (width === 64 && Number.isFinite(height) && height > 0 && typeof readNativeProperty(source, 'getContext') === 'function') {
      return height;
    }
  }
  return 0;
}

function shouldBlockEditorZoomIn(renderer: object): boolean {
  const deviceLimit = readDeviceTextureLimit(renderer);
  const scale = Number(readNativePath(renderer, ['Bc', 'scale']));
  const resolution = Number(readNativePath(renderer, ['Ag', 'resolution'])) || 1;
  const gradientHeight = readGradientCanvasHeight(renderer);
  return (
    (Number.isFinite(scale) &&
      (scale * EDITOR_ZOOM_STEP - 1) * resolution > Math.min(deviceLimit, MAX_EDITOR_GRID_TEXTURE_SIZE)) ||
    gradientHeight * EDITOR_ZOOM_STEP > deviceLimit
  );
}

export function installEditorZoomSafety(renderer: object): void {
  const host = getRendererHost(renderer);
  if (!host || host.id !== 'editorContainer') return;
  if (zoomRenderersByHost.has(host)) {
    zoomRenderersByHost.set(host, renderer);
    return;
  }

  zoomRenderersByHost.set(host, renderer);
  host.addEventListener('wheel', event => {
    const wheelEvent = event as WheelEvent;
    const currentRenderer = zoomRenderersByHost.get(host);
    if (wheelEvent.deltaY >= 0 || !currentRenderer || !shouldBlockEditorZoomIn(currentRenderer)) return;
    wheelEvent.preventDefault();
    wheelEvent.stopImmediatePropagation();
  }, { capture: true, passive: false });
}

export function installEditorMapFitZoom(renderer: object, onMapFit: () => void): void {
  if (mapFitZoomRenderers.has(renderer)) return;
  const resetCamera = readNativeProperty(renderer, 'Fg');
  const fitMap = readNativeProperty(renderer, 'Qg');
  if (typeof resetCamera !== 'function' || typeof fitMap !== 'function') return;

  mapFitZoomRenderers.add(renderer);
  setNativeReflectProperty(renderer, 'Fg', function (this: object, ...args: unknown[]) {
    const zoom = Number(getLastRendererDrawArguments(this)?.[1]);
    if (Number.isFinite(zoom) && zoom > 0) pendingMapFitZoom.set(this, zoom);
    queueMicrotask(() => pendingMapFitZoom.delete(this));
    return Reflect.apply(resetCamera as NativeFunction, this, args);
  });
  setNativeReflectProperty(renderer, 'Qg', function (this: object, ...args: unknown[]) {
    const result = Reflect.apply(fitMap as NativeFunction, this, args);
    if (pendingMapFitZoom.has(this)) onMapFit();
    const zoom = pendingMapFitZoom.get(this);
    pendingMapFitZoom.delete(this);
    const draw = readNativeProperty(this, 'Dg');
    if (zoom && typeof draw === 'function') {
      const map = getLastRendererDrawArguments(this)?.[0] ?? args[0];
      callMethod(this, 'Ig', [1 / zoom]);
      Reflect.apply(draw, this, [map, zoom]);
    }
    return result;
  });
}
