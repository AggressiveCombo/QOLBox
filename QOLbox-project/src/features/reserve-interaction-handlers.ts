import {
  clickReserveElement,
  getClosestReserveJoinButton,
  getReserveEventKey,
  getReservePasswordSubmitButton,
  stopReserveNativeEvent,
} from './reserve-interaction-events';
import type { ReserveSelectedRoomState } from './reserve-selection-state';

interface ReserveInteractionState {
  unavailable?: boolean;
}

interface StopReserveOptions {
  clearSelection?: boolean;
  hideNative?: boolean;
}

interface ReserveInteractionHandlersOptions {
  clearPasswordPromptPending(): void;
  getNativeConnectingWindows(): Element[];
  getRowFromTarget(target: unknown): Element | null;
  getSelectedRoomRow(): Element | null;
  getSelectedRoomState(): ReserveSelectedRoomState;
  getState(): ReserveInteractionState | null;
  isElementVisible(element: Element | null): boolean;
  isEnabled(): boolean;
  isPasswordPromptPending(): boolean;
  isPasswordRoom(row: unknown): boolean;
  isRoomFull(row: unknown): boolean;
  isUnavailableRoom(row: unknown): boolean;
  rememberSelectedRoom(row: unknown): Element | null;
  setPasswordPromptPending(pending: boolean): void;
  showOnePersonUnavailable(row?: unknown): void;
  startReserveSpot(reason: string): void;
  stopReserveSpot(options?: StopReserveOptions): void;
  syncJoinButtonLabel(): void;
  syncPasswordPrompt(): void;
}

export function createReserveInteractionHandlers(options: ReserveInteractionHandlersOptions) {
  function scheduleJoinButtonSync(): void {
    window.setTimeout(options.syncJoinButtonLabel, 0);
  }

  function schedulePasswordPromptSync(): void {
    window.setTimeout(options.syncPasswordPrompt, 0);
  }

  function markPasswordPromptPending(): void {
    options.setPasswordPromptPending(true);
    schedulePasswordPromptSync();
  }

  function showSelectedUnavailable(event: Event): void {
    stopReserveNativeEvent(event);
    options.clearPasswordPromptPending();
    options.showOnePersonUnavailable(options.getSelectedRoomRow());
  }

  function cancelReserveSpot(): void {
    if (options.getState()?.unavailable) {
      options.stopReserveSpot({ clearSelection: true, hideNative: true });
      return;
    }

    const cancelButton = options
      .getNativeConnectingWindows()
      .map(windowElement => windowElement.querySelector('.cancelButton'))
      .find(Boolean);

    if (cancelButton) {
      clickReserveElement(cancelButton);
    }

    options.stopReserveSpot({ hideNative: true });
  }

  function handleReserveRoomListClick(event: Event): void {
    if (!options.isEnabled()) {
      return;
    }

    const row = options.getRowFromTarget(event.target);
    const joinButton = getClosestReserveJoinButton(event.target);

    if (row) {
      options.rememberSelectedRoom(row);
      scheduleJoinButtonSync();

      if (options.isUnavailableRoom(row)) {
        options.showOnePersonUnavailable(row);

        if (joinButton) {
          stopReserveNativeEvent(event);
        }
      }
    }

    if (!joinButton) {
      return;
    }

    const selectedState = options.getSelectedRoomState();
    const selectedRow = selectedState.row;
    if (selectedState.unavailable) {
      stopReserveNativeEvent(event);
      options.showOnePersonUnavailable(selectedRow);
      return;
    }

    if (!selectedState.full) {
      options.clearPasswordPromptPending();
      return;
    }

    if (options.isPasswordRoom(selectedRow)) {
      markPasswordPromptPending();
      return;
    }

    options.startReserveSpot('room-list');
  }

  function handleReserveRoomListDoubleClick(event: Event): void {
    if (!options.isEnabled()) {
      return;
    }

    const row = options.getRowFromTarget(event.target);
    if (!options.isRoomFull(row)) {
      return;
    }

    options.rememberSelectedRoom(row);

    if (options.isUnavailableRoom(row)) {
      stopReserveNativeEvent(event);
      options.showOnePersonUnavailable(row);
      return;
    }

    if (options.isPasswordRoom(row)) {
      markPasswordPromptPending();
      return;
    }

    options.startReserveSpot('room-list');
  }

  function handleReservePasswordSubmit(event: Event): void {
    if (!options.isEnabled()) {
      return;
    }

    const submitButton = getReservePasswordSubmitButton(event.target);
    if (!submitButton || !options.isPasswordPromptPending()) {
      return;
    }

    if (options.isUnavailableRoom(options.getSelectedRoomRow())) {
      showSelectedUnavailable(event);
      return;
    }

    options.clearPasswordPromptPending();
    options.startReserveSpot('password-room');
  }

  function handleReservePasswordKey(event: Event): void {
    if (!options.isEnabled()) {
      return;
    }

    const passwordWindow = document.querySelector('.passwordWindowContainer');
    if (
      getReserveEventKey(event) !== 'Enter' ||
      !options.isPasswordPromptPending() ||
      !options.isElementVisible(passwordWindow)
    ) {
      return;
    }

    if (options.isUnavailableRoom(options.getSelectedRoomRow())) {
      showSelectedUnavailable(event);
      return;
    }

    options.clearPasswordPromptPending();
    options.startReserveSpot('password-room');
  }

  return {
    cancelReserveSpot,
    handleReservePasswordKey,
    handleReservePasswordSubmit,
    handleReserveRoomListClick,
    handleReserveRoomListDoubleClick,
  };
}
