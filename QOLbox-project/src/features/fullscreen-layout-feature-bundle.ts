import {
  FULLSCREEN_RENDER_CANVAS_SELECTOR,
  FULLSCREEN_RENDER_LAYER_SELECTOR,
  FULLSCREEN_SETTLE_PASSES,
} from '../config/qolbox-constants';
import { hasVisibleLayer, isElementVisible } from '../dom/dom-helpers';
import { resizeKnownFullscreenRenderers } from '../hitbox/renderer-adapter';
import { isSessionMatchActive } from '../hitbox/session-adapter';
import type { ScheduledUiWorkRequest } from '../types/scheduled-work';
import type {
  FullscreenDimensions,
  FullscreenViewportSize,
} from './fullscreen-types';
import { createFullscreenCleanup } from './fullscreen-cleanup';
import { createFullscreenFrameLayout } from './fullscreen-frame-layout';
import { createFullscreenGameReadyHook } from './fullscreen-game-ready-hook';
import { createFullscreenHudLayout } from './fullscreen-hud-layout';
import { createFullscreenResizeTargetObserver } from './fullscreen-resize-target-observer';

interface FullscreenRelativeBounds {
  height: number;
  left: number;
  top: number;
  width: number;
}

interface FullscreenLayoutFeatureBundleOptions {
  clearFullscreenSignature(): void;
  clearFullscreenStyleSnapshots(): void;
  ensureGlobalStyle(): void;
  getFullscreenDimensions(viewport?: FullscreenViewportSize, mode?: string): FullscreenDimensions;
  getNativeUiZoom(dimensions: FullscreenDimensions): number;
  getRelativeContainerBounds(dimensions: FullscreenDimensions): FullscreenRelativeBounds;
  isEditorCanvas(element: unknown): boolean;
  isEditorLayer(element: unknown): boolean;
  isFullscreenEnabled(): boolean;
  makeScoreRowsOpaque(scorePanel: Element): void;
  restoreFullscreenStyles(element: unknown, properties: Iterable<string>): void;
  restoreNativeFullscreenPatch(): void;
  restoreNativeLayoutSizeFallback(): void;
  scheduleUiWork(request: ScheduledUiWorkRequest): void;
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
    getNativeUiZoom: options.getNativeUiZoom,
    getRelativeContainerBounds: options.getRelativeContainerBounds,
    isEditorCanvas: options.isEditorCanvas,
    isEditorLayer: options.isEditorLayer,
    layoutRelativeHud: hudLayout.layoutRelativeHud,
    setImportantStyle: options.setImportantStyle,
  });

  const cleanup = createFullscreenCleanup({
    renderCanvasSelector: FULLSCREEN_RENDER_CANVAS_SELECTOR,
    renderLayerSelector: FULLSCREEN_RENDER_LAYER_SELECTOR,
    clearFullscreenSignature: options.clearFullscreenSignature,
    clearFullscreenStyleSnapshots: options.clearFullscreenStyleSnapshots,
    resetScorePanelLayout: hudLayout.resetScorePanelLayout,
    resetSpectateControlsLayout: hudLayout.resetSpectateControlsLayout,
    restoreFullscreenStyles: options.restoreFullscreenStyles,
    restoreNativeFullscreenPatch: options.restoreNativeFullscreenPatch,
    restoreNativeLayoutSizeFallback: options.restoreNativeLayoutSizeFallback,
  });

  const gameReadyHook = createFullscreenGameReadyHook({
    scheduleUiWork: options.scheduleUiWork,
    settlePasses: FULLSCREEN_SETTLE_PASSES,
  });

  const resizeTargets = createFullscreenResizeTargetObserver({
    renderCanvasSelector: FULLSCREEN_RENDER_CANVAS_SELECTOR,
    renderLayerSelector: FULLSCREEN_RENDER_LAYER_SELECTOR,
  });

  function resizeFullscreenRenderers(dimensions: FullscreenDimensions): void {
    resizeKnownFullscreenRenderers({
      dimensions,
      fitElementToFrame: frameLayout.fitElementToFrame,
      setImportantStyle: options.setImportantStyle,
    });
  }

  return {
    ...hudLayout,
    ...frameLayout,
    ...cleanup,
    ...gameReadyHook,
    ...resizeTargets,
    resizeKnownFullscreenRenderers: resizeFullscreenRenderers,
  };
}
