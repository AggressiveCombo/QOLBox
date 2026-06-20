import { getCanvasBackingSize, hasDataset } from '../dom/element-guards';
import type { FullscreenDimensions } from './fullscreen-types';

interface FullscreenEditorFrameLayoutOptions {
  setImportantStyle(element: unknown, property: string, value: string): void;
}

const EDITOR_STATUS_BLOCKER_MARGIN_PX = 8;
const EDITOR_STATUS_VIEWPORT_MARGIN_PX = 5;
const EDITOR_STATUS_RADIO_TRACKING_FRAMES = 60;

export interface EditorFrame {
  height: number;
  left: number;
  scale: number;
  top: number;
  visualHeight: number;
  visualWidth: number;
  width: number;
}

export function createFullscreenEditorFrameLayout(options: FullscreenEditorFrameLayoutOptions) {
  let latestEditorFrame: EditorFrame | null = null;
  let observedJukebox: Element | null = null;
  let jukeboxStatusObserver: MutationObserver | null = null;
  let statusLayoutFrame = 0;
  let statusLayoutFramesRemaining = 0;

  function getEditorNativeSize(editorLayer: unknown, dimensions: FullscreenDimensions): { height: number; width: number } {
    const canvas = editorLayer instanceof Element ? editorLayer.querySelector('canvas') : null;
    const canvasSize = getCanvasBackingSize(canvas);
    const canvasWidth = Number(canvasSize?.width);
    const canvasHeight = Number(canvasSize?.height);

    return {
      width: Number.isFinite(canvasWidth) && canvasWidth > 0 ? canvasWidth : dimensions.baseWidth,
      height: Number.isFinite(canvasHeight) && canvasHeight > 0 ? canvasHeight : dimensions.baseHeight,
    };
  }

  function getScaledEditorFrame(editorLayer: unknown, dimensions: FullscreenDimensions): EditorFrame {
    const nativeSize = getEditorNativeSize(editorLayer, dimensions);
    const scale = Math.max(
      0.01,
      Math.min(dimensions.width / nativeSize.width, dimensions.height / nativeSize.height)
    );
    const visualWidth = Math.max(1, Math.round(nativeSize.width * scale));
    const visualHeight = Math.max(1, Math.round(nativeSize.height * scale));

    return {
      left: dimensions.left + Math.max(0, Math.floor((dimensions.width - visualWidth) / 2)),
      top: dimensions.top + Math.max(0, Math.floor((dimensions.height - visualHeight) / 2)),
      width: nativeSize.width,
      height: nativeSize.height,
      scale,
      visualWidth,
      visualHeight,
    };
  }

  function getVisibleRect(element: Element): DOMRect | null {
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden' || rect.width <= 0 || rect.height <= 0) {
      return null;
    }

    return rect;
  }

  function intersectsHorizontally(rect: DOMRect, left: number, right: number): boolean {
    return rect.right > left && rect.left < right;
  }

  function getJukeboxTop(left: number, right: number): number | null {
    const jukebox = document.querySelector('.jukebox');
    if (!(jukebox instanceof Element)) {
      return null;
    }

    const candidates = [jukebox, ...Array.from(jukebox.querySelectorAll('*'))];
    let top: number | null = null;

    for (const candidate of candidates) {
      const rect = getVisibleRect(candidate);
      if (!rect || !intersectsHorizontally(rect, left, right)) {
        continue;
      }

      if (rect.top > window.innerHeight + EDITOR_STATUS_BLOCKER_MARGIN_PX || rect.bottom < 0) {
        continue;
      }

      top = top === null ? rect.top : Math.min(top, rect.top);
    }

    return top;
  }

  function getSpectatorControlsTop(left: number, right: number): number | null {
    let top: number | null = null;

    for (const controls of document.querySelectorAll('.spectateControls')) {
      const rect = getVisibleRect(controls);
      if (!rect || !intersectsHorizontally(rect, left, right)) {
        continue;
      }

      top = top === null ? rect.top : Math.min(top, rect.top);
    }

    return top;
  }

  function getEditorStatusMaxTop(left: number, right: number, height: number): number {
    const viewportMaxTop = window.innerHeight - Math.ceil(height) - EDITOR_STATUS_VIEWPORT_MARGIN_PX;
    const blockerTops = [getJukeboxTop(left, right), getSpectatorControlsTop(left, right)].filter(
      (top): top is number => top !== null
    );
    if (!blockerTops.length) {
      return viewportMaxTop;
    }

    const blockerMaxTop = Math.min(...blockerTops) - Math.ceil(height) - EDITOR_STATUS_BLOCKER_MARGIN_PX;
    return Math.min(viewportMaxTop, blockerMaxTop);
  }

  function hasActiveFullscreenEditorFrame(): boolean {
    const editorLayer = document.querySelector('#editorContainer');
    return hasDataset(editorLayer) && Boolean(editorLayer.dataset.qolboxEditorScale);
  }

  function runScheduledEditorStatusLayout(): void {
    statusLayoutFrame = 0;
    if (!latestEditorFrame || !hasActiveFullscreenEditorFrame()) {
      statusLayoutFramesRemaining = 0;
      return;
    }

    layoutEditorStatusWindow(latestEditorFrame);
    statusLayoutFramesRemaining -= 1;

    if (statusLayoutFramesRemaining > 0) {
      statusLayoutFrame = window.requestAnimationFrame(runScheduledEditorStatusLayout);
    }
  }

  function scheduleEditorStatusLayout(frames = 1): void {
    statusLayoutFramesRemaining = Math.max(statusLayoutFramesRemaining, frames);
    if (!statusLayoutFrame) {
      statusLayoutFrame = window.requestAnimationFrame(runScheduledEditorStatusLayout);
    }
  }

  function observeJukeboxForEditorStatusLayout(): void {
    const jukebox = document.querySelector('.jukebox');
    if (jukebox === observedJukebox) {
      return;
    }

    jukeboxStatusObserver?.disconnect();
    observedJukebox = jukebox instanceof Element ? jukebox : null;
    if (!observedJukebox) {
      jukeboxStatusObserver = null;
      return;
    }

    jukeboxStatusObserver = new MutationObserver(() => {
      scheduleEditorStatusLayout(EDITOR_STATUS_RADIO_TRACKING_FRAMES);
    });
    jukeboxStatusObserver.observe(observedJukebox, {
      attributes: true,
      attributeFilter: ['class', 'style'],
      subtree: true,
    });
  }

  function fitEditorCanvasToNative(canvas: unknown, frame: EditorFrame | null): void {
    if (!canvas || !frame) {
      return;
    }

    options.setImportantStyle(canvas, 'position', 'absolute');
    options.setImportantStyle(canvas, 'left', '0');
    options.setImportantStyle(canvas, 'top', '0');
    options.setImportantStyle(canvas, 'right', 'auto');
    options.setImportantStyle(canvas, 'bottom', 'auto');
    options.setImportantStyle(canvas, 'width', `${frame.width}px`);
    options.setImportantStyle(canvas, 'height', `${frame.height}px`);
    options.setImportantStyle(canvas, 'max-width', 'none');
    options.setImportantStyle(canvas, 'max-height', 'none');
    options.setImportantStyle(canvas, 'transform', 'none');
  }

  function layoutEditorStatusWindow(frame: EditorFrame): void {
    const statusWindow = document.querySelector('.physicsCountWindow');
    if (!(statusWindow instanceof Element)) {
      return;
    }

    const rect = statusWindow.getBoundingClientRect();
    const width = rect.width || 186;
    const height = rect.height || 22;
    const left = Math.max(0, Math.round(frame.left + (frame.visualWidth - width) / 2));
    const preferredTop = frame.top + frame.visualHeight + 12;
    const maxTop = getEditorStatusMaxTop(left, left + width, height);
    const top = Math.max(0, Math.min(Math.round(preferredTop), Math.round(maxTop)));

    options.setImportantStyle(statusWindow, 'position', 'fixed');
    options.setImportantStyle(statusWindow, 'left', `${left}px`);
    options.setImportantStyle(statusWindow, 'top', `${top}px`);
    options.setImportantStyle(statusWindow, 'right', 'auto');
    options.setImportantStyle(statusWindow, 'bottom', 'auto');
    options.setImportantStyle(statusWindow, 'margin', '0');
    options.setImportantStyle(statusWindow, 'transform', 'none');
    options.setImportantStyle(statusWindow, 'z-index', '2147483001');
  }

  function fitEditorLayerToFrame(layer: unknown, dimensions: FullscreenDimensions): EditorFrame | null {
    if (!(layer instanceof Element)) {
      return null;
    }

    const frame = getScaledEditorFrame(layer, dimensions);
    latestEditorFrame = frame;

    options.setImportantStyle(layer, 'position', 'absolute');
    options.setImportantStyle(layer, 'left', `${frame.left}px`);
    options.setImportantStyle(layer, 'top', `${frame.top}px`);
    options.setImportantStyle(layer, 'right', 'auto');
    options.setImportantStyle(layer, 'bottom', 'auto');
    options.setImportantStyle(layer, 'width', `${frame.width}px`);
    options.setImportantStyle(layer, 'height', `${frame.height}px`);
    options.setImportantStyle(layer, 'max-width', 'none');
    options.setImportantStyle(layer, 'max-height', 'none');
    options.setImportantStyle(layer, 'overflow', 'visible');
    options.setImportantStyle(layer, 'transform', `scale(${frame.scale})`);
    options.setImportantStyle(layer, 'transform-origin', 'top left');
    options.setImportantStyle(layer, 'zoom', '1');
    if (hasDataset(layer)) {
      layer.dataset.qolboxEditorNativeWidth = String(frame.width);
      layer.dataset.qolboxEditorNativeHeight = String(frame.height);
      layer.dataset.qolboxEditorScale = String(frame.scale);
    }

    const canvas = layer.querySelector('canvas');
    if (canvas) {
      fitEditorCanvasToNative(canvas, frame);
    }

    observeJukeboxForEditorStatusLayout();
    layoutEditorStatusWindow(frame);

    return frame;
  }

  return {
    fitEditorCanvasToNative,
    fitEditorLayerToFrame,
    getScaledEditorFrame,
  };
}
