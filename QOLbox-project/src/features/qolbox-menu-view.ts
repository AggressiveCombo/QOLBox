import { focusElementWithoutScroll } from '../dom/dom-helpers';
import { getLocalStorageItem, setLocalStorageItem } from '../utils/local-storage';

const QOLBOX_MENU_SIZE_KEY = 'vm.hitbox.qolboxMenuSize.v1';

interface QolboxMenuOverlayOptions {
  menuId: string;
  onClick(event: MouseEvent): void;
  onInput(event: Event): void;
  onPointerEvent(event: Event): void;
}

function findQolboxMenuPanel(menuId: string): Element | null {
  const menu = document.getElementById(menuId);
  return menu ? menu.querySelector('.qolboxMenuPanel') : null;
}

function focusFirstQolboxMenuControl(panel: Element): void {
  window.setTimeout(() => {
    const focusTarget =
      panel.querySelector('.qolboxMenuButton.primary, .qolboxMenuChoice.primary') ||
      panel.querySelector('.qolboxMenuToggle.active') ||
      panel.querySelector('.qolboxMenuButton');
    focusElementWithoutScroll(focusTarget);
  }, 0);
}

function restoreQolboxMenuSize(panel: HTMLElement): void {
  try {
    const saved = JSON.parse(getLocalStorageItem(QOLBOX_MENU_SIZE_KEY) || 'null') as {
      height?: unknown;
      width?: unknown;
    } | null;
    if (!saved || typeof saved.width !== 'number' || typeof saved.height !== 'number') return;
    panel.style.width = `${Math.max(320, Math.round(saved.width))}px`;
    panel.style.height = `${Math.max(240, Math.round(saved.height))}px`;
  } catch {
    // Storage may be unavailable in restricted userscript contexts.
  }
}

function installQolboxMenuResizePersistence(menu: HTMLElement, panel: HTMLElement): void {
  menu.addEventListener('pointerdown', event => {
    const bounds = panel.getBoundingClientRect();
    if (bounds.right - event.clientX > 18 || bounds.bottom - event.clientY > 18) return;
    const initialWidth = bounds.width;
    const initialHeight = bounds.height;
    window.addEventListener('pointerup', () => {
      const resized = panel.getBoundingClientRect();
      if (Math.abs(resized.width - initialWidth) < 1 && Math.abs(resized.height - initialHeight) < 1) return;
      setLocalStorageItem(QOLBOX_MENU_SIZE_KEY, JSON.stringify({
        height: Math.round(resized.height),
        width: Math.round(resized.width),
      }));
    }, { once: true });
  }, true);
}

export function renderQolboxMenuPanel(menuId: string, markup: string): void {
  const panel = findQolboxMenuPanel(menuId);
  if (!panel) {
    return;
  }

  panel.innerHTML = `<div class="qolboxMenuPersistentHeader"><h1 class="qolboxMenuTitle">QOLBox Menu</h1></div>${markup}`;
  focusFirstQolboxMenuControl(panel);
}

export function ensureQolboxMenuOverlay(options: QolboxMenuOverlayOptions): HTMLElement | null {
  let menu = document.getElementById(options.menuId);
  if (menu) {
    return menu;
  }

  const host = document.body || document.documentElement;
  if (!host) {
    return null;
  }

  menu = document.createElement('div');
  menu.id = options.menuId;
  menu.className = 'qolboxMenuOverlay';
  menu.setAttribute('role', 'dialog');
  menu.setAttribute('aria-modal', 'true');
  menu.setAttribute('aria-label', 'QOLBox');
  menu.innerHTML = '<div class="qolboxMenuPanel"></div>';
  const panel = menu.querySelector<HTMLElement>('.qolboxMenuPanel');
  if (panel) {
    restoreQolboxMenuSize(panel);
    installQolboxMenuResizePersistence(menu, panel);
  }
  menu.addEventListener('pointerdown', options.onPointerEvent, true);
  menu.addEventListener('mousedown', options.onPointerEvent, true);
  menu.addEventListener('mouseup', options.onPointerEvent, true);
  menu.addEventListener('wheel', options.onPointerEvent, { capture: true, passive: true });
  menu.addEventListener('click', options.onClick, true);
  menu.addEventListener('change', options.onInput, true);
  menu.addEventListener('input', options.onInput, true);
  host.appendChild(menu);
  return menu;
}
