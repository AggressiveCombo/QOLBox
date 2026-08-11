import type { FullscreenDimensions, FullscreenViewportSize } from './fullscreen-types';
import {
  applyFullscreenContainerLayout,
  type FullscreenRelativeBounds,
} from './fullscreen-container-layout';

interface FullscreenFrameLayoutOptions {
  ensureGlobalStyle(): void;
  getFullscreenDimensions(viewport?: FullscreenViewportSize, mode?: string): FullscreenDimensions;
  getRelativeContainerBounds(dimensions: FullscreenDimensions): FullscreenRelativeBounds;
  layoutRelativeHud(relativeBounds: unknown, dimensions: FullscreenDimensions): void;
  renderCanvasSelector: string;
  renderLayerSelector: string;
  setImportantStyle(element: unknown, property: string, value: string): void;
}

export function createFullscreenFrameLayout(options: FullscreenFrameLayoutOptions) {
  function fitElementToFrame(
    element: unknown,
    dimensions: FullscreenDimensions = options.getFullscreenDimensions()
  ): void {
    if (!(element instanceof Element)) return;

    options.setImportantStyle(element, 'position', 'absolute');
    options.setImportantStyle(element, 'left', '0');
    options.setImportantStyle(element, 'top', '0');
    options.setImportantStyle(element, 'right', 'auto');
    options.setImportantStyle(element, 'bottom', 'auto');
    options.setImportantStyle(element, 'margin', '0');
    options.setImportantStyle(element, 'width', `${dimensions.baseWidth}px`);
    options.setImportantStyle(element, 'height', `${dimensions.baseHeight}px`);
    options.setImportantStyle(element, 'max-width', 'none');
    options.setImportantStyle(element, 'max-height', 'none');
    options.setImportantStyle(element, 'transform', 'none');
  }

  function fitRenderLayersToFrame(dimensions: FullscreenDimensions): void {
    for (const layer of document.querySelectorAll(options.renderLayerSelector)) {
      fitElementToFrame(layer, dimensions);
      options.setImportantStyle(layer, 'zoom', '1');
    }
  }

  function fitRenderCanvasesToFrame(dimensions: FullscreenDimensions): void {
    for (const canvas of document.querySelectorAll(options.renderCanvasSelector)) {
      fitElementToFrame(canvas, dimensions);
    }
  }

  function enforceFullscreenLayout(dimensions: FullscreenDimensions = options.getFullscreenDimensions()): boolean {
    options.ensureGlobalStyle();
    const relativeBounds = options.getRelativeContainerBounds(dimensions);

    applyFullscreenContainerLayout(options, dimensions);

    fitRenderLayersToFrame(dimensions);
    fitRenderCanvasesToFrame(dimensions);

    options.layoutRelativeHud(relativeBounds, dimensions);
    return true;
  }

  return {
    enforceFullscreenLayout,
    fitElementToFrame,
  };
}
