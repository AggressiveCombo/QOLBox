export interface RgbColor {
  alpha: number;
  blue: number;
  green: number;
  red: number;
}

export const DESKTOP_LOBBY_CHAT_PROMPT = 'Press Enter to send a message';
export const TOUCH_LOBBY_CHAT_PROMPT = 'Tap here to send a message';
export const MENU_KEY_LABEL = 'F8';
export const MENU_KEY = 'F8';
export const QOLBOX_MENU_ID = 'qolboxMenu';
export const QOLBOX_MENU_ROOT_CLASS = 'qolbox-menu-open';

export const FALLBACK_BASE_WIDTH = 800;
export const FALLBACK_BASE_HEIGHT = 500;
export const SCORE_ROW_FALLBACK_RGB: RgbColor = { red: 225, green: 21, blue: 0, alpha: 1 };
export const TEAM_SCORE_COLORS: ReadonlyMap<number, RgbColor> = new Map([
  [2, { red: 225, green: 21, blue: 0, alpha: 1 }],
  [3, { red: 0, green: 117, blue: 225, alpha: 1 }],
]);

export const FULLSCREEN_GAMEPLAY_LAYER_SELECTOR = '#pixiContainer, #singlePlayer, .singlePlayer';
export const FULLSCREEN_EDITOR_LAYER_SELECTOR = '#editorContainer';
export const FULLSCREEN_MENU_LAYER_SELECTOR = '.replayViewer';
export const CHAT_INPUT_SELECTOR = '.inGameChat .input, .lobbyContainer .chatBox .input';
export const FULLSCREEN_PLAY_LAYER_SELECTOR = [
  FULLSCREEN_GAMEPLAY_LAYER_SELECTOR,
  FULLSCREEN_EDITOR_LAYER_SELECTOR,
].join(', ');
export const FULLSCREEN_RENDER_LAYER_SELECTOR = [
  FULLSCREEN_PLAY_LAYER_SELECTOR,
  FULLSCREEN_MENU_LAYER_SELECTOR,
].join(', ');
export const FULLSCREEN_RENDER_CANVAS_SELECTORS = [
  '#pixiContainer canvas',
  '#singlePlayer canvas',
  '.singlePlayer canvas',
  '#editorContainer > canvas',
  '.replayViewer canvas',
];
export const FULLSCREEN_RENDER_CANVAS_SELECTOR = FULLSCREEN_RENDER_CANVAS_SELECTORS.join(', ');
export const FULLSCREEN_RENDER_CANVAS_FOCUS_SELECTOR = FULLSCREEN_RENDER_CANVAS_SELECTORS
  .flatMap(selector => [`${selector}:focus`, `${selector}:focus-visible`])
  .join(', ');
export const FULLSCREEN_LAYOUT_TARGET_SELECTOR = [
  '#appContainer',
  '#relativeContainer',
  '#backgroundImage',
  FULLSCREEN_RENDER_LAYER_SELECTOR,
  FULLSCREEN_RENDER_CANVAS_SELECTOR,
  '.scores',
  '.spectateControls',
  '.rightClickMenu',
].join(', ');
export const GAMEPLAY_FOCUS_EXCLUSION_SELECTOR = [
  CHAT_INPUT_SELECTOR,
  '.inGameChat',
  '.lobbyContainer',
  '.cornerButton',
  '.cornerButton .items',
  '.jukebox',
  '.scores',
  '.spectateControls',
  '.qolboxMenuOverlay',
  '.qolboxReserveWindowContainer',
  '.connectingWindowContainer',
  '.passwordWindowContainer',
  '.buttonArea',
  'button',
  'input',
  'select',
  'textarea',
  'a',
  '.button',
  '.bottomButton',
  '.item',
].join(', ');
export const FEATURE_PATCH_TARGET_SELECTOR = [
  CHAT_INPUT_SELECTOR,
  '.items.left',
  '.items.left .item',
  '.jukebox',
  '.jukebox .knob.volumeContainer',
  '.buttonArea',
  '.cornerButton .items',
  '.cornerButton .items .item',
  '#ytContainer',
  '#ytContainer iframe',
  '.roomListContainer',
  '.roomListContainer .scrollBox tr',
  '.roomListContainer .bottomButton.right',
  '.mapListContainer',
  '.mapListContainer .topBar',
  '.mapListContainer .dropdownContainer .element',
  '.mapListContainer .secondaryContainer .secondaryElement',
  '.passwordWindowContainer',
  '.connectingWindowContainer',
  '.lobbyContainer',
  '.lobbyContainer .teamsButtonContainer',
  '.scores',
  '.scores .entryContainer',
  '#editorContainer',
  '.fileMenu',
  '.fileMenu .item',
].join(', ');

export const FULLSCREEN_SETTLE_PASSES = 4;
export const FULLSCREEN_NATIVE_LAYOUT_WAIT_MS = 2500;
export const RESIZE_SETTLE_PASSES = 2;

export const JUKEBOX_WHEEL_STEP = 5;
export const JUKEBOX_DRAG_SENSITIVITY = 1;
export const YOUTUBE_HOOK_RETRY_DELAY_MS = 250;
export const YOUTUBE_HOOK_MAX_RETRIES = 120;

export const RESERVE_BUTTON_TEXT = 'RESERVE';
export const JOIN_BUTTON_TEXT = 'JOIN';
export const RESERVE_WAIT_TITLE_TEXT = 'Waiting for a Spot';
export const RESERVE_WAIT_TEXT = 'Waiting for someone to leave...';
export const RESERVE_STATUS_FALLBACK_TEXT = 'Connecting...';
export const RESERVE_UNAVAILABLE_TITLE_TEXT = 'Lobby Not Available';
export const RESERVE_ONE_PERSON_TEXT = 'This lobby only allows one person, so there is no spot to reserve.';
export const RESERVE_RETRY_DELAY_MS = 2500;
export const RESERVE_COUNTDOWN_UPDATE_MS = 100;
export const RESERVE_RETRY_AUDIO_SUPPRESS_MS = 900;
export const RESERVE_JOINED_ROOM_FULL_SUPPRESS_MS = 12000;
export const RESERVE_ROOM_FULL_PATTERN = /room[_ ]?full|room is full/i;
export const RESERVE_ROOM_CLOSED_PATTERN = /room[_ ]?not[_ ]?found|room has just closed/i;
export const RESERVE_WRONG_PASSWORD_PATTERN = /wrong[_ ]?password|password incorrect|incorrect password/i;

export const GAME_START_INDICATOR_DELAY_MS = 1200;
export const GAME_START_WATCH_INTERVAL_MS = 750;
export const GAME_START_FLASH_INTERVAL_MS = 700;
export const GAME_START_END_WATCH_INTERVAL_MS = 1000;
export const GAME_START_LOCAL_TRANSITION_TIMEOUT_MS = 5000;
export const GAME_START_SESSION_ENTRY_GRACE_MS = 2000;
export const TYPING_INDICATOR_TIMEOUT_MS = 1600;
export const IS_QOLBOX_GAME_PAGE = /\/game2\.html$/i.test(window.location.pathname);
