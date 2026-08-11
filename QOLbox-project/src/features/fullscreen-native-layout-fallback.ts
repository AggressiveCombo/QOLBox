import { getCanvasBackingSize, isStyledElement, type StyleDeclarationLike } from '../dom/element-guards';
import { getRendererLogicalSize } from '../hitbox/renderer-adapter';

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

function setStyleSize(element: unknown, width: string, height: string): void {
  const style = getStyleDeclaration(element);
  if (!style) {
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
    const rawPixelRatio = Number(window.devicePixelRatio);
    const pixelRatio = Number.isFinite(rawPixelRatio) && rawPixelRatio > 0 ? rawPixelRatio : 1;
    const rendererSize = getRendererLogicalSize(canvas);
    const nativeWidth = rendererSize?.width ?? backingWidth / pixelRatio;
    const nativeHeight = rendererSize?.height ?? backingHeight / pixelRatio;
    const fitScale = Math.min(1, window.innerWidth / nativeWidth, window.innerHeight / nativeHeight);
    const width = nativeWidth * fitScale;
    const height = nativeHeight * fitScale;

    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
      return;
    }

    const canvasWidthPx = `${Math.round(width * 10) / 10}px`;
    const canvasHeightPx = `${Math.round(height * 10) / 10}px`;
    for (const element of [document.getElementById('appContainer'), document.getElementById('relativeContainer'), canvas]) {
      setStyleSize(element, canvasWidthPx, canvasHeightPx);
    }
  }

  return {
    restoreNativeLayoutSizeFallback,
    shouldWaitForNativeLayoutSeed,
  };
}
