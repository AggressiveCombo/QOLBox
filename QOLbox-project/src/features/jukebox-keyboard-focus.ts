import { focusElementWithoutScroll, isElementVisible } from '../dom/dom-helpers';
import type { ScheduledUiWorkRequest } from '../types/scheduled-work';
import { isCallable, readObjectProperty } from '../utils/object-properties';
import { isTabKey } from './chat-input-controls';

type StyleDatasetElement = Element & { dataset: DOMStringMap; style: CSSStyleDeclaration };
type StyleElement = Element & { style: CSSStyleDeclaration };

interface JukeboxKeyboardFocusOptions {
  resizeSettlePasses: number;
  findJukeboxKnob(): Element | null;
  focusActiveRenderCanvas(): void;
  getActiveRenderCanvas(): Element | null;
  getActiveRenderMode(): string;
  isAudioEnabled(): boolean;
  isChatInput(target: unknown): boolean;
  resetBrowserScroll(): void;
  scheduleUiWork(options: ScheduledUiWorkRequest): void;
}

function isStyleElement(value: unknown): value is StyleElement {
  return value instanceof Element && typeof readObjectProperty(value, 'style') === 'object';
}

function isStyleDatasetElement(value: unknown): value is StyleDatasetElement {
  return (
    value instanceof Element &&
    typeof readObjectProperty(value, 'dataset') === 'object' &&
    typeof readObjectProperty(value, 'style') === 'object'
  );
}

export function createJukeboxKeyboardFocusController(options: JukeboxKeyboardFocusOptions) {
  let tabFocusHooksInstalled = false;

  function setJukeboxBottom(jukebox: unknown, bottom: string): void {
    if (isStyleElement(jukebox)) {
      jukebox.style.bottom = bottom;
    }
  }

  function openJukeboxFromKeyboardFocus(jukebox: Element | null): void {
    if (!options.isAudioEnabled() || !jukebox) {
      return;
    }

    options.resetBrowserScroll();
    setJukeboxBottom(jukebox, '0px');

    const onMouseEnter = readObjectProperty(jukebox, 'onmouseenter');
    if (isCallable(onMouseEnter)) {
      Reflect.apply(onMouseEnter, jukebox, []);
    } else {
      setJukeboxBottom(jukebox, '0px');
    }

    options.scheduleUiWork({ passes: options.resizeSettlePasses });
  }

  function closeJukeboxFromKeyboardFocus(jukebox: Element | null, nextFocusTarget: unknown): void {
    if (
      !options.isAudioEnabled() ||
      !jukebox ||
      (nextFocusTarget instanceof Element && jukebox.contains(nextFocusTarget)) ||
      jukebox.matches(':hover')
    ) {
      return;
    }

    const onMouseLeave = readObjectProperty(jukebox, 'onmouseleave');
    if (isCallable(onMouseLeave)) {
      Reflect.apply(onMouseLeave, jukebox, []);
    } else {
      setJukeboxBottom(jukebox, '-50px');
    }
  }

  function focusJukeboxKnobFromTab(knob: Element | null): boolean {
    if (!options.isAudioEnabled()) {
      return false;
    }

    const jukebox = knob?.closest('.jukebox') || null;
    if (!jukebox) {
      return false;
    }

    openJukeboxFromKeyboardFocus(jukebox);
    focusElementWithoutScroll(knob);
    options.resetBrowserScroll();
    return true;
  }

  function isGameplayTabFocusContext(target: unknown, knob: Element): boolean {
    const activeCanvas = options.getActiveRenderCanvas();
    return (
      target === window ||
      target === document ||
      target === document.body ||
      target === document.documentElement ||
      target === activeCanvas ||
      target === knob
    );
  }

  function handleGameplayTabFocus(event: KeyboardEvent): void {
    if (
      !options.isAudioEnabled() ||
      !isTabKey(event) ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      options.isChatInput(event.target) ||
      options.getActiveRenderMode() !== 'gameplay'
    ) {
      return;
    }

    const knob = options.findJukeboxKnob();
    const jukebox = knob?.closest('.jukebox') || null;
    if (!knob || !jukebox || !isElementVisible(jukebox) || !isGameplayTabFocusContext(event.target, knob)) {
      return;
    }

    event.preventDefault();

    if (document.activeElement === knob) {
      options.focusActiveRenderCanvas();
      closeJukeboxFromKeyboardFocus(jukebox, document.activeElement);
      return;
    }

    focusJukeboxKnobFromTab(knob);
  }

  function installTabFocusHooks(): void {
    if (tabFocusHooksInstalled) {
      return;
    }

    tabFocusHooksInstalled = true;
    window.addEventListener('keydown', handleGameplayTabFocus, true);
  }

  function patchJukeboxKeyboardFocus(knob: Element | null): void {
    if (!options.isAudioEnabled()) {
      return;
    }

    const jukebox = knob?.closest('.jukebox') || null;
    if (!isStyleDatasetElement(jukebox) || jukebox.dataset.qolboxKeyboardFocusPatched) {
      return;
    }

    jukebox.dataset.qolboxKeyboardFocusPatched = 'true';
    jukebox.addEventListener('focusin', () => openJukeboxFromKeyboardFocus(jukebox), true);
    jukebox.addEventListener(
      'focusout',
      event => closeJukeboxFromKeyboardFocus(jukebox, readObjectProperty(event, 'relatedTarget')),
      true
    );
  }

  return {
    handleGameplayTabFocus,
    installTabFocusHooks,
    patchJukeboxKeyboardFocus,
  };
}
