import { isReflectableObject, readObjectProperty } from '../utils/object-properties';

export type ReserveJoinPayload = object;

export function cloneReserveJoinValue(value: unknown): unknown {
  try {
    const cloned: unknown = JSON.parse(JSON.stringify(value));
    return cloned;
  } catch {
    return value;
  }
}

export function isReserveJoinPayload(value: unknown): value is ReserveJoinPayload {
  return Boolean(
    isReflectableObject(value) &&
      (typeof getReserveJoinPayloadJoinId(value) === 'string' ||
        (Object.prototype.hasOwnProperty.call(value, 'playerName') &&
          Object.prototype.hasOwnProperty.call(value, 'peerID') &&
          Object.prototype.hasOwnProperty.call(value, 'password')))
  );
}

export function getReserveJoinPayload(args: readonly unknown[]): ReserveJoinPayload | null {
  return args.find(isReserveJoinPayload) || null;
}

export function getReserveJoinPayloadJoinId(payload: ReserveJoinPayload): unknown {
  return readObjectProperty(payload, 'joinID');
}

export function getReserveJoinPayloadPassword(payload: ReserveJoinPayload): unknown {
  return readObjectProperty(payload, 'password');
}
