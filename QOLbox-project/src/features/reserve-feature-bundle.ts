import {
  JOIN_BUTTON_TEXT,
  RESERVE_BUTTON_TEXT,
  RESERVE_COUNTDOWN_UPDATE_MS,
  RESERVE_JOINED_ROOM_FULL_SUPPRESS_MS,
  RESERVE_ONE_PERSON_TEXT,
  RESERVE_RETRY_AUDIO_SUPPRESS_MS,
  RESERVE_ROOM_CLOSED_PATTERN,
  RESERVE_ROOM_FULL_PATTERN,
  RESERVE_STATUS_FALLBACK_TEXT,
  RESERVE_UNAVAILABLE_TITLE_TEXT,
  RESERVE_WAIT_TEXT,
  RESERVE_WAIT_TITLE_TEXT,
  RESERVE_WRONG_PASSWORD_PATTERN,
} from '../config/qolbox-constants';
import { getAdvancedReserveRetryIntervalMs } from '../settings/advanced-settings';
import { isElementVisible } from '../dom/dom-helpers';
import { isNativeAutoJoinMatch, isNativeAutoJoinOnePersonRoom } from '../hitbox/auto-join-adapter';
import { createReserveSocketCaptureHook } from '../hitbox/reserve-socket-adapter';
import { createReserveActionControls } from './reserve-action-controls';
import { createReserveCapturedJoinController } from './reserve-captured-join';
import { createReserveConnectingStateController } from './reserve-connecting-state';
import { createReserveInteractionHandlers } from './reserve-interaction-handlers';
import { createReserveLifecycleController } from './reserve-lifecycle';
import {
  createReserveRoomList,
  getReserveRowFromTarget,
  isReservePasswordRoom,
  isReserveRoomFull,
  isReserveUnavailableRoom,
} from './reserve-room-list';
import { createReserveRetryScheduler } from './reserve-retry-scheduler';
import { createReserveNativeStatus } from './reserve-native-status';
import { createReserveSelectionState } from './reserve-selection-state';
import { createReserveWaitingWindow } from './reserve-waiting-window';
import { getReserveJoinPayload } from './reserve-join-payload';

interface ReserveFeatureBundleOptions {
  hasSuccessfulJoinLayer(): boolean;
  isReserveEnabled(): boolean;
}

export function createReserveFeatureBundle(options: ReserveFeatureBundleOptions) {
  let roomFullSuppressedUntil = 0;
  let retryAudioSuppressedUntil = 0;
  let statusWatchTimer = 0;
  let countdownTimer = 0;
  let domEventsInstalled = false;

  function isReserveJoinedRoomFullSuppressed(): boolean {
    return Date.now() < roomFullSuppressedUntil;
  }

  function suppressReserveRoomFullAfterJoin(): void {
    roomFullSuppressedUntil = Date.now() + RESERVE_JOINED_ROOM_FULL_SUPPRESS_MS;
  }

  function isReserveRetryAudioSuppressed(): boolean {
    return Date.now() < retryAudioSuppressedUntil;
  }

  function suppressReserveRetryAudio(): void {
    retryAudioSuppressedUntil = Date.now() + RESERVE_RETRY_AUDIO_SUPPRESS_MS;
  }

  function clearReserveStatusWatchTimer(): void {
    window.clearTimeout(statusWatchTimer);
    statusWatchTimer = 0;
  }

  function scheduleReserveStatusWatch(delay = 250): void {
    if (statusWatchTimer) {
      return;
    }
    statusWatchTimer = window.setTimeout(() => {
      statusWatchTimer = 0;
      handleReserveConnectingState();
      if (shouldContinueReserveStatusWatch()) {
        scheduleReserveStatusWatch(delay);
      }
    }, delay);
  }

  function clearReserveCountdownTimer(): void {
    window.clearTimeout(countdownTimer);
    countdownTimer = 0;
  }

  function scheduleReserveCountdownUpdate(): void {
    if (countdownTimer || !getReserveState()?.active) {
      return;
    }
    countdownTimer = window.setTimeout(() => {
      countdownTimer = 0;
      if (getReserveState()?.active) {
        updateReserveWaitingWindow();
        scheduleReserveCountdownUpdate();
      }
    }, RESERVE_COUNTDOWN_UPDATE_MS);
  }

  const {
    clearReserveSelectedRoom,
    getReserveSelectedRoomRow,
    getReserveSelectedRoomState,
    rememberReserveSelectedRoom,
  } = createReserveSelectionState();
  const {
    getReserveState,
    showReserveOnePersonUnavailable,
    showReserveTerminalMessage,
    startReserveSpot,
    stopReserveAfterSuccessfulJoin,
    stopReserveSpot,
  } = createReserveLifecycleController({
    clearCapturedJoin: () => clearReserveCapturedJoin(),
    clearCountdownTimer: () => clearReserveCountdownTimer(),
    clearPasswordPromptPending: () => clearReservePasswordPromptPending(),
    clearRetryTimer: state => clearReserveRetryTimer(state),
    clearStatusWatchTimer: () => clearReserveStatusWatchTimer(),
    clearVisibleRoomSelection: () => clearReserveVisibleRoomSelection(),
    getCapturedJoin: () => getReserveCapturedJoin(),
    hideNativeConnectingWindows: () => hideNativeConnectingWindows(),
    isEnabled: options.isReserveEnabled,
    onePersonText: RESERVE_ONE_PERSON_TEXT,
    rememberSelectedRoom: row => rememberReserveSelectedRoom(row),
    getRetryDelayMs: getAdvancedReserveRetryIntervalMs,
    scheduleCountdownUpdate: () => scheduleReserveCountdownUpdate(),
    scheduleStatusWatch: () => scheduleReserveStatusWatch(),
    setWaitingVisible: visible => setReserveWaitingVisible(visible),
    statusFallbackText: RESERVE_STATUS_FALLBACK_TEXT,
    suppressRoomFullAfterJoin: () => suppressReserveRoomFullAfterJoin(),
    syncJoinButtonLabel: () => syncReserveJoinButtonLabel(),
    updateWaitingWindow: () => updateReserveWaitingWindow(),
  });
  const { getReserveJoinButton } = createReserveRoomList({
    isElementVisible,
  });
  const {
    clearReservePasswordPromptPending,
    clearReserveVisibleRoomSelection,
    isReservePasswordPromptPending,
    setReservePasswordPromptPending,
    syncReserveJoinButtonLabel,
    syncReservePasswordPrompt,
  } = createReserveActionControls({
    clearReserveSelectedRoom,
    getReserveJoinButton,
    getReserveSelectedRoomState,
    isElementVisible,
    isEnabled: options.isReserveEnabled,
    joinButtonText: JOIN_BUTTON_TEXT,
    reserveButtonText: RESERVE_BUTTON_TEXT,
  });
  const {
    getNativeConnectingWindows,
    getNativeConnectingText,
    getReserveNativeMessage,
    getReserveStatusLines,
    hideNativeConnectingWindows,
  } = createReserveNativeStatus({
    reserveWaitText: RESERVE_WAIT_TEXT,
    roomClosedPattern: RESERVE_ROOM_CLOSED_PATTERN,
    roomFullPattern: RESERVE_ROOM_FULL_PATTERN,
    wrongPasswordPattern: RESERVE_WRONG_PASSWORD_PATTERN,
  });
  const {
    canAutoReserveCapturedJoin,
    captureReserveJoin,
    clearReserveCapturedJoin,
    emitReserveJoinAttempt,
    getReserveCapturedJoin,
    shouldWatchRecentReserveCapture,
  } = createReserveCapturedJoinController({
    capturedJoinFreshMs: 30000,
    getState: () => getReserveState(),
    hasSuccessfulJoinLayer: options.hasSuccessfulJoinLayer,
    isEnabled: options.isReserveEnabled,
    isAutoJoinMatch: isNativeAutoJoinMatch,
    onCaptured: () => scheduleReserveStatusWatch(),
    suppressRetryAudio: suppressReserveRetryAudio,
  });
  const { installReserveSocketCaptureHook } = createReserveSocketCaptureHook({
    onJoin: captureReserveJoin,
    shouldCaptureJoin: args => Boolean(getReserveJoinPayload(args)),
  });
  const {
    setReserveWaitingVisible,
    updateReserveWaitingWindow,
  } = createReserveWaitingWindow({
    getReserveStatusLines,
    getState: () => getReserveState(),
    getRetryDelayMs: getAdvancedReserveRetryIntervalMs,
    onCancel: () => cancelReserveSpot(),
    onePersonText: RESERVE_ONE_PERSON_TEXT,
    statusFallbackText: RESERVE_STATUS_FALLBACK_TEXT,
    unavailableTitleText: RESERVE_UNAVAILABLE_TITLE_TEXT,
    waitTitleText: RESERVE_WAIT_TITLE_TEXT,
  });
  const { clearReserveRetryTimer, scheduleReserveRetry } = createReserveRetryScheduler({
    emitJoinAttempt: emitReserveJoinAttempt,
    getState: () => getReserveState(),
    hasSuccessfulJoinLayer: options.hasSuccessfulJoinLayer,
    isEnabled: options.isReserveEnabled,
    onSuccessfulJoin: () => stopReserveAfterSuccessfulJoin(),
    getRetryDelayMs: getAdvancedReserveRetryIntervalMs,
    scheduleCountdownUpdate: () => scheduleReserveCountdownUpdate(),
    updateWaitingWindow: () => updateReserveWaitingWindow(),
  });
  const { handleReserveConnectingState } = createReserveConnectingStateController({
    canAutoReserveCapturedJoin,
    getNativeConnectingText,
    getReserveNativeMessage,
    getState: () => getReserveState(),
    hasSuccessfulJoinLayer: options.hasSuccessfulJoinLayer,
    hideNativeConnectingWindows,
    isAutoJoinOnePersonRoom: isNativeAutoJoinOnePersonRoom,
    isEnabled: options.isReserveEnabled,
    isRoomFullSuppressed: isReserveJoinedRoomFullSuppressed,
    roomClosedPattern: RESERVE_ROOM_CLOSED_PATTERN,
    roomFullPattern: RESERVE_ROOM_FULL_PATTERN,
    scheduleReserveRetry,
    showOnePersonUnavailable: () => showReserveOnePersonUnavailable(),
    showTerminalMessage: showReserveTerminalMessage,
    startReserveSpot,
    stopAfterSuccessfulJoin: stopReserveAfterSuccessfulJoin,
    stopReserveSpot,
    wrongPasswordPattern: RESERVE_WRONG_PASSWORD_PATTERN,
  });
  const {
    cancelReserveSpot,
    handleReservePasswordKey,
    handleReservePasswordSubmit,
    handleReserveRoomListClick,
    handleReserveRoomListDoubleClick,
  } = createReserveInteractionHandlers({
    clearPasswordPromptPending: clearReservePasswordPromptPending,
    getNativeConnectingWindows,
    getRowFromTarget: getReserveRowFromTarget,
    getSelectedRoomRow: getReserveSelectedRoomRow,
    getSelectedRoomState: getReserveSelectedRoomState,
    getState: () => getReserveState(),
    isElementVisible,
    isEnabled: options.isReserveEnabled,
    isPasswordPromptPending: isReservePasswordPromptPending,
    isPasswordRoom: isReservePasswordRoom,
    isRoomFull: isReserveRoomFull,
    isUnavailableRoom: isReserveUnavailableRoom,
    rememberSelectedRoom: rememberReserveSelectedRoom,
    setPasswordPromptPending: setReservePasswordPromptPending,
    showOnePersonUnavailable: showReserveOnePersonUnavailable,
    startReserveSpot,
    stopReserveSpot,
    syncJoinButtonLabel: syncReserveJoinButtonLabel,
    syncPasswordPrompt: syncReservePasswordPrompt,
  });
  function installReserveDomEventHooks(): void {
    if (domEventsInstalled) {
      return;
    }
    domEventsInstalled = true;
    document.addEventListener('click', handleReserveRoomListClick, true);
    document.addEventListener('dblclick', handleReserveRoomListDoubleClick, true);
    document.addEventListener('click', handleReservePasswordSubmit, true);
    window.addEventListener('keyup', handleReservePasswordKey, true);
  }

  function shouldContinueReserveStatusWatch(): boolean {
    return Boolean(
      getReserveState()?.active ||
      isReserveJoinedRoomFullSuppressed() ||
      shouldWatchRecentReserveCapture()
    );
  }

  function patchReserveSpotFeature(): void {
    if (!options.isReserveEnabled()) {
      syncReserveJoinButtonLabel();
      return;
    }
    installReserveSocketCaptureHook();
    syncReserveJoinButtonLabel();
    syncReservePasswordPrompt();
    handleReserveConnectingState();
    installReserveDomEventHooks();
  }

  return {
    clearReservePasswordPromptPending,
    getReserveState,
    installReserveSocketCaptureHook,
    isReserveRetryAudioSuppressed,
    patchReserveSpotFeature,
    stopReserveSpot,
    syncReserveJoinButtonLabel,
  };
}
