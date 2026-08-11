import { patchLargeMapPreviewDecode } from './map-list-performance';

type ActionIconName = keyof typeof ICONS;

// Lucide icons; see THIRD_PARTY_NOTICES.md.
const ICONS = {
  'arrow-left': '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
  'arrow-right': '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  'bell-ring': '<path d="M10.268 21a2 2 0 0 0 3.464 0"/><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/><path d="M4 2C2.8 3.7 2 5.7 2 8M20 2c1.2 1.7 2 3.7 2 6"/>',
  'calendar-days': '<path d="M8 2v4M16 2v4M3 10h18"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  'chevron-down': '<path d="m6 9 6 6 6-6"/>',
  'circle-help': '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  clipboard: '<rect width="8" height="4" x="8" y="2" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>',
  combine: '<path d="M14 3a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1"/><path d="M19 3a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1"/><path d="m7 15 3 3"/><path d="m7 21 3-3H5a2 2 0 0 1-2-2v-2"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="3" width="7" height="7" rx="1"/>',
  copy: '<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
  download: '<path d="M12 15V3"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/>',
  eye: '<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/>',
  'eye-off': '<path d="m2 2 20 20"/><path d="M6.71 6.71C4.66 8.06 3.21 9.91 2.06 11.65a1 1 0 0 0 0 .7C4.03 15.33 7.55 19 12 19c1.15 0 2.23-.25 3.22-.67"/><path d="M10.73 5.08C11.14 5.03 11.56 5 12 5c4.45 0 7.97 3.67 9.94 6.65a1 1 0 0 1 0 .7 16 16 0 0 1-2.01 2.48"/><path d="M14.12 14.12A3 3 0 0 1 9.88 9.88"/>',
  'file-plus': '<path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"/><path d="M14 2v5a1 1 0 0 0 1 1h5"/><path d="M9 15h6"/><path d="M12 18v-6"/>',
  'flip-horizontal': '<path d="m3 7 5 5-5 5V7"/><path d="m21 7-5 5 5 5V7"/><path d="M12 20v2M12 14v2M12 8v2M12 2v2"/>',
  'flip-vertical': '<path d="m17 3-5 5-5-5h10"/><path d="m17 21-5-5-5 5h10"/><path d="M4 12H2M10 12H8M16 12h-2M22 12h-2"/>',
  flame: '<path d="M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4"/>',
  'folder-open': '<path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
  keyboard: '<path d="M10 8h.01M12 12h.01M14 8h.01M16 12h.01M18 8h.01M6 8h.01M7 16h10M8 12h.01"/><rect width="20" height="16" x="2" y="4" rx="2"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.07.07l2-2a5 5 0 0 0-7.07-7.07l-1.15 1.15"/><path d="M14 11a5 5 0 0 0-7.07-.07l-2 2A5 5 0 0 0 12 20l1.15-1.15"/>',
  lock: '<rect width="14" height="11" x="5" y="11" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  'lock-open': '<rect width="14" height="11" x="5" y="11" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.9-.9"/>',
  list: '<path d="M3 5h.01M3 12h.01M3 19h.01M8 5h13M8 12h13M8 19h13"/>',
  'log-in': '<path d="m10 17 5-5-5-5"/><path d="M15 12H3"/><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>',
  'log-out': '<path d="m16 17 5-5-5-5"/><path d="M21 12H9"/><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>',
  maximize: '<path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  monitor: '<rect width="20" height="14" x="2" y="3" rx="2"/><path d="M8 21h8M12 17v4"/>',
  map: '<path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z"/><path d="M15 5.764v15M9 3.236v15"/>',
  'message-circle': '<path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/>',
  mirror: '<path d="M12 3v18"/><path d="m8 8-4 4 4 4M16 8l4 4-4 4"/>',
  move: '<path d="M12 2v20M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M5 9l-3 3 3 3M9 5l3-3 3 3"/>',
  moon: '<path d="M20.985 12.486A9 9 0 1 1 11.514 3.015c.447-.028.683.541.366.857a6 6 0 0 0 8.248 8.248c.316-.317.885-.081.857.366"/>',
  'mouse-pointer': '<path d="M4.037 4.688a.495.495 0 0 1 .651-.651l16 6.5a.5.5 0 0 1-.063.947l-6.124 1.58a2 2 0 0 0-1.438 1.435l-1.579 6.126a.5.5 0 0 1-.947.063z"/>',
  music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  'music-off': '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/><path d="m2 2 20 20"/>',
  package: '<path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/><path d="M12 22V12"/><polyline points="3.29 7 12 12 20.71 7"/><path d="m7.5 4.27 9 5.15"/>',
  palette: '<path d="M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z"/><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/>',
  pause: '<rect x="14" y="3" width="5" height="18" rx="1"/><rect x="5" y="3" width="5" height="18" rx="1"/>',
  'pencil-ruler': '<path d="M13 7 8.7 2.7a2.41 2.41 0 0 0-3.4 0L2.7 5.3a2.41 2.41 0 0 0 0 3.4L7 13M8 6l2-2M18 16l2-2M17 11l4.3 4.3c.94.94.94 2.46 0 3.4l-2.6 2.6c-.94.94-2.46.94-3.4 0L11 17"/><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497zM15 5l4 4"/>',
  play: '<path d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z"/>',
  plus: '<path d="M5 12h14M12 5v14"/>',
  radio: '<path d="M16.247 7.761a6 6 0 0 1 0 8.478M19.075 4.933a10 10 0 0 1 0 14.134M4.925 19.067a10 10 0 0 1 0-14.134M7.753 16.239a6 6 0 0 1 0-8.478"/><circle cx="12" cy="12" r="2"/>',
  'radio-off': '<path d="M16.247 7.761a6 6 0 0 1 0 8.478M19.075 4.933a10 10 0 0 1 0 14.134M4.925 19.067a10 10 0 0 1 0-14.134M7.753 16.239a6 6 0 0 1 0-8.478"/><circle cx="12" cy="12" r="2"/><path d="m2 2 20 20"/>',
  'refresh-cw': '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
  'rotate-ccw': '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
  'rotate-cw': '<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>',
  save: '<path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7M7 3v4a1 1 0 0 0 1 1h7"/>',
  search: '<path d="m21 21-4.34-4.34"/><circle cx="11" cy="11" r="8"/>',
  'share-2': '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.59 13.51 6.83 3.98M15.41 6.51 8.59 10.49"/>',
  shield: '<path d="M20 13c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V5l8-3 8 3z"/>',
  'shield-x': '<path d="M20 13c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V5l8-3 8 3z"/><path d="m9.5 9.5 5 5M14.5 9.5l-5 5"/>',
  'skip-forward': '<path d="M21 4v16"/><path d="M6.029 4.285A2 2 0 0 0 3 6v12a2 2 0 0 0 3.029 1.715l9.997-5.998a2 2 0 0 0 .003-3.432z"/>',
  square: '<rect width="16" height="16" x="4" y="4" rx="2"/>',
  sliders: '<path d="M10 5H3M12 19H3M14 3v4M16 17v4M21 12h-9M21 19h-5M21 5h-7M8 10v4M8 12H3"/>',
  star: '<path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.751a.53.53 0 0 1 .294.904l-3.738 3.643a2.123 2.123 0 0 0-.61 1.88l.882 5.146a.53.53 0 0 1-.77.559l-4.62-2.428a2.122 2.122 0 0 0-1.969 0l-4.619 2.428a.53.53 0 0 1-.77-.559l.882-5.145a2.122 2.122 0 0 0-.611-1.879L2.16 9.79a.53.53 0 0 1 .294-.904l5.165-.751a2.122 2.122 0 0 0 1.597-1.16z"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
  terminal: '<path d="M12 19h8"/><path d="m4 17 6-6-6-6"/>',
  trash: '<path d="M10 11v6M14 11v6M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  upload: '<path d="M12 3v12M17 8l-5-5-5 5M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>',
  unlink: '<path d="m18.84 12.25 1.23-1.18a5 5 0 0 0-7.07-7.07l-1.17 1.23"/><path d="m5.17 11.75-1.24 1.18A5 5 0 0 0 11 20l1.17-1.23"/><path d="M8 2v3M2 8h3M16 19v3M19 16h3"/>',
  user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  'user-minus': '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 11h-6"/>',
  users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  'volume-2': '<path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298zM16 9a5 5 0 0 1 0 6M19.364 18.364a9 9 0 0 0 0-12.728"/>',
  wrench: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.106-3.105c.32-.322.863-.22.983.218a6 6 0 0 1-8.259 7.057l-7.91 7.91a1 1 0 0 1-2.999-3l7.91-7.91a6 6 0 0 1 7.057-8.259c.438.12.54.662.219.984z"/>',
  wifi: '<path d="M12 20h.01M2 8.82a15 15 0 0 1 20 0M5 12.86a10 10 0 0 1 14 0M8.5 16.43a5 5 0 0 1 7 0"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  zap: '<path d="M15.914 4a1.5 1.5 0 0 0-2.474-1.561l-9 9A1.5 1.5 0 0 0 5.5 14h4.002a.5.5 0 0 1 .471.666L8.086 20a1.5 1.5 0 0 0 2.475 1.56l9-9A1.5 1.5 0 0 0 18.5 10h-3.997a.5.5 0 0 1-.472-.667z"/>',
} as const;

const ICON_ONLY_CLOSE_SELECTOR = '.crossButton, .mapListContainer .closeButton, .replayViewer .closeButton';
const ICON_ONLY_ACTION_SELECTOR = [
  ICON_ONLY_CLOSE_SELECTOR,
  '.cornerButton .square',
  '.lobbyContainer .teamLockButton',
  '.lobbyContainer .settingsBox .linkButton',
  '.spectateControls .button.prev',
  '.spectateControls .button.next',
].join(', ');
const ACTION_SELECTOR = [
  'button',
  '.bigButton',
  '.bottomButton',
  '.button',
  '.item',
  '.teamButton',
  '.topLabel',
  '.searchButton',
  '.mapListContainer .sortBy',
  '.mapListContainer .topBar',
  '.connectingWindowContainer:not(.qolboxReserveWindowContainer) .connectingWindow .topBar',
  '.autoLoginWindowContainer .autoLoginWindow .topBar',
  '.recordsWindow .topBar',
  ICON_ONLY_ACTION_SELECTOR,
  '.mapListContainer .dropdownContainer .element',
  '.mapListContainer .secondaryContainer .secondaryElement',
  '.qolboxMenuFeatureName[data-qolbox-icon]',
  '#appContainer [class*="Button"]:not(.cornerButton)',
  '[role="button"]',
].join(', ');

const AUDIO_LABEL = /^(?:Volume:\s*\d+%|(?:Mute|Unmute) (?:Music|Jukebox))$/i;
const ROOM_LIST_LABEL_SELECTOR = '.roomListContainer .topBar, .roomListContainer .tableHeader .element';
const STATUS_SELECTOR = [
  '.connectingWindowContainer:not(.qolboxReserveWindowContainer) .connectingWindow .textBox',
  '.autoLoginWindowContainer .autoLoginWindow .textBox',
  '.mapListContainer .mapList .statusText',
  '.roomListContainer .roomList > .status',
  '.recordsWindow > .status',
  '.inGameCSS .matchmakingNotification',
].join(', ');
const MAP_DROPDOWN_ARROW_SELECTOR = [
  '.mapListContainer .dropdownContainer img.downArrow',
  '.mapListContainer .dropdownContainer img.rightArrow',
].join(', ');
const NATIVE_SPINNER_TIMEOUT_MS = 8000;
const nativeSpinnerRecoveryTimers = new WeakMap<HTMLElement, number>();
const PLAYER_HEX_COLOR = /^#(?:[\da-f]{3}|[\da-f]{6})$/i;

function normalizePlayerHexColor(value: string): string | null {
  if (!PLAYER_HEX_COLOR.test(value.trim())) return null;
  const hex = value.trim().slice(1);
  return `#${hex.length === 3 ? [...hex].map(character => character.repeat(2)).join('') : hex}`.toUpperCase();
}

function rgbToHsv(hex: string): [number, number, number] {
  const red = parseInt(hex.slice(1, 3), 16) / 255;
  const green = parseInt(hex.slice(3, 5), 16) / 255;
  const blue = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  let hue = 0;
  if (delta) {
    if (max === red) hue = 60 * (((green - blue) / delta) % 6);
    else if (max === green) hue = 60 * ((blue - red) / delta + 2);
    else hue = 60 * ((red - green) / delta + 4);
  }
  return [(hue + 360) % 360, max ? delta / max * 100 : 0, max * 100];
}

function sendColorWheelMouse(target: HTMLElement, clientX: number, clientY: number): void {
  const type = 'PointerEvent' in window ? 'pointerdown' : 'mousedown';
  const EventClass = 'PointerEvent' in window ? PointerEvent : MouseEvent;
  target.dispatchEvent(new EventClass(type, {
    bubbles: true,
    button: 0,
    clientX,
    clientY,
    ...(EventClass === PointerEvent ? { isPrimary: true, pointerId: 1, pointerType: 'mouse' } : {}),
  }));
}

function applyNativePlayerColor(windowElement: HTMLElement, colorBox: HTMLElement, hex: string): boolean {
  colorBox.click();
  const wheel = windowElement.querySelector<HTMLElement>('.colorWheelContainer');
  const hueWheel = wheel?.querySelector<HTMLCanvasElement>('.reinvented-color-wheel--hue-wheel');
  const valueSquare = wheel?.querySelector<HTMLCanvasElement>('.reinvented-color-wheel--sv-space');
  if (!wheel || !hueWheel || !valueSquare) return false;
  const [hue, saturation, value] = rgbToHsv(hex);
  const hueBounds = hueWheel.getBoundingClientRect();
  const hueAngle = (hue - 90) * Math.PI / 180;
  const hueRadius = hueBounds.width / 2 - 10;
  sendColorWheelMouse(hueWheel,
    hueBounds.left + hueBounds.width / 2 + Math.cos(hueAngle) * hueRadius,
    hueBounds.top + hueBounds.height / 2 + Math.sin(hueAngle) * hueRadius);
  const valueBounds = valueSquare.getBoundingClientRect();
  sendColorWheelMouse(valueSquare,
    valueBounds.left + valueBounds.width * saturation / 100,
    valueBounds.top + valueBounds.height * (100 - value) / 100);
  wheel.style.display = 'none';
  return true;
}

function decoratePlayerColorInput(root: ParentNode): void {
  const windows = root instanceof HTMLElement && root.matches('.cosmeticWindow')
    ? [root]
    : [...root.querySelectorAll<HTMLElement>('.cosmeticWindow')];
  for (const windowElement of windows) {
    if (windowElement.dataset.qolboxPlayerHex) continue;
    const row = windowElement.querySelector<HTMLElement>('.optionsContainer .singleContainer');
    const colorBox = row?.querySelector<HTMLElement>('.colorBox');
    if (!row || !colorBox) continue;
    windowElement.dataset.qolboxPlayerHex = 'true';
    const input = document.createElement('input');
    input.className = 'qolboxPlayerHexInput';
    input.value = getComputedStyle(colorBox).backgroundColor.match(/\d+/g)?.slice(0, 3)
      .map(channel => Number(channel).toString(16).padStart(2, '0')).join('').toUpperCase().replace(/^/, '#') || '#FFFFFF';
    input.maxLength = 7;
    input.spellcheck = false;
    input.setAttribute('aria-label', 'Main color hex code');
    input.addEventListener('input', () => {
      const color = normalizePlayerHexColor(input.value);
      input.setAttribute('aria-invalid', String(!color));
      if (color && applyNativePlayerColor(windowElement, colorBox, color)) input.value = color;
    });
    new MutationObserver(() => {
      const color = getComputedStyle(colorBox).backgroundColor.match(/\d+/g)?.slice(0, 3)
        .map(channel => Number(channel).toString(16).padStart(2, '0')).join('').toUpperCase();
      if (color) input.value = `#${color}`;
    }).observe(colorBox, { attributes: true, attributeFilter: ['style'] });
    row.append(input);
  }
}

function createIcon(name: ActionIconName): SVGSVGElement {
  const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  icon.classList.add('qolboxActionIcon');
  icon.setAttribute('viewBox', '0 0 24 24');
  icon.setAttribute('fill', 'none');
  icon.setAttribute('stroke', 'currentColor');
  icon.setAttribute('stroke-width', '2');
  icon.setAttribute('stroke-linecap', 'round');
  icon.setAttribute('stroke-linejoin', 'round');
  icon.setAttribute('aria-hidden', 'true');
  icon.dataset.qolboxIcon = name;
  icon.innerHTML = ICONS[name];
  return icon;
}

function getActionLabel(element: HTMLElement): string {
  const copy = element.cloneNode(true) as HTMLElement;
  copy.querySelectorAll('.qolboxActionIcon, .tooltip, .container, .qolboxAudioMenuOptions')
    .forEach(child => child.remove());
  return (copy.textContent || '').replace(/\s+/g, ' ').trim();
}

function getActionIcon(label: string, element: HTMLElement): ActionIconName {
  const text = label.toLowerCase();
  const explicit = element.dataset.qolboxIcon as ActionIconName | undefined;
  if (explicit && explicit in ICONS) return explicit;
  if (/^(?:ok|finish|apply|confirm|done|yes)$/.test(text)) return 'check';
  if (/^(?:close|cancel|no)$/.test(text)) return 'x';
  if (/^(?:back|previous)$/.test(text)) return 'arrow-left';
  if (/^(?:next|newer|continue)$/.test(text)) return 'arrow-right';
  if (text === 'older') return 'arrow-left';
  if (/\bkick\b/.test(text)) return 'log-out';
  if (/\bban\b/.test(text)) return 'shield-x';
  if (/delete|remove/.test(text)) return 'trash';
  if (/copy/.test(text)) return 'copy';
  if (/paste|clipboard/.test(text)) return 'clipboard';
  if (/undo|default|reset|redo setup/.test(text)) return 'rotate-ccw';
  if (/^redo$/.test(text)) return 'rotate-cw';
  if (/refresh|reload/.test(text)) return 'refresh-cw';
  if (/save/.test(text)) return 'save';
  if (/export|download/.test(text)) return 'download';
  if (/import|upload/.test(text)) return 'upload';
  if (/^(?:load|open)/.test(text)) return 'folder-open';
  if (/^(?:new|create)(?:\s|$)/.test(text)) return 'file-plus';
  if (/quick play|training|^play$|^start$/.test(text)) return 'play';
  if (text === 'end game') return 'square';
  if (/play as guest/.test(text)) return 'user';
  if (/pause/.test(text)) return 'pause';
  if (/retry|switch/.test(text)) return 'refresh-cw';
  if (text === 'hide lobby') return 'eye-off';
  if (/^(?:show )?lobby$/.test(text)) return 'eye';
  if (/^move to spec/.test(text)) return 'user-minus';
  if (/^move to (?:ffa|red|blue)/.test(text)) return 'users';
  if (/spectate/.test(text)) return 'eye';
  if (/join/.test(text)) return 'log-in';
  if (/welcome back/.test(text)) return 'log-in';
  if (/^connecting$/.test(text)) return 'wifi';
  if (/fastest times/.test(text)) return 'clock';
  if (/reserve|register|sign in|log in/.test(text)) return 'log-in';
  if (/leave|log out|exit/.test(text)) return 'log-out';
  if (/room list|custom game|server/.test(text)) return 'list';
  if (/editor/.test(text)) return 'pencil-ruler';
  if (/hot maps/.test(text)) return 'flame';
  if (/chaz(?:'|’)?s picks|top rated|favorite/.test(text)) return 'star';
  if (/^sort by:\s*best$/.test(text)) return 'star';
  if (/^sort by:\s*newest$/.test(text)) return 'clock';
  if (/newest/.test(text)) return 'clock';
  if (/^(?:19|20)\d{2}$/.test(text)) return 'calendar-days';
  if (/private/.test(text)) return 'lock';
  if (/published/.test(text)) return 'upload';
  if (/\bmaps?\b/.test(text)) return 'map';
  if (/volume|^audio$/.test(text)) return 'volume-2';
  if (/^unmute music$/.test(text)) return 'music-off';
  if (/music/.test(text)) return 'music';
  if (/^unmute jukebox$/.test(text)) return 'radio-off';
  if (/jukebox/.test(text)) return 'radio';
  if (/qolbox/.test(text)) return 'package';
  if (/controls|keyboard|shortcut/.test(text)) return 'keyboard';
  if (/fullscreen/.test(text)) return 'maximize';
  if (/player info|account|profile/.test(text)) return 'user';
  if (/host|change name/.test(text)) return 'user';
  if (/lock/.test(text)) return 'lock';
  if (/share|invite/.test(text)) return 'upload';
  if (/^file$|patch notes/.test(text)) return 'folder-open';
  if (/tools?/.test(text)) return 'wrench';
  if (/settings|advanced|custom/.test(text)) return 'sliders';
  if (/help|reference/.test(text)) return 'circle-help';
  if (/about|info/.test(text)) return 'info';
  if (/news/.test(text)) return 'info';
  if (/commands?/.test(text)) return 'terminal';
  if (/features?/.test(text)) return 'list';
  if (/mirror|horizontal/.test(text)) return 'flip-horizontal';
  if (/vertical/.test(text)) return 'flip-vertical';
  if (/merge|group/.test(text)) return 'combine';
  if (/selection/.test(text)) return 'mouse-pointer';
  if (/transform|move/.test(text)) return 'move';
  if (/appearance|color|paint/.test(text)) return 'palette';
  if (/search/.test(text)) return 'search';
  if (/express/.test(text)) return 'zap';
  if (/skip/.test(text)) return 'skip-forward';
  return element.matches('.item, .topLabel') ? 'arrow-right' : 'check';
}

function getIconOnlyActionIcon(element: HTMLElement): ActionIconName | null {
  if (element.matches(ICON_ONLY_CLOSE_SELECTOR)) return 'x';
  if (element.matches('.cornerButton .square')) {
    return element.querySelector('.icon.opened') ? 'x' : 'menu';
  }
  if (element.matches('.lobbyContainer .teamLockButton')) {
    return element.matches('.lockedClient, .lockedHost') ? 'lock' : 'lock-open';
  }
  if (element.matches('.lobbyContainer .settingsBox .linkButton')) return 'share-2';
  if (element.matches('.spectateControls .button.prev')) return 'arrow-left';
  if (element.matches('.spectateControls .button.next')) return 'arrow-right';
  return null;
}

function getRoomListLabelIcon(label: string): ActionIconName | null {
  switch (label.toUpperCase()) {
    case 'ROOM LIST': return 'list';
    case 'ROOM NAME': return 'list';
    case 'PLAYERS': return 'users';
    case 'PASSWORD': return 'lock';
    case 'JUKEBOX': return 'radio';
    case 'DISTANCE': return 'map';
    default: return null;
  }
}

function getIconHost(element: HTMLElement): HTMLElement {
  if (!element.matches('.bigButton')) return element;
  const host = element.querySelector<HTMLElement>('.text');
  if (!host) return element;
  host.classList.add('qolboxMainActionText');
  let label = host.querySelector<HTMLElement>(':scope > .qolboxMainActionLabel');
  if (!label) {
    label = document.createElement('span');
    label.className = 'qolboxMainActionLabel';
    while (host.firstChild) label.append(host.firstChild);
    host.append(label);
  }
  return host;
}

function isRendered(element: HTMLElement | null): boolean {
  if (!element || !element.getClientRects().length) return false;
  const style = getComputedStyle(element);
  return style.display !== 'none' && style.visibility !== 'hidden';
}

function syncLobbyEditorAction(root: ParentNode): void {
  const button = root instanceof HTMLElement && root.matches('.lobbyContainer .editorButton')
    ? root
    : root.querySelector<HTMLElement>('.lobbyContainer .editorButton');
  const lobby = button?.closest<HTMLElement>('.lobbyContainer');
  const editor = document.getElementById('editorContainer');
  if (!button || isRendered(editor) || !isRendered(lobby ?? null) || getActionLabel(button) !== 'HIDE LOBBY') return;
  button.textContent = 'EDITOR';
}

function decorateAction(element: HTMLElement): void {
  if (element.matches('.lobbyContainer .voteSpan')) {
    element.querySelector(':scope > .qolboxActionIcon')?.remove();
    return;
  }
  const spinners = element.querySelectorAll(':scope > .spinner');
  if (spinners.length && !element.classList.contains('spinnerHideText')) {
    const pendingRecovery = nativeSpinnerRecoveryTimers.get(element);
    if (pendingRecovery) window.clearTimeout(pendingRecovery);
    nativeSpinnerRecoveryTimers.delete(element);
    spinners.forEach(spinner => spinner.remove());
    if (!getActionLabel(element)) element.textContent = element.dataset.qolboxSpinnerLabel || 'REFRESH';
  }
  if (element.classList.contains('spinnerHideText')) {
    element.querySelector(':scope > .qolboxActionIcon')?.remove();
    armNativeSpinnerRecovery(element);
    return;
  }
  const containsActions = !element.matches('.qolboxAudioMenuGroup, .qolboxMirrorItem, .topLabel') &&
    Boolean(element.querySelector(ACTION_SELECTOR));
  const isMapCategory = element.matches(
    '.mapListContainer .dropdownContainer .element, .mapListContainer .secondaryContainer .secondaryElement'
  );
  if (
    element.matches('.qolboxMenuToggle, .qolboxColorPicker, .checkbox, [role="checkbox"], [role="radio"], [role="switch"]') ||
    containsActions ||
    (!isMapCategory && element.querySelector('img, svg:not(.qolboxActionIcon)'))
  ) return;
  let label = getActionLabel(element);
  if (!label && element.dataset.qolboxSpinnerLabel) {
    label = element.dataset.qolboxSpinnerLabel;
    element.append(document.createTextNode(label));
  }
  const iconName = label
    ? getActionIcon(label, element)
    : getIconOnlyActionIcon(element);
  if (!iconName) return;
  element.classList.toggle('qolboxIconOnlyAction', !label);
  const host = getIconHost(element);
  const existing = host.querySelector<HTMLElement | SVGSVGElement>(':scope > .qolboxActionIcon');
  if (existing?.dataset.qolboxIcon === iconName) return;
  existing?.remove();
  host.querySelector(':scope > .qolboxEditorHelpMark')?.remove();
  host.prepend(createIcon(iconName));
}

function decorateRoomListLabel(element: HTMLElement): void {
  const label = getActionLabel(element);
  const iconName = getRoomListLabelIcon(label);
  if (!iconName) return;
  const existing = element.querySelector<HTMLElement | SVGSVGElement>(':scope > .qolboxActionIcon');
  if (existing?.dataset.qolboxIcon === iconName) return;
  existing?.remove();
  element.prepend(createIcon(iconName));
}

function getStatusIconName(line: string): ActionIconName {
  const text = line.toLowerCase();
  return /fail|error|incorrect|closed|full|invalid|disconnect|not found|no rooms/.test(text)
    ? 'x'
    : /success|sync|ready/.test(text)
      ? 'check'
      : /address|connect|server|p2p/.test(text)
        ? 'wifi'
        : /join|attempt|log(?:ging)?|automatically load/.test(text)
          ? 'log-in'
          : /search|find|match/.test(text)
            ? 'search'
            : /fetch|load|download|map/.test(text)
              ? 'download'
              : /player|await/.test(text)
                ? 'users'
                : /no records|haven't/.test(text)
                  ? 'info'
                : /retry|wait/.test(text)
                  ? 'refresh-cw'
                  : 'clock';
}

function decorateStatus(element: HTMLElement): void {
  const lines = (element.textContent || '')
    .split(/\r?\n/)
    .map(line => line.replace(/\s*✓\s*$/, '').trim())
    .filter(Boolean);
  const statusText = lines.join('\n');
  if (!statusText) {
    element.replaceChildren();
    delete element.dataset.qolboxStatusText;
    return;
  }
  if (element.dataset.qolboxStatusText === statusText && element.querySelector('.qolboxStatusLine')) return;

  const list = document.createElement('span');
  list.className = 'qolboxStatusLines';
  list.append(...lines.map((line, index) => {
    const row = document.createElement('span');
    row.className = 'qolboxStatusLine';
    if (index > 0) {
      const separator = document.createElement('span');
      separator.className = 'qolboxStatusSeparator';
      separator.textContent = '\n';
      row.append(separator);
    }
    const isRoomName = index > 0 && /attempting to join room:$/i.test(lines[index - 1] || '');
    if (!isRoomName) {
      const icon = createIcon(getStatusIconName(line));
      icon.classList.add('qolboxStatusIcon');
      row.append(icon);
    } else {
      const spacer = document.createElement('span');
      spacer.className = 'qolboxStatusIconSpacer';
      row.append(spacer);
    }
    const label = document.createElement('span');
    label.className = 'qolboxStatusLabel';
    label.textContent = line;
    row.append(label);
    return row;
  }));
  element.replaceChildren(list);
  element.dataset.qolboxStatusText = statusText;
}

function decorateMapDropdownArrows(root: ParentNode): void {
  const arrows = root instanceof HTMLElement && root.matches(MAP_DROPDOWN_ARROW_SELECTOR)
    ? [root]
    : Array.from(root.querySelectorAll<HTMLElement>(MAP_DROPDOWN_ARROW_SELECTOR));
  for (const arrow of arrows) {
    const icon = createIcon('chevron-down');
    icon.classList.add(...arrow.classList, 'qolboxDropdownArrow');
    arrow.replaceWith(icon);
  }
}

function decorateRoomPasswordIcons(root: ParentNode): void {
  const rows = root instanceof HTMLElement && root.matches('.roomListContainer .scrollBox table tr')
    ? [root as HTMLTableRowElement]
    : Array.from(root.querySelectorAll<HTMLTableRowElement>('.roomListContainer .scrollBox table tr'));
  for (const row of rows) {
    const cell = row.cells[2];
    if (!cell) continue;
    const nativeLock = cell.querySelector<HTMLImageElement>('img[src*="lock-outline-roomlist"]');
    const existing = cell.querySelector<HTMLElement | SVGSVGElement>(':scope > .qolboxRoomPasswordIcon');
    if (!nativeLock) {
      if (existing?.dataset.qolboxIcon !== 'lock') existing?.remove();
      continue;
    }
    nativeLock?.remove();
    if (existing?.dataset.qolboxIcon === 'lock') continue;
    existing?.remove();
    const icon = createIcon('lock');
    icon.classList.add('qolboxRoomPasswordIcon');
    cell.append(icon);
  }
}

function preserveNativeSpinnerContract(element: HTMLElement): void {
  if (!/^(?:refresh|retry)$/i.test(getActionLabel(element)) || element.dataset.qolboxSpinnerSafe) return;
  element.dataset.qolboxSpinnerSafe = 'true';
  element.addEventListener('click', () => {
    element.dataset.qolboxSpinnerLabel = getActionLabel(element);
    const pendingRecovery = nativeSpinnerRecoveryTimers.get(element);
    if (pendingRecovery) window.clearTimeout(pendingRecovery);
    nativeSpinnerRecoveryTimers.delete(element);
    element.querySelector(':scope > .qolboxActionIcon')?.remove();
    element.querySelectorAll(':scope > .spinner').forEach(spinner => spinner.remove());
    element.classList.remove('spinnerHideText');
    window.setTimeout(() => {
      if (element.classList.contains('spinnerHideText') || element.querySelector(':scope > .spinner')) {
        armNativeSpinnerRecovery(element);
      }
    }, 0);
  }, true);
}

function armNativeSpinnerRecovery(element: HTMLElement): void {
  if (nativeSpinnerRecoveryTimers.has(element)) return;
  const label = element.dataset.qolboxSpinnerLabel || getActionLabel(element) || 'REFRESH';
  element.dataset.qolboxSpinnerLabel = label;
  nativeSpinnerRecoveryTimers.set(element, window.setTimeout(() => {
    nativeSpinnerRecoveryTimers.delete(element);
    if (!element.classList.contains('spinnerHideText') && !element.querySelector(':scope > .spinner')) return;
    element.classList.remove('spinnerHideText');
    element.querySelectorAll(':scope > .spinner').forEach(spinner => spinner.remove());
    element.textContent = label;
    decorateAction(element);
  }, NATIVE_SPINNER_TIMEOUT_MS));
}

function getDirectAudioItems(menu: HTMLElement): HTMLElement[] {
  return Array.from(menu.querySelectorAll<HTMLElement>(':scope > .item'))
    .filter(item => AUDIO_LABEL.test(getActionLabel(item)));
}

export function createActionIconographyController() {
  function decorateActions(root: ParentNode = document): void {
    patchLargeMapPreviewDecode();
    decoratePlayerColorInput(root);
    syncLobbyEditorAction(root);
    if (root instanceof HTMLElement && root.matches('.cornerButton .square .icon')) {
      decorateAction(root.parentElement as HTMLElement);
    }
    if (root instanceof HTMLElement && root.matches(ACTION_SELECTOR)) {
      preserveNativeSpinnerContract(root);
      decorateAction(root);
    }
    root.querySelectorAll<HTMLElement>(ACTION_SELECTOR).forEach(element => {
      preserveNativeSpinnerContract(element);
      decorateAction(element);
    });
    if (root instanceof HTMLElement && root.matches(ROOM_LIST_LABEL_SELECTOR)) decorateRoomListLabel(root);
    root.querySelectorAll<HTMLElement>(ROOM_LIST_LABEL_SELECTOR).forEach(decorateRoomListLabel);
    if (root instanceof HTMLElement && root.matches(STATUS_SELECTOR)) decorateStatus(root);
    root.querySelectorAll<HTMLElement>(STATUS_SELECTOR).forEach(decorateStatus);
    decorateMapDropdownArrows(root);
    decorateRoomPasswordIcons(root);
    root.querySelectorAll('.mapListContainer .mapsContainer .thumbImage')
      .forEach(image => image.parentElement?.querySelector('.qolboxMapPreviewPlaceholder')?.remove());
    root.querySelectorAll<HTMLElement>('.mapListContainer .mapsContainer .thumb:empty').forEach(thumbnail => {
      const icon = createIcon('map');
      icon.classList.add('qolboxMapPreviewPlaceholder');
      thumbnail.append(icon);
    });
  }

  function patchHamburgerAudioGroup(): void {
    for (const menu of document.querySelectorAll<HTMLElement>('.cornerButton .items')) {
      let group = menu.querySelector<HTMLElement>(':scope > .qolboxAudioMenuGroup');
      const directItems = getDirectAudioItems(menu);
      if (!group && directItems.length < 2) continue;
      if (!group) {
        group = document.createElement('div');
        group.className = 'item qolboxAudioMenuGroup';
        group.dataset.qolboxIcon = 'volume-2';
        group.tabIndex = 0;
        group.setAttribute('role', 'menuitem');
        group.setAttribute('aria-haspopup', 'menu');
        group.setAttribute('aria-expanded', 'false');
        const label = document.createElement('span');
        label.className = 'qolboxAudioMenuLabel';
        label.textContent = 'Audio';
        const arrow = document.createElement('span');
        arrow.className = 'qolboxAudioMenuArrow';
        arrow.textContent = '›';
        arrow.setAttribute('aria-hidden', 'true');
        const options = document.createElement('div');
        options.className = 'qolboxAudioMenuOptions';
        options.setAttribute('role', 'menu');
        group.append(label, arrow, options);
        menu.insertBefore(group, directItems[0] || null);
        group.addEventListener('click', event => {
          if (event.target instanceof Element && event.target.closest('.qolboxAudioMenuOptions')) return;
          event.preventDefault();
          event.stopImmediatePropagation();
          const open = group?.classList.toggle('open') ?? false;
          group?.setAttribute('aria-expanded', String(open));
        }, true);
      }
      const options = group.querySelector<HTMLElement>('.qolboxAudioMenuOptions');
      if (!options) continue;
      for (const item of directItems) {
        item.classList.add('qolboxAudioMenuOption');
        options.appendChild(item);
      }
    }
    decorateActions();
  }

  function removeHamburgerAudioGroup(): void {
    for (const group of document.querySelectorAll<HTMLElement>('.qolboxAudioMenuGroup')) {
      const menu = group.parentElement;
      if (!menu) continue;
      for (const item of group.querySelectorAll<HTMLElement>('.qolboxAudioMenuOption')) {
        item.classList.remove('qolboxAudioMenuOption');
        menu.insertBefore(item, group);
      }
      group.remove();
    }
  }

  return { decorateActions, patchHamburgerAudioGroup, removeHamburgerAudioGroup };
}
