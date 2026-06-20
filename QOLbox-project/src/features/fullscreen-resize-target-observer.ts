interface FullscreenResizeTargetObserverOptions {
  renderCanvasSelector: string;
  renderLayerSelector: string;
}

export function createFullscreenResizeTargetObserver(options: FullscreenResizeTargetObserverOptions) {
  let resizeObserver: ResizeObserver | null = null;
  let observedResizeTargets = new WeakSet<Element>();

  function setFullscreenResizeObserver(observer: ResizeObserver | null): void {
    resizeObserver = observer;

    if (!observer) {
      observedResizeTargets = new WeakSet<Element>();
    }
  }

  function observeResizeTarget(element: Element | null): void {
    if (!resizeObserver || !(element instanceof Element) || observedResizeTargets.has(element)) {
      return;
    }

    observedResizeTargets.add(element);
    resizeObserver.observe(element);
  }

  function refreshObservedResizeTargets(): void {
    observeResizeTarget(document.documentElement);
    observeResizeTarget(document.body);
    observeResizeTarget(document.getElementById('appContainer'));
    observeResizeTarget(document.getElementById('relativeContainer'));
    observeResizeTarget(document.getElementById('backgroundImage'));

    for (const element of document.querySelectorAll(options.renderLayerSelector)) {
      observeResizeTarget(element);
    }

    for (const element of document.querySelectorAll(options.renderCanvasSelector)) {
      observeResizeTarget(element);
    }
  }

  return {
    refreshObservedResizeTargets,
    setFullscreenResizeObserver,
  };
}
