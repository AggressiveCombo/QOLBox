import { focusElementWithoutScroll } from '../dom/dom-helpers';

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
    const focusTarget = panel.querySelector('.qolboxMenuButton.primary, .qolboxMenuToggle.active, .qolboxMenuButton');
    focusElementWithoutScroll(focusTarget);
  }, 0);
}

export function renderQolboxMenuPanel(menuId: string, markup: string): void {
  const panel = findQolboxMenuPanel(menuId);
  if (!panel) {
    return;
  }

  panel.innerHTML = markup;
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
  menu.innerHTML = '<div class="qolboxMenuPanel"></div>';
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
