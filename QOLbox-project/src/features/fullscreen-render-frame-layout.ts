import type { FullscreenDimensions } from './fullscreen-types';
import type { EditorFrame } from './fullscreen-editor-frame-layout';

interface FullscreenRenderFrameLayoutOptions {
  fitEditorCanvasToNative(canvas: unknown, frame: EditorFrame | null): void;
  fitEditorLayerToFrame(layer: unknown, dimensions: FullscreenDimensions): EditorFrame | null;
  getScaledEditorFrame(editorLayer: unknown, dimensions: FullscreenDimensions): EditorFrame;
  isEditorCanvas(element: unknown): boolean;
  isEditorLayer(element: unknown): boolean;
  renderCanvasSelector: string;
  renderLayerSelector: string;
  setImportantStyle(element: unknown, property: string, value: string): void;
}

export function createFullscreenRenderFrameLayout(options: FullscreenRenderFrameLayoutOptions) {
  function fitElementToFrame(
    element: unknown,
    dimensions: FullscreenDimensions,
    left = 0,
    top = 0
  ): void {
    if (!(element instanceof Element)) {
      return;
    }

    if (options.isEditorLayer(element)) {
      options.fitEditorLayerToFrame(element, dimensions);
      return;
    }

    options.setImportantStyle(element, 'position', 'absolute');
    options.setImportantStyle(element, 'left', `${left}px`);
    options.setImportantStyle(element, 'top', `${top}px`);
    options.setImportantStyle(element, 'right', 'auto');
    options.setImportantStyle(element, 'bottom', 'auto');
    options.setImportantStyle(element, 'margin', '0');
    options.setImportantStyle(element, 'width', `${dimensions.width}px`);
    options.setImportantStyle(element, 'height', `${dimensions.height}px`);
    options.setImportantStyle(element, 'max-width', 'none');
    options.setImportantStyle(element, 'max-height', 'none');
    options.setImportantStyle(element, 'overflow', 'hidden');
    options.setImportantStyle(element, 'transform', 'none');
  }

  function fitRenderLayersToFrame(dimensions: FullscreenDimensions): void {
    for (const layer of document.querySelectorAll(options.renderLayerSelector)) {
      if (options.isEditorLayer(layer)) {
        options.fitEditorLayerToFrame(layer, dimensions);
        continue;
      }

      options.setImportantStyle(layer, 'position', 'absolute');
      options.setImportantStyle(layer, 'left', `${dimensions.left}px`);
      options.setImportantStyle(layer, 'top', `${dimensions.top}px`);
      options.setImportantStyle(layer, 'right', 'auto');
      options.setImportantStyle(layer, 'bottom', 'auto');
      options.setImportantStyle(layer, 'width', `${dimensions.width}px`);
      options.setImportantStyle(layer, 'height', `${dimensions.height}px`);
      options.setImportantStyle(layer, 'max-width', 'none');
      options.setImportantStyle(layer, 'max-height', 'none');
      options.setImportantStyle(layer, 'overflow', 'hidden');
      options.setImportantStyle(layer, 'transform', 'none');
      options.setImportantStyle(layer, 'zoom', '1');
    }
  }

  function fitRenderCanvasesToFrame(dimensions: FullscreenDimensions): void {
    for (const canvas of document.querySelectorAll(options.renderCanvasSelector)) {
      if (options.isEditorCanvas(canvas)) {
        const editorLayer = canvas.parentElement;
        const frame = options.getScaledEditorFrame(editorLayer, dimensions);
        options.fitEditorCanvasToNative(canvas, frame);
        continue;
      }

      options.setImportantStyle(canvas, 'position', 'absolute');
      options.setImportantStyle(canvas, 'left', '0');
      options.setImportantStyle(canvas, 'top', '0');
      options.setImportantStyle(canvas, 'right', 'auto');
      options.setImportantStyle(canvas, 'bottom', 'auto');
      options.setImportantStyle(canvas, 'width', `${dimensions.width}px`);
      options.setImportantStyle(canvas, 'height', `${dimensions.height}px`);
      options.setImportantStyle(canvas, 'max-width', 'none');
      options.setImportantStyle(canvas, 'max-height', 'none');
      options.setImportantStyle(canvas, 'transform', 'none');
    }
  }

  return {
    fitElementToFrame,
    fitRenderCanvasesToFrame,
    fitRenderLayersToFrame,
  };
}
