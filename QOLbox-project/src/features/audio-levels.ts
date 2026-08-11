import { DEFAULT_GAME_PERCENT, DEFAULT_JUKEBOX_PERCENT, clampJukeboxPercent, clampPercent } from '../settings/audio-storage';
import { readObjectProperty } from '../utils/object-properties';

const KEYBOARD_PAGE_STEP_MULTIPLIER = 4;
const GAME_CURVE_EXPONENT = 2;
const JUKEBOX_CURVE_EXPONENT = 2;

export const JUKEBOX_MIN_ANGLE = -40;
export const JUKEBOX_MAX_ANGLE = 220;
export const JUKEBOX_ARC_CENTER = 14;
export const JUKEBOX_ARC_RADIUS = 12;

const JUKEBOX_ANGLE_EPSILON = 1e-6;

interface ArcPoint {
  x: number;
  y: number;
}

function readBooleanProperty(source: unknown, property: PropertyKey): boolean {
  return readObjectProperty(source, property) === true;
}

function readStringProperty(source: unknown, property: PropertyKey): string {
  const value = readObjectProperty(source, property);
  return typeof value === 'string' ? value : '';
}

export function percentToGameScalar(percent: number): number {
  return (clampPercent(percent, DEFAULT_GAME_PERCENT) / 100) ** GAME_CURVE_EXPONENT;
}

export function percentToJukeboxVolume(percent: number): number {
  const clampedPercent = clampJukeboxPercent(percent);
  if (clampedPercent <= 0) {
    return 0;
  }

  return Math.max(1, Math.round((clampedPercent / 100) ** JUKEBOX_CURVE_EXPONENT * 100));
}

export function percentToJukeboxAngle(percent: number): number {
  const normalized = clampJukeboxPercent(percent) / 100;
  return JUKEBOX_MIN_ANGLE + (JUKEBOX_MAX_ANGLE - JUKEBOX_MIN_ANGLE) * normalized;
}

export function getKeyboardPercentTarget(event: unknown, currentPercent: number, stepPercent: number): number | null {
  if (
    !event ||
    readBooleanProperty(event, 'altKey') ||
    readBooleanProperty(event, 'ctrlKey') ||
    readBooleanProperty(event, 'metaKey')
  ) {
    return null;
  }

  const current = Number.isFinite(Number(currentPercent)) ? Number(currentPercent) : 0;
  const step = Math.max(1, Number(stepPercent) || 1);

  switch (readStringProperty(event, 'key')) {
    case 'ArrowUp':
    case 'ArrowRight':
      return current + step;
    case 'ArrowDown':
    case 'ArrowLeft':
      return current - step;
    case 'PageUp':
      return current + step * KEYBOARD_PAGE_STEP_MULTIPLIER;
    case 'PageDown':
      return current - step * KEYBOARD_PAGE_STEP_MULTIPLIER;
    case 'Home':
      return 0;
    case 'End':
      return 100;
    default:
      return null;
  }
}

export function angleToJukeboxPercent(angle: number): number {
  const numericAngle = Number(angle);
  if (!Number.isFinite(numericAngle)) {
    return DEFAULT_JUKEBOX_PERCENT;
  }

  const normalizedAngle = normalizeJukeboxAngle(numericAngle);
  const normalized =
    (Math.min(JUKEBOX_MAX_ANGLE, Math.max(JUKEBOX_MIN_ANGLE, normalizedAngle)) - JUKEBOX_MIN_ANGLE) /
    (JUKEBOX_MAX_ANGLE - JUKEBOX_MIN_ANGLE);
  return clampJukeboxPercent(normalized * 100);
}

export function normalizeJukeboxAngle(angle: number): number {
  const numericAngle = Number(angle);
  if (!Number.isFinite(numericAngle)) {
    return percentToJukeboxAngle(DEFAULT_JUKEBOX_PERCENT);
  }

  const candidates = [numericAngle, numericAngle + 360, numericAngle - 360];
  for (const candidate of candidates) {
    if (
      candidate >= JUKEBOX_MIN_ANGLE - JUKEBOX_ANGLE_EPSILON &&
      candidate <= JUKEBOX_MAX_ANGLE + JUKEBOX_ANGLE_EPSILON
    ) {
      return Math.max(JUKEBOX_MIN_ANGLE, Math.min(JUKEBOX_MAX_ANGLE, candidate));
    }
  }

  return Math.max(JUKEBOX_MIN_ANGLE, Math.min(JUKEBOX_MAX_ANGLE, numericAngle));
}

export function parseJukeboxAngleFromTransform(transform: string): number | null {
  if (typeof transform !== 'string' || transform === '' || transform === 'none') {
    return null;
  }

  const rotateMatch = transform.match(/rotate\(\s*(-?\d+(?:\.\d+)?)deg\s*\)/i);
  if (rotateMatch) {
    return normalizeJukeboxAngle(Number(rotateMatch[1]));
  }

  const matrixValues = transform.match(/^matrix\(([^)]+)\)$/i)?.[1];
  if (matrixValues) {
    const values = matrixValues.split(',').map(value => Number(value.trim()));
    if (values.length >= 4 && values.every(Number.isFinite)) {
      return normalizeJukeboxAngle((Math.atan2(values[1] ?? 0, values[0] ?? 0) * 180) / Math.PI);
    }
  }

  const matrix3dValues = transform.match(/^matrix3d\(([^)]+)\)$/i)?.[1];
  if (matrix3dValues) {
    const values = matrix3dValues.split(',').map(value => Number(value.trim()));
    if (values.length >= 16 && values.every(Number.isFinite)) {
      return normalizeJukeboxAngle((Math.atan2(values[1] ?? 0, values[0] ?? 0) * 180) / Math.PI);
    }
  }

  return null;
}

export function polarToArcPoint(angle: number): ArcPoint {
  const radians = ((angle + 180) * Math.PI) / 180;
  return {
    x: JUKEBOX_ARC_CENTER + JUKEBOX_ARC_RADIUS * Math.cos(radians),
    y: JUKEBOX_ARC_CENTER + JUKEBOX_ARC_RADIUS * Math.sin(radians),
  };
}
