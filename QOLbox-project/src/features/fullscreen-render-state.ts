import type {
  FullscreenBaseSize,
  FullscreenLayoutProbe,
  FullscreenViewportSize,
} from './fullscreen-types';
import { getCanvasBackingSize } from '../dom/element-guards';
import { getNativeBaseGameSize, getNativeFullscreenLayoutSize } from '../hitbox/native-game-adapter';
import { getKnownFullscreenRenderers } from '../hitbox/renderer-adapter';

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
    return getNativeBaseGameSize({
      width: options.fallbackBaseWidth,
      height: options.fallbackBaseHeight,
    });
  }

  function isEditorLayer(element: unknown): element is Element {
    return element instanceof Element && element.id === 'editorContainer';
  }

  function isCanvasElement(element: unknown): element is Element {
    return (
      element instanceof Element &&
      element.tagName === 'CANVAS'
    );
  }

  function isEditorCanvas(element: unknown): element is Element {
    return (
      isCanvasElement(element) &&
      element.parentElement instanceof Element &&
      element.parentElement.id === 'editorContainer'
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
    const backingSize = getCanvasBackingSize(renderLayer);
    const nativeLayoutSize = getNativeFullscreenLayoutSize();

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
      nativeWidth: nativeLayoutSize.width,
      nativeHeight: nativeLayoutSize.height,
    };
  }

  return {
    getActiveRenderCanvas,
    getActiveRenderMode,
    getBaseGameSize,
    getLayoutProbe,
    getViewportSize,
    isEditorCanvas,
    isEditorLayer,
  };
}
