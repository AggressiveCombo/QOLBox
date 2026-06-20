import { keepOutOfBrowserTabOrder } from '../dom/dom-helpers';
import { hasDataset, isStyledElement } from '../dom/element-guards';

export type GameVolumeMenuItemElement = Element & {
  dataset: { qolboxGameVolumePatched?: string };
  style: {
    cursor: string;
    userSelect: string;
  };
};

function isGameVolumeMenuItemElement(value: unknown): value is GameVolumeMenuItemElement {
  return (
    value instanceof Element &&
    hasDataset(value) &&
    isStyledElement(value) &&
    'cursor' in value.style &&
    'userSelect' in value.style
  );
}

export function findGameVolumeItem(): GameVolumeMenuItemElement | null {
  const candidates = document.querySelectorAll('.items.left .item, .item');
  for (const candidate of candidates) {
    if (/^Volume:\s*\d+%$/.test(candidate.textContent?.trim() || '') && isGameVolumeMenuItemElement(candidate)) {
      return candidate;
    }
  }

  return null;
}

export function updateGameVolumeItemView(item: GameVolumeMenuItemElement, gamePercent: number): void {
  item.textContent = `Volume: ${gamePercent}%`;
  item.setAttribute('title', 'Scroll or use arrow keys to adjust by 5%, left-click up, right-click down');
  item.style.cursor = 'ns-resize';
  item.style.userSelect = 'none';
  keepOutOfBrowserTabOrder(item);
  item.setAttribute('role', 'slider');
  item.setAttribute('aria-label', 'Game volume');
  item.setAttribute('aria-valuemin', '0');
  item.setAttribute('aria-valuemax', '100');
  item.setAttribute('aria-valuenow', String(gamePercent));
  item.setAttribute('aria-valuetext', `${gamePercent}%`);
}
