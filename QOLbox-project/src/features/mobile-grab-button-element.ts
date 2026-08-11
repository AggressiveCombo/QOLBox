interface MobileGrabButtonElementHandlers {
  onKeyboardChange(pressed: boolean): void;
  onPointerStart(event: unknown): void;
  onTouchStart(event: unknown): void;
}

export function createMobileGrabButtonElement(
  container: HTMLElement,
  handlers: MobileGrabButtonElementHandlers
): HTMLElement {
  const button = document.createElement('div');
  button.className = 'buttonArea qolboxMobileGrabButton';
  button.setAttribute('aria-label', 'Grab');
  button.setAttribute('role', 'button');
  button.tabIndex = 0;
  button.dataset.qolboxMobileGrab = 'true';
  if (typeof window.PointerEvent === 'function') {
    button.addEventListener('pointerdown', handlers.onPointerStart, true);
  } else {
    button.addEventListener('touchstart', handlers.onTouchStart, {
      passive: false,
      capture: true,
    });
  }
  button.addEventListener('keydown', event => {
    if ((event.key === 'Enter' || event.key === ' ') && !event.repeat) {
      event.preventDefault();
      event.stopPropagation();
      handlers.onKeyboardChange(true);
    }
  });
  button.addEventListener('keyup', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      event.stopPropagation();
      handlers.onKeyboardChange(false);
    }
  });
  button.addEventListener('blur', () => handlers.onKeyboardChange(false));
  container.appendChild(button);
  return button;
}

export function hideMobileGrabButtonElement(button: HTMLElement | null): void {
  if (button && button.style) {
    button.style.display = 'none';
  }
}

export function removeMobileGrabButtonElement(button: HTMLElement | null): null {
  hideMobileGrabButtonElement(button);

  if (button && button.isConnected) {
    button.remove();
  }

  return null;
}
