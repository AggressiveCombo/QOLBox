import type { FullscreenDimensions } from './fullscreen-types';

export interface FullscreenRelativeBounds {
  height: number;
  left: number;
  top: number;
  width: number;
}

interface FullscreenContainerLayoutOptions {
  setImportantStyle(element: unknown, property: string, value: string): void;
}

function alignNativePointerMenus(
  options: FullscreenContainerLayoutOptions,
  dimensions: FullscreenDimensions,
  appContainer: HTMLElement
): void {
  const appRect = appContainer.getBoundingClientRect();
  const scale = dimensions.scale || 1;
  for (const menu of appContainer.querySelectorAll<HTMLElement>('.rightClickMenu .container')) {
    menu.dataset.qolboxNativeLeft ||= menu.style.left;
    menu.dataset.qolboxNativeTop ||= menu.style.top;
    const nativeLeft = Number.parseFloat(menu.dataset.qolboxNativeLeft);
    const nativeTop = Number.parseFloat(menu.dataset.qolboxNativeTop);
    if (!Number.isFinite(nativeLeft) || !Number.isFinite(nativeTop)) {
      continue;
    }

    const pointerX = nativeLeft + appContainer.offsetLeft;
    const pointerY = nativeTop + appContainer.offsetTop;
    options.setImportantStyle(menu, 'left', `${(pointerX - appRect.left) / scale}px`);
    options.setImportantStyle(menu, 'top', `${(pointerY - appRect.top) / scale}px`);
  }
}

function applyFullscreenChromeLayout(
  options: FullscreenContainerLayoutOptions,
  dimensions: FullscreenDimensions
): void {
  const scale = dimensions.scale || 1;
  const leftInset = dimensions.left / scale;
  const topInset = dimensions.top / scale;
  const rightInset = (
    dimensions.viewportWidth - dimensions.left - dimensions.baseWidth * scale
  ) / scale;
  const bottomInset = (
    dimensions.viewportHeight - dimensions.top - dimensions.baseHeight * scale
  ) / scale;
  const viewportWidth = dimensions.viewportWidth / scale;

  for (const topBar of document.querySelectorAll('.mainMenuFancy > .topBar')) {
    options.setImportantStyle(topBar, 'left', `${-leftInset}px`);
    options.setImportantStyle(topBar, 'top', `${-topInset}px`);
    options.setImportantStyle(topBar, 'width', `${viewportWidth}px`);
  }

  for (const bottomBar of document.querySelectorAll('.mainMenuFancy > .bottomBar')) {
    options.setImportantStyle(bottomBar, 'left', `${-leftInset}px`);
    options.setImportantStyle(bottomBar, 'bottom', `${-bottomInset}px`);
    options.setImportantStyle(bottomBar, 'width', `${viewportWidth}px`);
  }

  for (const cornerButton of document.querySelectorAll('.cornerButton')) {
    options.setImportantStyle(cornerButton, 'top', `${15 - topInset}px`);
    if (cornerButton.classList.contains('left')) {
      options.setImportantStyle(cornerButton, 'left', `${15 - leftInset}px`);
    } else {
      options.setImportantStyle(cornerButton, 'right', `${15 - rightInset}px`);
    }
  }
}

export function applyFullscreenContainerLayout(
  options: FullscreenContainerLayoutOptions,
  dimensions: FullscreenDimensions
): void {
  options.setImportantStyle(document.documentElement, 'overflow', 'hidden');
  options.setImportantStyle(document.body, 'overflow', 'hidden');
  options.setImportantStyle(document.body, 'margin', '0');
  options.setImportantStyle(document.body, 'background-color', '#0a0a0a');

  const appContainer = document.getElementById('appContainer');
  const rootLeft = dimensions.left;
  const rootTop = dimensions.top;
  const rootWidth = dimensions.baseWidth;
  const rootHeight = dimensions.baseHeight;
  const rootTransform = `scale(${dimensions.scale})`;

  if (appContainer) {
    options.setImportantStyle(appContainer, 'position', 'fixed');
    options.setImportantStyle(appContainer, 'left', `${rootLeft}px`);
    options.setImportantStyle(appContainer, 'top', `${rootTop}px`);
    options.setImportantStyle(appContainer, 'right', 'auto');
    options.setImportantStyle(appContainer, 'bottom', 'auto');
    options.setImportantStyle(appContainer, 'margin', '0');
    options.setImportantStyle(appContainer, 'width', `${rootWidth}px`);
    options.setImportantStyle(appContainer, 'height', `${rootHeight}px`);
    options.setImportantStyle(appContainer, 'max-width', 'none');
    options.setImportantStyle(appContainer, 'max-height', 'none');
    options.setImportantStyle(appContainer, 'border', '0');
    // The native background is a child of this transformed frame and must be
    // allowed to paint into the fullscreen side letterboxes.
    options.setImportantStyle(appContainer, 'overflow', 'visible');
    options.setImportantStyle(appContainer, 'transform', rootTransform);
    options.setImportantStyle(appContainer, 'transform-origin', 'top left');
    alignNativePointerMenus(options, dimensions, appContainer);
  }

  const relativeContainer = document.getElementById('relativeContainer');
  if (relativeContainer) {
    options.setImportantStyle(relativeContainer, 'position', 'fixed');
    options.setImportantStyle(relativeContainer, 'left', `${rootLeft}px`);
    options.setImportantStyle(relativeContainer, 'top', `${rootTop}px`);
    options.setImportantStyle(relativeContainer, 'right', 'auto');
    options.setImportantStyle(relativeContainer, 'bottom', 'auto');
    options.setImportantStyle(relativeContainer, 'margin', '0');
    options.setImportantStyle(relativeContainer, 'width', `${rootWidth}px`);
    options.setImportantStyle(relativeContainer, 'height', `${rootHeight}px`);
    options.setImportantStyle(relativeContainer, 'overflow', 'visible');
    options.setImportantStyle(relativeContainer, 'transform', rootTransform);
    options.setImportantStyle(relativeContainer, 'transform-origin', 'top left');
  }

  const backgroundImage = document.getElementById('backgroundImage');
  if (backgroundImage) {
    const backgroundScale = dimensions.scale;
    options.setImportantStyle(backgroundImage, 'position', 'fixed');
    options.setImportantStyle(backgroundImage, 'left', `${-rootLeft / backgroundScale}px`);
    options.setImportantStyle(backgroundImage, 'top', `${-rootTop / backgroundScale}px`);
    options.setImportantStyle(backgroundImage, 'right', 'auto');
    options.setImportantStyle(backgroundImage, 'bottom', 'auto');
    options.setImportantStyle(backgroundImage, 'width', `${dimensions.viewportWidth / backgroundScale}px`);
    options.setImportantStyle(backgroundImage, 'height', `${dimensions.viewportHeight / backgroundScale}px`);
  }

  applyFullscreenChromeLayout(options, dimensions);
}
