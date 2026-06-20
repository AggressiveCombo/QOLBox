import type { FullscreenDimensions, FullscreenViewportSize } from './fullscreen-types';
import {
  applyFullscreenContainerLayout,
  type FullscreenRelativeBounds,
} from './fullscreen-container-layout';
import type { EditorFrame } from './fullscreen-editor-frame-layout';
import { createFullscreenEditorFrameLayout } from './fullscreen-editor-frame-layout';
import { createFullscreenRenderFrameLayout } from './fullscreen-render-frame-layout';

interface FullscreenFrameLayoutOptions {
  ensureGlobalStyle(): void;
  getFullscreenDimensions(viewport?: FullscreenViewportSize, mode?: string): FullscreenDimensions;
  getNativeUiZoom(dimensions: FullscreenDimensions): number;
  getRelativeContainerBounds(dimensions: FullscreenDimensions): FullscreenRelativeBounds;
  isEditorCanvas(element: unknown): boolean;
  isEditorLayer(element: unknown): boolean;
  layoutRelativeHud(relativeBounds: unknown, dimensions: FullscreenDimensions): void;
  renderCanvasSelector: string;
  renderLayerSelector: string;
  setImportantStyle(element: unknown, property: string, value: string): void;
}

export function createFullscreenFrameLayout(options: FullscreenFrameLayoutOptions) {
  const editorFrameLayout = createFullscreenEditorFrameLayout({
    setImportantStyle: options.setImportantStyle,
  });

  function getScaledEditorFrame(
    editorLayer: unknown,
    dimensions: FullscreenDimensions = options.getFullscreenDimensions(undefined, 'editor')
  ): EditorFrame {
    return editorFrameLayout.getScaledEditorFrame(editorLayer, dimensions);
  }

  function fitEditorCanvasToNative(canvas: unknown, frame: EditorFrame | null): void {
    editorFrameLayout.fitEditorCanvasToNative(canvas, frame);
  }

  function fitEditorLayerToFrame(
    layer: unknown,
    dimensions: FullscreenDimensions = options.getFullscreenDimensions(undefined, 'editor')
  ): EditorFrame | null {
    return editorFrameLayout.fitEditorLayerToFrame(layer, dimensions);
  }

  const renderFrameLayout = createFullscreenRenderFrameLayout({
    fitEditorCanvasToNative,
    fitEditorLayerToFrame,
    getScaledEditorFrame,
    isEditorCanvas: options.isEditorCanvas,
    isEditorLayer: options.isEditorLayer,
    renderCanvasSelector: options.renderCanvasSelector,
    renderLayerSelector: options.renderLayerSelector,
    setImportantStyle: options.setImportantStyle,
  });

  function fitElementToFrame(
    element: unknown,
    dimensions: FullscreenDimensions = options.getFullscreenDimensions(),
    left = 0,
    top = 0
  ): void {
    renderFrameLayout.fitElementToFrame(element, dimensions, left, top);
  }

  function enforceFullscreenLayout(dimensions: FullscreenDimensions = options.getFullscreenDimensions()): boolean {
    options.ensureGlobalStyle();
    const menuDimensions =
      dimensions.mode === 'menu' ? dimensions : options.getFullscreenDimensions(undefined, 'menu');
    const playDimensions =
      dimensions.mode === 'gameplay' || dimensions.mode === 'editor'
        ? dimensions
        : options.getFullscreenDimensions(undefined, 'gameplay');
    const activeDimensions =
      dimensions.mode === 'gameplay' || dimensions.mode === 'editor' ? playDimensions : menuDimensions;
    const relativeBounds = options.getRelativeContainerBounds(activeDimensions);

    applyFullscreenContainerLayout(options, dimensions, activeDimensions, relativeBounds);

    renderFrameLayout.fitRenderLayersToFrame(activeDimensions);
    renderFrameLayout.fitRenderCanvasesToFrame(activeDimensions);

    const uiZoom = String(options.getNativeUiZoom(activeDimensions));
    for (const overlay of document.querySelectorAll('.inGameCSS')) {
      options.setImportantStyle(overlay, 'zoom', uiZoom);
      options.setImportantStyle(overlay, 'transform-origin', 'top left');
    }

    options.layoutRelativeHud(relativeBounds, activeDimensions);
    return true;
  }

  return {
    enforceFullscreenLayout,
    fitEditorCanvasToNative,
    fitEditorLayerToFrame,
    fitElementToFrame,
    getScaledEditorFrame,
  };
}
