import { readObjectProperty } from '../utils/object-properties';

export interface ReserveRoomPlayers {
  current: number;
  max: number;
}

interface ReserveRoomListOptions {
  isElementVisible(element: Element | null): boolean;
}

function getCell(row: unknown, index: number): unknown {
  const cells = readObjectProperty(row, 'cells');
  return readObjectProperty(cells, index);
}

function getCellText(row: unknown, index: number): string {
  const text = readObjectProperty(getCell(row, index), 'textContent');
  return typeof text === 'string' ? text.trim() : '';
}

function hasAtLeastTwoCells(row: unknown): boolean {
  const cells = readObjectProperty(row, 'cells');
  const length = Number(readObjectProperty(cells, 'length'));
  return Number.isFinite(length) && length >= 2;
}

export function getReserveRowFromTarget(target: unknown): Element | null {
  return target instanceof Element ? target.closest('.roomListContainer .scrollBox tr') : null;
}

export function getReserveRoomSignature(row: unknown): string {
  if (!row || !getCell(row, 0)) {
    return '';
  }

  const roomName = getCellText(row, 0);
  const lockState = isReservePasswordRoom(row) ? 'locked' : 'open';
  return `${roomName}\n${lockState}`;
}

export function findReserveRoomBySignature(signature: string): Element | null {
  if (!signature) {
    return null;
  }

  return (
    [...document.querySelectorAll('.roomListContainer .scrollBox tr')].find(row => {
      return row.isConnected && getReserveRoomSignature(row) === signature;
    }) || null
  );
}

export function parseReserveRoomPlayers(row: unknown): ReserveRoomPlayers | null {
  if (!hasAtLeastTwoCells(row)) {
    return null;
  }

  const match = getCellText(row, 1).match(/^(\d+)\s*\/\s*(\d+)$/);
  if (!match) {
    return null;
  }

  return {
    current: Number(match[1]),
    max: Number(match[2]),
  };
}

export function isReserveRoomFull(row: unknown): boolean {
  const players = parseReserveRoomPlayers(row);
  return Boolean(players && players.max > 0 && players.current >= players.max);
}

export function isReserveOnePersonRoom(row: unknown): boolean {
  const players = parseReserveRoomPlayers(row);
  return Boolean(players && players.max === 1);
}

export function isReserveUnavailableRoom(row: unknown): boolean {
  return Boolean(isReserveRoomFull(row) && isReserveOnePersonRoom(row));
}

export function isReservePasswordRoom(row: unknown): boolean {
  return Boolean(row instanceof Element && row.querySelector('img[src*="lock"]'));
}

export function createReserveRoomList(options: ReserveRoomListOptions) {
  function getReserveJoinButton(): Element | null {
    const button = document.querySelector('.roomListContainer .bottomButton.right');
    return options.isElementVisible(button) ? button : null;
  }

  return {
    getReserveJoinButton,
  };
}
