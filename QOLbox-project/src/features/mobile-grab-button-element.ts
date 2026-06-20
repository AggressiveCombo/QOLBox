interface MobileGrabButtonElementHandlers {
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
  button.dataset.qolboxMobileGrab = 'true';
  button.addEventListener('touchstart', handlers.onTouchStart, {
    passive: false,
    capture: true,
  });
  button.addEventListener('pointerdown', handlers.onPointerStart, true);
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
