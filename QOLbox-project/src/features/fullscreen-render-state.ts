import type {
  FullscreenBaseSize,
  FullscreenLayoutProbe,
  FullscreenViewportSize,
} from './fullscreen-types';
import { getCanvasBackingSize } from '../dom/element-guards';
import { readNativeProperty } from '../hitbox/native-access';
import { getKnownFullscreenRenderers, getRendererView } from '../hitbox/renderer-adapter';

const HITBOX_REFERENCE_VIEWPORT_WIDTH = 1366;
const HITBOX_VIEWPORT_SCALE = 1.15;
const HITBOX_MOBILE_WIDTH = 1000;
const HITBOX_MOBILE_USER_AGENT = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;

interface FullscreenRenderStateOptions {
  editorLayerSelector: string;
  fallbackBaseHeight: number;
  fallbackBaseWidth: number;
  gameplayLayerSelector: string;
  hasVisibleLayer(selector: string): boolean;
  isElementVisible(element: Element): boolean;
  menuLayerSelector: string;
  renderCanvasSelector: string;
}

export function createFullscreenRenderState(options: FullscreenRenderStateOptions) {
  function getViewportSize(): FullscreenViewportSize {
    return {
      width: Math.max(window.innerWidth, document.documentElement.clientWidth || 0),
      height: Math.max(window.innerHeight, document.documentElement.clientHeight || 0),
    };
  }

  function getBaseGameSize(): FullscreenBaseSize {
    const nativeScale = window.innerWidth / HITBOX_REFERENCE_VIEWPORT_WIDTH * HITBOX_VIEWPORT_SCALE;
    const nativeWidth = HITBOX_MOBILE_USER_AGENT.test(window.navigator?.userAgent ?? '')
      ? HITBOX_MOBILE_WIDTH
      : options.fallbackBaseWidth;
    return {
      width: Math.max(1, Math.floor(nativeWidth * nativeScale)),
      height: Math.max(1, Math.floor(options.fallbackBaseHeight * nativeScale)),
    };
  }

  function isCanvasElement(element: unknown): element is Element {
    return (
      element instanceof Element &&
      element.tagName === 'CANVAS'
    );
  }

  function getActiveRenderMode(): string {
    // During the handoff into a match both layers can exist briefly.
    // Keep using the menu frame until the replay/menu layer is actually gone.
    if (options.hasVisibleLayer(options.menuLayerSelector)) {
      return 'menu';
    }

    if (options.hasVisibleLayer(options.editorLayerSelector)) {
      return 'editor';
    }

    if (options.hasVisibleLayer(options.gameplayLayerSelector)) {
      return 'gameplay';
    }

    return 'menu';
  }

  function getActiveRenderCanvas(mode: string = getActiveRenderMode()): Element | null {
    const selector =
      mode === 'gameplay'
        ? options.gameplayLayerSelector
        : mode === 'editor'
          ? options.editorLayerSelector
          : options.menuLayerSelector;

    for (const layer of document.querySelectorAll(selector)) {
      if (!options.isElementVisible(layer)) {
        continue;
      }

      const canvas = layer.querySelector('canvas');
      if (isCanvasElement(canvas)) {
        return canvas;
      }
    }

    const fallback = document.querySelector(options.renderCanvasSelector);
    return isCanvasElement(fallback) ? fallback : null;
  }

  function getLayoutProbe(): FullscreenLayoutProbe {
    const appContainer = document.getElementById('appContainer');
    const relativeContainer = document.getElementById('relativeContainer');
    const renderLayer = getActiveRenderCanvas();
    const appRect = appContainer ? appContainer.getBoundingClientRect() : null;
    const relativeRect = relativeContainer ? relativeContainer.getBoundingClientRect() : null;
    const renderRect = renderLayer ? renderLayer.getBoundingClientRect() : null;
    const renderers = getKnownFullscreenRenderers();
    const renderer = renderers.find(candidate => getRendererView(candidate) === renderLayer);
    const pixiRenderer = readNativeProperty(renderer, 'Ag');
    const rendererScreen = readNativeProperty(pixiRenderer, 'screen');
    const backingSize = getCanvasBackingSize(renderLayer);

    return {
      appWidth: appRect ? Math.round(appRect.width) : 0,
      appHeight: appRect ? Math.round(appRect.height) : 0,
      relativeWidth: relativeRect ? Math.round(relativeRect.width) : 0,
      relativeHeight: relativeRect ? Math.round(relativeRect.height) : 0,
      renderWidth: renderRect ? Math.round(renderRect.width) : 0,
      renderHeight: renderRect ? Math.round(renderRect.height) : 0,
      renderLeft: renderRect ? Math.round(renderRect.left) : 0,
      renderTop: renderRect ? Math.round(renderRect.top) : 0,
      backingWidth: backingSize ? Math.round(backingSize.width) : 0,
      backingHeight: backingSize ? Math.round(backingSize.height) : 0,
      rendererCount: renderers.length,
      rendererLogicalWidth: Number(readNativeProperty(rendererScreen, 'width')) || 0,
      rendererLogicalHeight: Number(readNativeProperty(rendererScreen, 'height')) || 0,
      rendererResolution: Number(readNativeProperty(pixiRenderer, 'resolution')) || 0,
    };
  }

  return {
    getActiveRenderCanvas,
    getActiveRenderMode,
    getBaseGameSize,
    getLayoutProbe,
    getViewportSize,
  };
}
