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

function readNumberProperty(source: unknown, property: PropertyKey): number {
  const value = readObjectProperty(source, property);
  return typeof value === 'number' ? value : Number(value);
}

export function createGameVolumeMenuController(options: GameVolumeMenuControllerOptions) {
  let currentGameMenuItem: GameVolumeMenuItemElement | null = null;

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
    }

    updateGameVolumeText();
    return true;
  }

  return {
    patchGameVolumeMenu,
    updateGameVolumeText,
  };
}
