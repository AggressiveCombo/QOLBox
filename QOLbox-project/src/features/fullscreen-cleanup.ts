import { restoreKnownFullscreenRenderers } from '../hitbox/renderer-adapter';

interface FullscreenCleanupOptions {
  clearFullscreenStyleSnapshots(): void;
  renderCanvasSelector: string;
  renderLayerSelector: string;
  resetScorePanelLayout(scorePanel: Element): void;
  resetSpectateControlsLayout(spectateControls: Element): void;
  restoreFullscreenStyles(element: unknown, properties: Iterable<string>): void;
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
  'transform',
  'transform-origin',
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
  'transform',
  'transform-origin',
];

export function createFullscreenCleanup(options: FullscreenCleanupOptions) {
  function clearFullscreenLayoutStyles(): void {
    options.restoreFullscreenStyles(document.documentElement, ['overflow']);
    options.restoreFullscreenStyles(document.body, ['overflow', 'margin', 'background-color']);

    options.restoreFullscreenStyles(document.getElementById('appContainer'), APP_CONTAINER_PROPERTIES);
    options.restoreFullscreenStyles(document.getElementById('relativeContainer'), RELATIVE_CONTAINER_PROPERTIES);
    options.restoreFullscreenStyles(document.getElementById('backgroundImage'), BACKGROUND_IMAGE_PROPERTIES);

    for (const topBar of document.querySelectorAll('.mainMenuFancy > .topBar')) {
      options.restoreFullscreenStyles(topBar, ['left', 'top', 'width']);
    }

    for (const bottomBar of document.querySelectorAll('.mainMenuFancy > .bottomBar')) {
      options.restoreFullscreenStyles(bottomBar, ['left', 'bottom', 'width']);
    }

    for (const cornerButton of document.querySelectorAll('.cornerButton')) {
      options.restoreFullscreenStyles(cornerButton, ['left', 'right', 'top']);
    }

    for (const element of document.querySelectorAll(options.renderLayerSelector)) {
      options.restoreFullscreenStyles(element, FRAME_PROPERTIES);
    }

    for (const canvas of document.querySelectorAll(options.renderCanvasSelector)) {
      options.restoreFullscreenStyles(canvas, FRAME_PROPERTIES);
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

    for (const menu of document.querySelectorAll<HTMLElement>('.rightClickMenu .container')) {
      options.restoreFullscreenStyles(menu, ['left', 'top']);
      delete menu.dataset.qolboxNativeLeft;
      delete menu.dataset.qolboxNativeTop;
    }

    for (const physicsCount of document.querySelectorAll('.physicsCountWindow')) {
      options.restoreFullscreenStyles(physicsCount, ['bottom']);
    }

    options.restoreNativeLayoutSizeFallback();
    options.clearFullscreenStyleSnapshots();

    restoreKnownFullscreenRenderers();
  }

  return {
    clearFullscreenLayoutStyles,
  };
}
