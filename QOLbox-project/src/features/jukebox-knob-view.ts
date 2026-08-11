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

interface JukeboxKnobViewSnapshot {
  arcPath: Element | null;
  arcPathData: string | null;
  attributes: Map<string, string | null>;
  bar: StyleElement | null;
  barTransform: string;
  knob: Element;
  touchAction: string;
}

const PATCHED_KNOB_ATTRIBUTES = [
  'aria-label',
  'aria-orientation',
  'aria-valuemin',
  'aria-valuemax',
  'aria-valuenow',
  'aria-valuetext',
  'role',
  'tabindex',
  'title',
] as const;
const originalKnobViews = new Map<Element, JukeboxKnobViewSnapshot>();

function isStyleElement(value: unknown): value is StyleElement {
  return value instanceof Element && typeof readObjectProperty(value, 'style') === 'object';
}

function setAttribute(element: Element, name: string, value: string): void {
  if (element.getAttribute(name) !== value) element.setAttribute(name, value);
}

function captureJukeboxKnobView(knob: Element): void {
  for (const savedKnob of originalKnobViews.keys()) {
    if (!savedKnob.isConnected) {
      originalKnobViews.delete(savedKnob);
    }
  }
  if (originalKnobViews.has(knob)) {
    return;
  }

  const bar = knob.querySelector('.barSVG');
  const styledBar = isStyleElement(bar) ? bar : null;
  const arcPath = knob.querySelector('.arcSVG path');
  originalKnobViews.set(knob, {
    arcPath,
    arcPathData: arcPath?.getAttribute('d') ?? null,
    attributes: new Map(PATCHED_KNOB_ATTRIBUTES.map(attribute => [attribute, knob.getAttribute(attribute)])),
    bar: styledBar,
    barTransform: styledBar?.style.transform ?? '',
    knob,
    touchAction: isStyleElement(knob) ? knob.style.touchAction : '',
  });
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

  setAttribute(knob, 'aria-label', 'Jukebox volume');
  setAttribute(knob, 'aria-orientation', 'vertical');
  setAttribute(knob, 'aria-valuemin', '0');
  setAttribute(knob, 'aria-valuemax', '100');
  setAttribute(knob, 'aria-valuenow', String(effectivePercent));
  setAttribute(knob, 'aria-valuetext', state.muted ? `Muted (${effectivePercent}%)` : `${effectivePercent}%`);
  setAttribute(knob, 'role', 'slider');
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

  captureJukeboxKnobView(knob);
  const angle = percentToJukeboxAngle(visualPercent ?? DEFAULT_JUKEBOX_PERCENT);
  const bar = knob.querySelector('.barSVG');
  const arcPath = knob.querySelector('.arcSVG path');

  if (isStyleElement(bar)) {
    const transform = `rotate(${angle}deg)`;
    if (bar.style.transform !== transform) bar.style.transform = transform;
  }

  if (arcPath) {
    const startPoint = polarToArcPoint(JUKEBOX_MIN_ANGLE);
    const endPoint = polarToArcPoint(angle);
    const sweepDegrees = Math.max(0, angle - JUKEBOX_MIN_ANGLE);
    const largeArcFlag = sweepDegrees > 180 ? 1 : 0;
    setAttribute(arcPath, 'd',
      `M ${startPoint.x} ${startPoint.y} A ${JUKEBOX_ARC_RADIUS} ${JUKEBOX_ARC_RADIUS} 0 ${largeArcFlag} 1 ${endPoint.x} ${endPoint.y}`);
  }

  updateJukeboxKnobAccessibility(knob, visualPercent, state);
}

export function restoreJukeboxKnobViews(): void {
  for (const snapshot of originalKnobViews.values()) {
    for (const [attribute, value] of snapshot.attributes) {
      if (value === null) {
        snapshot.knob.removeAttribute(attribute);
      } else {
        snapshot.knob.setAttribute(attribute, value);
      }
    }
    if (isStyleElement(snapshot.knob)) {
      snapshot.knob.style.touchAction = snapshot.touchAction;
    }
    if (snapshot.bar) {
      snapshot.bar.style.transform = snapshot.barTransform;
    }
    if (snapshot.arcPath) {
      if (snapshot.arcPathData === null) {
        snapshot.arcPath.removeAttribute('d');
      } else {
        snapshot.arcPath.setAttribute('d', snapshot.arcPathData);
      }
    }
  }
  originalKnobViews.clear();
}
