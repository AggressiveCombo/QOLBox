import { areGameStartSessionHooksInstalled, installGameStartSessionHooks } from '../hitbox/game-start-hooks';
import { createGameStartDisplayController } from './game-start-display';
import { createGameStartFocusHookInstaller } from './game-start-focus-hooks';
import { createLocalPlayTransitionTracker } from './game-start-local-transition';
import {
  GAME_PULLED_TITLE_PREFIX,
  GAME_START_TITLE_PREFIX,
  stripGameStartTitlePrefix,
} from './game-start-shared';
import { createGameStartTimerController } from './game-start-timers';

type GameStartReason = 'started' | 'pulled';

interface GameStartIndicatorOptions {
  endWatchIntervalMs: number;
  getFlashIntervalMs(): number;
  getIndicatorDelayMs(): number;
  localTransitionTimeoutMs: number;
  sessionEntryGraceMs: number;
  watchIntervalMs: number;
  getSession(): unknown;
  isEnabled(): boolean;
  isMatchActive(): boolean;
  isPageFocused(): boolean;
  isPlayableLobby(): boolean;
  isPlayingMatch(): boolean;
  isSessionActive(): boolean;
}

function getTitlePrefix(reason: GameStartReason): string {
  return reason === 'pulled' ? GAME_PULLED_TITLE_PREFIX : GAME_START_TITLE_PREFIX;
}

export function createGameStartIndicatorController(options: GameStartIndicatorOptions) {
  const display = createGameStartDisplayController();
  const localPlayTransition = createLocalPlayTransitionTracker({
    getSession: options.getSession,
    timeoutMs: options.localTransitionTimeoutMs,
  });
  let sessionHookTarget: unknown = null;
  let indicatorActive = false;
  const timers = createGameStartTimerController();
  let flashOn = false;
  let originalTitle = '';
  let wasPlayingWhenUnfocused = false;
  let wasInLobbyWhenUnfocused = false;
  let observedSession: unknown = null;
  let wasSessionActive = false;
  let sessionEntryGraceSession: unknown = null;
  let sessionEntryGraceUntil = 0;
  let indicatorReason: GameStartReason = 'started';
  let pageFocused = true;
  const focusHooks = createGameStartFocusHookInstaller({
    handleAway,
    handleInteractionFocus,
    handleReturn,
    handleVisibilityChange,
    initializeFocusState,
  });

  function isIndicatorPageFocused(): boolean {
    return pageFocused && options.isPageFocused();
  }

  function getPolledReason(): GameStartReason {
    return wasInLobbyWhenUnfocused ? 'started' : 'pulled';
  }

  function clearIndicatorTimer(): void {
    timers.clearIndicatorTimer();
  }

  function clearWatchTimer(): void {
    timers.clearWatchTimer();
  }

  function clearEndWatchTimer(): void {
    timers.clearEndWatchTimer();
  }

  function clearFlashTimer(): void {
    timers.clearFlashTimer();
  }

  function flashIndicator(): void {
    if (!indicatorActive) {
      return;
    }

    flashOn = !flashOn;
    display.setTitle(`${getTitlePrefix(indicatorReason)}${originalTitle}`);
    display.setFavicon(flashOn);
    timers.setFlashTimer(flashIndicator, options.getFlashIntervalMs());
  }

  function scheduleEndWatch(): void {
    if (!indicatorActive || timers.hasEndWatchTimer()) {
      return;
    }

    timers.setEndWatchTimer(() => {
      if (!indicatorActive) {
        return;
      }

      if (!options.isPlayingMatch()) {
        wasPlayingWhenUnfocused = false;
        wasInLobbyWhenUnfocused = options.isPlayableLobby();
        clearIndicator();

        if (!isIndicatorPageFocused()) {
          scheduleWatch();
        }

        return;
      }

      scheduleEndWatch();
    }, options.endWatchIntervalMs);
  }

  function showIndicator(reason: GameStartReason = 'started'): void {
    if (!options.isEnabled()) {
      return;
    }

    if (indicatorActive) {
      scheduleEndWatch();
      return;
    }

    indicatorReason = reason;
    originalTitle = stripGameStartTitlePrefix(display.getTitle());
    indicatorActive = true;
    flashOn = false;
    clearFlashTimer();
    flashIndicator();
    scheduleEndWatch();
  }

  function clearIndicator(): void {
    clearIndicatorTimer();
    clearEndWatchTimer();
    clearFlashTimer();

    if (!indicatorActive) {
      return;
    }

    display.setTitle(originalTitle);
    display.restoreFavicon();
    display.postClear();
    originalTitle = '';
    flashOn = false;
    indicatorReason = 'started';
    indicatorActive = false;
  }

  function noteLocallyInitiatedPlayTransition(session: unknown = options.getSession()): void {
    if (!options.isEnabled()) {
      return;
    }

    if (localPlayTransition.note(session)) {
      clearIndicatorTimer();
    }
  }

  function hasPendingLocalPlayTransition(session: unknown = options.getSession()): boolean {
    return localPlayTransition.has(session);
  }

  function consumePendingLocalPlayTransition(session: unknown = options.getSession()): boolean {
    return localPlayTransition.consume(session);
  }

  function clearSessionEntryGrace(): void {
    sessionEntryGraceSession = null;
    sessionEntryGraceUntil = 0;
  }

  function noteSessionEntryGrace(session: unknown): void {
    if (!session) {
      clearSessionEntryGrace();
      return;
    }

    sessionEntryGraceSession = session;
    sessionEntryGraceUntil = Date.now() + options.sessionEntryGraceMs;
  }

  function consumeSessionEntryGrace(session: unknown = options.getSession()): boolean {
    if (
      !sessionEntryGraceSession ||
      sessionEntryGraceSession !== session ||
      Date.now() > sessionEntryGraceUntil
    ) {
      clearSessionEntryGrace();
      return false;
    }

    clearSessionEntryGrace();
    return true;
  }

  function observeSessionEntry(session: unknown): void {
    if (!session) {
      return;
    }

    if (session !== observedSession) {
      observedSession = session;
      wasSessionActive = false;
    }

    const sessionActive = options.isSessionActive();
    if (!sessionActive) {
      wasSessionActive = false;
      clearSessionEntryGrace();
      return;
    }

    if (!wasSessionActive) {
      if (options.isMatchActive()) {
        noteSessionEntryGrace(session);
      } else {
        clearSessionEntryGrace();
      }
    }

    wasSessionActive = true;
  }

  function scheduleIndicator(reason: GameStartReason = 'pulled'): void {
    if (!options.isEnabled() || timers.hasIndicatorTimer() || isIndicatorPageFocused()) {
      return;
    }

    clearWatchTimer();
    indicatorReason = reason;
    timers.setIndicatorTimer(() => {
      if (
        !isIndicatorPageFocused() &&
        !wasPlayingWhenUnfocused &&
        !hasPendingLocalPlayTransition() &&
        options.isPlayingMatch() &&
        !options.isPlayableLobby()
      ) {
        showIndicator(indicatorReason);
      }
    }, options.getIndicatorDelayMs());
  }

  function scheduleWatch(): void {
    if (!options.isEnabled() || timers.hasWatchTimer() || isIndicatorPageFocused() || indicatorActive) {
      return;
    }

    timers.setWatchTimer(() => {
      updateGameStartIndicator();

      if (!indicatorActive && !isIndicatorPageFocused()) {
        scheduleWatch();
      }
    }, options.watchIntervalMs);
  }

  function handleStartAfterNativeEvent(
    wasPlayingMatch: boolean,
    wasPlayableLobby: boolean,
    session: unknown = options.getSession()
  ): void {
    const startedPlaying = !wasPlayingMatch && options.isPlayingMatch();
    if (startedPlaying && consumePendingLocalPlayTransition(session)) {
      wasPlayingWhenUnfocused = true;
      wasInLobbyWhenUnfocused = false;
      clearWatchTimer();
      clearIndicatorTimer();
      return;
    }

    if (startedPlaying && wasPlayableLobby && !isIndicatorPageFocused()) {
      clearWatchTimer();
      clearIndicatorTimer();
      showIndicator('started');
      return;
    }

    updateGameStartIndicator();
  }

  function patchMultiplayerSessionGameStartHooks(session: unknown = options.getSession()): void {
    if (!options.isEnabled() || !session) {
      return;
    }

    observeSessionEntry(session);

    if (session === sessionHookTarget && areGameStartSessionHooksInstalled(session)) {
      return;
    }

    if (session !== sessionHookTarget && !isIndicatorPageFocused() && options.isPlayingMatch()) {
      wasPlayingWhenUnfocused = true;
      wasInLobbyWhenUnfocused = false;
      clearIndicatorTimer();
    }

    if (
      installGameStartSessionHooks(session, {
        captureStartState: () => ({
          wasPlayingMatch: options.isPlayingMatch(),
          wasPlayableLobby: options.isPlayableLobby(),
        }),
        handleStartAfterNativeEvent: ({ wasPlayingMatch, wasPlayableLobby }, eventSession) => {
          handleStartAfterNativeEvent(wasPlayingMatch, wasPlayableLobby, eventSession);
        },
        noteLocalStartRequest: noteLocallyInitiatedPlayTransition,
      })
    ) {
      sessionHookTarget = session;
    }
  }

  function updateGameStartIndicator(): void {
    if (!options.isEnabled()) {
      wasPlayingWhenUnfocused = false;
      clearWatchTimer();
      clearIndicator();
      return;
    }

    const playingMatch = options.isPlayingMatch();
    const playableLobby = options.isPlayableLobby();
    patchMultiplayerSessionGameStartHooks();

    if (isIndicatorPageFocused()) {
      wasPlayingWhenUnfocused = playingMatch;
      wasInLobbyWhenUnfocused = false;
      return;
    }

    if (playableLobby) {
      wasPlayingWhenUnfocused = false;
      wasInLobbyWhenUnfocused = true;
      scheduleWatch();
      return;
    }

    if (!wasPlayingWhenUnfocused && playingMatch) {
      if (consumeSessionEntryGrace()) {
        wasPlayingWhenUnfocused = true;
        wasInLobbyWhenUnfocused = false;
        clearWatchTimer();
        clearIndicatorTimer();
        return;
      }

      scheduleIndicator(getPolledReason());
      return;
    }

    if (!playingMatch) {
      wasPlayingWhenUnfocused = false;
      wasInLobbyWhenUnfocused = false;
      clearSessionEntryGrace();
      clearWatchTimer();
      clearIndicator();
      scheduleWatch();
    }
  }

  function handleReturn(): void {
    if (!options.isEnabled()) {
      clearIndicator();
      return;
    }

    pageFocused = true;
    clearWatchTimer();
    clearIndicator();
    wasPlayingWhenUnfocused = options.isPlayingMatch();
    wasInLobbyWhenUnfocused = false;
  }

  function handleInteractionFocus(): void {
    if (options.isEnabled() && !document.hidden) {
      pageFocused = true;
      wasPlayingWhenUnfocused = options.isPlayingMatch();
      wasInLobbyWhenUnfocused = false;
    }
  }

  function setGameStartPageFocused(value: boolean): void {
    pageFocused = Boolean(value);
  }

  function setGameStartWasPlayingWhenUnfocused(value: boolean): void {
    wasPlayingWhenUnfocused = Boolean(value);
  }

  function setGameStartWasInLobbyWhenUnfocused(value: boolean): void {
    wasInLobbyWhenUnfocused = Boolean(value);
  }

  function handleAway(): void {
    if (!options.isEnabled()) {
      return;
    }

    pageFocused = false;
    patchMultiplayerSessionGameStartHooks();
    wasPlayingWhenUnfocused = options.isPlayingMatch();
    wasInLobbyWhenUnfocused = !wasPlayingWhenUnfocused && options.isPlayableLobby();
    scheduleWatch();
  }

  function handleVisibilityChange(): void {
    if (!options.isEnabled()) {
      return;
    }

    if (document.hidden) {
      handleAway();
    } else {
      handleReturn();
    }
  }

  function initializeFocusState(): void {
    pageFocused = options.isPageFocused();
    if (!pageFocused) {
      wasPlayingWhenUnfocused = options.isPlayingMatch();
      wasInLobbyWhenUnfocused = !wasPlayingWhenUnfocused && options.isPlayableLobby();
    }
  }

  function installGameStartIndicatorHooks(): void {
    focusHooks.installGameStartIndicatorHooks();
  }

  function disableGameStartAlerts(): void {
    wasPlayingWhenUnfocused = false;
    wasInLobbyWhenUnfocused = false;
    observedSession = null;
    wasSessionActive = false;
    clearSessionEntryGrace();
    localPlayTransition.clear();
    clearWatchTimer();
    clearIndicator();
  }

  return {
    clearGameStartIndicator: clearIndicator,
    disableGameStartAlerts,
    handleGameStartInteractionFocus: handleInteractionFocus,
    hasPendingLocalPlayTransition,
    installGameStartIndicatorHooks,
    noteLocallyInitiatedPlayTransition,
    patchMultiplayerSessionGameStartHooks,
    setGameStartPageFocused,
    setGameStartWasInLobbyWhenUnfocused,
    setGameStartWasPlayingWhenUnfocused,
    updateGameStartIndicator,
  };
}
