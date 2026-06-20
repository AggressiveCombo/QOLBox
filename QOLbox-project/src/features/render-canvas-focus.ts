import { isTabbableElement } from '../dom/element-guards';

interface RenderCanvasFocusOptions {
  focusElementWithoutScroll(element: Element): void;
  getActiveRenderCanvas(): Element | null;
}

export function createRenderCanvasFocusController(options: RenderCanvasFocusOptions) {
  function resetBrowserScroll(): void {
    try {
      window.scrollTo(0, 0);
    } catch {
      // Ignore scroll failures in older userscript engines.
    }

    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }

  function focusActiveRenderCanvas(): void {
    const canvas = options.getActiveRenderCanvas();
    if (!canvas) {
      return;
    }

    if (isTabbableElement(canvas) && !canvas.hasAttribute('tabindex')) {
      canvas.tabIndex = -1;
    }

    options.focusElementWithoutScroll(canvas);
  }

  return {
    focusActiveRenderCanvas,
    resetBrowserScroll,
  };
}
