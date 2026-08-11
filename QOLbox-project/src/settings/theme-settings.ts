import { isRecord } from '../utils/object-properties';
import { getLocalStorageItem, setLocalStorageItem } from '../utils/local-storage';
import { getKnownFullscreenRenderers, rerenderKnownRenderer } from '../hitbox/renderer-discovery';
import { isNativeObject, readNativePath, readNativeProperty } from '../hitbox/native-access';

export const DEFAULT_QOLBOX_ACCENT = '#FF6200';
export const DEFAULT_GAME_ACCENT = '#4A7AB1';
export const THEME_QOLBOX_ACCENT = 'qolboxAccent';
export const THEME_GAME_ACCENT = 'gameAccent';
export const THEME_MODE = 'mode';

export type ThemeColorKey = typeof THEME_QOLBOX_ACCENT | typeof THEME_GAME_ACCENT;
export type ThemeMode = 'system' | 'dark' | 'light';

export interface ThemeSettings {
  gameAccent: string;
  linked: boolean;
  mode: ThemeMode;
  qolboxAccent: string;
}

const THEME_SETTINGS_KEY = 'vm.hitbox.qolboxThemeSettings';
const GAME_THEME_STYLE_ID = 'qolbox-game-theme-overrides';
const HEX_COLOR = /^#[0-9a-f]{6}$/i;
const NATIVE_PLAYER_EMBLEM_COLOR = 0xffd440;
const PLAYER_EMBLEM_RENDER_HOOK = '__qolboxPlayerEmblemRenderHook';
const playerEmblemFills = new WeakSet<object>();
let playerEmblemTarget = NATIVE_PLAYER_EMBLEM_COLOR;
let appliedDocument: Document | null = null;
let appliedThemeSignature = '';
let themedStylesheetSignature = '';

const NATIVE_BLUE_VARIABLES: readonly [RegExp, string][] = [
  [/(?:#4a7ab1|rgb\(74,\s*122,\s*177\))/gi, 'var(--qolbox-game-accent)'],
  [/(?:#5c85b4|rgb\(92,\s*133,\s*180\))/gi, 'var(--qolbox-game-accent-hover)'],
  [/(?:#5a8ac1|rgb\(90,\s*138,\s*193\))/gi, 'var(--qolbox-game-accent-focus)'],
  [/(?:#375a83|rgb\(55,\s*90,\s*131\))/gi, 'var(--qolbox-game-accent-shadow)'],
  [/(?:#6190d4|rgb\(97,\s*144,\s*212\))/gi, 'var(--qolbox-game-accent-bright)'],
  [/(?:#3d5874|rgb\(61,\s*88,\s*116\))/gi, 'var(--qolbox-game-accent-dark)'],
  [/(?:#405664|rgb\(64,\s*86,\s*100\))/gi, 'var(--qolbox-game-accent-darker)'],
];
const NATIVE_PALETTE: readonly [RegExp, string, string, string][] = [
  [/(?:#191818|rgb\(25,\s*24,\s*24\))/gi, '--qolbox-ui-dark-border', '#191818', '#A4ADB9'],
  [/(?:#191919|rgb\(25,\s*25,\s*25\))/gi, '--qolbox-ui-room-header', '#191919', '#D8DDE3'],
  [/(?:#1c1c1c|rgb\(28,\s*28,\s*28\))/gi, '--qolbox-ui-strong-border', '#1C1C1C', '#A4ADB9'],
  [/(?:#202020|rgb\(32,\s*32,\s*32\))/gi, '--qolbox-ui-settings-table', '#202020', '#E9EDF2'],
  [/(?:#222222|rgb\(34,\s*34,\s*34\))/gi, '--qolbox-ui-border', '#222222', '#AEB6C2'],
  [/(?:#25262a|rgb\(37,\s*38,\s*42\))/gi, '--qolbox-ui-panel', '#25262A', '#F4F6F8'],
  [/(?:#262626|rgb\(38,\s*38,\s*38\))/gi, '--qolbox-ui-room-panel', '#262626', '#F8F9FB'],
  [/(?:#27292c|rgb\(39,\s*41,\s*44\))/gi, '--qolbox-ui-popup-menu', '#27292C', '#EDF1F5'],
  [/(?:#2b2d31|rgb\(43,\s*45,\s*49\))/gi, '--qolbox-ui-context-menu', '#2B2D31', '#E8EDF2'],
  [/(?:#2c2e32|rgb\(44,\s*46,\s*50\))/gi, '--qolbox-ui-control', '#2C2E32', '#E2E7ED'],
  [/(?:#2e2f31|rgb\(46,\s*47,\s*49\))/gi, '--qolbox-ui-list-item', '#2E2F31', '#F0F2F5'],
  [/(?:#303030|rgb\(48,\s*48,\s*48\))/gi, '--qolbox-ui-input', '#303030', '#FFFFFF'],
  [/(?:#323438|rgb\(50,\s*52,\s*56\))/gi, '--qolbox-ui-popup-menu-hover', '#323438', '#D6DEE7'],
  [/(?:#333f37|rgb\(51,\s*63,\s*55\))/gi, '--qolbox-ui-friends-present', '#333F37', '#D4E8D9'],
  [/(?:#35383d|rgb\(53,\s*56,\s*61\))/gi, '--qolbox-ui-tile', '#35383D', '#E4E9EE'],
  [/(?:#363636|rgb\(54,\s*54,\s*54\))/gi, '--qolbox-ui-table-border', '#363636', '#B7BEC8'],
  [/(?:#36373c|rgb\(54,\s*55,\s*60\))/gi, '--qolbox-ui-list-hover', '#36373C', '#DCE3EA'],
  [/(?:#3d4046|rgb\(61,\s*64,\s*70\))/gi, '--qolbox-ui-chrome', '#3D4046', '#D4DCE5'],
  [/(?:#3f4044|rgb\(63,\s*64,\s*68\))/gi, '--qolbox-ui-list-meta-bg', '#3F4044', '#DFE5EB'],
  [/(?:#3f474e|rgb\(63,\s*71,\s*78\))/gi, '--qolbox-ui-filter-bar', '#3F474E', '#D7DEE6'],
  [/(?:#3f4c50|rgb\(63,\s*76,\s*80\))/gi, '--qolbox-ui-list-selected-hover', '#3F4C50', '#CED9E1'],
  [/(?:#414141|rgb\(65,\s*65,\s*65\))/gi, '--qolbox-ui-subtle-border', '#414141', '#B7BEC8'],
  [/(?:#474747|rgb\(71,\s*71,\s*71\))/gi, '--qolbox-ui-settings-row', '#474747', '#E3E7EC'],
  [/(?:#49575c|rgb\(73,\s*87,\s*92\))/gi, '--qolbox-ui-list-selected', '#49575C', '#C4D2DB'],
  [/(?:#535962|rgb\(83,\s*89,\s*98\))/gi, '--qolbox-ui-tile-selected', '#535962', '#C7D4E2'],
  [/(?:#555555|rgb\(85,\s*85,\s*85\))/gi, '--qolbox-ui-disabled', '#555555', '#C7CDD5'],
  [/(?:#585858|rgb\(88,\s*88,\s*88\))/gi, '--qolbox-ui-generic-control', '#585858', '#E1E5EA'],
  [/(?:#5a5a5a|rgb\(90,\s*90,\s*90\))/gi, '--qolbox-ui-item-border', '#5A5A5A', '#919AA7'],
  [/(?:#6c6c6c|rgb\(108,\s*108,\s*108\))/gi, '--qolbox-ui-input-border', '#6C6C6C', '#919AA7'],
  [/(?:#a9a9a9|rgb\(169,\s*169,\s*169\))/gi, '--qolbox-ui-status-text', '#A9A9A9', '#59636F'],
  [/(?:#a5a5a5|rgb\(165,\s*165,\s*165\))/gi, '--qolbox-ui-list-meta', '#A5A5A5', '#59636F'],
  [/(?:#bababa|rgb\(186,\s*186,\s*186\))/gi, '--qolbox-ui-preview-border', '#BABABA', '#7D8793'],
  [/(?:#b5b5b5|rgb\(181,\s*181,\s*181\))/gi, '--qolbox-ui-help-text', '#B5B5B5', '#4D5662'],
  [/(?:#c3c3c3|rgb\(195,\s*195,\s*195\))/gi, '--qolbox-ui-muted', '#C3C3C3', '#414A55'],
  [/(?:#d5d5d5|rgb\(213,\s*213,\s*213\))/gi, '--qolbox-ui-list-text', '#D5D5D5', '#303640'],
  [/(?:#ebebeb|rgb\(235,\s*235,\s*235\))/gi, '--qolbox-ui-text', '#EBEBEB', '#171A1F'],
];
const COLOR_SCHEMES = {
  dark: Object.fromEntries(NATIVE_PALETTE.map(([, property, dark]) => [property, dark])),
  light: Object.fromEntries(NATIVE_PALETTE.map(([, property, , light]) => [property, light])),
};

export function normalizeThemeColor(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().startsWith('#') ? value.trim() : `#${value.trim()}`;
  return HEX_COLOR.test(normalized) ? normalized.toUpperCase() : null;
}

export function getDefaultThemeSettings(): ThemeSettings {
  return {
    gameAccent: DEFAULT_GAME_ACCENT,
    linked: false,
    mode: 'system',
    qolboxAccent: DEFAULT_QOLBOX_ACCENT,
  };
}

export function sanitizeThemeSettings(value: unknown): ThemeSettings {
  const defaults = getDefaultThemeSettings();
  if (!isRecord(value)) return defaults;
  const qolboxAccent = normalizeThemeColor(value.qolboxAccent) || defaults.qolboxAccent;
  const linked = value.linked === true;
  return {
    gameAccent: linked
      ? qolboxAccent
      : normalizeThemeColor(value.gameAccent) || defaults.gameAccent,
    linked,
    mode: value.mode === 'dark' || value.mode === 'light' ? value.mode : 'system',
    qolboxAccent,
  };
}

export function loadThemeSettings(): ThemeSettings {
  try {
    const stored = getLocalStorageItem(THEME_SETTINGS_KEY);
    return stored ? sanitizeThemeSettings(JSON.parse(stored)) : getDefaultThemeSettings();
  } catch {
    return getDefaultThemeSettings();
  }
}

export function saveThemeSettings(settings: ThemeSettings): void {
  setLocalStorageItem(THEME_SETTINGS_KEY, JSON.stringify(sanitizeThemeSettings(settings)));
}

function getRgb(hex: string): [number, number, number] {
  return [1, 3, 5].map(index => parseInt(hex.slice(index, index + 2), 16)) as [number, number, number];
}

function mixColors(hex: string, target: string, amount: number): string {
  const targetRgb = getRgb(target);
  return `#${getRgb(hex)
    .map((channel, index) => Math.round(channel + ((targetRgb[index] ?? channel) - channel) * amount)
      .toString(16).padStart(2, '0'))
    .join('')}`.toUpperCase();
}

function mix(hex: string, target: 0 | 255, amount: number): string {
  return mixColors(hex, target ? '#FFFFFF' : '#000000', amount);
}

function getLuminance(hex: string): number {
  return getRgb(hex)
    .map(channel => channel / 255)
    .map(channel => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
    .reduce((sum, channel, index) => sum + channel * ([0.2126, 0.7152, 0.0722][index] ?? 0), 0);
}

function getContrastRatio(left: string, right: string): number {
  const values = [getLuminance(left), getLuminance(right)].sort((a, b) => b - a);
  return ((values[0] ?? 0) + 0.05) / ((values[1] ?? 0) + 0.05);
}

function getContrastColor(hex: string): '#000000' | '#FFFFFF' {
  const luminance = getLuminance(hex);
  const whiteContrast = 1.05 / (luminance + 0.05);
  const blackContrast = (luminance + 0.05) / 0.05;
  return blackContrast >= whiteContrast ? '#000000' : '#FFFFFF';
}

function keepThemeContrast(color: string, base: string, foreground: string): string {
  for (let attempt = 0; attempt < 10 && getContrastRatio(color, foreground) < 4.5; attempt += 1) {
    color = mixColors(color, base, 0.5);
  }
  return getContrastRatio(color, foreground) >= 4.5 ? color : base;
}

function replaceNativeThemeColors(value: string): string {
  let result = value;
  for (const [pattern, replacement] of NATIVE_BLUE_VARIABLES) result = result.replace(pattern, replacement);
  for (const [pattern, property] of NATIVE_PALETTE) result = result.replace(pattern, `var(${property})`);
  return result;
}

function getResolvedColorScheme(mode: ThemeMode): 'dark' | 'light' {
  if (mode !== 'system') return mode;
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

function recolorPlayerEmblems(renderer: unknown): boolean {
  let rendererChanged = false;
  const players = readNativeProperty(renderer, 'nf');
  if (!isNativeObject(players)) return false;
  for (const key of Reflect.ownKeys(players)) {
    const group = readNativeProperty(players, key);
    for (const player of Array.isArray(group) ? group : [group]) {
      const children = readNativePath(player, ['Ic', 'children']);
      if (!Array.isArray(children)) continue;
      for (const graphic of children) {
        const geometry = readNativeProperty(graphic, 'geometry');
        if (!isNativeObject(graphic) || !isNativeObject(geometry)) continue;
        const data = readNativeProperty(geometry, 'graphicsData');
        if (!Array.isArray(data)) continue;
        let changed = false;
        for (const item of data) {
          const fill = readNativeProperty(item, 'fillStyle');
          if (!isNativeObject(fill)) continue;
          const color = readNativeProperty(fill, 'color');
          if (color === NATIVE_PLAYER_EMBLEM_COLOR) playerEmblemFills.add(fill);
          if (!playerEmblemFills.has(fill) || color === playerEmblemTarget) continue;
          Reflect.set(fill, 'color', playerEmblemTarget);
          changed = true;
        }
        const invalidate = readNativeProperty(geometry, 'invalidate');
        if (changed && typeof invalidate === 'function') {
          Reflect.apply(invalidate, geometry, []);
          rendererChanged = true;
        }
      }
    }
  }
  return rendererChanged;
}

function installPlayerEmblemRenderHook(renderer: unknown): void {
  const pixiRenderer = readNativeProperty(renderer, 'Ag');
  const render = readNativeProperty(pixiRenderer, 'render');
  if (!isNativeObject(pixiRenderer) || typeof render !== 'function' || readNativeProperty(render, PLAYER_EMBLEM_RENDER_HOOK)) {
    return;
  }
  const wrappedRender = function (this: unknown, ...args: unknown[]): unknown {
    if (playerEmblemTarget !== NATIVE_PLAYER_EMBLEM_COLOR) recolorPlayerEmblems(renderer);
    return Reflect.apply(render, this, args);
  };
  Reflect.set(wrappedRender, PLAYER_EMBLEM_RENDER_HOOK, true);
  Reflect.set(pixiRenderer, 'render', wrappedRender);
}

function applyPlayerEmblemColor(gameAccent: string): void {
  const nextTarget = gameAccent === DEFAULT_GAME_ACCENT
    ? NATIVE_PLAYER_EMBLEM_COLOR
    : parseInt(gameAccent.slice(1), 16);
  playerEmblemTarget = nextTarget;
  for (const renderer of getKnownFullscreenRenderers()) {
    if (playerEmblemTarget !== NATIVE_PLAYER_EMBLEM_COLOR) installPlayerEmblemRenderHook(renderer);
    if (recolorPlayerEmblems(renderer)) rerenderKnownRenderer(renderer);
  }
}

function getBackgroundContrastVariable(value: string): string | null {
  const matches = NATIVE_BLUE_VARIABLES.filter(([pattern]) => {
    pattern.lastIndex = 0;
    const matched = pattern.test(value);
    pattern.lastIndex = 0;
    return matched;
  });
  const match = matches.length === 1 ? matches[0] : null;
  return match ? match[1].replace(/\)$/, '-contrast)') : null;
}

function getGameThemeSourceSignature(): string {
  const sources: string[] = [];
  for (const [index, sheet] of Array.from(document.styleSheets || []).entries()) {
    const owner = sheet.ownerNode;
    if (owner instanceof HTMLElement && (owner.id === 'qolbox-style' || owner.id === GAME_THEME_STYLE_ID)) continue;
    let ruleCount = -1;
    try {
      ruleCount = sheet.cssRules.length;
    } catch {
      // Cross-origin stylesheets are not readable and cannot be themed.
    }
    const identity = sheet.href || (owner instanceof HTMLElement
      ? `${owner.tagName}:${owner.id}:${owner.getAttribute('href') || ''}`
      : 'anonymous');
    sources.push(`${index}:${identity}:${ruleCount}`);
  }
  return sources.join('|');
}

export function ensureGameThemeOverrides(): void {
  const declarations: string[] = [];
  for (const sheet of Array.from(document.styleSheets || [])) {
    const owner = sheet.ownerNode;
    if (owner instanceof HTMLElement && (owner.id === 'qolbox-style' || owner.id === GAME_THEME_STYLE_ID)) continue;
    let rules: CSSRuleList;
    try {
      rules = sheet.cssRules;
    } catch {
      continue;
    }
    for (const rule of rules) {
      if (!(rule instanceof CSSStyleRule)) continue;
      const properties: string[] = [];
      let contrast: string | null = null;
      for (const property of rule.style) {
        const value = rule.style.getPropertyValue(property);
        const themed = replaceNativeThemeColors(value);
        if (themed === value) continue;
        properties.push(`${property}:${themed}${rule.style.getPropertyPriority(property) ? '!important' : ''}`);
        if (/^background(?:-color)?$/i.test(property)) contrast = getBackgroundContrastVariable(value);
      }
      if (contrast) properties.push(`color:${contrast}`);
      if (properties.length) declarations.push(`${rule.selectorText}{${properties.join(';')}}`);
    }
  }
  declarations.push('.mainMenuFancy .rightContainer .bigButton .text{color:var(--qolbox-game-accent-contrast)!important}');
  declarations.push('#appContainer .spinnerHideText{color:transparent!important;text-shadow:none!important}');
  declarations.push('.checkbox.checked{background-color:var(--qolbox-game-accent)!important;background-image:none!important;position:relative}');
  declarations.push('.checkbox.checked::after{border:solid var(--qolbox-game-accent-contrast);border-width:0 2px 2px 0;content:"";height:10px;left:7px;position:absolute;top:3px;transform:rotate(45deg);width:5px}');
  declarations.push('html[data-qolbox-color-scheme="light"] #editorContainer .sideBar .button{background-color:var(--qolbox-ui-control);background-blend-mode:difference}');
  declarations.push('html[data-qolbox-color-scheme="light"] #editorContainer .sideBar .button:hover{background-color:var(--qolbox-ui-chrome)}');
  declarations.push('html[data-qolbox-color-scheme="light"] .editorPropertiesWindow{color:var(--qolbox-ui-text)}');
  declarations.push('html[data-qolbox-color-scheme="light"] .mapListContainer .mapsContainer .element .title{color:var(--qolbox-ui-list-text)}');
  declarations.push('html[data-qolbox-color-scheme="light"] .lobbyContainer .playerElement .level{color:var(--qolbox-ui-list-meta)}');
  declarations.push('html[data-qolbox-color-scheme="light"] .lobbyContainer .playerElement{background:var(--qolbox-ui-control)}');
  declarations.push('html[data-qolbox-color-scheme="light"] .lobbyContainer .playerElement:hover{background:var(--qolbox-ui-list-hover)}');
  declarations.push('html[data-qolbox-color-scheme="light"] .lobbyContainer .playerElement .pingText.highPing{color:#B42318}');
  declarations.push('html[data-qolbox-color-scheme="light"] .roomListContainer .roomList .friendsPopup{background:var(--qolbox-ui-context-menu);color:var(--qolbox-ui-text)}');
  declarations.push('html[data-qolbox-color-scheme="light"] .lobbyContainer .settingsBox .mapTextContainer{color:#fff;text-shadow:0 1px 2px #000}');
  declarations.push('html[data-qolbox-color-scheme="light"] .lobbyContainer .settingsBox .modeDropdown{background-color:var(--qolbox-game-accent)!important;border-color:var(--qolbox-game-accent)!important;color:var(--qolbox-game-accent-contrast)!important}');
  declarations.push('html[data-qolbox-color-scheme="light"] .lobbyContainer .chatBox .content .status{color:var(--qolbox-game-accent-darker)}');
  declarations.push('html[data-qolbox-color-scheme="light"] .lobbyContainer .chatBox .content .status.jukeStatus{color:#805200}');
  declarations.push('html[data-qolbox-color-scheme="light"] .lobbyContainer .chatBox .content :is(.name,.message){filter:brightness(.4)}');
  declarations.push('html[data-qolbox-color-scheme="light"] .postGameContainer{color:var(--qolbox-ui-text)}');
  declarations.push('html[data-qolbox-color-scheme="light"] .postGameContainer .xpGroup .lvNow,html[data-qolbox-color-scheme="light"] .postGameContainer .xpGroup .lvNext,html[data-qolbox-color-scheme="light"] .postGameContainer .xpGroup .xpSlash{color:var(--qolbox-ui-list-meta)}');
  declarations.push('html[data-qolbox-color-scheme="light"] .postGameContainer .xpGroup .barContainer{background:var(--qolbox-ui-disabled)}');
  declarations.push('html[data-qolbox-color-scheme="light"] .postGameContainer .xpGroup .barInner{background:var(--qolbox-ui-list-meta)}');
  declarations.push('html[data-qolbox-color-scheme="light"] .qolboxPlayerInfoLabel{color:var(--qolbox-ui-list-meta)}');
  declarations.push('html[data-qolbox-color-scheme="light"] .qolboxPlayerInfoValue{color:var(--qolbox-ui-text)}');
  declarations.push('html[data-qolbox-color-scheme="light"] .qolboxPlayerInfoUnknownProgress{opacity:.68}');
  declarations.push('.cornerButton .items .item{color:#fff!important;text-shadow:1px 1px 2px #000!important}');
  declarations.push('.cornerButton .items .item.disabled{color:#737b86!important}');

  let style = document.getElementById(GAME_THEME_STYLE_ID) as HTMLStyleElement | null;
  if (!style) {
    style = document.createElement('style');
    style.id = GAME_THEME_STYLE_ID;
    (document.head || document.documentElement).append(style);
  }
  style.textContent = declarations.join('\n');
}

export function applyThemeSettings(value: ThemeSettings): ThemeSettings {
  const settings = sanitizeThemeSettings(value);
  const documentChanged = appliedDocument !== document;
  const colorScheme = getResolvedColorScheme(settings.mode);
  const themeSignature = `${settings.qolboxAccent}|${settings.gameAccent}|${settings.mode}|${colorScheme}`;
  if (documentChanged || appliedThemeSignature !== themeSignature) {
    const root = document.documentElement.style;
    document.documentElement.dataset.qolboxColorScheme = colorScheme;
    root.colorScheme = colorScheme;
    for (const [property, color] of Object.entries(COLOR_SCHEMES[colorScheme])) root.setProperty(property, color);
    const [red, green, blue] = getRgb(settings.qolboxAccent);
    root.setProperty('--qolbox-accent', settings.qolboxAccent);
    root.setProperty('--qolbox-accent-rgb', `${red} ${green} ${blue}`);
    root.setProperty('--qolbox-accent-contrast', getContrastColor(settings.qolboxAccent));
    const gameForeground = getContrastColor(settings.gameAccent);
    const gameVariants = {
      accent: settings.gameAccent,
      hover: mix(settings.gameAccent, 255, 0.12),
      focus: mix(settings.gameAccent, 255, 0.16),
      shadow: mix(settings.gameAccent, 0, 0.26),
      bright: mix(settings.gameAccent, 255, 0.22),
      dark: mix(settings.gameAccent, 0, 0.25),
      darker: mix(settings.gameAccent, 0, 0.4),
    };
    for (const [name, candidate] of Object.entries(gameVariants)) {
      const color = keepThemeContrast(candidate, settings.gameAccent, gameForeground);
      const variable = name === 'accent' ? '--qolbox-game-accent' : `--qolbox-game-accent-${name}`;
      root.setProperty(variable, color);
      root.setProperty(`${variable}-contrast`, gameForeground);
    }
    appliedThemeSignature = themeSignature;
  }

  const sourceSignature = getGameThemeSourceSignature();
  if (documentChanged || themedStylesheetSignature !== sourceSignature || !document.getElementById(GAME_THEME_STYLE_ID)) {
    ensureGameThemeOverrides();
    themedStylesheetSignature = sourceSignature;
  }
  applyPlayerEmblemColor(settings.gameAccent);
  appliedDocument = document;
  return settings;
}

export function createThemeSettingsController() {
  let settings = loadThemeSettings();
  const systemTheme = window.matchMedia?.('(prefers-color-scheme: light)');

  function apply(): void {
    settings = applyThemeSettings(settings);
  }

  function setThemeSettings(value: ThemeSettings): void {
    settings = sanitizeThemeSettings(value);
    saveThemeSettings(settings);
    apply();
  }

  systemTheme?.addEventListener?.('change', () => {
    if (settings.mode === 'system') apply();
  });

  return {
    applyThemeSettings: apply,
    getThemeSettings: () => ({ ...settings }),
    setThemeSettings,
  };
}
