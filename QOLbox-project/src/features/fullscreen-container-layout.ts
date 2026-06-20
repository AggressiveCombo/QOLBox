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

export function applyFullscreenContainerLayout(
  options: FullscreenContainerLayoutOptions,
  dimensions: FullscreenDimensions,
  activeDimensions: FullscreenDimensions,
  relativeBounds: FullscreenRelativeBounds
): void {
  options.setImportantStyle(document.documentElement, 'overflow', 'hidden');
  options.setImportantStyle(document.body, 'overflow', 'hidden');
  options.setImportantStyle(document.body, 'margin', '0');
  options.setImportantStyle(document.body, 'background-color', '#0a0a0a');

  const appContainer = document.getElementById('appContainer');
  if (appContainer) {
    options.setImportantStyle(appContainer, 'position', 'fixed');
    options.setImportantStyle(appContainer, 'left', `${activeDimensions.shellLeft}px`);
    options.setImportantStyle(appContainer, 'top', `${activeDimensions.shellTop}px`);
    options.setImportantStyle(appContainer, 'right', 'auto');
    options.setImportantStyle(appContainer, 'bottom', 'auto');
    options.setImportantStyle(appContainer, 'margin', '0');
    options.setImportantStyle(appContainer, 'width', `${activeDimensions.shellWidth}px`);
    options.setImportantStyle(appContainer, 'height', `${activeDimensions.shellHeight}px`);
    options.setImportantStyle(appContainer, 'max-width', 'none');
    options.setImportantStyle(appContainer, 'max-height', 'none');
    options.setImportantStyle(appContainer, 'border', '0');
    options.setImportantStyle(appContainer, 'overflow', 'hidden');
  }

  const relativeContainer = document.getElementById('relativeContainer');
  if (relativeContainer) {
    options.setImportantStyle(relativeContainer, 'position', 'fixed');
    options.setImportantStyle(relativeContainer, 'left', `${relativeBounds.left}px`);
    options.setImportantStyle(relativeContainer, 'top', `${relativeBounds.top}px`);
    options.setImportantStyle(relativeContainer, 'right', 'auto');
    options.setImportantStyle(relativeContainer, 'bottom', 'auto');
    options.setImportantStyle(relativeContainer, 'margin', '0');
    options.setImportantStyle(relativeContainer, 'width', `${relativeBounds.width}px`);
    options.setImportantStyle(relativeContainer, 'height', `${relativeBounds.height}px`);
    options.setImportantStyle(relativeContainer, 'overflow', 'visible');
  }

  const backgroundImage = document.getElementById('backgroundImage');
  if (backgroundImage) {
    options.setImportantStyle(backgroundImage, 'position', 'fixed');
    options.setImportantStyle(backgroundImage, 'left', '0');
    options.setImportantStyle(backgroundImage, 'top', '0');
    options.setImportantStyle(backgroundImage, 'right', 'auto');
    options.setImportantStyle(backgroundImage, 'bottom', 'auto');
    options.setImportantStyle(backgroundImage, 'width', `${dimensions.viewportWidth}px`);
    options.setImportantStyle(backgroundImage, 'height', `${dimensions.viewportHeight}px`);
  }
}
