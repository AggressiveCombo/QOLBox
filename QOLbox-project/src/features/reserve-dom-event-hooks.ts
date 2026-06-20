interface ReserveDomEventHooksOptions {
  onPasswordKey(event: Event): void;
  onPasswordSubmit(event: Event): void;
  onRoomListClick(event: Event): void;
  onRoomListDoubleClick(event: Event): void;
}

export function createReserveDomEventHooks(options: ReserveDomEventHooksOptions) {
  let domEventsInstalled = false;

  function installReserveDomEventHooks(): void {
    if (domEventsInstalled) {
      return;
    }

    domEventsInstalled = true;
    document.addEventListener('click', options.onRoomListClick, true);
    document.addEventListener('dblclick', options.onRoomListDoubleClick, true);
    document.addEventListener('click', options.onPasswordSubmit, true);
    window.addEventListener('keyup', options.onPasswordKey, true);
  }

  return {
    installReserveDomEventHooks,
  };
}
