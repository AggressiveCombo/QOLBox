import { keepInBrowserTabOrder } from '../dom/dom-helpers';
import { DEFAULT_JUKEBOX_PERCENT, clampJukeboxPercent } from '../settings/audio-storage';
import { readObjectProperty } from '../utils/object-properties';
import {
  JUKEBOX_ARC_RADIUS,
  JUKEBOX_MIN_ANGLE,
  angleToJukeboxPercent,
  parseJukeboxAngleFromTransform,
  percentToJukeboxAngle,
  polarToArcPoint,
} from './audio-levels';

type StyleElement = Element & { style: CSSStyleDeclaration };

export interface JukeboxKnobState {
  muted: boolean;
  percent: number | null;
}

function isStyleElement(value: unknown): value is StyleElement {
  return value instanceof Element && typeof readObjectProperty(value, 'style') === 'object';
}

export function findJukeboxKnob(): Element | null {
  return document.querySelector('.jukebox .knob.volumeContainer');
}

export function readJukeboxPercentFromKnob(knob: Element | null): number | null {
  const bar = knob ? knob.querySelector('.barSVG') : null;
  if (!isStyleElement(bar)) {
    return null;
  }

  const inlineAngle = parseJukeboxAngleFromTransform(bar.style.transform);
  if (inlineAngle !== null) {
    return angleToJukeboxPercent(inlineAngle);
  }

  const computedAngle = parseJukeboxAngleFromTransform(window.getComputedStyle(bar).transform);
  if (computedAngle !== null) {
    return angleToJukeboxPercent(computedAngle);
  }

  return null;
}

function updateJukeboxKnobAccessibility(
  knob: Element | null,
  visualPercent: number | null,
  state: JukeboxKnobState
): void {
  if (!knob) {
    return;
  }

  const effectivePercent = state.muted
    ? 0
    : clampJukeboxPercent(visualPercent ?? state.percent ?? DEFAULT_JUKEBOX_PERCENT);

  knob.setAttribute('aria-label', 'Jukebox volume');
  knob.setAttribute('aria-orientation', 'vertical');
  knob.setAttribute('aria-valuemin', '0');
  knob.setAttribute('aria-valuemax', '100');
  knob.setAttribute('aria-valuenow', String(effectivePercent));
  knob.setAttribute('aria-valuetext', state.muted ? `Muted (${effectivePercent}%)` : `${effectivePercent}%`);
  knob.setAttribute('role', 'slider');
  keepInBrowserTabOrder(knob);
}

export function setJukeboxKnobVisual(
  knob: Element | null,
  visualPercent: number | null,
  state: JukeboxKnobState
): void {
  if (!knob) {
    return;
  }

  const angle = percentToJukeboxAngle(visualPercent ?? DEFAULT_JUKEBOX_PERCENT);
  const bar = knob.querySelector('.barSVG');
  const arcPath = knob.querySelector('.arcSVG path');

  if (isStyleElement(bar)) {
    bar.style.transform = `rotate(${angle}deg)`;
  }

  if (arcPath) {
    const startPoint = polarToArcPoint(JUKEBOX_MIN_ANGLE);
    const endPoint = polarToArcPoint(angle);
    const sweepDegrees = Math.max(0, angle - JUKEBOX_MIN_ANGLE);
    const largeArcFlag = sweepDegrees > 180 ? 1 : 0;
    arcPath.setAttribute(
      'd',
      `M ${startPoint.x} ${startPoint.y} A ${JUKEBOX_ARC_RADIUS} ${JUKEBOX_ARC_RADIUS} 0 ${largeArcFlag} 1 ${endPoint.x} ${endPoint.y}`
    );
  }

  updateJukeboxKnobAccessibility(knob, visualPercent, state);
}

export function clearJukeboxKnobAccessibility(knob: Element | null): void {
  if (!knob) {
    return;
  }

  knob.removeAttribute('aria-label');
  knob.removeAttribute('aria-orientation');
  knob.removeAttribute('aria-valuemin');
  knob.removeAttribute('aria-valuemax');
  knob.removeAttribute('aria-valuenow');
  knob.removeAttribute('aria-valuetext');
  knob.removeAttribute('role');
  if (knob.getAttribute('tabindex') === '0') {
    knob.removeAttribute('tabindex');
  }
}
