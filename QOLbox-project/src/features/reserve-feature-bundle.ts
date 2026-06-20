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
import { createReserveCountdownTimer } from './reserve-countdown-timer';
import { createReserveDomEventHooks } from './reserve-dom-event-hooks';
import { createReserveFeaturePatchController } from './reserve-feature-patch';
import { createReserveInteractionHandlers } from './reserve-interaction-handlers';
import { createReserveLifecycleController } from './reserve-lifecycle';
import {
  createReserveRoomList,
  getReserveRowFromTarget,
  isReservePasswordRoom,
  isReserveRoomFull,
  isReserveUnavailableRoom,
} from './reserve-room-list';
import { createReserveRoomFullSuppression } from './reserve-room-full-suppression';
import { createReserveRetryAudioSuppression } from './reserve-retry-audio-suppression';
import { createReserveRetryScheduler } from './reserve-retry-scheduler';
import { createReserveNativeStatus } from './reserve-native-status';
import { createReserveSelectionState } from './reserve-selection-state';
import { createReserveStatusWatchTimer } from './reserve-status-watch-timer';
import { createReserveWaitingWindow } from './reserve-waiting-window';
import { getReserveJoinPayload } from './reserve-join-payload';

interface ReserveFeatureBundleOptions {
  hasSuccessfulJoinLayer(): boolean;
  isReserveEnabled(): boolean;
}

export function createReserveFeatureBundle(options: ReserveFeatureBundleOptions) {
  const {
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
    isReserveJoinedRoomFullSuppressed,
    suppressReserveRoomFullAfterJoin,
  } = createReserveRoomFullSuppression({
    suppressMs: RESERVE_JOINED_ROOM_FULL_SUPPRESS_MS,
  });
  const {
    clearReserveStatusWatchTimer,
    scheduleReserveStatusWatch,
  } = createReserveStatusWatchTimer({
    defaultDelayMs: 250,
    onTick: () => handleReserveConnectingState(),
    shouldContinue: () => shouldContinueReserveStatusWatch(),
  });
  const {
    isReserveRetryAudioSuppressed,
    suppressReserveRetryAudio,
  } = createReserveRetryAudioSuppression({
    suppressMs: RESERVE_RETRY_AUDIO_SUPPRESS_MS,
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
  const {
    clearReserveCountdownTimer,
    scheduleReserveCountdownUpdate,
  } = createReserveCountdownTimer({
    getState: () => getReserveState(),
    intervalMs: RESERVE_COUNTDOWN_UPDATE_MS,
    onTick: () => updateReserveWaitingWindow(),
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
  const { installReserveDomEventHooks } = createReserveDomEventHooks({
    onPasswordKey: handleReservePasswordKey,
    onPasswordSubmit: handleReservePasswordSubmit,
    onRoomListClick: handleReserveRoomListClick,
    onRoomListDoubleClick: handleReserveRoomListDoubleClick,
  });
  const {
    patchReserveSpotFeature,
    shouldContinueReserveStatusWatch,
  } = createReserveFeaturePatchController({
    getState: () => getReserveState(),
    handleConnectingState: handleReserveConnectingState,
    installDomEventHooks: installReserveDomEventHooks,
    installSocketCaptureHook: installReserveSocketCaptureHook,
    isEnabled: options.isReserveEnabled,
    isRoomFullSuppressed: isReserveJoinedRoomFullSuppressed,
    shouldWatchRecentCapture: shouldWatchRecentReserveCapture,
    syncJoinButtonLabel: syncReserveJoinButtonLabel,
    syncPasswordPrompt: syncReservePasswordPrompt,
  });

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
