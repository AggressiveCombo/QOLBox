export function findSettingsContainer(): Element | null {
  return document.querySelector('.items.left');
}

export function findChangeControlsItem(container: Element | null): Element | null {
  if (!container) {
    return null;
  }

  for (const item of container.querySelectorAll('.item')) {
    if ((item.textContent || '').trim() === 'Change Controls') {
      return item;
    }
  }

  return null;
}
