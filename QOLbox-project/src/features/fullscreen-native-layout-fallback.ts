import { getCanvasBackingSize, isStyledElement, type StyleDeclarationLike } from '../dom/element-guards';

interface FullscreenNativeLayoutFallbackOptions {
  getActiveRenderCanvas(): Element | null;
  waitMs: number;
}

function getStyleDeclaration(element: unknown): StyleDeclarationLike | null {
  if (isStyledElement(element)) {
    return element.style;
  }

  return null;
}

function hasStyleSize(element: unknown): boolean {
  const style = getStyleDeclaration(element);
  return Boolean(style?.width && style.height);
}

function setStyleSizeIfEmpty(element: unknown, width: string, height: string): void {
  const style = getStyleDeclaration(element);
  if (!style || style.width || style.height) {
    return;
  }

  style.width = width;
  style.height = height;
}

export function createFullscreenNativeLayoutFallback(options: FullscreenNativeLayoutFallbackOptions) {
  let waitStartedAt = 0;

  function hasNativeLayoutSeed(): boolean {
    const appContainer = document.getElementById('appContainer');
    const relativeContainer = document.getElementById('relativeContainer');
    return Boolean(appContainer && relativeContainer && hasStyleSize(appContainer) && hasStyleSize(relativeContainer));
  }

  function shouldWaitForNativeLayoutSeed(): boolean {
    if (hasNativeLayoutSeed()) {
      waitStartedAt = 0;
      return false;
    }

    if (!document.getElementById('appContainer') || !document.getElementById('relativeContainer')) {
      return false;
    }

    if (!waitStartedAt) {
      waitStartedAt = Date.now();
    }

    return Date.now() - waitStartedAt < options.waitMs;
  }

  function restoreNativeLayoutSizeFallback(): void {
    const canvas = options.getActiveRenderCanvas();
    const canvasSize = getCanvasBackingSize(canvas);
    const backingWidth = canvasSize?.width ?? Number.NaN;
    const backingHeight = canvasSize?.height ?? Number.NaN;
    const pixelRatio = Math.max(1, Number(window.devicePixelRatio) || 1);
    const width = backingWidth / pixelRatio;
    const height = backingHeight / pixelRatio;

    if (
      !Number.isFinite(width) ||
      !Number.isFinite(height) ||
      width <= 0 ||
      height <= 0 ||
      width >= window.innerWidth * 0.98 ||
      height >= window.innerHeight * 0.98
    ) {
      return;
    }

    const containerWidthPx = `${Math.floor(width)}px`;
    const containerHeightPx = `${Math.floor(height)}px`;
    const canvasWidthPx = `${Math.round(width * 10) / 10}px`;
    const canvasHeightPx = `${Math.round(height * 10) / 10}px`;

    for (const element of [
      document.getElementById('appContainer'),
      document.getElementById('relativeContainer'),
    ]) {
      setStyleSizeIfEmpty(element, containerWidthPx, containerHeightPx);
    }

    setStyleSizeIfEmpty(canvas, canvasWidthPx, canvasHeightPx);
  }

  return {
    restoreNativeLayoutSizeFallback,
    shouldWaitForNativeLayoutSeed,
  };
}
