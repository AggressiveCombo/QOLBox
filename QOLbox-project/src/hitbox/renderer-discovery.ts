import { isNativeObject, readNativePath, readNativeProperty } from './native-access';

function isRendererCandidate(value: unknown): value is object {
  return (
    isNativeObject(value) &&
    isNativeObject(readNativeProperty(value, 'Bc')) &&
    (isNativeObject(readNativeProperty(value, 'Ag')) || typeof readNativeProperty(value, 'cg') === 'function')
  );
}

export function getRendererView(renderer: unknown): Element | null {
  const view = readNativePath(renderer, ['Ag', 'view']);
  return view instanceof Element ? view : null;
}

export function getRendererHost(renderer: unknown): Element | null {
  const directHost = readNativeProperty(renderer, 'Tg') || readNativeProperty(renderer, 'dg');
  if (directHost instanceof Element) {
    return directHost;
  }

  return getRendererView(renderer)?.parentElement || null;
}

export function getKnownFullscreenRenderers(windowObject: unknown = window): object[] {
  const renderers: object[] = [];
  const seen = new Set<object>();

  function addRenderer(candidate: unknown): void {
    if (!isRendererCandidate(candidate) || seen.has(candidate)) {
      return;
    }

    seen.add(candidate);
    renderers.push(candidate);
  }

  function collect(candidate: unknown): void {
    if (!candidate) {
      return;
    }

    if (Array.isArray(candidate)) {
      candidate.forEach(collect);
      return;
    }

    addRenderer(candidate);

    const nested = readNativeProperty(candidate, 'hb');
    addRenderer(nested);

    if (Array.isArray(nested)) {
      nested.forEach(addRenderer);
    }
  }

  const multiplayerSession = readNativeProperty(windowObject, 'multiplayerSession');
  collect(multiplayerSession);
  collect(readNativeProperty(windowObject, 'A4'));
  collect(readNativePath(windowObject, ['a8', 'II']));

  return renderers;
}
