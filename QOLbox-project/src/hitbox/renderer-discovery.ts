import { isNativeObject, readNativePath, readNativeProperty, readNativeReflectProperty } from './native-access';

const RENDER_CAPTURE_MARKER = '__qolboxRendererCaptureInstalled';
const NATIVE_RENDERER_CAPTURE_MARKER = '__qolboxNativeRendererCapture';
const NATIVE_RENDER_CAPTURE_MARKER = '__qolboxNativeRenderCapture';
const ATOMIC_RESIZE_MARKER = '__qolboxAtomicResize';
const observedPixiRenderers = new Set<object>();
const observedRenderArguments = new WeakMap<object, unknown[]>();
const observedRendererWrappers = new WeakMap<object, object>();
const syntheticRendererWrappers = new WeakSet<object>();
const observedNativeDrawArgumentMaps = new Set<WeakMap<object, unknown[]>>();
const observedNativeRenderArgumentMaps = new Set<WeakMap<object, unknown[]>>();
const observedNativeRendererSets = new Set<Set<object>>();
const pendingResizeRenders = new WeakSet<object>();
const rendererByContextView = new WeakMap<Element, object>();
const contextRecoveryViews = new WeakSet<Element>();

function isRendererCandidate(value: unknown): value is object {
  return (
    isNativeObject(value) &&
    isNativeObject(readNativeProperty(value, 'Bc')) &&
    (isNativeObject(readNativeProperty(value, 'Ag')) || typeof readNativeProperty(value, 'cg') === 'function')
  );
}

export function getRendererView(renderer: unknown): Element | null {
  const view = readNativePath(renderer, ['Ag', 'view']);
  return view instanceof Element ? view : null;
}

export function getRendererHost(renderer: unknown): Element | null {
  const directHost = readNativeProperty(renderer, 'Tg') || readNativeProperty(renderer, 'dg');
  if (directHost instanceof Element) {
    return directHost;
  }

  return getRendererView(renderer)?.parentElement || null;
}

export function isSyntheticRendererWrapper(renderer: object): boolean {
  return syntheticRendererWrappers.has(renderer);
}

function installNativeRendererCapture(renderer: object): void {
  const prototype = Object.getPrototypeOf(renderer);
  if (!isNativeObject(prototype)) return;

  const draw = readNativeReflectProperty(prototype, 'Dg');
  const existing = readNativeReflectProperty(draw, NATIVE_RENDERER_CAPTURE_MARKER);
  const existingRenderers = readNativeProperty(existing, 'renderers');
  const existingDrawArguments = readNativeProperty(existing, 'arguments');
  if (existingRenderers instanceof Set && existingDrawArguments instanceof WeakMap) {
    observedNativeRendererSets.add(existingRenderers);
    observedNativeDrawArgumentMaps.add(existingDrawArguments);
  } else if (typeof draw === 'function') {
    try {
      const captured = existing instanceof Set ? existing : new Set<object>([renderer]);
      const capturedArguments = new WeakMap<object, unknown[]>();
      const wrappedDraw = function (this: object, ...args: unknown[]) {
        captured.add(this);
        capturedArguments.set(this, args);
        return Reflect.apply(draw, this, args);
      };
      Object.defineProperty(wrappedDraw, NATIVE_RENDERER_CAPTURE_MARKER, {
        value: { arguments: capturedArguments, renderers: captured },
      });
      Object.defineProperty(prototype, 'Dg', {
        configurable: true,
        writable: true,
        value: wrappedDraw,
      });
      observedNativeRendererSets.add(captured);
      observedNativeDrawArgumentMaps.add(capturedArguments);
    } catch {
      // A synthetic Pixi wrapper remains available if the prototype is locked.
    }
  }

  const render = readNativeReflectProperty(prototype, 'render');
  const existingRenderCapture = readNativeReflectProperty(render, NATIVE_RENDER_CAPTURE_MARKER);
  let capturedRenderArguments: WeakMap<object, unknown[]> | null = null;
  if (existingRenderCapture instanceof WeakMap) {
    capturedRenderArguments = existingRenderCapture;
  } else if (typeof render === 'function') {
    try {
      const capturedArguments = new WeakMap<object, unknown[]>();
      const wrappedRender = function (this: object, ...args: unknown[]) {
        capturedArguments.set(this, args);
        return Reflect.apply(render, this, args);
      };
      Object.defineProperty(wrappedRender, NATIVE_RENDER_CAPTURE_MARKER, { value: capturedArguments });
      Object.defineProperty(prototype, 'render', {
        configurable: true,
        writable: true,
        value: wrappedRender,
      });
      capturedRenderArguments = capturedArguments;
    } catch {
      // The renderer can still use its next native frame after a resize.
    }
  }
  if (capturedRenderArguments) observedNativeRenderArgumentMaps.add(capturedRenderArguments);

  const resize = readNativeReflectProperty(prototype, 'cg');
  if (
    capturedRenderArguments &&
    typeof resize === 'function' &&
    !readNativeReflectProperty(resize, ATOMIC_RESIZE_MARKER)
  ) {
    try {
      const renderArgumentsByRenderer = capturedRenderArguments;
      const wrappedResize = function (this: object, ...args: unknown[]) {
        const result = Reflect.apply(resize, this, args);
        if (!pendingResizeRenders.has(this)) {
          pendingResizeRenders.add(this);
          queueMicrotask(() => {
            pendingResizeRenders.delete(this);
            const renderArguments = renderArgumentsByRenderer.get(this);
            const currentRender = readNativeProperty(this, 'render');
            if (renderArguments && typeof currentRender === 'function') {
              Reflect.apply(currentRender, this, renderArguments);
            }
          });
        }
        return result;
      };
      Object.defineProperty(wrappedResize, ATOMIC_RESIZE_MARKER, { value: true });
      Object.defineProperty(prototype, 'cg', {
        configurable: true,
        writable: true,
        value: wrappedResize,
      });
    } catch {
      // The next native frame remains the fallback if the prototype is locked.
    }
  }
}

function readLastArguments(renderer: object, maps: Set<WeakMap<object, unknown[]>>): unknown[] | null {
  for (const map of maps) {
    const args = map.get(renderer);
    if (args) return args;
  }
  return null;
}

export function getLastRendererDrawArguments(renderer: object): unknown[] | null {
  return readLastArguments(renderer, observedNativeDrawArgumentMaps);
}

function recoverRendererContext(renderer: object): void {
  const draw = readNativeProperty(renderer, 'Dg');
  const drawArguments = readLastArguments(renderer, observedNativeDrawArgumentMaps);
  const render = readNativeProperty(renderer, 'render');
  const renderArguments = readLastArguments(renderer, observedNativeRenderArgumentMaps);
  try {
    let replayed = false;
    if (drawArguments && typeof draw === 'function') {
      Reflect.apply(draw, renderer, drawArguments);
      replayed = true;
    }
    if (renderArguments && typeof render === 'function') {
      Reflect.apply(render, renderer, renderArguments);
      replayed = true;
    }
    if (!replayed) rerenderKnownRenderer(renderer);
  } catch {
    // A renderer that is being replaced can recover on its next native frame.
  }
}

function installRendererContextRecovery(renderer: object): void {
  const view = getRendererView(renderer);
  if (!view) return;
  rendererByContextView.set(view, renderer);
  if (contextRecoveryViews.has(view)) return;
  contextRecoveryViews.add(view);
  view.addEventListener('webglcontextlost', event => event.preventDefault());
  view.addEventListener('webglcontextrestored', () => {
    queueMicrotask(() => {
      const currentRenderer = rendererByContextView.get(view);
      if (currentRenderer && view.isConnected) recoverRendererContext(currentRenderer);
    });
  });
}

function installPixiRendererCapture(windowObject: unknown): boolean {
  const pixi = readNativeProperty(windowObject, 'PIXI');
  let installed = false;
  for (const constructorName of ['Renderer', 'AbstractRenderer']) {
    const rendererConstructor = readNativeProperty(pixi, constructorName);
    const prototype = readNativeReflectProperty(rendererConstructor, 'prototype');
    const render = readNativeProperty(prototype, 'render');
    if (
      !isNativeObject(prototype) ||
      typeof render !== 'function' ||
      readNativeReflectProperty(render, RENDER_CAPTURE_MARKER)
    ) {
      installed ||= Boolean(readNativeReflectProperty(render, RENDER_CAPTURE_MARKER));
      continue;
    }

    try {
      const wrappedRender = function (this: object, ...args: unknown[]) {
        observedPixiRenderers.add(this);
        observedRenderArguments.set(this, args);
        return Reflect.apply(render, this, args);
      };
      Object.defineProperty(wrappedRender, RENDER_CAPTURE_MARKER, { value: true });
      Object.defineProperty(prototype, 'render', {
        configurable: true,
        writable: true,
        value: wrappedRender,
      });
      installed = true;
    } catch {
      // A renderer discovered through the native session path remains usable.
    }
  }
  return installed;
}

export function rerenderKnownRenderer(renderer: unknown): void {
  const pixiRenderer = readNativeProperty(renderer, 'Ag');
  if (!isNativeObject(pixiRenderer)) return;
  const args = observedRenderArguments.get(pixiRenderer);
  const render = readNativeProperty(pixiRenderer, 'render');
  if (!args || typeof render !== 'function') return;

  try {
    Reflect.apply(render, pixiRenderer, args);
  } catch {
    // Static scenes can wait for their next native render if they are rebuilding.
  }
}

export function rerenderKnownNativeRenderer(renderer: object): void {
  const args = readLastArguments(renderer, observedNativeRenderArgumentMaps);
  const render = readNativeProperty(renderer, 'render');
  if (!args || typeof render !== 'function') {
    rerenderKnownRenderer(renderer);
    return;
  }

  try {
    Reflect.apply(render, renderer, args);
  } catch {
    rerenderKnownRenderer(renderer);
  }
}

function schedulePixiRendererCapture(windowObject: unknown = window): void {
  if (installPixiRendererCapture(windowObject)) return;
  const setIntervalMethod = readNativeProperty(windowObject, 'setInterval');
  const clearIntervalMethod = readNativeProperty(windowObject, 'clearInterval');
  if (typeof setIntervalMethod !== 'function' || typeof clearIntervalMethod !== 'function') return;
  let attempts = 0;
  const timer = Reflect.apply(setIntervalMethod, windowObject, [
    () => {
      attempts += 1;
      if (installPixiRendererCapture(windowObject) || attempts >= 200) {
        Reflect.apply(clearIntervalMethod, windowObject, [timer]);
      }
    },
    50,
  ]);
}

function getObservedRendererWrapper(pixiRenderer: object): object | null {
  const existing = observedRendererWrappers.get(pixiRenderer);
  if (existing) return existing;

  const view = readNativeProperty(pixiRenderer, 'view');
  const screen = readNativeProperty(pixiRenderer, 'screen');
  const width = Number(readNativeProperty(screen, 'width')) || Number(readNativeProperty(pixiRenderer, 'width'));
  const height = Number(readNativeProperty(screen, 'height')) || Number(readNativeProperty(pixiRenderer, 'height'));
  if (!(view instanceof Element) || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    return null;
  }

  const backing = {};
  Object.defineProperties(backing, {
    mc: { enumerable: true, get: () => Number(readNativeProperty(readNativeProperty(pixiRenderer, 'screen'), 'height')) },
    wc: { enumerable: true, get: () => Number(readNativeProperty(readNativeProperty(pixiRenderer, 'screen'), 'width')) },
  });
  const wrapper = {
    Ag: pixiRenderer,
    Bc: backing,
    Tg: view.parentElement,
  };
  observedRendererWrappers.set(pixiRenderer, wrapper);
  syntheticRendererWrappers.add(wrapper);
  return wrapper;
}

export function getKnownFullscreenRenderers(windowObject: unknown = window): object[] {
  const renderers: object[] = [];
  const seen = new Set<object>();
  const seenViews = new Set<Element>();

  installPixiRendererCapture(windowObject);

  function addRenderer(candidate: unknown): void {
    if (!isRendererCandidate(candidate) || seen.has(candidate)) {
      return;
    }

    const view = getRendererView(candidate);
    if (view && seenViews.has(view)) return;

    seen.add(candidate);
    installNativeRendererCapture(candidate);
    installRendererContextRecovery(candidate);
    if (view) seenViews.add(view);
    renderers.push(candidate);
  }

  function collect(candidate: unknown): void {
    if (!candidate) {
      return;
    }

    if (Array.isArray(candidate)) {
      candidate.forEach(collect);
      return;
    }

    addRenderer(candidate);

    const nested = readNativeProperty(candidate, 'hb');
    addRenderer(nested);

    if (Array.isArray(nested)) {
      nested.forEach(addRenderer);
    }
  }

  const multiplayerSession = readNativeProperty(windowObject, 'multiplayerSession');
  collect(multiplayerSession);
  collect(readNativePath(windowObject, ['multiplayerSession', 'KR', 'hb']));
  collect(readNativeProperty(windowObject, 'A4'));
  collect(readNativePath(windowObject, ['a8', 'II']));

  for (const captured of observedNativeRendererSets) {
    for (const renderer of captured) {
      const view = getRendererView(renderer);
      if (view && !view.isConnected) captured.delete(renderer);
      else addRenderer(renderer);
    }
  }

  for (const pixiRenderer of observedPixiRenderers) {
    const view = readNativeProperty(pixiRenderer, 'view');
    if (readNativeProperty(pixiRenderer, 'destroyed') === true || (view instanceof Element && !view.isConnected)) {
      observedPixiRenderers.delete(pixiRenderer);
      continue;
    }
    addRenderer(getObservedRendererWrapper(pixiRenderer));
  }

  return renderers;
}

schedulePixiRendererCapture();
