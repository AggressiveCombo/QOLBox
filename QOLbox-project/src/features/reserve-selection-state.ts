import {
  findReserveRoomBySignature,
  getReserveRoomSignature,
  isReserveRoomFull,
  isReserveUnavailableRoom,
} from './reserve-room-list';

const SELECTED_RESERVE_ROW_SELECTOR = '.roomListContainer .scrollBox tr.SELECTED';

export interface ReserveSelectedRoomState {
  row: Element | null;
  full: boolean;
  unavailable: boolean;
}

export function createReserveSelectionState() {
  let selectedRow: Element | null = null;
  let selectedSignature = '';
  let selectedWasFull = false;
  let selectedWasUnavailable = false;

  function clearReserveSelectedRoom(): void {
    selectedRow = null;
    selectedSignature = '';
    selectedWasFull = false;
    selectedWasUnavailable = false;
  }

  function rememberReserveSelectedRoom(row: unknown): Element | null {
    if (!(row instanceof Element) || !row.isConnected) {
      return null;
    }

    selectedRow = row;
    selectedSignature = getReserveRoomSignature(row);
    selectedWasFull = isReserveRoomFull(row);
    selectedWasUnavailable = isReserveUnavailableRoom(row);
    return row;
  }

  function getReserveSelectedRoomRow(): Element | null {
    const selected = document.querySelector(SELECTED_RESERVE_ROW_SELECTOR);
    if (selected?.isConnected) {
      return rememberReserveSelectedRoom(selected);
    }

    if (selectedRow?.isConnected) {
      return rememberReserveSelectedRoom(selectedRow);
    }

    const matchingRow = findReserveRoomBySignature(selectedSignature);
    if (matchingRow) {
      return rememberReserveSelectedRoom(matchingRow);
    }

    return null;
  }

  function getReserveSelectedRoomState(): ReserveSelectedRoomState {
    const row = getReserveSelectedRoomRow();
    if (row) {
      return {
        row,
        full: isReserveRoomFull(row),
        unavailable: isReserveUnavailableRoom(row),
      };
    }

    return {
      row: null,
      full: selectedWasFull,
      unavailable: selectedWasUnavailable,
    };
  }

  return {
    clearReserveSelectedRoom,
    getReserveSelectedRoomRow,
    getReserveSelectedRoomState,
    rememberReserveSelectedRoom,
  };
}
