import { createYouTubeJukeboxAdapter } from '../hitbox/youtube-player-adapter';
import type { ScheduledUiWorkRequest } from '../types/scheduled-work';
import { percentToJukeboxVolume } from './audio-levels';
import { isJukeboxStyleDatasetElement } from './jukebox-dom-helpers';
import { createJukeboxKeyboardFocusController } from './jukebox-keyboard-focus';
import { createJukeboxKnobInteractionController } from './jukebox-knob-interaction';
import { createJukeboxMenuController } from './jukebox-menu-control';
import {
  clearJukeboxKnobAccessibility,
  findJukeboxKnob,
  readJukeboxPercentFromKnob,
  setJukeboxKnobVisual,
} from './jukebox-knob-view';
import { createJukeboxStateController } from './jukebox-state';

interface JukeboxControllerOptions {
  jukeboxDragSensitivity: number;
  jukeboxWheelStep: number;
  resizeSettlePasses: number;
  youTubeHookMaxRetries: number;
  youTubeHookRetryDelayMs: number;
  findChangeControlsItem(container: Element | null): Element | null;
  findSettingsContainer(): Element | null;
  focusActiveRenderCanvas(): void;
  getActiveRenderCanvas(): Element | null;
  getActiveRenderMode(): string;
  isAudioEnabled(): boolean;
  isChatInput(target: unknown): boolean;
  resetBrowserScroll(): void;
  scheduleUiWork(options: ScheduledUiWorkRequest): void;
}

export function createJukeboxController(options: JukeboxControllerOptions) {
  const jukeboxState = createJukeboxStateController();
  const youTubeAdapter = createYouTubeJukeboxAdapter({
    getVolume: () => percentToJukeboxVolume(getEffectiveJukeboxPercent()),
    isEnabled: options.isAudioEnabled,
    isMuted: () => jukeboxState.isMuted(),
    maxRetries: options.youTubeHookMaxRetries,
    onPlayerStateNeeded: () => applyJukeboxState(),
    retryDelayMs: options.youTubeHookRetryDelayMs,
  });
  const keyboardFocus = createJukeboxKeyboardFocusController({
    resizeSettlePasses: options.resizeSettlePasses,
    findJukeboxKnob,
    focusActiveRenderCanvas: options.focusActiveRenderCanvas,
    getActiveRenderCanvas: options.getActiveRenderCanvas,
    getActiveRenderMode: options.getActiveRenderMode,
    isAudioEnabled: options.isAudioEnabled,
    isChatInput: options.isChatInput,
    resetBrowserScroll: options.resetBrowserScroll,
    scheduleUiWork: options.scheduleUiWork,
  });
  const menuController = createJukeboxMenuController({
    findChangeControlsItem: options.findChangeControlsItem,
    findSettingsContainer: options.findSettingsContainer,
    getLabel: getJukeboxMenuLabel,
    isAudioEnabled: options.isAudioEnabled,
    onToggleMute: toggleJukeboxMute,
  });
  const knobInteraction = createJukeboxKnobInteractionController({
    dragSensitivity: options.jukeboxDragSensitivity,
    wheelStep: options.jukeboxWheelStep,
    applyJukeboxState,
    ensureJukeboxPercent,
    getEffectiveJukeboxPercent,
    getJukeboxPercent: () => jukeboxState.getPercent(),
    isAudioEnabled: options.isAudioEnabled,
    isJukeboxMuted: () => jukeboxState.isMuted(),
    setJukeboxPercent,
    unmuteJukeboxIfMuted: () => jukeboxState.unmuteIfMuted(),
    updateJukeboxMenuItem,
  });

  function installTabFocusHooks(): void {
    keyboardFocus.installTabFocusHooks();
  }

  function patchJukeboxKeyboardFocus(knob: Element | null): void {
    keyboardFocus.patchJukeboxKeyboardFocus(knob);
  }

  function getJukeboxMenuLabel(): string {
    return jukeboxState.getMenuLabel();
  }

  function updateJukeboxMenuItem(): void {
    menuController.updateJukeboxMenuItem();
  }

  function patchJukeboxMenu(): boolean {
    return menuController.patchJukeboxMenu();
  }

  function getEffectiveJukeboxPercent(): number {
    return jukeboxState.getEffectivePercent();
  }

  function ensureJukeboxPercent(knob: Element | null): void {
    if (!knob) {
      return;
    }

    jukeboxState.ensurePercent(() => readJukeboxPercentFromKnob(knob));
  }

  function applyJukeboxStateToKnob(knob: Element | null): void {
    if (!options.isAudioEnabled() || !knob || knobInteraction.isKnobDragActive()) {
      return;
    }

    ensureJukeboxPercent(knob);
    setJukeboxKnobVisual(knob, jukeboxState.isMuted() ? 0 : jukeboxState.getPercent(), jukeboxState.getState());
  }

  function applyJukeboxState(): void {
    if (!options.isAudioEnabled()) {
      return;
    }

    const knob = findJukeboxKnob();
    applyJukeboxStateToKnob(knob);

    ensureJukeboxPercent(knob);
    youTubeAdapter.applyToTrackedPlayers();
  }

  function installYouTubeReadyCallbackHook(): void {
    youTubeAdapter.installReadyCallbackHook();
  }

  function hookYouTubePlayer(): boolean {
    return youTubeAdapter.hookPlayerConstructor();
  }

  function setJukeboxPercent(nextPercent: number): void {
    if (!options.isAudioEnabled()) {
      return;
    }

    jukeboxState.setPercent(nextPercent);
    updateJukeboxMenuItem();
    setJukeboxKnobVisual(findJukeboxKnob(), jukeboxState.getPercent(), jukeboxState.getState());
    applyJukeboxState();
  }

  function toggleJukeboxMute(): void {
    if (!options.isAudioEnabled()) {
      return;
    }

    ensureJukeboxPercent(findJukeboxKnob());
    jukeboxState.toggleMuted();
    updateJukeboxMenuItem();
    applyJukeboxState();
  }

  function patchJukeboxKnob(): boolean {
    if (!options.isAudioEnabled()) {
      return false;
    }

    const knob = findJukeboxKnob();
    if (!isJukeboxStyleDatasetElement(knob)) {
      return false;
    }

    ensureJukeboxPercent(knob);
    applyJukeboxStateToKnob(knob);
    patchJukeboxKeyboardFocus(knob);
    knobInteraction.patchJukeboxKnobInteraction(knob);

    return true;
  }

  function removeJukeboxMenuItem(): void {
    menuController.removeJukeboxMenuItem();
  }

  function restoreJukeboxState(): void {
    const knob = findJukeboxKnob();
    const nativePercent = readJukeboxPercentFromKnob(knob);
    const restorePercent =
      jukeboxState.isMuted() && nativePercent === 0
        ? getEffectiveJukeboxPercent()
        : nativePercent ?? getEffectiveJukeboxPercent();
    clearJukeboxKnobAccessibility(knob);
    youTubeAdapter.restoreTrackedPlayers(percentToJukeboxVolume(restorePercent));
  }

  function setJukeboxState(nextState: { muted?: boolean; percent?: number | null }): void {
    jukeboxState.setState(nextState);
  }

  return {
    applyJukeboxState,
    findJukeboxKnob,
    getEffectiveJukeboxPercent,
    handleGameplayTabFocus: keyboardFocus.handleGameplayTabFocus,
    hookYouTubePlayer,
    installTabFocusHooks,
    installYouTubeReadyCallbackHook,
    patchJukeboxKeyboardFocus,
    patchJukeboxKnob,
    patchJukeboxMenu,
    removeJukeboxMenuItem,
    restoreJukeboxState,
    setJukeboxState,
  };
}
