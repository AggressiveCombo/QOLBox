import { isSamePlayerId } from './session-adapter';
import { isNativeObject, readNativePath, readNativeProperty } from './native-access';

interface CollectionEntry {
  key: unknown;
  value: unknown;
}

interface ForEachCollection {
  forEach(callback: (value: unknown, key: unknown) => void): void;
}

export interface WorldCameraState {
  height: number;
  left: number;
  top: number;
  width: number;
}

export interface WorldEntityPosition {
  x: number;
  y: number;
}

function hasForEach(value: unknown): value is ForEachCollection {
  return isNativeObject(value) && typeof readNativeProperty(value, 'forEach') === 'function';
}

function getCollectionEntries(collection: unknown): CollectionEntry[] {
  if (!collection) {
    return [];
  }

  if (Array.isArray(collection)) {
    return collection.map((value, key) => ({ key, value })).filter(entry => entry.value);
  }

  if (collection instanceof Map) {
    const entries: CollectionEntry[] = [];
    collection.forEach((value, key) => {
      if (value) {
        entries.push({ key, value });
      }
    });
    return entries;
  }

  if (hasForEach(collection)) {
    const entries: CollectionEntry[] = [];
    collection.forEach((value, key) => {
      if (value) {
        entries.push({ key, value });
      }
    });
    return entries;
  }

  if (!isNativeObject(collection)) {
    return [];
  }

  return Object.keys(collection)
    .map(key => ({ key, value: readNativeProperty(collection, key) }))
    .filter(entry => entry.value);
}

function readFiniteNumber(source: unknown, property: PropertyKey): number | null {
  const value = Number(readNativeProperty(source, property));
  return Number.isFinite(value) ? value : null;
}

export function getPlayerWorldEntityPosition(playerId: unknown, session: unknown): WorldEntityPosition | null {
  const sources = [
    // Live match entities observed during gameplay.
    readNativePath(session, ['KR', 'uL', 'Ho']),
    // Alternate player collection observed around match/lobby transitions.
    readNativePath(session, ['KR', 'mL', 'Pi']),
  ];

  for (const source of sources) {
    for (const { key, value } of getCollectionEntries(source)) {
      const id = readNativeProperty(value, 'id') !== undefined ? readNativeProperty(value, 'id') : key;
      const x = readFiniteNumber(value, 'x');
      const y = readFiniteNumber(value, 'y');
      if (isSamePlayerId(id, playerId) && x !== null && y !== null) {
        return { x, y };
      }
    }
  }

  return null;
}

export function getWorldCameraState(session: unknown): WorldCameraState {
  // The active camera has been observed at `KR.ed`, with `KR.hb.Bc` as a fallback during transitions.
  const camera = readNativePath(session, ['KR', 'ed']) || readNativePath(session, ['KR', 'hb', 'Bc']);
  return {
    width: Number(readNativeProperty(camera, 'fc')),
    height: Number(readNativeProperty(camera, 'gc')),
    left: Number(readNativeProperty(camera, 'yc')),
    top: Number(readNativeProperty(camera, 'vc')),
  };
}
