import { focusElementWithoutScroll } from '../dom/dom-helpers';
import { readObjectProperty } from '../utils/object-properties';
import { getKeyboardPercentTarget } from './audio-levels';
import {
  findGameVolumeItem,
  type GameVolumeMenuItemElement,
  updateGameVolumeItemView,
} from './game-volume-menu-item';

interface GameVolumeMenuControllerOptions {
  stepPercent: number;
  getGamePercent(): number;
  isAudioEnabled(): boolean;
  setGamePercent(nextPercent: number): void;
}

interface GameVolumeMenuViewSnapshot {
  attributes: Map<string, string | null>;
  cursor: string;
  item: GameVolumeMenuItemElement;
  textContent: string | null;
  userSelect: string;
}

const PATCHED_VIEW_ATTRIBUTES = [
  'aria-label',
  'aria-valuemax',
  'aria-valuemin',
  'aria-valuenow',
  'aria-valuetext',
  'role',
  'tabindex',
  'title',
] as const;
const DRAG_PIXELS_PER_PERCENT = 2;
const POINTER_PIXEL_EPSILON = 0.01;

function getDragPercentDelta(delta: number): number {
  return Math.sign(delta) * Math.floor((Math.abs(delta) + POINTER_PIXEL_EPSILON) / DRAG_PIXELS_PER_PERCENT);
}

function readNumberProperty(source: unknown, property: PropertyKey): number {
  const value = readObjectProperty(source, property);
  return typeof value === 'number' ? value : Number(value);
}

export function createGameVolumeMenuController(options: GameVolumeMenuControllerOptions) {
  let currentGameMenuItem: GameVolumeMenuItemElement | null = null;
  let originalView: GameVolumeMenuViewSnapshot | null = null;
  let activeDrag: { moved: boolean; pointerId: number; startPercent: number; startY: number } | null = null;
  let suppressNextClick = false;

  function captureOriginalView(item: GameVolumeMenuItemElement): void {
    if (originalView?.item === item) {
      return;
    }

    originalView = {
      attributes: new Map(PATCHED_VIEW_ATTRIBUTES.map(attribute => [attribute, item.getAttribute(attribute)])),
      cursor: item.style.cursor,
      item,
      textContent: item.textContent,
      userSelect: item.style.userSelect,
    };
  }

  function cleanupGameVolumeMenu(): void {
    if (!originalView) {
      return;
    }

    const { attributes, cursor, item, textContent, userSelect } = originalView;
    item.textContent = textContent;
    item.style.cursor = cursor;
    item.style.userSelect = userSelect;
    for (const [attribute, value] of attributes) {
      if (value === null) {
        item.removeAttribute(attribute);
      } else {
        item.setAttribute(attribute, value);
      }
    }
    originalView = null;
    currentGameMenuItem = null;
  }

  function updateGameVolumeText(): void {
    if (!options.isAudioEnabled()) {
      return;
    }

    if (!currentGameMenuItem || !currentGameMenuItem.isConnected) {
      currentGameMenuItem = findGameVolumeItem();
    }

    if (!currentGameMenuItem) {
      return;
    }

    captureOriginalView(currentGameMenuItem);
    const gamePercent = options.getGamePercent();
    updateGameVolumeItemView(currentGameMenuItem, gamePercent);
  }

  function patchGameVolumeMenu(): boolean {
    if (!options.isAudioEnabled()) {
      return false;
    }

    const item = findGameVolumeItem();
    if (!item) {
      return false;
    }

    currentGameMenuItem = item;
    captureOriginalView(item);

    if (!item.dataset.qolboxGameVolumePatched) {
      item.dataset.qolboxGameVolumePatched = 'true';
      item.addEventListener(
        'click',
        event => {
          if (!options.isAudioEnabled()) {
            return;
          }

          event.preventDefault();
          event.stopImmediatePropagation();
          if (suppressNextClick) {
            suppressNextClick = false;
            return;
          }
          focusElementWithoutScroll(item);
          options.setGamePercent(options.getGamePercent() + options.stepPercent);
        },
        true
      );
      item.addEventListener(
        'contextmenu',
        event => {
          if (!options.isAudioEnabled()) {
            return;
          }

          event.preventDefault();
          event.stopImmediatePropagation();
          focusElementWithoutScroll(item);
          options.setGamePercent(options.getGamePercent() - options.stepPercent);
        },
        true
      );
      item.addEventListener(
        'wheel',
        event => {
          if (!options.isAudioEnabled()) {
            return;
          }

          event.preventDefault();
          event.stopImmediatePropagation();
          focusElementWithoutScroll(item);
          options.setGamePercent(
            options.getGamePercent() +
              (readNumberProperty(event, 'deltaY') < 0 ? options.stepPercent : -options.stepPercent)
          );
        },
        { passive: false, capture: true }
      );
      item.addEventListener(
        'keydown',
        event => {
          if (!options.isAudioEnabled()) {
            return;
          }

          const nextPercent = getKeyboardPercentTarget(
            event,
            options.getGamePercent(),
            options.stepPercent
          );
          if (nextPercent === null) {
            return;
          }

          event.preventDefault();
          event.stopImmediatePropagation();
          options.setGamePercent(nextPercent);
        },
        true
      );
      item.addEventListener('pointerdown', rawEvent => {
        if (!(rawEvent instanceof PointerEvent)) return;
        const event = rawEvent;
        if (!options.isAudioEnabled() || event.button !== 0 || !(item instanceof HTMLElement)) return;
        activeDrag = {
          moved: false,
          pointerId: event.pointerId,
          startPercent: options.getGamePercent(),
          startY: event.clientY,
        };
        focusElementWithoutScroll(item);
        item.setPointerCapture(event.pointerId);
      }, true);
      item.addEventListener('pointermove', rawEvent => {
        if (!(rawEvent instanceof PointerEvent)) return;
        const event = rawEvent;
        if (!activeDrag || activeDrag.pointerId !== event.pointerId) return;
        const delta = activeDrag.startY - event.clientY;
        if (Math.abs(delta) < 1) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        activeDrag.moved = true;
        const percentDelta = getDragPercentDelta(delta);
        options.setGamePercent(
          activeDrag.startPercent + percentDelta
        );
      }, true);
      const finishDrag = (event: Event) => {
        if (!(event instanceof PointerEvent)) return;
        if (!activeDrag || activeDrag.pointerId !== event.pointerId) return;
        const cancelled = event.type === 'pointercancel';
        const delta = activeDrag.startY - event.clientY;
        if (!cancelled && Math.abs(delta) >= 1) {
          activeDrag.moved = true;
          const percentDelta = getDragPercentDelta(delta);
          options.setGamePercent(activeDrag.startPercent + percentDelta);
        }
        suppressNextClick = !cancelled;
        if (!cancelled && !activeDrag.moved) {
          options.setGamePercent(options.getGamePercent() + options.stepPercent);
        }
        activeDrag = null;
        if (item instanceof HTMLElement && item.hasPointerCapture(event.pointerId)) {
          item.releasePointerCapture(event.pointerId);
        }
      };
      item.addEventListener('pointerup', finishDrag, true);
      item.addEventListener('pointercancel', finishDrag, true);
    }

    updateGameVolumeText();
    return true;
  }

  return {
    cleanupGameVolumeMenu,
    patchGameVolumeMenu,
    updateGameVolumeText,
  };
}
