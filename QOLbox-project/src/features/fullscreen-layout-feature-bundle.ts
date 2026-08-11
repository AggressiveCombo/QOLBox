import {
  FULLSCREEN_RENDER_CANVAS_SELECTOR,
  FULLSCREEN_RENDER_LAYER_SELECTOR,
} from '../config/qolbox-constants';
import { hasVisibleLayer, isElementVisible } from '../dom/dom-helpers';
import { resizeKnownFullscreenRenderers } from '../hitbox/renderer-adapter';
import { isSessionMatchActive } from '../hitbox/session-adapter';
import type {
  FullscreenDimensions,
  FullscreenViewportSize,
} from './fullscreen-types';
import { createFullscreenCleanup } from './fullscreen-cleanup';
import { createFullscreenFrameLayout } from './fullscreen-frame-layout';
import { createFullscreenHudLayout } from './fullscreen-hud-layout';
import { createFullscreenResizeTargetObserver } from './fullscreen-resize-target-observer';

interface FullscreenRelativeBounds {
  height: number;
  left: number;
  top: number;
  width: number;
}

interface FullscreenLayoutFeatureBundleOptions {
  clearFullscreenStyleSnapshots(): void;
  ensureGlobalStyle(): void;
  getFullscreenDimensions(viewport?: FullscreenViewportSize, mode?: string): FullscreenDimensions;
  getRelativeContainerBounds(dimensions: FullscreenDimensions): FullscreenRelativeBounds;
  isFullscreenEnabled(): boolean;
  makeScoreRowsOpaque(scorePanel: Element): void;
  restoreFullscreenStyles(element: unknown, properties: Iterable<string>): void;
  restoreNativeLayoutSizeFallback(): void;
  setImportantStyle(element: unknown, property: string, value: string): void;
  syncScoreRowsFromPlayers(scorePanel: Element): void;
  syncTypingIndicators(scorePanel: Element): void;
}

export function createFullscreenLayoutFeatureBundle(options: FullscreenLayoutFeatureBundleOptions) {
  const hudLayout = createFullscreenHudLayout({
    scoresSelector: '.scores',
    spectateControlsSelector: '.spectateControls',
    hasVisibleLayer,
    isElementVisible,
    isFullscreenEnabled: options.isFullscreenEnabled,
    isSessionMatchActive,
    makeScoreRowsOpaque: options.makeScoreRowsOpaque,
    setImportantStyle: options.setImportantStyle,
    syncScoreRowsFromPlayers: options.syncScoreRowsFromPlayers,
    syncTypingIndicators: options.syncTypingIndicators,
  });

  const frameLayout = createFullscreenFrameLayout({
    renderCanvasSelector: FULLSCREEN_RENDER_CANVAS_SELECTOR,
    renderLayerSelector: FULLSCREEN_RENDER_LAYER_SELECTOR,
    ensureGlobalStyle: options.ensureGlobalStyle,
    getFullscreenDimensions: options.getFullscreenDimensions,
    getRelativeContainerBounds: options.getRelativeContainerBounds,
    layoutRelativeHud: hudLayout.layoutRelativeHud,
    setImportantStyle: options.setImportantStyle,
  });

  const cleanup = createFullscreenCleanup({
    renderCanvasSelector: FULLSCREEN_RENDER_CANVAS_SELECTOR,
    renderLayerSelector: FULLSCREEN_RENDER_LAYER_SELECTOR,
    clearFullscreenStyleSnapshots: options.clearFullscreenStyleSnapshots,
    resetScorePanelLayout: hudLayout.resetScorePanelLayout,
    resetSpectateControlsLayout: hudLayout.resetSpectateControlsLayout,
    restoreFullscreenStyles: options.restoreFullscreenStyles,
    restoreNativeLayoutSizeFallback: options.restoreNativeLayoutSizeFallback,
  });

  const resizeTargets = createFullscreenResizeTargetObserver({
    renderCanvasSelector: FULLSCREEN_RENDER_CANVAS_SELECTOR,
    renderLayerSelector: FULLSCREEN_RENDER_LAYER_SELECTOR,
  });

  function resizeFullscreenRenderers(dimensions: FullscreenDimensions): void {
    resizeKnownFullscreenRenderers({
      dimensions,
      fitElementToFrame: frameLayout.fitElementToFrame,
    });
  }

  return {
    ...hudLayout,
    ...frameLayout,
    ...cleanup,
    ...resizeTargets,
    resizeKnownFullscreenRenderers: resizeFullscreenRenderers,
  };
}
