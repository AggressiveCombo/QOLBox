import { focusElementWithoutScroll } from '../dom/dom-helpers';
import { readObjectProperty } from '../utils/object-properties';
import {
  canBlurGameplayFocusTarget,
  canPreventGameplayDefault,
  ensureGameplayFocusTargetFocusable,
  forwardGameplayPointerToCanvas,
  isPrimaryGameplayMouseButton,
  readGameplayFocusBooleanProperty,
} from './gameplay-background-focus-events';

interface GameplayBackgroundFocusOptions {
  exclusionSelector: string;
  renderCanvasSelector: string;
  renderLayerSelector: string;
  getActiveChatInput(): Element | null;
  getActiveRenderCanvas(): Element | null;
  isPlayingMatch(): boolean;
  isQolboxMenuClosed(): boolean;
}

export function createGameplayBackgroundFocusController(options: GameplayBackgroundFocusOptions) {
  let hooksInstalled = false;

  function focusActiveRenderCanvas(): void {
    const canvas = options.getActiveRenderCanvas();
    if (!canvas) {
      return;
    }

    ensureGameplayFocusTargetFocusable(canvas);
    focusElementWithoutScroll(canvas);
  }

  function captureGameplayInputFocus(): void {
    if (typeof window.focus === 'function') {
      try {
        window.focus();
      } catch {
        // Ignore browsers/userscript engines that do not allow focusing the window.
      }
    }

    focusActiveRenderCanvas();

    const activeElement = document.activeElement;
    if (options.getActiveChatInput() === activeElement && canBlurGameplayFocusTarget(activeElement)) {
      activeElement.blur();
    }

    const canvasConstructor = typeof HTMLCanvasElement === 'function' ? HTMLCanvasElement : null;
    if (!(canvasConstructor && document.activeElement instanceof canvasConstructor) && document.body) {
      if (typeof document.body.hasAttribute !== 'function' || !document.body.hasAttribute('tabindex')) {
        document.body.tabIndex = -1;
      }
      focusElementWithoutScroll(document.body);
      focusActiveRenderCanvas();
    }
  }

  function forwardGameplayBackgroundPointer(event: unknown): boolean {
    return forwardGameplayPointerToCanvas(event, options.getActiveRenderCanvas());
  }

  function isGameplayRenderTarget(target: unknown): boolean {
    return Boolean(
      target instanceof Element &&
        (target.matches(options.renderCanvasSelector) || target.closest(options.renderLayerSelector))
    );
  }

  function shouldCaptureGameplayBackgroundFocus(event: unknown): boolean {
    if (
      !options.isPlayingMatch() ||
      !options.isQolboxMenuClosed() ||
      options.getActiveChatInput() ||
      readGameplayFocusBooleanProperty(event, '__qolboxForwardedGameplayPointer') ||
      readGameplayFocusBooleanProperty(event, 'defaultPrevented')
    ) {
      return false;
    }

    if (!isPrimaryGameplayMouseButton(event)) {
      return false;
    }

    const target = readObjectProperty(event, 'target');
    if (!(target instanceof Element)) {
      return false;
    }

    if (target.closest(options.exclusionSelector)) {
      return false;
    }

    return !isGameplayRenderTarget(target);
  }

  function handleGameplayBackgroundFocus(event: Event): void {
    if (!shouldCaptureGameplayBackgroundFocus(event)) {
      return;
    }

    if (readGameplayFocusBooleanProperty(event, 'cancelable') && canPreventGameplayDefault(event)) {
      event.preventDefault();
    }

    captureGameplayInputFocus();
    forwardGameplayBackgroundPointer(event);
  }

  function installGameplayBackgroundFocusHooks(): void {
    if (hooksInstalled) {
      return;
    }

    hooksInstalled = true;
    document.addEventListener('pointerdown', handleGameplayBackgroundFocus, true);
    document.addEventListener('mousedown', handleGameplayBackgroundFocus, true);
    document.addEventListener('click', handleGameplayBackgroundFocus, true);
  }

  return {
    captureGameplayInputFocus,
    forwardGameplayBackgroundPointer,
    handleGameplayBackgroundFocus,
    installGameplayBackgroundFocusHooks,
    shouldCaptureGameplayBackgroundFocus,
  };
}
