let dismissalListenersInstalled = false;

function getRightClickMenus(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>('.rightClickMenu'));
}

function removePlayerPopups(): boolean {
  const menus = getRightClickMenus();
  for (const menu of menus) {
    const background = menu.querySelector<HTMLElement>('.background');
    if (background) {
      background.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    } else {
      menu.remove();
    }
  }
  return menus.length > 0;
}

function isInsidePopupActionList(target: EventTarget | null): boolean {
  return target instanceof Element && Boolean(target.closest('.rightClickMenu .container'));
}

function handlePointerOutsidePlayerPopup(event: Event): void {
  if (!getRightClickMenus().length || isInsidePopupActionList(event.target)) {
    return;
  }

  removePlayerPopups();
}

export function installPlayerPopupDismissal(): void {
  if (dismissalListenersInstalled) {
    return;
  }

  dismissalListenersInstalled = true;
  document.addEventListener('pointerdown', handlePointerOutsidePlayerPopup, true);
  document.addEventListener('mousedown', handlePointerOutsidePlayerPopup, true);
}
