import { createYouTubeJukeboxAdapter } from '../hitbox/youtube-player-adapter';
import type { ScheduledUiWorkRequest } from '../types/scheduled-work';
import { percentToJukeboxVolume } from './audio-levels';
import { isJukeboxStyleDatasetElement } from './jukebox-dom-helpers';
import { createJukeboxKeyboardFocusController } from './jukebox-keyboard-focus';
import { createJukeboxKnobInteractionController } from './jukebox-knob-interaction';
import { createJukeboxMenuController } from './jukebox-menu-control';
import {
  findJukeboxKnob,
  readJukeboxPercentFromKnob,
  restoreJukeboxKnobViews,
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
    getVolume: () => percentToJukeboxVolume(jukeboxState.getEffectivePercent()),
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
    getLabel: jukeboxState.getMenuLabel,
    isAudioEnabled: options.isAudioEnabled,
    onToggleMute: toggleJukeboxMute,
  });
  const knobInteraction = createJukeboxKnobInteractionController({
    dragSensitivity: options.jukeboxDragSensitivity,
    wheelStep: options.jukeboxWheelStep,
    applyJukeboxState,
    ensureJukeboxPercent,
    getEffectiveJukeboxPercent: jukeboxState.getEffectivePercent,
    getJukeboxPercent: () => jukeboxState.getPercent(),
    isAudioEnabled: options.isAudioEnabled,
    isJukeboxMuted: () => jukeboxState.isMuted(),
    setJukeboxPercent,
    unmuteJukeboxIfMuted: () => jukeboxState.unmuteIfMuted(),
    updateJukeboxMenuItem: menuController.updateJukeboxMenuItem,
  });

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

  function setJukeboxPercent(nextPercent: number): void {
    if (!options.isAudioEnabled()) {
      return;
    }

    jukeboxState.setPercent(nextPercent);
    menuController.updateJukeboxMenuItem();
    setJukeboxKnobVisual(findJukeboxKnob(), jukeboxState.getPercent(), jukeboxState.getState());
    applyJukeboxState();
  }

  function toggleJukeboxMute(): void {
    if (!options.isAudioEnabled()) {
      return;
    }

    ensureJukeboxPercent(findJukeboxKnob());
    jukeboxState.toggleMuted();
    menuController.updateJukeboxMenuItem();
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
    keyboardFocus.patchJukeboxKeyboardFocus(knob);
    knobInteraction.patchJukeboxKnobInteraction(knob);

    return true;
  }

  function restoreJukeboxState(): void {
    restoreJukeboxKnobViews();
    youTubeAdapter.restoreTrackedPlayers();
  }

  function setJukeboxState(nextState: { muted?: boolean; percent?: number | null }): void {
    jukeboxState.setState(nextState);
  }

  return {
    applyJukeboxState,
    findJukeboxKnob,
    getEffectiveJukeboxPercent: jukeboxState.getEffectivePercent,
    handleGameplayTabFocus: keyboardFocus.handleGameplayTabFocus,
    hookYouTubePlayer: youTubeAdapter.hookPlayerConstructor,
    installTabFocusHooks: keyboardFocus.installTabFocusHooks,
    installYouTubeReadyCallbackHook: youTubeAdapter.installReadyCallbackHook,
    patchJukeboxKeyboardFocus: keyboardFocus.patchJukeboxKeyboardFocus,
    patchJukeboxKnob,
    patchJukeboxMenu: menuController.patchJukeboxMenu,
    removeJukeboxMenuItem: menuController.removeJukeboxMenuItem,
    restoreJukeboxState,
    setJukeboxState,
  };
}
