import { focusElementWithoutScroll } from '../dom/dom-helpers';
import { DEFAULT_JUKEBOX_PERCENT, clampJukeboxPercent } from '../settings/audio-storage';
import { setObjectProperty } from '../utils/object-properties';
import { getKeyboardPercentTarget } from './audio-levels';
import {
  type JukeboxStyleDatasetElement,
  readJukeboxBooleanProperty,
  readJukeboxNumberProperty,
  requestJukeboxPointerCapture,
} from './jukebox-dom-helpers';

interface KnobDragState {
  startPercent: number;
  startY: number;
}

interface JukeboxKnobInteractionOptions {
  dragSensitivity: number;
  wheelStep: number;
  applyJukeboxState(): void;
  ensureJukeboxPercent(knob: Element | null): void;
  getEffectiveJukeboxPercent(): number;
  getJukeboxPercent(): number | null;
  isAudioEnabled(): boolean;
  isJukeboxMuted(): boolean;
  setJukeboxPercent(nextPercent: number): void;
  unmuteJukeboxIfMuted(): boolean;
  updateJukeboxMenuItem(): void;
}

export function createJukeboxKnobInteractionController(options: JukeboxKnobInteractionOptions) {
  let activeKnobDrag: KnobDragState | null = null;

  function isKnobDragActive(): boolean {
    return Boolean(activeKnobDrag);
  }

  function getKnobPercentFromPointer(event: unknown): number {
    if (!activeKnobDrag) {
      return DEFAULT_JUKEBOX_PERCENT;
    }

    const deltaY = activeKnobDrag.startY - readJukeboxNumberProperty(event, 'clientY');
    return clampJukeboxPercent(activeKnobDrag.startPercent + deltaY * options.dragSensitivity);
  }

  function onKnobPointerMove(event: Event): void {
    if (!options.isAudioEnabled() || !activeKnobDrag) {
      return;
    }

    event.preventDefault();
    options.setJukeboxPercent(getKnobPercentFromPointer(event));
  }

  function endKnobDrag(): void {
    activeKnobDrag = null;
  }

  function patchGlobalKnobListeners(): void {
    if (readJukeboxBooleanProperty(window, '__qolboxJukeboxGlobalsPatched')) {
      return;
    }

    setObjectProperty(window, '__qolboxJukeboxGlobalsPatched', true);
    window.addEventListener('pointermove', onKnobPointerMove, true);
    window.addEventListener('mousemove', onKnobPointerMove, true);
    window.addEventListener('pointerup', endKnobDrag, true);
    window.addEventListener('mouseup', endKnobDrag, true);
    window.addEventListener('blur', endKnobDrag, true);
  }

  function patchJukeboxKnobInteraction(knob: JukeboxStyleDatasetElement): void {
    patchGlobalKnobListeners();

    if (knob.dataset.qolboxJukeboxPatched) {
      return;
    }

    knob.dataset.qolboxJukeboxPatched = 'true';
    knob.setAttribute('title', 'Scroll, drag, or use arrow keys to adjust the jukebox volume');
    knob.style.touchAction = 'none';

    knob.addEventListener(
      'pointerdown',
      event => {
        if (!options.isAudioEnabled()) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        focusElementWithoutScroll(knob);
        requestJukeboxPointerCapture(knob, event);

        if (options.unmuteJukeboxIfMuted()) {
          options.updateJukeboxMenuItem();
          options.applyJukeboxState();
        }

        activeKnobDrag = {
          startY: readJukeboxNumberProperty(event, 'clientY'),
          startPercent: options.getJukeboxPercent() ?? DEFAULT_JUKEBOX_PERCENT,
        };
        onKnobPointerMove(event);
      },
      true
    );

    knob.addEventListener(
      'wheel',
      event => {
        if (!options.isAudioEnabled()) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        focusElementWithoutScroll(knob);
        options.ensureJukeboxPercent(knob);

        const currentPercent = options.isJukeboxMuted() ? 0 : options.getJukeboxPercent();
        options.setJukeboxPercent(
          (currentPercent ?? DEFAULT_JUKEBOX_PERCENT) +
            (readJukeboxNumberProperty(event, 'deltaY') < 0 ? options.wheelStep : -options.wheelStep)
        );
      },
      { passive: false }
    );

    knob.addEventListener(
      'keydown',
      event => {
        if (!options.isAudioEnabled()) {
          return;
        }

        const currentPercent = options.isJukeboxMuted() ? 0 : options.getEffectiveJukeboxPercent();
        const nextPercent = getKeyboardPercentTarget(event, currentPercent, options.wheelStep);
        if (nextPercent === null) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        options.ensureJukeboxPercent(knob);
        options.setJukeboxPercent(nextPercent);
      },
      true
    );
  }

  return {
    isKnobDragActive,
    patchJukeboxKnobInteraction,
  };
}
