import {
  FALLBACK_BASE_HEIGHT,
  FALLBACK_BASE_WIDTH,
  FULLSCREEN_EDITOR_LAYER_SELECTOR,
  FULLSCREEN_GAMEPLAY_LAYER_SELECTOR,
  FULLSCREEN_MENU_LAYER_SELECTOR,
  FULLSCREEN_NATIVE_LAYOUT_WAIT_MS,
  FULLSCREEN_RENDER_CANVAS_SELECTOR,
} from '../config/qolbox-constants';
import { hasVisibleLayer, isElementVisible } from '../dom/dom-helpers';
import { createFullscreenGeometry } from './fullscreen-geometry';
import { createFullscreenNativeLayoutFallback } from './fullscreen-native-layout-fallback';
import { createFullscreenRenderState } from './fullscreen-render-state';
import { createFullscreenStyleManager } from './fullscreen-style-manager';

export function createFullscreenFoundationBundle() {
  const renderState = createFullscreenRenderState({
    editorLayerSelector: FULLSCREEN_EDITOR_LAYER_SELECTOR,
    fallbackBaseHeight: FALLBACK_BASE_HEIGHT,
    fallbackBaseWidth: FALLBACK_BASE_WIDTH,
    gameplayLayerSelector: FULLSCREEN_GAMEPLAY_LAYER_SELECTOR,
    hasVisibleLayer,
    isElementVisible,
    menuLayerSelector: FULLSCREEN_MENU_LAYER_SELECTOR,
    renderCanvasSelector: FULLSCREEN_RENDER_CANVAS_SELECTOR,
  });

  const nativeLayoutFallback = createFullscreenNativeLayoutFallback({
    getActiveRenderCanvas: renderState.getActiveRenderCanvas,
    waitMs: FULLSCREEN_NATIVE_LAYOUT_WAIT_MS,
  });

  const styleManager = createFullscreenStyleManager();

  const geometry = createFullscreenGeometry({
    getActiveRenderMode: renderState.getActiveRenderMode,
    getBaseGameSize: renderState.getBaseGameSize,
    getViewportSize: renderState.getViewportSize,
  });

  return {
    ...renderState,
    ...nativeLayoutFallback,
    ...styleManager,
    ...geometry,
  };
}
