interface MobileQolboxMenuEntryDependencies {
  findChangeControlsItem(container: Element): Element | null;
  getSettingsContainer(): Element | null;
  isMobileQolboxMenuContext(): boolean;
  openMenu(): void;
}

export interface MobileQolboxMenuEntryController {
  patchMobileQolboxHamburgerEntry(): boolean;
  removeMobileQolboxHamburgerEntry(): void;
}

export function createMobileQolboxMenuEntryController({
  findChangeControlsItem,
  getSettingsContainer,
  isMobileQolboxMenuContext,
  openMenu,
}: MobileQolboxMenuEntryDependencies): MobileQolboxMenuEntryController {
  function removeMobileQolboxHamburgerEntry(): void {
    for (const item of document.querySelectorAll('.item[data-qolbox-mobile-menu="true"]')) {
      item.remove();
    }
  }

  function patchMobileQolboxHamburgerEntry(): boolean {
    const container = getSettingsContainer();
    if (!container) {
      return false;
    }

    if (!isMobileQolboxMenuContext()) {
      removeMobileQolboxHamburgerEntry();
      return false;
    }

    let item = container.querySelector<HTMLElement>('.item[data-qolbox-mobile-menu="true"]');
    if (!item) {
      item = document.createElement('div');
      item.className = 'item';
      item.dataset.qolboxMobileMenu = 'true';
      item.addEventListener(
        'click',
        event => {
          event.preventDefault();
          event.stopImmediatePropagation();
          openMenu();
        },
        true
      );
    }

    const beforeItem = findChangeControlsItem(container);
    if (beforeItem && beforeItem !== item) {
      container.insertBefore(item, beforeItem);
    } else if (item.parentElement !== container) {
      container.appendChild(item);
    }

    item.textContent = 'QOLBox';
    return true;
  }

  return { patchMobileQolboxHamburgerEntry, removeMobileQolboxHamburgerEntry };
}
