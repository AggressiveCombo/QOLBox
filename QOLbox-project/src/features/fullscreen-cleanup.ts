import { hasDataset } from '../dom/element-guards';

interface FullscreenCleanupOptions {
  clearFullscreenSignature(): void;
  clearFullscreenStyleSnapshots(): void;
  renderCanvasSelector: string;
  renderLayerSelector: string;
  resetScorePanelLayout(scorePanel: Element): void;
  resetSpectateControlsLayout(spectateControls: Element): void;
  restoreFullscreenStyles(element: unknown, properties: Iterable<string>): void;
  restoreNativeFullscreenPatch(): void;
  restoreNativeLayoutSizeFallback(): void;
}

const APP_CONTAINER_PROPERTIES = [
  'position',
  'left',
  'top',
  'right',
  'bottom',
  'margin',
  'width',
  'height',
  'max-width',
  'max-height',
  'border',
  'overflow',
];

const BACKGROUND_IMAGE_PROPERTIES = ['position', 'left', 'top', 'right', 'bottom', 'width', 'height'];

const FRAME_PROPERTIES = [
  'position',
  'left',
  'top',
  'right',
  'bottom',
  'margin',
  'width',
  'height',
  'max-width',
  'max-height',
  'overflow',
  'transform',
  'transform-origin',
  'zoom',
];

const RELATIVE_CONTAINER_PROPERTIES = [
  'position',
  'left',
  'top',
  'right',
  'bottom',
  'margin',
  'width',
  'height',
  'overflow',
];

function deleteDatasetValue(element: Element, key: string): void {
  if (hasDataset(element)) {
    delete element.dataset[key];
  }
}

function shouldDispatchNativeResizeAfterCleanup(): boolean {
  const appContainer = document.getElementById('appContainer');
  const relativeContainer = document.getElementById('relativeContainer');
  return (
    appContainer?.style.position === 'fixed' ||
    relativeContainer?.style.position === 'fixed' ||
    document.documentElement.style.overflow === 'hidden'
  );
}

function dispatchNativeResizeAfterCleanup(): void {
  try {
    window.dispatchEvent(new Event('resize'));
  } catch {
    // Native resize listeners are best-effort; QOLBox-owned styles are still restored.
  }
}

export function createFullscreenCleanup(options: FullscreenCleanupOptions) {
  function clearFullscreenLayoutStyles(): void {
    const needsNativeResize = shouldDispatchNativeResizeAfterCleanup();

    options.clearFullscreenSignature();

    options.restoreFullscreenStyles(document.documentElement, ['overflow']);
    options.restoreFullscreenStyles(document.body, ['overflow', 'margin', 'background-color']);

    options.restoreFullscreenStyles(document.getElementById('appContainer'), APP_CONTAINER_PROPERTIES);
    options.restoreFullscreenStyles(document.getElementById('relativeContainer'), RELATIVE_CONTAINER_PROPERTIES);
    options.restoreFullscreenStyles(document.getElementById('backgroundImage'), BACKGROUND_IMAGE_PROPERTIES);

    for (const element of document.querySelectorAll(options.renderLayerSelector)) {
      options.restoreFullscreenStyles(element, FRAME_PROPERTIES);
      deleteDatasetValue(element, 'qolboxEditorNativeWidth');
      deleteDatasetValue(element, 'qolboxEditorNativeHeight');
      deleteDatasetValue(element, 'qolboxEditorScale');
    }

    for (const canvas of document.querySelectorAll(options.renderCanvasSelector)) {
      options.restoreFullscreenStyles(canvas, FRAME_PROPERTIES);
    }

    for (const overlay of document.querySelectorAll('.inGameCSS')) {
      options.restoreFullscreenStyles(overlay, ['zoom', 'transform-origin']);
    }

    for (const scorePanel of document.querySelectorAll('.scores')) {
      options.resetScorePanelLayout(scorePanel);
      options.restoreFullscreenStyles(scorePanel, ['display']);
    }

    for (const scoreRow of document.querySelectorAll('.scores .entryContainer')) {
      options.restoreFullscreenStyles(scoreRow, ['background-color']);
    }

    for (const spectateControls of document.querySelectorAll('.spectateControls')) {
      options.resetSpectateControlsLayout(spectateControls);
    }

    for (const editorStatusWindow of document.querySelectorAll('.physicsCountWindow')) {
      options.restoreFullscreenStyles(editorStatusWindow, [
        'position',
        'left',
        'top',
        'right',
        'bottom',
        'margin',
        'transform',
        'z-index',
      ]);
    }

    options.restoreNativeFullscreenPatch();
    options.restoreNativeLayoutSizeFallback();
    options.clearFullscreenStyleSnapshots();

    if (needsNativeResize) {
      dispatchNativeResizeAfterCleanup();
    }
  }

  return {
    clearFullscreenLayoutStyles,
  };
}
