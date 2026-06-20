import {
  getFullscreenInlineStyleProperty,
  removeFullscreenInlineProperties,
} from './fullscreen-inline-style';
import { readObjectProperty } from '../utils/object-properties';

interface FullscreenSpectateControlsLayoutOptions {
  isElementVisible(element: Element | null): boolean;
  isFullscreenEnabled(): boolean;
  isSessionMatchActive(): boolean;
  setImportantStyle(element: unknown, property: string, value: string): void;
  spectateControlsSelector: string;
}

const CLOSED_CONTROLS_BOTTOM_OFFSET_PX = 12;
const HELD_OPEN_CONTROLS_MARGIN_PX = 3;
const RADIO_NEAR_OPEN_BOTTOM_PX = -2;
const RADIO_CLOSING_REENTER_DELTA_PX = 0.5;

type NativeCallable = (...args: unknown[]) => unknown;

let isPointerTrackingInstalled = false;
let lastPointerPosition: { x: number; y: number } | null = null;

function rememberPointerPosition(event: PointerEvent): void {
  lastPointerPosition = {
    x: event.clientX,
    y: event.clientY,
  };
}

function clearPointerPosition(): void {
  lastPointerPosition = null;
}

function ensurePointerTracking(): void {
  if (isPointerTrackingInstalled) {
    return;
  }

  isPointerTrackingInstalled = true;
  window.addEventListener('pointermove', rememberPointerPosition, true);
  window.addEventListener('pointerdown', rememberPointerPosition, true);
  window.addEventListener('blur', clearPointerPosition, true);
  document.addEventListener(
    'pointerleave',
    event => {
      if (!event.relatedTarget) {
        clearPointerPosition();
      }
    },
    true
  );
}

function isPointerOverElement(element: Element): boolean {
  if (!lastPointerPosition) {
    return false;
  }

  const { x, y } = lastPointerPosition;
  if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) {
    return false;
  }

  const hitElement = document.elementFromPoint(x, y);
  if (hitElement && (hitElement === element || element.contains(hitElement))) {
    return true;
  }

  const rect = element.getBoundingClientRect();
  return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

function isPointerInControlsTravelCorridor(controls: Element, jukebox: Element): boolean {
  if (!lastPointerPosition) {
    return false;
  }

  const { x, y } = lastPointerPosition;
  const controlsRect = controls.getBoundingClientRect();
  const jukeboxRect = jukebox.getBoundingClientRect();
  if (
    controlsRect.width <= 0 ||
    controlsRect.height <= 0 ||
    jukeboxRect.width <= 0 ||
    jukeboxRect.height <= 0
  ) {
    return false;
  }

  const corridorLeft = controlsRect.left;
  const corridorRight = controlsRect.right;
  const corridorTop = Math.min(controlsRect.bottom, jukeboxRect.top);
  const corridorBottom = Math.max(controlsRect.bottom, jukeboxRect.top);
  return x >= corridorLeft && x <= corridorRight && y >= corridorTop && y <= corridorBottom;
}

function parseBottomPx(value: unknown): number | null {
  const parsed = Number.parseFloat(typeof value === 'string' ? value : '');
  return Number.isFinite(parsed) ? parsed : null;
}

function hasFocusedDescendant(element: Element): boolean {
  return document.activeElement instanceof Element && element.contains(document.activeElement);
}

function getElementBottomPx(element: Element): number | null {
  return (
    parseBottomPx(getFullscreenInlineStyleProperty(element, 'bottom')) ??
    parseBottomPx(window.getComputedStyle(element).bottom)
  );
}

function wantsToHoldSpectateControls(controls: Element, jukebox: Element): boolean {
  return (
    controls.matches(':hover') ||
    isPointerOverElement(controls) ||
    isPointerInControlsTravelCorridor(controls, jukebox) ||
    hasFocusedDescendant(controls)
  );
}

function isSpectateControlsAlreadyExpanded(controls: Element, openOffset: number): boolean {
  const bottom = getElementBottomPx(controls);
  return bottom !== null && bottom >= openOffset - HELD_OPEN_CONTROLS_MARGIN_PX;
}

function isNativeCallable(value: unknown): value is NativeCallable {
  return typeof value === 'function';
}

function callNativeJukeboxHandler(jukebox: Element, handlerName: 'onmouseenter' | 'onmouseleave', fallbackBottom: string): void {
  const handler = readObjectProperty(jukebox, handlerName);
  if (isNativeCallable(handler)) {
    Reflect.apply(handler, jukebox, []);
    return;
  }

  const style = readObjectProperty(jukebox, 'style');
  if (style instanceof CSSStyleDeclaration) {
    style.bottom = fallbackBottom;
  }
}

interface SpectatorRadioLayoutState {
  controlsBottomOffset: number;
  jukebox: Element | null;
  jukeboxDirectlyActive: boolean;
  jukeboxBottom: number | null;
  openOffset: number;
  shouldHoldRadioOpen: boolean;
}

function getSpectatorRadioLayoutState(
  options: FullscreenSpectateControlsLayoutOptions,
  spectatorRadioHoldActive: boolean,
  keepControlsOpenUntilRadioCloses: boolean
): SpectatorRadioLayoutState {
  const baseOffset = CLOSED_CONTROLS_BOTTOM_OFFSET_PX;
  const jukebox = document.querySelector('.jukebox');
  if (!(jukebox instanceof Element) || !options.isElementVisible(jukebox)) {
    return {
      controlsBottomOffset: baseOffset,
      jukebox: null,
      jukeboxDirectlyActive: false,
      jukeboxBottom: null,
      openOffset: baseOffset,
      shouldHoldRadioOpen: false,
    };
  }

  const style = window.getComputedStyle(jukebox);
  const inlineBottom = getFullscreenInlineStyleProperty(jukebox, 'bottom');
  const bottom = Number.parseFloat(typeof inlineBottom === 'string' ? inlineBottom : style.bottom);
  const rect = jukebox.getBoundingClientRect();
  const height = rect.height || Number.parseFloat(style.height) || 35;
  const openOffset = Math.ceil(height + 36);
  const openProgress = Number.isFinite(bottom) ? Math.max(0, Math.min(1, (bottom + 50) / 50)) : 0;
  const jukeboxDirectlyActive = jukebox.matches(':hover') || hasFocusedDescendant(jukebox);
  const jukeboxIsActive = jukeboxDirectlyActive || openProgress > 0.05 || spectatorRadioHoldActive;
  const spectateControls = Array.from(document.querySelectorAll(options.spectateControlsSelector));
  const controlsAlreadyExpanded = spectateControls.some(controls =>
    isSpectateControlsAlreadyExpanded(controls, openOffset)
  );
  const controlsWantHold = spectateControls.some(controls => wantsToHoldSpectateControls(controls, jukebox));
  const holdControlsOpen = controlsAlreadyExpanded && controlsWantHold && jukeboxIsActive;
  const holdReleasedNearOpen =
    keepControlsOpenUntilRadioCloses &&
    !controlsWantHold &&
    !jukeboxDirectlyActive &&
    Number.isFinite(bottom) &&
    bottom > RADIO_NEAR_OPEN_BOTTOM_PX;
  const shouldHoldRadioOpen = holdControlsOpen && !jukeboxDirectlyActive;

  if (!Number.isFinite(bottom)) {
    const open = holdControlsOpen || holdReleasedNearOpen || jukeboxDirectlyActive;
    return {
      controlsBottomOffset: open ? openOffset : baseOffset,
      jukebox,
      jukeboxDirectlyActive,
      jukeboxBottom: null,
      openOffset,
      shouldHoldRadioOpen,
    };
  }

  // Native jukebox closing waits before animating; following its live bottom keeps both controls together.
  const liveOffset = Math.round(baseOffset + (openOffset - baseOffset) * openProgress);
  return {
    controlsBottomOffset: holdControlsOpen || holdReleasedNearOpen ? openOffset : liveOffset,
    jukebox,
    jukeboxDirectlyActive,
    jukeboxBottom: bottom,
    openOffset,
    shouldHoldRadioOpen,
  };
}

export function createFullscreenSpectateControlsLayout(options: FullscreenSpectateControlsLayoutOptions) {
  ensurePointerTracking();
  let pointerSyncFrame = 0;
  let keepControlsOpenUntilRadioCloses = false;
  let lastHeldJukeboxBottom: number | null = null;
  let spectatorRadioHoldActive = false;

  function schedulePointerSync(): void {
    if (pointerSyncFrame) {
      return;
    }

    pointerSyncFrame = window.requestAnimationFrame(() => {
      pointerSyncFrame = 0;
      syncSpectateControlsBottomWithJukebox();
    });
  }

  window.addEventListener('pointermove', schedulePointerSync, true);
  window.addEventListener('pointerdown', schedulePointerSync, true);

  function setSpectateControlsBottom(spectateControls: Element, bottom: string): boolean {
    if (getFullscreenInlineStyleProperty(spectateControls, 'bottom') === bottom) {
      return false;
    }

    options.setImportantStyle(spectateControls, 'bottom', bottom);
    return true;
  }

  function releaseSpectatorRadioHold(): void {
    keepControlsOpenUntilRadioCloses = false;
    lastHeldJukeboxBottom = null;
    if (!spectatorRadioHoldActive) {
      return;
    }

    spectatorRadioHoldActive = false;
    const jukebox = document.querySelector('.jukebox');
    if (jukebox instanceof Element && !jukebox.matches(':hover') && !hasFocusedDescendant(jukebox)) {
      callNativeJukeboxHandler(jukebox, 'onmouseleave', '-50px');
    }
  }

  function syncJukeboxSpectatorHold(state: SpectatorRadioLayoutState): boolean {
    if (!state.jukebox) {
      releaseSpectatorRadioHold();
      return false;
    }

    if (state.shouldHoldRadioOpen) {
      keepControlsOpenUntilRadioCloses = false;
      const radioAppearsToBeClosing =
        lastHeldJukeboxBottom !== null &&
        state.jukeboxBottom !== null &&
        state.jukeboxBottom < lastHeldJukeboxBottom - RADIO_CLOSING_REENTER_DELTA_PX;
      if (!spectatorRadioHoldActive || radioAppearsToBeClosing) {
        callNativeJukeboxHandler(state.jukebox, 'onmouseenter', '0px');
      }
      spectatorRadioHoldActive = true;
      if (state.jukeboxBottom !== null) {
        lastHeldJukeboxBottom = state.jukeboxBottom;
      }
      return false;
    }

    if (
      keepControlsOpenUntilRadioCloses &&
      (state.jukeboxDirectlyActive ||
        state.jukeboxBottom === null ||
        state.jukeboxBottom <= RADIO_NEAR_OPEN_BOTTOM_PX)
    ) {
      keepControlsOpenUntilRadioCloses = false;
    }

    if (spectatorRadioHoldActive) {
      spectatorRadioHoldActive = false;
      lastHeldJukeboxBottom = null;
      if (
        !state.jukeboxDirectlyActive &&
        state.jukeboxBottom !== null &&
        state.jukeboxBottom > RADIO_NEAR_OPEN_BOTTOM_PX
      ) {
        keepControlsOpenUntilRadioCloses = true;
      }
      if (!state.jukeboxDirectlyActive) {
        callNativeJukeboxHandler(state.jukebox, 'onmouseleave', '-50px');
      }
      return keepControlsOpenUntilRadioCloses;
    }

    return false;
  }

  function resetSpectateControlsLayout(spectateControls: Element): void {
    releaseSpectatorRadioHold();
    removeFullscreenInlineProperties(spectateControls, [
      'position',
      'left',
      'right',
      'top',
      'bottom',
      'transform',
      'transition',
      'margin',
      'z-index',
    ]);
  }

  function syncSpectateControlsBottomWithJukebox(): boolean {
    if (!options.isFullscreenEnabled() || !options.isSessionMatchActive()) {
      releaseSpectatorRadioHold();
      return false;
    }

    const state = getSpectatorRadioLayoutState(
      options,
      spectatorRadioHoldActive,
      keepControlsOpenUntilRadioCloses
    );
    const forceOpenControls = syncJukeboxSpectatorHold(state);

    const bottom = `${forceOpenControls ? state.openOffset : state.controlsBottomOffset}px`;
    let changed = false;
    for (const controls of document.querySelectorAll(options.spectateControlsSelector)) {
      changed = setSpectateControlsBottom(controls, bottom) || changed;
    }

    return changed;
  }

  function layoutSpectateControls(useGameplayHudLayout: boolean): void {
    if (!useGameplayHudLayout) {
      releaseSpectatorRadioHold();
    } else {
      const state = getSpectatorRadioLayoutState(
        options,
        spectatorRadioHoldActive,
        keepControlsOpenUntilRadioCloses
      );
      const forceOpenControls = syncJukeboxSpectatorHold(state);
      const controlsBottomOffset = forceOpenControls ? state.openOffset : state.controlsBottomOffset;

      for (const spectateControls of document.querySelectorAll(options.spectateControlsSelector)) {
        options.setImportantStyle(spectateControls, 'position', 'absolute');
        options.setImportantStyle(spectateControls, 'left', '50%');
        options.setImportantStyle(spectateControls, 'right', 'auto');
        options.setImportantStyle(spectateControls, 'top', 'auto');
        setSpectateControlsBottom(spectateControls, `${controlsBottomOffset}px`);
        options.setImportantStyle(spectateControls, 'transform', 'translateX(-50%)');
        options.setImportantStyle(spectateControls, 'margin', '0');
        options.setImportantStyle(spectateControls, 'z-index', '2147483002');
      }
      return;
    }

    for (const spectateControls of document.querySelectorAll(options.spectateControlsSelector)) {
      resetSpectateControlsLayout(spectateControls);
    }
  }

  return {
    layoutSpectateControls,
    resetSpectateControlsLayout,
    syncSpectateControlsBottomWithJukebox,
  };
}
