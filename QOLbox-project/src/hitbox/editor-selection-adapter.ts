import {
  callNativeMethodSafely,
  isNativeObject,
  readNativePath,
  readNativeProperty,
  readNativeReflectProperty,
  setNativeReflectProperty,
} from './native-access';
import {
  getKnownFullscreenRenderers,
  getLastRendererDrawArguments,
  getRendererView,
} from './renderer-discovery';
import { installEditorHelp } from '../features/editor-help';
import { EDITOR_PROPERTY_PATHS } from './editor-property-paths';
import { installEditorMapFitZoom, installEditorZoomSafety } from './editor-zoom-safety';
import {
  areasIntersect,
  distanceToPolygon,
  getArea,
  getPointBounds,
  offsetPolygon,
  polygonContainsPoint,
  polygonsIntersect,
  rotatePoint,
  type Bounds,
} from './editor-geometry';

type NativeFunction = (this: unknown, ...args: unknown[]) => unknown;

function isNativeFunction(value: unknown): value is NativeFunction {
  return typeof value === 'function';
}

interface SelectionRecord {
  model: object;
  type: string;
  wrapper: object;
}

interface OutlineGeometry {
  bounds: Bounds;
  center: { x: number; y: number };
  contours: number[][];
  points: number[];
  rotation: number;
  scale: { x: number; y: number };
}

type OutlineMode = 'bounds' | 'rendered';
type MirrorAxis = 'horizontal' | 'vertical';

interface MarqueeSelection {
  graphics: object;
  modified: boolean;
  records: SelectionRecord[];
  start: { x: number; y: number };
}

interface SelectionState {
  bodyGroups: Map<number, Set<number>>;
  dragStart: { x: number; y: number } | null;
  extraLabels: object[];
  extraOutline: object | null;
  nativeOutline: object;
  originalAb: NativeFunction;
  originalFv: NativeFunction;
  originalIv: NativeFunction;
  originalNb: NativeFunction;
  originalPb: NativeFunction;
  originalUb: NativeFunction;
  originalWb: NativeFunction;
  outlineSignature: string;
  labelConstructor: Function | null;
  labelStyle: unknown;
  lastPointerEvent: unknown;
  marquee: MarqueeSelection | null;
  paintValues: Map<PropertyKey, unknown>;
  pointerDownRecords: SelectionRecord[] | null;
  records: SelectionRecord[];
  redrawing: boolean;
  refreshPending: boolean;
  renderer: object;
  samplingColor: boolean;
  selecting: boolean;
  specialBodyId: number | null;
  specialDragStart: { x: number; y: number } | null;
  tool: object;
}

interface PropertySnapshot {
  force: boolean;
  kind: 'connect' | null;
  model: object;
  path: readonly PropertyKey[];
  records: SelectionRecord[];
  state: SelectionState;
  value: unknown;
  values: Map<object, unknown>;
}

const POINTER_LISTENER_MARKER = Symbol('qolboxEditorSelectionCapture');
const CAMERA_MOVE_MARKER = Symbol('qolboxEditorCameraMoveGuard');
const PROPERTY_HANDLER_MARKER = Symbol('qolboxEditorSelectionProperty');
const MIXED_OPTION_VALUE = '__qolbox_mixed__';
const MARQUEE_DRAG_THRESHOLD_PX = 4;
const EDITOR_OUTLINE_PADDING_PX = 5;
const inputOwnershipWindows = new WeakSet<object>();
const statesByRenderer = new WeakMap<object, SelectionState>();
const originalCopyByWrapper = new WeakMap<object, NativeFunction>();
const originalDeleteByWrapper = new WeakMap<object, NativeFunction>();
const originalRotateByWrapper = new WeakMap<object, NativeFunction>();
const propertyPaths = new WeakMap<HTMLElement, readonly PropertyKey[]>();
const guardedMixedInputs = new WeakSet<HTMLInputElement>();
const relativeCommandInputs = new WeakSet<HTMLInputElement>();
const relativePropertyUpdates = new WeakMap<HTMLInputElement, number>();
const mergeGroupingWindows = new WeakSet<object>();
const editorTopMenus = new WeakSet<HTMLElement>();
let activeSelectionState: SelectionState | null = null;
let colorPickerShortcutInstalled = false;
let nativeColorWheelDismissalInstalled = false;
let nativeColorWheelOpener: HTMLElement | null = null;
let nativeTexturePanelOpener: HTMLElement | null = null;
let editorPointerControlModified = false;
let editorPointerModified = false;
const pendingPaintHex = new Map<'color' | 'la', number>();
const editorHistoryShortcutKeys = new Set<string>();
// Tabler Icons "color-picker" (MIT): https://tabler.io/icons/icon/color-picker
const COLOR_PICKER_SVG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%23ebebeb' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M11 7l6 6'/%3E%3Cpath d='M4 16l11.7-11.7a1 1 0 0 1 1.4 0l2.6 2.6a1 1 0 0 1 0 1.4L8 20H4v-4'/%3E%3C/svg%3E";
const COLOR_PICKER_ICON = `url("${COLOR_PICKER_SVG}")`;
const COLOR_PICKER_CURSOR = `url("${COLOR_PICKER_SVG}") 4 20, crosshair`;
const COLOR_PICKER_CURSOR_PROPERTY = '--qolbox-editor-color-picker-cursor';

const callMethod = callNativeMethodSafely;

function setColorPickerActive(editor: HTMLElement, button: HTMLElement, active: boolean): void {
  editor.classList.toggle('qolboxColorPickerActive', active);
  button.classList.toggle('selected', active);
  button.setAttribute('aria-pressed', String(active));
  if (active) editor.style.setProperty(COLOR_PICKER_CURSOR_PROPERTY, COLOR_PICKER_CURSOR);
  else editor.style.removeProperty(COLOR_PICKER_CURSOR_PROPERTY);
}

function syncEditorToolCursor(editor: HTMLElement, sidebar: HTMLElement): void {
  const tool = sidebar.querySelector<HTMLElement>('.button.selected:not(.qolboxColorPicker)');
  editor.classList.toggle('qolboxEditorFillTool', Boolean(tool?.classList.contains('fill')));
  editor.classList.toggle(
    'qolboxEditorPrecisionTool',
    Boolean(tool && !tool.matches('.selectBody, .selectShape, .fill')),
  );
}

function installEditorColorPicker(): void {
  if (!nativeColorWheelDismissalInstalled) {
    nativeColorWheelDismissalInstalled = true;
    document.addEventListener('click', event => {
      const target = event.target instanceof Element ? event.target : null;
      const preview = target?.closest<HTMLElement>('.preview');
      if (preview) {
        nativeColorWheelOpener = preview;
        if (preview.classList.contains('bgTexPreview')) nativeTexturePanelOpener = preview;
        return;
      }

      const editor = document.querySelector<HTMLElement>('#editorContainer');
      const wheel = [...document.querySelectorAll<HTMLElement>('.reinvented-color-wheel')]
        .find(candidate => candidate.offsetParent);
      const wheelContainer = wheel?.closest<HTMLElement>('.colorWheelContainer, .bgColorWheel') ?? wheel;
      if (editor?.offsetParent && wheelContainer && target && !wheelContainer.contains(target)) {
        const backgroundClose = [...document.querySelectorAll<HTMLElement>('.bgColorWheel .crossButton')]
          .find(button => button.offsetParent);
        (backgroundClose ?? nativeColorWheelOpener)?.click();
      }
      const texturePanel = [...document.querySelectorAll<HTMLElement>('#editorContainer .textureContainer')]
        .find(candidate => candidate.offsetParent);
      if (editor?.offsetParent && texturePanel && target && !texturePanel.contains(target)) {
        (nativeTexturePanelOpener ?? editor.querySelector<HTMLElement>('.bgTexPreview'))?.click();
      }
    }, true);
  }

  if (!colorPickerShortcutInstalled) {
    colorPickerShortcutInstalled = true;
    window.addEventListener('keydown', event => {
      const key = event.key.toLowerCase();
      const active = document.activeElement;
      const editor = document.querySelector<HTMLElement>('#editorContainer');
      if (
        !event.ctrlKey && !event.metaKey ||
        key !== 'y' && key !== 'z' ||
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        (active instanceof HTMLElement && active.isContentEditable) ||
        !editor?.offsetParent
      ) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      editorHistoryShortcutKeys.add(key);
      [...editor.querySelectorAll<HTMLElement>('.toolsMenu .item')]
        .find(item => item.textContent?.trim() === (key === 'y' ? 'Redo' : 'Undo'))
        ?.click();
    }, true);
    window.addEventListener('keyup', event => {
      const key = event.key.toLowerCase();
      if (editorHistoryShortcutKeys.delete(key)) {
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }
      const active = document.activeElement;
      if (
        !['i', 'u', 'y'].includes(key) ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        (active instanceof HTMLElement && active.isContentEditable)
      ) return;
      const editor = document.querySelector<HTMLElement>('#editorContainer');
      if (!editor?.offsetParent) return;

      event.preventDefault();
      event.stopImmediatePropagation();
      const button = editor.querySelector<HTMLElement>(key === 'y' ? '.cap' : key === 'u' ? '.fill' : '.qolboxColorPicker');
      if (button?.offsetParent && (key !== 'i' || !button.classList.contains('selected'))) button.click();
    }, true);
  }

  for (const sidebar of document.querySelectorAll<HTMLElement>('#editorContainer .sideBar')) {
    installEditorHexInputs(sidebar);
    if (sidebar.querySelector('.qolboxColorPicker')) continue;
    const colorLabel = [...sidebar.querySelectorAll<HTMLElement>('.sideLabel')]
      .find(label => label.textContent?.trim() === 'Color');
    const editor = sidebar.closest<HTMLElement>('#editorContainer');
    const selectButton = sidebar.querySelector<HTMLElement>('.selectBody');
    if (!colorLabel || !editor || !selectButton) continue;

    const button = document.createElement('div');
    button.className = 'button qolboxColorPicker';
    button.style.backgroundImage = COLOR_PICKER_ICON;
    button.setAttribute('aria-label', 'Color Picker (I)');
    button.setAttribute('aria-pressed', 'false');
    const tooltip = document.createElement('div');
    tooltip.className = 'tooltip';
    tooltip.textContent = 'Color Picker (I)';
    button.appendChild(tooltip);
    colorLabel.before(button);

    button.addEventListener('click', () => {
      const activate = !button.classList.contains('selected');
      if (!selectButton.classList.contains('selected')) selectButton.click();
      if (activate) {
        sidebar.querySelectorAll('.button.selected').forEach(tool => tool.classList.remove('selected'));
      }
      setColorPickerActive(editor, button, activate);
      syncEditorToolCursor(editor, sidebar);
    });
    sidebar.addEventListener('pointerdown', event => {
      if (event.target instanceof Element && event.target.closest('.qolboxColorPicker') === button) return;
      setColorPickerActive(editor, button, false);
    }, true);
    new MutationObserver(() => {
      if (sidebar.querySelector('.button.selected:not(.qolboxColorPicker)')) {
        setColorPickerActive(editor, button, false);
      }
      syncEditorToolCursor(editor, sidebar);
    }).observe(sidebar, { attributeFilter: ['class'], attributes: true, subtree: true });
    syncEditorToolCursor(editor, sidebar);
  }
}

function installEditorTopMenuDismissal(): void {
  for (const menu of document.querySelectorAll<HTMLElement>(
    '#editorContainer .fileMenu, #editorContainer .toolsMenu, #editorContainer .settingsMenu',
  )) {
    if (editorTopMenus.has(menu)) continue;
    editorTopMenus.add(menu);
    menu.addEventListener('pointerleave', () => {
      const dropdown = menu.querySelector<HTMLElement>(':scope > .container');
      if (dropdown?.offsetParent) menu.click();
    });
  }
}

function parseHexColor(value: string): number | null {
  const match = /^#?([\da-f]{3}|[\da-f]{6})$/i.exec(value.trim());
  if (!match?.[1]) return null;
  const hex = match[1].length === 3
    ? [...match[1]].map(character => character.repeat(2)).join('')
    : match[1];
  return Number.parseInt(hex, 16);
}

function setHexInputValue(input: HTMLInputElement | null, colors: string[]): void {
  if (!input || document.activeElement === input) return;
  const unique = [...new Set(colors)];
  input.value = unique.length === 1 ? unique[0]!.toUpperCase() : '';
  input.dataset.qolboxValue = input.value;
  input.placeholder = unique.length > 1 ? 'Mixed' : '';
  input.removeAttribute('aria-invalid');
}

function previewColorHex(selector: string): string | null {
  const preview = document.querySelector<HTMLElement>(`#editorContainer ${selector}`);
  const match = preview && getComputedStyle(preview).backgroundColor.match(/[\d.]+/g);
  if (!match || match.length < 3) return null;
  return colorHex((Number(match[0]) << 16) | (Number(match[1]) << 8) | Number(match[2]));
}

function updatePaintHexInputsFromPreviews(): void {
  const fill = previewColorHex('.fillPreview');
  const stroke = previewColorHex('.strokeColorPreview');
  setHexInputValue(
    document.querySelector<HTMLInputElement>('#editorContainer .qolboxFillHex'),
    fill ? [fill] : [],
  );
  setHexInputValue(
    document.querySelector<HTMLInputElement>('#editorContainer .qolboxStrokeHex'),
    stroke ? [stroke] : [],
  );
}

function applyPaintHex(property: 'color' | 'la', color: number): boolean {
  const state = activeSelectionState;
  const paintTool = state && readNativeProperty(state.tool, 'Av');
  if (!state || !isNativeObject(paintTool)) {
    const preview = document.querySelector<HTMLElement>(
      `#editorContainer .${property === 'color' ? 'fillPreview' : 'strokeColorPreview'}`,
    );
    if (!preview) return false;
    preview.style.backgroundColor = colorHex(color)!;
    pendingPaintHex.set(property, color);
    return true;
  }
  const values = Object.fromEntries(getCopyableValues(paintTool));
  state.selecting = true;
  try {
    callMethod(paintTool, 'bk', [{ ...values, [property]: color }]);
  } finally {
    state.selecting = false;
  }
  for (const record of state.records) {
    const paint = getPaint(record);
    if (!paint || !Reflect.has(paint, property)) continue;
    setNativeReflectProperty(paint, property, color);
    callMethod(record.wrapper, 'fv', [paint]);
  }
  callMethod(state.tool, 'Eb');
  state.paintValues = getCopyableValues(paintTool);
  redrawSelection(state);
  updatePaintPreviews(state);
  return true;
}

function getActiveEditorContext(): {
  map: object;
  renderer: object;
  settings: object;
  state: SelectionState | null;
} | null {
  const renderers = getKnownFullscreenRenderers(window).filter(renderer =>
    getRendererView(renderer)?.parentElement?.id === 'editorContainer'
  );
  const renderer = renderers.find(candidate => getRendererView(candidate)?.parentElement?.offsetParent) ?? renderers[renderers.length - 1];
  if (!renderer) return null;
  const state = statesByRenderer.get(renderer) ?? null;
  const map = readNativeProperty(state?.tool, 'Bv') ?? getLastRendererDrawArguments(renderer)?.[0];
  const settings = readNativePath(map, ['settings', 0]);
  return isNativeObject(map) && isNativeObject(settings) ? { map, renderer, settings, state } : null;
}

function applyBackgroundHex(property: 'Kn' | 'Xn', color: number): boolean {
  const context = getActiveEditorContext();
  if (!context) return false;
  const { renderer, settings, state } = context;
  setNativeReflectProperty(settings, property, color);
  const label = property === 'Kn' ? 'Top Color' : 'Bot Color';
  const container = [...document.querySelectorAll<HTMLElement>('#editorContainer .paramContainer')]
    .find(candidate => candidate.querySelector('.label')?.textContent?.trim() === label);
  container?.querySelector<HTMLElement>('.paramColorBox')?.style.setProperty('background-color', colorHex(color)!);
  if (state) callMethod(state.tool, 'Eb');
  const draw = readNativeProperty(renderer, 'Dg');
  const args = getLastRendererDrawArguments(renderer);
  if (isNativeFunction(draw) && args) Reflect.apply(draw, renderer, args);
  callMethod(renderer, 'render');
  if (state) redrawSelection(state);
  return true;
}

function addHexInput(
  parent: Element,
  className: string,
  label: string,
  apply: (color: number) => boolean,
): HTMLInputElement {
  const input = document.createElement('input');
  input.className = `input qolboxHexInput ${className}`;
  input.type = 'text';
  input.maxLength = 7;
  input.placeholder = '';
  input.setAttribute('aria-label', `${label} hex color`);
  input.setAttribute('autocomplete', 'off');
  input.setAttribute('spellcheck', 'false');
  const commit = () => {
    const color = parseHexColor(input.value);
    if (color == null || !apply(color)) {
      input.setAttribute('aria-invalid', 'true');
      return;
    }
    input.value = colorHex(color)!.toUpperCase();
    input.dataset.qolboxValue = input.value;
    input.removeAttribute('aria-invalid');
  };
  input.addEventListener('change', commit);
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter') {
      event.preventDefault();
      input.blur();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      input.value = input.dataset.qolboxValue ?? '';
      input.blur();
    }
  });
  parent.appendChild(input);
  return input;
}

function installEditorHexInputs(sidebar: HTMLElement): void {
  for (const [selector, className, label, property] of [
    ['.fillPreview', 'qolboxFillHex', 'Fill', 'color'],
    ['.strokeColorPreview', 'qolboxStrokeHex', 'Stroke', 'la'],
  ] as const) {
    if (sidebar.querySelector(`.${className}`)) continue;
    const preview = sidebar.querySelector(selector);
    if (preview) {
      preview.classList.add('qolboxHexPreview');
      preview.after(addHexInput(sidebar, className, label, color => applyPaintHex(property, color)));
    }
  }
  for (const [label, className, property] of [
    ['Top Color', 'qolboxBackgroundTopHex', 'Kn'],
    ['Bot Color', 'qolboxBackgroundBottomHex', 'Xn'],
  ] as const) {
    if (sidebar.querySelector(`.${className}`)) continue;
    const container = [...sidebar.querySelectorAll<HTMLElement>('.paramContainer')]
      .find(candidate => candidate.querySelector('.label')?.textContent?.trim() === label);
    if (container) addHexInput(container, className, label, color => applyBackgroundHex(property, color));
  }
  if (activeSelectionState) updateHexInputs(activeSelectionState);
  else {
    updatePaintHexInputsFromPreviews();
    updateBackgroundHexInputs();
  }
}

function isColorPickerActive(): boolean {
  return Boolean(document.querySelector('#editorContainer.qolboxColorPickerActive .qolboxColorPicker.selected'));
}

function isSelectionOutlineTarget(state: SelectionState, event: unknown): boolean {
  const target = readNativeProperty(event, 'target');
  if (!isNativeObject(target)) return false;
  for (let current: unknown = target; isNativeObject(current); current = readNativeProperty(current, 'parent')) {
    if (current === state.nativeOutline) return true;
  }
  return false;
}

function isEditorBackgroundTarget(state: SelectionState, event: unknown): boolean {
  const target = readNativeProperty(event, 'target');
  if (!isNativeObject(target) || isSelectionOutlineTarget(state, event)) return false;
  return ['td', 'Ym', 'Vc', '_y'].every(property => readNativeProperty(target, property) == null);
}

function getSelection(tool: object): object[] | null {
  const selection = readNativeProperty(tool, 'vb');
  return Array.isArray(selection) ? selection as object[] : null;
}

function isSelectionTool(candidate: unknown): candidate is object {
  return Boolean(
    isNativeObject(candidate) &&
      Array.isArray(readNativeProperty(candidate, 'vb')) &&
      isNativeObject(readNativeProperty(candidate, 'Cb')) &&
      'wk' in candidate &&
      'gk' in candidate &&
      'yk' in candidate &&
      typeof readNativeProperty(candidate, 'ab') === 'function' &&
      typeof readNativeProperty(candidate, 'wb') === 'function' &&
      typeof readNativeProperty(candidate, 'Iv') === 'function' &&
      typeof readNativeProperty(candidate, 'Fv') === 'function'
  );
}

function getOriginalPointerEvent(event: unknown): unknown {
  return readNativeProperty(readNativeProperty(event, 'data'), 'originalEvent');
}

function hasSelectionModifier(event: unknown): boolean {
  const original = getOriginalPointerEvent(event);
  return Boolean(
    editorPointerModified ||
      readNativeProperty(event, 'ctrlKey') ||
      readNativeProperty(event, 'metaKey') ||
      readNativeProperty(event, 'shiftKey') ||
      readNativeProperty(original, 'ctrlKey') ||
      readNativeProperty(original, 'metaKey') ||
      readNativeProperty(original, 'shiftKey')
  );
}

function hasControlModifier(event: unknown): boolean {
  const original = getOriginalPointerEvent(event);
  return Boolean(
    editorPointerControlModified ||
      readNativeProperty(event, 'ctrlKey') ||
      readNativeProperty(event, 'metaKey') ||
      readNativeProperty(original, 'ctrlKey') ||
      readNativeProperty(original, 'metaKey')
  );
}

function wrapperMatchesModel(wrapper: object, model: object): boolean {
  return callMethod(wrapper, 'yv', [model]) === true;
}

function findWrapperRecord(records: SelectionRecord[], wrapper: object): SelectionRecord | null {
  return records.find(record => wrapperMatchesModel(wrapper, record.model)) ?? null;
}

function setRecords(state: SelectionState, records: SelectionRecord[]): void {
  const selection = getSelection(state.tool);
  if (!selection) return;
  selection.splice(0, selection.length, ...records.map(record => record.wrapper));
  state.records = records;
  if (state.specialBodyId != null && !records.some(record => Number(readNativeProperty(record.model, 'id')) === state.specialBodyId)) {
    state.specialBodyId = null;
  }
  records.forEach(record => installGroupOperations(state, record.wrapper));
}

function installGroupOperations(state: SelectionState, wrapper: object): void {
  installGroupCopy(state, wrapper);
  installGroupDelete(state, wrapper);
  installGroupRotation(state, wrapper);
}

function getBodyGroup(state: SelectionState, body: object): Set<object> | null {
  const bodies = readNativePath(state.tool, ['Bv', 'pl']);
  const id = Number(readNativeProperty(body, 'id'));
  const ids = state.bodyGroups.get(id);
  if (!ids || !Array.isArray(bodies)) return null;
  const group = [...ids].flatMap(memberId => bodies[memberId] ?? []);
  if (group.length !== ids.size) {
    ids.forEach(memberId => state.bodyGroups.delete(memberId));
    return null;
  }
  return group.length > 1 ? new Set(group) : null;
}

function mergeBodyGroups(state: SelectionState, ...bodies: object[]): Set<number> {
  const ids = bodies.map(body => Number(readNativeProperty(body, 'id'))).filter(Number.isInteger);
  const group = new Set(ids.flatMap(id => [...(state.bodyGroups.get(id) ?? [id])]));
  group.forEach(id => state.bodyGroups.set(id, group));
  return group;
}

function forgetGroupedBody(state: SelectionState, body: object): void {
  const id = Number(readNativeProperty(body, 'id'));
  const group = state.bodyGroups.get(id);
  if (!group) return;
  state.bodyGroups.delete(id);
  group.delete(id);
  if (group.size < 2) group.forEach(memberId => state.bodyGroups.delete(memberId));
}

function getBodyRecords(state: SelectionState, bodies: object[]): SelectionRecord[] {
  const wanted = new Set(bodies);
  const records = new Map<object, SelectionRecord>();
  const selectedBody = readNativeProperty(state.tool, 'yk');
  const shapeMode = readNativeProperty(state.tool, 'wk');
  setNativeReflectProperty(state.tool, 'yk', -1);
  setNativeReflectProperty(state.tool, 'wk', false);
  try {
    for (const target of getSelectionTargets(state)) {
      const record = selectNatively(state, { data: { global: { x: 0, y: 0 } }, target }, true, target, true);
      if (record?.type === 'body' && wanted.has(record.model)) records.set(record.model, record);
    }
  } finally {
    setNativeReflectProperty(state.tool, 'yk', selectedBody);
    setNativeReflectProperty(state.tool, 'wk', shapeMode);
  }
  return bodies.flatMap(body => records.get(body) ?? []);
}

function expandBodyGroup(state: SelectionState, record: SelectionRecord): SelectionRecord[] {
  const group = record.type === 'body' ? getBodyGroup(state, record.model) : null;
  return group ? getBodyRecords(state, [record.model, ...[...group].filter(body => body !== record.model)]) : [record];
}

function getCompleteBodyGroup(state: SelectionState, records = state.records): SelectionRecord[] | null {
  const group = records[0]?.type === 'body' ? getBodyGroup(state, records[0].model) : null;
  return group && group.size === records.length && records.every(record => record.type === 'body' && group.has(record.model))
    ? records
    : null;
}

function getBodyGroupCenter(state: SelectionState, records: SelectionRecord[]): { x: number; y: number } | null {
  const positions = records.map(record => getRecordPosition(state, record));
  if (positions.some(position => !position)) return null;
  return {
    x: positions.reduce((sum, position) => sum + position!.x, 0) / positions.length,
    y: positions.reduce((sum, position) => sum + position!.y, 0) / positions.length,
  };
}

function orbitBodies(records: SelectionRecord[], center: { x: number; y: number }, angle: number): void {
  for (const record of records) {
    const position = rotatePoint({
      x: Number(readNativeProperty(record.model, 'x')) - center.x,
      y: Number(readNativeProperty(record.model, 'y')) - center.y,
    }, angle);
    setNativeReflectProperty(record.model, 'x', center.x + position.x);
    setNativeReflectProperty(record.model, 'y', center.y + position.y);
  }
}

function installGroupRotation(state: SelectionState, wrapper: object): void {
  if (originalRotateByWrapper.has(wrapper)) return;
  const original = readNativeProperty(wrapper, 'Ib');
  const body = readNativeProperty(wrapper, 'pv');
  const bodies = readNativePath(state.tool, ['Bv', 'pl']);
  if (!isNativeFunction(original) || !isNativeObject(body) || !Array.isArray(bodies) || !bodies.includes(body)) return;
  const wrapped = function (this: unknown, value: unknown) {
    const group = getBodyGroup(state, body);
    const angle = -Number(value);
    if (
      state.specialBodyId === Number(readNativeProperty(body, 'id')) ||
      !group ||
      !Number.isFinite(angle) ||
      !angle
    ) return Reflect.apply(original, this, [value]);
    const members = [...group];
    const center = {
      x: members.reduce((sum, member) => sum + Number(readNativeProperty(member, 'x')), 0) / members.length,
      y: members.reduce((sum, member) => sum + Number(readNativeProperty(member, 'y')), 0) / members.length,
    };
    for (const member of members) {
      const position = rotatePoint({
        x: Number(readNativeProperty(member, 'x')) - center.x,
        y: Number(readNativeProperty(member, 'y')) - center.y,
      }, angle);
      setNativeReflectProperty(member, 'x', center.x + position.x);
      setNativeReflectProperty(member, 'y', center.y + position.y);
      if (member !== body) {
        const memberAngle = Number(readNativeProperty(member, 'angle')) || 0;
        setNativeReflectProperty(member, 'angle', memberAngle + angle);
      }
    }
    return Reflect.apply(original, this, [value]);
  };
  if (setNativeReflectProperty(wrapper, 'Ib', wrapped)) originalRotateByWrapper.set(wrapper, original);
}

function installGroupCopy(state: SelectionState, wrapper: object): void {
  if (originalCopyByWrapper.has(wrapper)) return;
  const original = readNativeProperty(wrapper, 'bv');
  if (!isNativeFunction(original)) return;
  const wrapped = function (this: unknown, ...args: unknown[]) {
    if (state.records.length < 2 || state.records[0]?.wrapper !== this) {
      return Reflect.apply(original, this, args);
    }
    const copies = state.records.map(record => {
      const copy = originalCopyByWrapper.get(record.wrapper) ?? readNativeProperty(record.wrapper, 'bv');
      return isNativeFunction(copy) ? Reflect.apply(copy, record.wrapper, args) : undefined;
    });
    if (!copies.every(isNativeObject)) return undefined;
    const records = [...state.records];
    const group = records[0]?.type === 'body' ? getBodyGroup(state, records[0].model) : null;
    const preserveGroup = Boolean(group && group.size === records.length && records.every(record => group.has(record.model)));
    return {
      vv(map: unknown): void {
        if (!isNativeObject(map)) return;
        const before = new Set(getEditorModels(map));
        copies.forEach((copy, index) => {
          const position = getRecordPosition(state, records[index]!);
          callMethod(copy, 'vv', [map, position && { x: position.x + 1, y: position.y + 1 }, -1]);
        });
        const inserted = getEditorModels(map).filter(model => !before.has(model));
        callMethod(state.tool, 'Eb');
        requestAnimationFrame(() => selectInsertedModels(state, inserted, preserveGroup));
      },
    };
  };
  if (setNativeReflectProperty(wrapper, 'bv', wrapped)) originalCopyByWrapper.set(wrapper, original);
}

function installGroupDelete(state: SelectionState, wrapper: object): void {
  if (originalDeleteByWrapper.has(wrapper)) return;
  const original = readNativeProperty(wrapper, 'delete');
  if (!isNativeFunction(original)) return;
  const wrapped = function (this: unknown, ...args: unknown[]) {
    const records = [...state.records];
    if (state.records.length < 2 || state.records[0]?.wrapper !== this) {
      const result = Reflect.apply(original, this, args);
      const record = records.find(candidate => candidate.wrapper === this);
      if (record?.type === 'body') forgetGroupedBody(state, record.model);
      return result;
    }
    let result: unknown;
    for (const record of records) {
      const remove = originalDeleteByWrapper.get(record.wrapper) ?? readNativeProperty(record.wrapper, 'delete');
      if (isNativeFunction(remove)) result = Reflect.apply(remove, record.wrapper, args);
    }
    records.filter(record => record.type === 'body').forEach(record => forgetGroupedBody(state, record.model));
    return result;
  };
  if (setNativeReflectProperty(wrapper, 'delete', wrapped)) originalDeleteByWrapper.set(wrapper, original);
}

function inferSelectionRecord(state: SelectionState, wrapper: object): SelectionRecord | null {
  const existing = state.records.find(record =>
    record.wrapper === wrapper || wrapperMatchesModel(wrapper, record.model)
  );
  if (existing) return { ...existing, wrapper };

  const model = readNativeProperty(wrapper, 'pv');
  const bodies = readNativeProperty(readNativeProperty(state.tool, 'Bv'), 'pl');
  if (!isNativeObject(model) || !Array.isArray(bodies)) return null;
  if (bodies.includes(model)) return { model, type: 'body', wrapper };
  if (bodies.some(body => {
    const shapes = readNativeProperty(body, 'Sa');
    return Array.isArray(shapes) && shapes.includes(model);
  })) return { model, type: 'shape', wrapper };
  return null;
}

function syncRecords(state: SelectionState): boolean {
  const selection = getSelection(state.tool);
  if (!selection?.length) {
    const changed = state.records.length > 0;
    state.records = [];
    return changed;
  }
  const records = selection.flatMap(wrapper => inferSelectionRecord(state, wrapper) ?? []);
  const map = readNativeProperty(state.tool, 'Bv');
  if (isNativeObject(map)) {
    const models = new Set(getEditorModels(map));
    if (records.some(record => !models.has(record.model))) {
      clearEditorSelection(state);
      return true;
    }
  }
  const changed = records.length !== state.records.length || records.some((record, index) =>
    record.wrapper !== state.records[index]?.wrapper || record.model !== state.records[index]?.model
  );
  state.records = records;
  if (state.specialBodyId != null && !records.some(record => Number(readNativeProperty(record.model, 'id')) === state.specialBodyId)) {
    state.specialBodyId = null;
  }
  records.forEach(record => installGroupOperations(state, record.wrapper));
  return changed;
}

function getRecordConstructor(record: SelectionRecord): unknown {
  return readNativeReflectProperty(record.model, 'constructor');
}

function getEditorModels(map: object): object[] {
  const models = Reflect.ownKeys(map).flatMap(key => {
    const value = readNativeReflectProperty(map, key);
    return Array.isArray(value) ? value.filter(isNativeObject) : [];
  });
  return [...models, ...models.flatMap(model => {
    const shapes = readNativeProperty(model, 'Sa');
    return Array.isArray(shapes) ? shapes.filter(isNativeObject) : [];
  })];
}

function getRecordPosition(state: SelectionState, record: SelectionRecord): { x: number; y: number } | null {
  let model = record.model;
  if (record.type === 'shape') {
    const bodies = readNativePath(state.tool, ['Bv', 'pl']);
    const parent = Array.isArray(bodies)
      ? bodies.find(body => (readNativeProperty(body, 'Sa') as unknown[])?.includes(record.model))
      : null;
    if (isNativeObject(parent)) model = parent;
  }
  const x = Number(readNativeProperty(model, 'x'));
  const y = Number(readNativeProperty(model, 'y'));
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
}

function getCompatibleRecords(state: SelectionState): SelectionRecord[] {
  const [primary] = state.records;
  if (!primary) return [];
  const recordConstructor = getRecordConstructor(primary);
  const shapeKind = readNativeProperty(primary.model, 'na');
  const objectKind = readNativeProperty(primary.model, 'type');
  return state.records.filter(record =>
    record.type === primary.type &&
    getRecordConstructor(record) === recordConstructor &&
    Object.is(readNativeProperty(record.model, 'na'), shapeKind) &&
    Object.is(readNativeProperty(record.model, 'type'), objectKind)
  );
}

function getPaint(record: SelectionRecord): object | null {
  if (record.type === 'shape') return record.model;
  const shapes = readNativeProperty(readNativeProperty(record.wrapper, 'pv'), 'Sa');
  const paint = Array.isArray(shapes) ? shapes[0] : null;
  return isNativeObject(paint) ? paint : null;
}

function getPaintToolInput(paint: object): object {
  return readNativeProperty(paint, 'aa') == null
    ? { ...Object.fromEntries(getCopyableValues(paint)), aa: 0 }
    : paint;
}

function getRenderedView(state: SelectionState, record: SelectionRecord): unknown {
  if (record.type === 'body') {
    return callMethod(
      readNativeProperty(state.renderer, 'pg'),
      'Od',
      [readNativeProperty(record.model, 'id')]
    );
  }
  return callMethod(state.renderer, '$g', [readNativeProperty(state.tool, 'Bv'), record.model]);
}

function getOutlineMode(record: SelectionRecord): OutlineMode {
  return record.type === 'body' || record.type === 'shape' ? 'rendered' : 'bounds';
}

function renderedShapeContainsPoint(state: SelectionState, record: SelectionRecord, event: unknown): boolean {
  if (getOutlineMode(record) !== 'rendered') return true;
  const point = getEventPoint(event);
  const visual = readNativeProperty(getRenderedView(state, record), 'Ic');
  const parent = readNativeProperty(state.nativeOutline, 'parent');
  const parentTransform = readNativeProperty(parent, 'worldTransform');
  if (!point || !isNativeObject(visual) || !isNativeObject(parent) || !isNativeObject(parentTransform)) return true;
  const local = callMethod(parentTransform, 'applyInverse', [point]);
  const x = Number(readNativeProperty(local, 'x'));
  const y = Number(readNativeProperty(local, 'y'));
  if (![x, y].every(Number.isFinite)) return true;
  const contours = getRenderedPolygonContours(
    visual,
    parent,
    Array.isArray(readNativeProperty(readNativeProperty(record.wrapper, 'pv'), 'Sa')),
  );
  return !contours.length || contours.some(points => polygonContainsPoint(points, x, y));
}

function refreshWrapperViews(state: SelectionState): boolean {
  let changed = false;
  for (const record of state.records) {
    const view = getRenderedView(state, record);
    if (isNativeObject(view) && callMethod(record.wrapper, 'Bb') !== view) {
      callMethod(record.wrapper, 'gv', [view]);
      changed = true;
    }
  }
  return changed;
}

function readBounds(source: unknown, method = 'getBounds', args: unknown[] = [false]): Bounds | null {
  const bounds = callMethod(source, method, args);
  if (!isNativeObject(bounds)) return null;
  const x = Number(readNativeProperty(bounds, 'x'));
  const y = Number(readNativeProperty(bounds, 'y'));
  const width = Number(readNativeProperty(bounds, 'width'));
  const height = Number(readNativeProperty(bounds, 'height'));
  return [x, y, width, height].every(Number.isFinite) ? { height, width, x, y } : null;
}

function getWrapperBounds(wrapper: object): Bounds | null {
  return readBounds(readNativeProperty(callMethod(wrapper, 'Bb'), 'Ic'));
}

function getRenderedPolygonContours(
  visual: unknown,
  parent: object,
  requireEveryGraphic: boolean,
): number[][] {
  const parentTransform = readNativeProperty(parent, 'worldTransform');
  if (!isNativeObject(visual) || !isNativeObject(parentTransform)) return [];
  const contours: number[][] = [];
  let unsupportedShape = false;
  const visit = (display: unknown) => {
    if (!isNativeObject(display)) return;
    const transform = readNativeProperty(display, 'worldTransform');
    const data = readNativeProperty(readNativeProperty(display, 'geometry'), 'graphicsData');
    if (Array.isArray(data)) {
      for (const item of data) {
        const points = readNativePath(item, ['shape', 'points']);
        if (!Array.isArray(points) || points.length < 6 || points.length % 2) {
          unsupportedShape = true;
          continue;
        }
        if (!isNativeObject(transform)) {
          unsupportedShape = true;
          continue;
        }
        const transformed = Array.from({ length: points.length / 2 }).flatMap((_, index) => {
          const worldPoint = callMethod(transform, 'apply', [{
            x: Number(points[index * 2]),
            y: Number(points[index * 2 + 1]),
          }]);
          const parentPoint = callMethod(parentTransform, 'applyInverse', [worldPoint]);
          return [Number(readNativeProperty(parentPoint, 'x')), Number(readNativeProperty(parentPoint, 'y'))];
        });
        const contour = transformed.every(Number.isFinite) ? transformed : [];
        if (contour.length) contours.push(contour);
        else unsupportedShape = true;
      }
    }
    const children = readNativeProperty(display, 'children');
    if (Array.isArray(children)) children.forEach(visit);
  };
  visit(visual);
  return unsupportedShape && requireEveryGraphic ? [] : contours;
}

function getWrapperOutlineGeometry(wrapper: object, parent: object, mode: OutlineMode): OutlineGeometry | null {
  const display = callMethod(wrapper, 'Bb');
  const visual = readNativeProperty(display, 'Ic');
  callMethod(visual, 'getBounds', [false]);
  const bounds = readBounds(visual, 'getLocalBounds', []);
  const worldTransform = readNativeProperty(visual, 'worldTransform');
  const parentTransform = readNativeProperty(parent, 'worldTransform');
  if (!bounds || !isNativeObject(worldTransform) || !isNativeObject(parentTransform)) return null;

  const transform = (point: { x: number; y: number }) =>
    callMethod(parentTransform, 'applyInverse', [callMethod(worldTransform, 'apply', [point])]);
  const center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
  const centerPoint = transform(center);
  const xPoint = transform({ x: center.x + 1, y: center.y });
  const yPoint = transform({ x: center.x, y: center.y + 1 });
  if (![centerPoint, xPoint, yPoint].every(isNativeObject)) return null;
  const centerX = Number(readNativeProperty(centerPoint, 'x'));
  const centerY = Number(readNativeProperty(centerPoint, 'y'));
  const xVector = {
    x: Number(readNativeProperty(xPoint, 'x')) - centerX,
    y: Number(readNativeProperty(xPoint, 'y')) - centerY,
  };
  const xScale = Math.hypot(xVector.x, xVector.y);
  const yScale = Math.hypot(Number(readNativeProperty(yPoint, 'x')) - centerX, Number(readNativeProperty(yPoint, 'y')) - centerY);
  if (![centerX, centerY, xScale, yScale].every(Number.isFinite) || xScale <= 0 || yScale <= 0) return null;

  const halfWidth = bounds.width / 2 + EDITOR_OUTLINE_PADDING_PX / xScale;
  const halfHeight = bounds.height / 2 + EDITOR_OUTLINE_PADDING_PX / yScale;
  const corners: Array<[number, number]> = [
    [-halfWidth, -halfHeight],
    [halfWidth, -halfHeight],
    [halfWidth, halfHeight],
    [-halfWidth, halfHeight],
  ];
  const points = corners.flatMap(([offsetX, offsetY]) => {
    const point = transform({ x: center.x + offsetX, y: center.y + offsetY });
    return [Number(readNativeProperty(point, 'x')), Number(readNativeProperty(point, 'y'))];
  });
  const shapeContours = mode === 'rendered'
    ? getRenderedPolygonContours(
        visual,
        parent,
        Array.isArray(readNativeProperty(readNativeProperty(wrapper, 'pv'), 'Sa')),
      )
    : [];
  return {
    bounds,
    center: { x: centerX, y: centerY },
    contours: shapeContours
      .map(points => offsetPolygon(points, EDITOR_OUTLINE_PADDING_PX))
      .filter(points => points.length >= 6),
    points,
    rotation: Math.atan2(xVector.y, xVector.x),
    scale: { x: xScale, y: yScale },
  };
}

function mirrorNumber(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) ? -number : null;
}

function mirrorProperty(model: object, property: PropertyKey): void {
  const value = mirrorNumber(readNativeProperty(model, property));
  if (value != null) setNativeReflectProperty(model, property, value);
}

function mirrorPoint(point: unknown, axis: MirrorAxis): void {
  if (!isNativeObject(point)) return;
  mirrorProperty(point, axis === 'horizontal' ? 'x' : 'y');
}

function mirrorShape(shape: object, axis: MirrorAxis): void {
  mirrorPoint(shape, axis);
  const vertices = readNativeProperty(shape, 'ca');
  if (!Array.isArray(vertices)) return;
  vertices.forEach(vertex => mirrorPoint(vertex, axis));
  vertices.reverse();
}

function mirrorDirectionalProperties(model: object, axis: MirrorAxis): void {
  for (const property of axis === 'horizontal' ? ['o', 'Or', 'Dr'] : ['l', 'Rr', 'Lr']) {
    if (Reflect.has(model, property)) mirrorProperty(model, property);
  }
  for (const property of ['angularVelocity', 'Ur']) {
    if (Reflect.has(model, property)) mirrorProperty(model, property);
  }
}

function setReflectedPosition(model: object, axis: MirrorAxis, center: { x: number; y: number }): void {
  const property = axis === 'horizontal' ? 'x' : 'y';
  const value = Number(readNativeProperty(model, property));
  if (Number.isFinite(value)) setNativeReflectProperty(model, property, 2 * center[property] - value);
}

function getParentBody(state: SelectionState, shape: object): object | null {
  const bodies = readNativePath(state.tool, ['Bv', 'pl']);
  return Array.isArray(bodies)
    ? bodies.find(body => (readNativeProperty(body, 'Sa') as unknown[])?.includes(shape)) ?? null
    : null;
}

function reflectWorldPoint(
  point: { x: number; y: number },
  axis: MirrorAxis,
  center: { x: number; y: number },
): { x: number; y: number } {
  return axis === 'horizontal'
    ? { x: 2 * center.x - point.x, y: point.y }
    : { x: point.x, y: 2 * center.y - point.y };
}

function mirrorSelectedShape(
  state: SelectionState,
  shape: object,
  axis: MirrorAxis,
  center: { x: number; y: number },
): void {
  const body = getParentBody(state, shape);
  if (!body) return;
  const bodyPosition = {
    x: Number(readNativeProperty(body, 'x')),
    y: Number(readNativeProperty(body, 'y')),
  };
  const angle = Number(readNativeProperty(body, 'angle')) || 0;
  const localPosition = {
    x: Number(readNativeProperty(shape, 'x')) || 0,
    y: Number(readNativeProperty(shape, 'y')) || 0,
  };
  const worldPosition = rotatePoint(localPosition, angle);
  const reflectedPosition = reflectWorldPoint({
    x: bodyPosition.x + worldPosition.x,
    y: bodyPosition.y + worldPosition.y,
  }, axis, center);
  const nextLocal = rotatePoint({
    x: reflectedPosition.x - bodyPosition.x,
    y: reflectedPosition.y - bodyPosition.y,
  }, -angle);
  setNativeReflectProperty(shape, 'x', nextLocal.x);
  setNativeReflectProperty(shape, 'y', nextLocal.y);

  const vertices = readNativeProperty(shape, 'ca');
  if (!Array.isArray(vertices)) return;
  for (const vertex of vertices) {
    if (!isNativeObject(vertex)) continue;
    const local = {
      x: Number(readNativeProperty(vertex, 'x')),
      y: Number(readNativeProperty(vertex, 'y')),
    };
    const world = rotatePoint(local, angle);
    const reflected = rotatePoint(axis === 'horizontal' ? { x: -world.x, y: world.y } : { x: world.x, y: -world.y }, -angle);
    setNativeReflectProperty(vertex, 'x', reflected.x);
    setNativeReflectProperty(vertex, 'y', reflected.y);
  }
  vertices.reverse();
}

function getBodyById(state: SelectionState, id: unknown): object | null {
  const bodies = readNativePath(state.tool, ['Bv', 'pl']);
  return Array.isArray(bodies)
    ? bodies.find(body => readNativeProperty(body, 'id') === id) ?? null
    : null;
}

function getJointPointWorldPosition(
  state: SelectionState,
  model: object,
  property: 'Oa' | 'Ra' | 'Va',
): { x: number; y: number } | null {
  const point = readNativeProperty(model, property);
  if (!isNativeObject(point)) return null;
  const local = { x: Number(readNativeProperty(point, 'x')), y: Number(readNativeProperty(point, 'y')) };
  if (![local.x, local.y].every(Number.isFinite)) return null;
  const bodyId = property === 'Oa' ? readNativeProperty(model, 'Da') : property === 'Ra' ? readNativeProperty(model, 'La') : -1;
  const body = getBodyById(state, bodyId);
  if (!body) return local;
  const rotated = rotatePoint(local, Number(readNativeProperty(body, 'angle')) || 0);
  return {
    x: Number(readNativeProperty(body, 'x')) + rotated.x,
    y: Number(readNativeProperty(body, 'y')) + rotated.y,
  };
}

function setJointPointWorldPosition(
  state: SelectionState,
  model: object,
  property: 'Oa' | 'Ra' | 'Va',
  world: { x: number; y: number },
): void {
  const point = readNativeProperty(model, property);
  if (!isNativeObject(point)) return;
  const bodyId = property === 'Oa' ? readNativeProperty(model, 'Da') : property === 'Ra' ? readNativeProperty(model, 'La') : -1;
  const body = getBodyById(state, bodyId);
  const local = body
    ? rotatePoint({
        x: world.x - Number(readNativeProperty(body, 'x')),
        y: world.y - Number(readNativeProperty(body, 'y')),
      }, -(Number(readNativeProperty(body, 'angle')) || 0))
    : world;
  setNativeReflectProperty(point, 'x', local.x);
  setNativeReflectProperty(point, 'y', local.y);
}

function getBodyMirrorBounds(body: object, shapes: object[]): Bounds | null {
  const x = Number(readNativeProperty(body, 'x'));
  const y = Number(readNativeProperty(body, 'y'));
  if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
  const angle = Number(readNativeProperty(body, 'angle')) || 0;
  const points = shapes.flatMap(shape => {
    const shapePosition = {
      x: Number(readNativeProperty(shape, 'x')) || 0,
      y: Number(readNativeProperty(shape, 'y')) || 0,
    };
    const vertices = readNativeProperty(shape, 'ca');
    const polygon = Array.isArray(vertices) ? vertices.flatMap(vertex => {
      const vertexX = Number(readNativeProperty(vertex, 'x'));
      const vertexY = Number(readNativeProperty(vertex, 'y'));
      if (!Number.isFinite(vertexX) || !Number.isFinite(vertexY)) return [];
      const point = rotatePoint({ x: shapePosition.x + vertexX, y: shapePosition.y + vertexY }, angle);
      return [{ x: x + point.x, y: y + point.y }];
    }) : [];
    if (polygon.length) return polygon;
    const center = rotatePoint(shapePosition, angle);
    const radius = Math.abs(Number(readNativeProperty(shape, 'ra')));
    return Number.isFinite(radius) && radius > 0
      ? [{ x: x + center.x - radius, y: y + center.y - radius }, { x: x + center.x + radius, y: y + center.y + radius }]
      : [{ x: x + center.x, y: y + center.y }];
  });
  return getPointBounds(points.length ? points : [{ x, y }]);
}

function getJointPointProperties(type: string): Array<'Oa' | 'Ra' | 'Va'> {
  return type === 'lineJoint'
    ? ['Oa', 'Ra', 'Va']
    : type === 'springJoint' || type === 'rotateJoint' ? ['Oa', 'Ra'] : [];
}

function getMirrorBounds(state: SelectionState, record: SelectionRecord): Bounds | null {
  if (record.type === 'body') {
    const shapes = readNativeProperty(record.model, 'Sa');
    return getBodyMirrorBounds(record.model, Array.isArray(shapes) ? shapes.filter(isNativeObject) : []);
  }
  if (record.type === 'shape') {
    const body = getParentBody(state, record.model);
    return body ? getBodyMirrorBounds(body, [record.model]) : null;
  }
  const jointPoints = getJointPointProperties(record.type)
    .flatMap(property => getJointPointWorldPosition(state, record.model, property) ?? []);
  if (jointPoints.length) return getPointBounds(jointPoints);
  const x = Number(readNativeProperty(record.model, 'x'));
  const y = Number(readNativeProperty(record.model, 'y'));
  return Number.isFinite(x) && Number.isFinite(y) ? { height: 0, width: 0, x, y } : null;
}

function getMirrorCenter(state: SelectionState, records: SelectionRecord[]): { x: number; y: number } | null {
  const bounds = records.map(record => getMirrorBounds(state, record));
  if (!bounds.length || bounds.some(value => !value)) return null;
  const present = bounds.filter((value): value is Bounds => value != null);
  return {
    x: (Math.min(...present.map(value => value.x)) + Math.max(...present.map(value => value.x + value.width))) / 2,
    y: (Math.min(...present.map(value => value.y)) + Math.max(...present.map(value => value.y + value.height))) / 2,
  };
}

function mirrorSelection(state: SelectionState, axis: MirrorAxis): boolean {
  syncRecords(state);
  const records = [...state.records];
  const center = getMirrorCenter(state, records);
  if (!center) return false;
  callMethod(state.tool, 'Eb');

  const bodyRecords = records.filter(record => record.type === 'body');
  const selectedBodies = new Set(bodyRecords.map(record => record.model));
  const jointPoints = new Map<object, Map<'Oa' | 'Ra' | 'Va', { x: number; y: number }>>();
  for (const record of records) {
    const properties = getJointPointProperties(record.type);
    if (!properties.length || jointPoints.has(record.model)) continue;
    const points = new Map<'Oa' | 'Ra' | 'Va', { x: number; y: number }>();
    for (const property of properties) {
      const point = getJointPointWorldPosition(state, record.model, property);
      if (point) points.set(property, point);
    }
    jointPoints.set(record.model, points);
  }

  for (const record of bodyRecords) {
    setReflectedPosition(record.model, axis, center);
    const shapes = readNativeProperty(record.model, 'Sa');
    if (Array.isArray(shapes)) shapes.filter(isNativeObject).forEach(shape => mirrorShape(shape, axis));
    mirrorProperty(record.model, 'angle');
    mirrorDirectionalProperties(record.model, axis);
  }

  const mirrored = new Set<object>(selectedBodies);
  for (const record of records) {
    if (mirrored.has(record.model)) continue;
    if (record.type === 'shape') {
      const parent = getParentBody(state, record.model);
      if (!parent || selectedBodies.has(parent)) continue;
      mirrorSelectedShape(state, record.model, axis, center);
    } else if (!jointPoints.has(record.model)) {
      setReflectedPosition(record.model, axis, center);
      if (Reflect.has(record.model, 'angle')) {
        const angle = Number(readNativeProperty(record.model, 'angle')) || 0;
        setNativeReflectProperty(record.model, 'angle', axis === 'horizontal' ? Math.PI - angle : -angle);
      }
      mirrorDirectionalProperties(record.model, axis);
    }
    mirrored.add(record.model);
  }

  for (const [model, points] of jointPoints) {
    for (const [property, point] of points) {
      setJointPointWorldPosition(state, model, property, reflectWorldPoint(point, axis, center));
    }
  }

  callMethod(state.tool, 'Eb');
  restoreSelection(state, records);
  return true;
}

function installEditorMirrorMenu(windowObject: unknown): void {
  const toolsMenu = document.querySelector<HTMLElement>('#editorContainer .toolsMenu');
  const container = toolsMenu?.querySelector<HTMLElement>(':scope > .container');
  if (!toolsMenu || !container || container.querySelector('.qolboxMirrorItem')) return;

  const item = document.createElement('div');
  item.className = 'item qolboxMirrorItem';
  item.dataset.qolboxIcon = 'mirror';
  item.textContent = 'Mirror';
  item.setAttribute('aria-label', 'Mirror');
  item.setAttribute('aria-haspopup', 'menu');
  item.setAttribute('aria-expanded', 'false');
  const arrow = document.createElement('span');
  arrow.className = 'qolboxMirrorArrow';
  arrow.textContent = '›';
  item.appendChild(arrow);
  const submenu = document.createElement('div');
  submenu.className = 'container qolboxMirrorSubmenu';
  submenu.setAttribute('role', 'menu');
  for (const [label, axis] of [['Horizontal', 'horizontal'], ['Vertical', 'vertical']] as const) {
    const action = document.createElement('div');
    action.className = 'item';
    action.textContent = label;
    action.addEventListener('click', () => {
      for (const renderer of getKnownFullscreenRenderers(windowObject)) {
        const state = statesByRenderer.get(renderer);
        if (state && mirrorSelection(state, axis)) break;
      }
      item.classList.remove('qolboxMirrorOpen');
      item.setAttribute('aria-expanded', 'false');
    });
    submenu.appendChild(action);
  }
  item.appendChild(submenu);
  item.addEventListener('click', event => {
    if (event.target !== item) return;
    event.preventDefault();
    event.stopPropagation();
    const open = item.classList.toggle('qolboxMirrorOpen');
    item.setAttribute('aria-expanded', String(open));
  });
  new MutationObserver(() => {
    if (container.style.display === 'none') {
      item.classList.remove('qolboxMirrorOpen');
      item.setAttribute('aria-expanded', 'false');
    }
  }).observe(container, { attributeFilter: ['style'], attributes: true });
  const resetZoom = container.querySelector('.item:nth-child(2)');
  if (resetZoom) resetZoom.before(item);
  else container.appendChild(item);
}

function toOutlineLocalPoint(geometry: OutlineGeometry, x: number, y: number): { x: number; y: number } {
  const cosine = Math.cos(geometry.rotation);
  const sine = Math.sin(geometry.rotation);
  const offsetX = x - geometry.center.x;
  const offsetY = y - geometry.center.y;
  return {
    x: (offsetX * cosine + offsetY * sine) / geometry.scale.x,
    y: (-offsetX * sine + offsetY * cosine) / geometry.scale.y,
  };
}

function getOutlineTopRight(geometry: OutlineGeometry): {
  local: { x: number; y: number };
  parent: { x: number; y: number };
} {
  if (geometry.contours.length) {
    return geometry.contours.flatMap(points =>
      Array.from({ length: points.length / 2 }, (_, index) => {
        const parent = { x: points[index * 2] ?? 0, y: points[index * 2 + 1] ?? 0 };
        return { local: toOutlineLocalPoint(geometry, parent.x, parent.y), parent };
      })
    ).reduce((best, point) =>
      point.local.x - point.local.y > best.local.x - best.local.y ? point : best
    );
  }

  const parent = { x: geometry.points[2] ?? 0, y: geometry.points[3] ?? 0 };
  return { local: toOutlineLocalPoint(geometry, parent.x, parent.y), parent };
}

function getLabelPlacement(geometry: OutlineGeometry): { rotation: number; x: number; y: number } {
  if (!geometry.contours.length) {
    const anchor = getOutlineTopRight(geometry).parent;
    return {
      rotation: geometry.rotation,
      x: anchor.x - 16 * Math.cos(geometry.rotation) + 13 * Math.sin(geometry.rotation),
      y: anchor.y - 16 * Math.sin(geometry.rotation) - 13 * Math.cos(geometry.rotation),
    };
  }

  const candidates = geometry.contours.flatMap((points, contourIndex) =>
    Array.from({ length: points.length / 2 }, (_, index) => {
      const parent = { x: points[index * 2] ?? 0, y: points[index * 2 + 1] ?? 0 };
      return { contourIndex, index, local: toOutlineLocalPoint(geometry, parent.x, parent.y), parent };
    })
  );
  const anchor = candidates.reduce((best, point) =>
    point.local.x - point.local.y > best.local.x - best.local.y ? point : best
  );
  const contour = geometry.contours[anchor.contourIndex]!;
  const pointCount = contour.length / 2;
  const neighbours = [
    (anchor.index + pointCount - 1) % pointCount,
    (anchor.index + 1) % pointCount,
  ].map(index => {
    const parent = { x: contour[index * 2] ?? 0, y: contour[index * 2 + 1] ?? 0 };
    return { local: toOutlineLocalPoint(geometry, parent.x, parent.y), parent };
  });
  const neighbour = neighbours.reduce((best, point) =>
    Math.abs(point.local.x - anchor.local.x) > Math.abs(best.local.x - anchor.local.x) ? point : best
  );
  let rotation = Math.atan2(anchor.parent.y - neighbour.parent.y, anchor.parent.x - neighbour.parent.x);
  if (Math.cos(rotation) < 0) rotation += Math.PI;
  return {
    rotation,
    x: anchor.parent.x - 16 * Math.cos(rotation) + 13 * Math.sin(rotation),
    y: anchor.parent.y - 16 * Math.sin(rotation) - 13 * Math.cos(rotation),
  };
}

function getOutlineSignature(geometry: OutlineGeometry | null): string {
  if (!geometry) return '';
  const points = geometry.contours.length
    ? geometry.contours.flatMap(contour => [contour.length, ...contour])
    : geometry.points;
  return [
    geometry.center.x,
    geometry.center.y,
    geometry.rotation,
    geometry.scale.x,
    geometry.scale.y,
    ...points,
  ].map(value => Math.round(value * 1000) / 1000).join(',');
}

function clearGraphics(graphics: unknown): void {
  callMethod(graphics, 'clear');
  callMethod(graphics, 'removeChildren');
}

function clearExtraLabels(state: SelectionState): void {
  for (const label of state.extraLabels) {
    callMethod(readNativeProperty(label, 'parent'), 'removeChild', [label]);
    callMethod(label, 'destroy');
  }
  state.extraLabels = [];
}

function clearExtraOutline(state: SelectionState): void {
  clearExtraLabels(state);
  if (!state.extraOutline) return;
  clearGraphics(state.extraOutline);
  callMethod(readNativeProperty(state.extraOutline, 'parent'), 'removeChild', [state.extraOutline]);
  state.extraOutline = null;
}

function drawExtraLabels(
  state: SelectionState,
  records: Array<{ geometry: OutlineGeometry; record: SelectionRecord }>,
): void {
  const children = readNativeProperty(state.nativeOutline, 'children');
  const template = Array.isArray(children) ? children[2] : null;
  const currentConstructor = readNativeReflectProperty(template, 'constructor');
  if (isNativeObject(template) && typeof currentConstructor === 'function') {
    state.labelConstructor = currentConstructor;
    state.labelStyle = readNativeProperty(template, 'style');
  }
  const Text = state.labelConstructor;
  if (typeof Text !== 'function') return;

  const labeled = records.filter(({ record }) => readNativeProperty(record.model, 'id') != null);
  while (state.extraLabels.length > labeled.length) {
    const label = state.extraLabels.pop();
    callMethod(readNativeProperty(label, 'parent'), 'removeChild', [label]);
    callMethod(label, 'destroy');
  }
  while (state.extraLabels.length < labeled.length) {
    let label: unknown;
    try {
      label = Reflect.construct(Text, ['', state.labelStyle]);
    } catch {
      return;
    }
    if (!isNativeObject(label)) return;
    callMethod(readNativeProperty(state.renderer, 'Cg'), 'addChild', [label]);
    state.extraLabels.push(label);
  }

  labeled.forEach(({ geometry, record }, index) => {
    const label = state.extraLabels[index];
    const placement = getLabelPlacement(geometry);
    setNativeReflectProperty(label, 'text', String(readNativeProperty(record.model, 'id')));
    setNativeReflectProperty(label, 'x', placement.x);
    setNativeReflectProperty(label, 'y', placement.y);
    setNativeReflectProperty(label, 'rotation', placement.rotation);
  });
}

function drawDashedPolygon(graphics: object, points: number[], scale: number): void {
  const dash = 6 / scale;
  const step = 10 / scale;
  for (let index = 0; index < points.length; index += 2) {
    const next = (index + 2) % points.length;
    const startX = points[index] ?? 0;
    const startY = points[index + 1] ?? 0;
    const endX = points[next] ?? 0;
    const endY = points[next + 1] ?? 0;
    const length = Math.hypot(endX - startX, endY - startY);
    for (let offset = 0; offset < length; offset += step) {
      const from = offset / length;
      const to = Math.min(offset + dash, length) / length;
      callMethod(graphics, 'moveTo', [startX + (endX - startX) * from, startY + (endY - startY) * from]);
      callMethod(graphics, 'lineTo', [startX + (endX - startX) * to, startY + (endY - startY) * to]);
    }
  }
}

function drawPrimaryOutline(state: SelectionState): void {
  const primary = state.records[0];
  const parent = readNativeProperty(state.nativeOutline, 'parent');
  if (!primary || !isNativeObject(parent)) return;
  const geometry = getWrapperOutlineGeometry(primary.wrapper, parent, 'bounds');
  if (!geometry || !geometry.points.every(Number.isFinite)) return;

  const { bounds, center, rotation, scale } = geometry;
  const topRight = getOutlineTopRight(geometry).local;
  const labelPlacement = getLabelPlacement(geometry);
  const halfWidth = bounds.width / 2 + EDITOR_OUTLINE_PADDING_PX / scale.x;
  const halfHeight = bounds.height / 2 + EDITOR_OUTLINE_PADDING_PX / scale.y;
  const special = state.specialBodyId === Number(readNativeProperty(primary.model, 'id'));
  callMethod(state.nativeOutline, 'clear');
  const outlineScale = Math.max(scale.x, scale.y);
  callMethod(state.nativeOutline, 'lineStyle', [1 / outlineScale, special ? 0xff4d4d : readNativeProperty(primary.wrapper, 'kv') ? 5307581 : 0xffffff, 1]);
  if (special) {
    drawDashedPolygon(state.nativeOutline, [
      -halfWidth, -halfHeight,
      halfWidth, -halfHeight,
      halfWidth, halfHeight,
      -halfWidth, halfHeight,
    ], outlineScale);
  } else if (geometry.contours.length) {
    for (const contour of geometry.contours) {
      const local = Array.from({ length: contour.length / 2 }).flatMap((_, index) => {
        const point = toOutlineLocalPoint(
          geometry,
          contour[index * 2] ?? 0,
          contour[index * 2 + 1] ?? 0,
        );
        return [point.x, point.y];
      });
      callMethod(state.nativeOutline, 'drawPolygon', [local]);
    }
  } else {
    callMethod(state.nativeOutline, 'drawRect', [-halfWidth, -halfHeight, halfWidth * 2, halfHeight * 2]);
  }
  setNativeReflectProperty(state.nativeOutline, 'x', center.x);
  setNativeReflectProperty(state.nativeOutline, 'y', center.y);
  setNativeReflectProperty(state.nativeOutline, 'rotation', rotation);
  callMethod(readNativeProperty(state.nativeOutline, 'scale'), 'set', [scale.x, scale.y]);
  state.outlineSignature = getOutlineSignature(geometry);

  const children = readNativeProperty(state.nativeOutline, 'children');
  if (!Array.isArray(children)) return;
  const label = children[2];
  const Text = readNativeReflectProperty(label, 'constructor');
  if (isNativeObject(label) && typeof Text === 'function') {
    state.labelConstructor = Text;
    state.labelStyle = readNativeProperty(label, 'style');
  }
  children.forEach((child, index) => {
    const [xOffset, yOffset] = index === 1 ? [9, 9] : index ? [16, 13] : [0, 0];
    callMethod(readNativeProperty(child, 'scale'), 'set', [1 / scale.x, 1 / scale.y]);
    if (index === 2 && geometry.contours.length) {
      const point = toOutlineLocalPoint(geometry, labelPlacement.x, labelPlacement.y);
      setNativeReflectProperty(child, 'x', point.x);
      setNativeReflectProperty(child, 'y', point.y);
      setNativeReflectProperty(child, 'rotation', labelPlacement.rotation - rotation);
    } else {
      setNativeReflectProperty(child, 'x', topRight.x - xOffset / scale.x);
      setNativeReflectProperty(child, 'y', topRight.y - yOffset / scale.y);
      if (index === 2) setNativeReflectProperty(child, 'rotation', 0);
    }
  });
}

function drawExtraOutlines(state: SelectionState): void {
  if (state.records.length < 2) {
    clearExtraOutline(state);
    return;
  }
  let graphics = state.extraOutline;
  if (!graphics) {
    const Graphics = readNativeReflectProperty(state.nativeOutline, 'constructor');
    if (typeof Graphics !== 'function') return;
    try {
      graphics = Reflect.construct(Graphics, []);
    } catch {
      return;
    }
    if (!isNativeObject(graphics)) return;
    callMethod(readNativeProperty(state.renderer, 'Cg'), 'addChild', [graphics]);
    state.extraOutline = graphics;
  }

  clearGraphics(graphics);
  const parent = readNativeProperty(graphics, 'parent');
  if (!isNativeObject(parent)) return;
  const outlined: Array<{ geometry: OutlineGeometry; record: SelectionRecord }> = [];
  for (const record of state.records.slice(1)) {
    const geometry = getWrapperOutlineGeometry(record.wrapper, parent, 'bounds');
    if (!geometry?.points.every(Number.isFinite)) continue;
    callMethod(graphics, 'lineStyle', [1, 0xffffff, 1]);
    for (const contour of geometry.contours.length ? geometry.contours : [geometry.points]) {
      callMethod(graphics, 'drawPolygon', [contour]);
    }
    outlined.push({ geometry, record });
  }
  drawExtraLabels(state, outlined);
}

function redrawSelection(state: SelectionState): void {
  syncRecords(state);
  if (!state.records.length) {
    state.outlineSignature = '';
    clearExtraOutline(state);
    return;
  }

  state.redrawing = true;
  try {
    Reflect.apply(state.originalNb, state.tool, []);
    refreshWrapperViews(state);
    const installedNb = readNativeProperty(state.tool, 'nb');
    setNativeReflectProperty(state.tool, 'nb', () => undefined);
    try {
      Reflect.apply(state.originalIv, state.tool, []);
    } finally {
      setNativeReflectProperty(state.tool, 'nb', installedNb);
    }
    drawPrimaryOutline(state);
    drawExtraOutlines(state);
    Reflect.apply(state.originalNb, state.tool, []);
  } finally {
    state.redrawing = false;
  }
}

function clearEditorSelection(state: SelectionState): void {
  setRecords(state, []);
  state.paintValues.clear();
  state.pointerDownRecords = null;
  state.outlineSignature = '';
  clearMarquee(state);
  clearGraphics(state.nativeOutline);
  clearExtraOutline(state);
  Reflect.apply(state.originalNb, state.tool, []);
  const close = document.querySelector<HTMLElement>('.editorPropertiesWindow .closeButton');
  if (close?.offsetParent) close.click();
}

function restoreSelection(state: SelectionState, records: SelectionRecord[]): void {
  setNativeReflectProperty(state.tool, 'xb', false);
  state.specialBodyId = null;
  if (!records.length) {
    clearEditorSelection(state);
    return;
  }
  setRecords(state, records);
  const primary = records[0]!;
  Reflect.apply(state.originalFv, state.tool, [primary.type, primary.model]);
  const paint = getPaint(primary);
  if (paint) {
    state.selecting = true;
    try {
      callMethod(readNativeProperty(state.tool, 'Av'), 'bk', [getPaintToolInput(paint)]);
    } finally {
      state.selecting = false;
    }
  }
  redrawSelection(state);
  rememberPaintValues(state);
  patchPropertyControls(state);
}

function startGroupDrag(state: SelectionState, event: unknown): void {
  const global = readNativeProperty(readNativeProperty(event, 'data'), 'global');
  const pointer = readNativeProperty(state.tool, 'Cb');
  if (isNativeObject(pointer)) {
    setNativeReflectProperty(pointer, 'x', Number(readNativeProperty(global, 'x')));
    setNativeReflectProperty(pointer, 'y', Number(readNativeProperty(global, 'y')));
  }
  setNativeReflectProperty(state.tool, 'mk', false);
  setNativeReflectProperty(state.tool, 'xb', true);
  state.dragStart = getEventPoint(event);
  state.records.forEach(record => callMethod(record.wrapper, 'wv'));
  getRendererView(state.renderer)?.parentElement?.classList.remove('qolboxEditorDragging');
}

function getEventPoint(event: unknown): { x: number; y: number } | null {
  const global = readNativePath(event, ['data', 'global']);
  const x = Number(readNativeProperty(global, 'x'));
  const y = Number(readNativeProperty(global, 'y'));
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
}

function clearMarquee(state: SelectionState): void {
  getRendererView(state.renderer)?.parentElement?.classList.remove('qolboxEditorMarquee');
  const graphics = state.marquee?.graphics;
  state.marquee = null;
  if (!graphics) return;
  callMethod(readNativeProperty(graphics, 'parent'), 'removeChild', [graphics]);
  callMethod(graphics, 'destroy');
}

function cancelMarquee(state: SelectionState): void {
  const records = state.marquee?.records;
  if (!records) return;
  clearMarquee(state);
  restoreSelection(state, records);
}

function startMarquee(state: SelectionState, event: unknown, records: SelectionRecord[]): void {
  const start = getEventPoint(event);
  const Graphics = readNativeReflectProperty(state.nativeOutline, 'constructor');
  if (!start || typeof Graphics !== 'function') return;
  let graphics: unknown;
  try {
    graphics = Reflect.construct(Graphics, []);
  } catch {
    return;
  }
  if (!isNativeObject(graphics)) return;
  callMethod(readNativeProperty(state.renderer, 'Cg'), 'addChild', [graphics]);
  state.marquee = { graphics, modified: hasSelectionModifier(event), records, start };
  const editor = getRendererView(state.renderer)?.parentElement;
  editor?.classList.remove('qolboxEditorDragging');
}

function drawMarquee(state: SelectionState, event: unknown): boolean {
  const marquee = state.marquee;
  const end = getEventPoint(event);
  if (!marquee || !end) return false;
  const area = getArea(marquee.start, end);
  callMethod(marquee.graphics, 'clear');
  if (Math.hypot(area.width, area.height) < MARQUEE_DRAG_THRESHOLD_PX) {
    getRendererView(state.renderer)?.parentElement?.classList.remove('qolboxEditorMarquee');
    Reflect.apply(state.originalNb, state.tool, []);
    return true;
  }
  getRendererView(state.renderer)?.parentElement?.classList.add('qolboxEditorMarquee');
  callMethod(marquee.graphics, 'lineStyle', [1, 0xffffff, 0.85]);
  callMethod(marquee.graphics, 'beginFill', [0xffffff, 0.12]);
  callMethod(marquee.graphics, 'drawRect', [area.x, area.y, area.width, area.height]);
  callMethod(marquee.graphics, 'endFill');
  Reflect.apply(state.originalNb, state.tool, []);
  return true;
}

function getSelectionTargets(state: SelectionState): object[] {
  const targets: object[] = [];
  const visit = (display: unknown): void => {
    if (!isNativeObject(display)) return;
    if (readNativeProperty(display, 'objectType') != null) targets.push(display);
    const children = readNativeProperty(display, 'children');
    if (Array.isArray(children)) children.forEach(visit);
  };
  visit(readNativeProperty(state.renderer, 'Cg'));
  return targets;
}

function getMarqueeTargets(state: SelectionState, area: Bounds): object[] {
  return getSelectionTargets(state).filter(target => {
    const bounds = readBounds(target);
    return bounds && areasIntersect(area, bounds);
  });
}

function renderedShapeIntersectsArea(state: SelectionState, record: SelectionRecord, area: Bounds): boolean {
  if (getOutlineMode(record) !== 'rendered') return true;
  const visual = readNativeProperty(getRenderedView(state, record), 'Ic');
  const parent = readNativeProperty(state.nativeOutline, 'parent');
  if (!isNativeObject(visual) || !isNativeObject(parent)) return true;
  const contours = getRenderedPolygonContours(
    visual,
    parent,
    Array.isArray(readNativeProperty(readNativeProperty(record.wrapper, 'pv'), 'Sa')),
  );
  const rectangle = [
    area.x, area.y,
    area.x + area.width, area.y,
    area.x + area.width, area.y + area.height,
    area.x, area.y + area.height,
  ];
  return !contours.length || contours.some(points => polygonsIntersect(points, rectangle));
}

function getHitBody(state: SelectionState, event: unknown, records: SelectionRecord[]): object | null {
  const direct = readNativePath(event, ['target', 'sd', 'Kc']);
  if (isNativeObject(direct)) return direct;
  return records.find(record =>
    record.type === 'body' && renderedShapeContainsPoint(state, record, event)
  )?.model ?? null;
}

function selectNatively(
  state: SelectionState,
  event: unknown,
  modified: boolean,
  target: unknown = readNativeProperty(event, 'target'),
  quiet = false,
): SelectionRecord | null {
  let capturedType = '';
  let capturedModel: object | null = null;
  const previousCtrlKey = readNativeProperty(event, 'ctrlKey');
  const previousTarget = readNativeProperty(event, 'target');
  const previousClickedBody = readNativeProperty(state.tool, 'gk');
  const previousClickTime = readNativeProperty(state.tool, 'fk');
  const installedIv = readNativeProperty(state.tool, 'Iv');
  const paintTool = readNativeProperty(state.tool, 'Av');
  const originalPaint = readNativeProperty(paintTool, 'bk');
  const captureProperties = function (this: unknown, type: unknown, model: unknown) {
    if (typeof type === 'string' && isNativeObject(model)) {
      capturedType = type;
      capturedModel = model;
    }
    return quiet ? undefined : Reflect.apply(state.originalFv, this, [type, model]);
  };

  state.selecting = true;
  if (modified) setNativeReflectProperty(state.tool, 'gk', -1);
  setNativeReflectProperty(state.tool, 'Fv', captureProperties);
  if (quiet) setNativeReflectProperty(state.tool, 'Iv', () => undefined);
  if (isNativeObject(paintTool) && isNativeFunction(originalPaint)) {
    setNativeReflectProperty(paintTool, 'bk', function (this: unknown, paint: unknown) {
      if (quiet) return undefined;
      return Reflect.apply(originalPaint, this, [isNativeObject(paint) ? getPaintToolInput(paint) : paint]);
    });
  }
  setNativeReflectProperty(event, 'ctrlKey', false);
  setNativeReflectProperty(event, 'target', target);
  try {
    Reflect.apply(state.originalAb, state.tool, [event]);
  } finally {
    setNativeReflectProperty(event, 'target', previousTarget);
    setNativeReflectProperty(event, 'ctrlKey', previousCtrlKey);
    setNativeReflectProperty(state.tool, 'Iv', installedIv);
    setNativeReflectProperty(state.tool, 'Fv', state.originalFv);
    if (isNativeObject(paintTool) && isNativeFunction(originalPaint)) {
      setNativeReflectProperty(paintTool, 'bk', originalPaint);
    }
    if (quiet) {
      setNativeReflectProperty(state.tool, 'gk', previousClickedBody);
      setNativeReflectProperty(state.tool, 'fk', previousClickTime);
    }
    state.selecting = false;
  }

  const [wrapper] = getSelection(state.tool) ?? [];
  return wrapper && capturedModel ? { model: capturedModel, type: capturedType, wrapper } : null;
}

function selectGroupedBodyNatively(state: SelectionState, event: unknown): SelectionRecord | null {
  if (!hasControlModifier(event)) return null;
  const body = readNativePath(event, ['target', 'sd', 'Kc']);
  if (!isNativeObject(body) || !getBodyGroup(state, body)) return null;

  const selectedBody = readNativeProperty(state.tool, 'yk');
  const shapeMode = readNativeProperty(state.tool, 'wk');
  setNativeReflectProperty(state.tool, 'yk', -1);
  setNativeReflectProperty(state.tool, 'wk', false);
  try {
    const selected = selectNatively(state, event, false);
    return selected?.type === 'body' && selected.model === body ? selected : null;
  } finally {
    setNativeReflectProperty(state.tool, 'yk', selectedBody);
    setNativeReflectProperty(state.tool, 'wk', shapeMode);
  }
}

function selectShapeNatively(state: SelectionState): boolean {
  const event = state.lastPointerEvent;
  const body = readNativePath(event, ['target', 'sd', 'Kc']);
  const id = Number(readNativeProperty(body, 'id'));
  if (!isNativeObject(body) || !Number.isInteger(id)) return false;
  callMethod(state.tool, 'Mb', [id]);
  getSelection(state.tool)?.splice(0);
  setNativeReflectProperty(state.tool, 'yk', id);
  setNativeReflectProperty(state.tool, 'wk', false);
  setNativeReflectProperty(state.tool, 'gk', -1);
  const selected = selectNatively(state, event, false);
  setNativeReflectProperty(state.tool, 'xb', false);
  if (selected?.type !== 'shape') return false;
  state.specialBodyId = null;
  setRecords(state, [selected]);
  redrawSelection(state);
  rememberPaintValues(state);
  patchPropertyControls(state);
  return true;
}

function selectInsertedModels(state: SelectionState, models: object[], groupBodies = false): void {
  if (!models.length) return;
  const inserted = new Set(models);
  const records: SelectionRecord[] = [];
  const selectedBody = readNativeProperty(state.tool, 'yk');
  const shapeMode = readNativeProperty(state.tool, 'wk');
  setNativeReflectProperty(state.tool, 'yk', -1);
  setNativeReflectProperty(state.tool, 'wk', false);
  try {
    for (const target of getSelectionTargets(state)) {
      const record = selectNatively(state, { data: { global: { x: 0, y: 0 } }, target }, true, target, true);
      if (
        record &&
        inserted.has(record.model) &&
        !records.some(candidate => candidate.model === record.model)
      ) records.push(record);
    }
  } finally {
    setNativeReflectProperty(state.tool, 'yk', selectedBody);
    setNativeReflectProperty(state.tool, 'wk', shapeMode);
  }
  if (records.length) {
    if (groupBodies) mergeBodyGroups(state, ...records.filter(record => record.type === 'body').map(record => record.model));
    restoreSelection(state, records);
  }
}

function getPaintSample(state: SelectionState, event: unknown): { color: number; property: 'color' | 'la' } | null {
  const point = getEventPoint(event);
  const parent = readNativeProperty(state.nativeOutline, 'parent');
  if (!point || !isNativeObject(parent)) return null;
  for (const target of getSelectionTargets(state).reverse()) {
    const paint = readNativePath(target, ['td', 'Hc']);
    const bounds = readBounds(target);
    if (!isNativeObject(paint) || !bounds || !areasIntersect(bounds, { ...point, height: 0, width: 0 })) continue;
    const contains = callMethod(target, 'containsPoint', [readNativePath(event, ['data', 'global'])]);
    const strokeWidth = Number(readNativeProperty(paint, 'aa'));
    const visual = readNativeProperty(target, 'Ic');
    const contours = getRenderedPolygonContours(visual, parent, false);
    const edgeDistance = contours.length
      ? Math.min(...contours.map(contour => distanceToPolygon(contour, point)))
      : Math.min(point.x - bounds.x, bounds.x + bounds.width - point.x, point.y - bounds.y, bounds.y + bounds.height - point.y);
    if (contains === false && !(strokeWidth > 0 && edgeDistance <= Math.max(2, strokeWidth / 2))) continue;
    const property = strokeWidth > 0 && edgeDistance <= Math.max(2, strokeWidth / 2) ? 'la' : 'color';
    const color = Number(readNativeProperty(paint, property));
    return Number.isInteger(color) && color >= 0 && color <= 0xffffff ? { color, property } : null;
  }
  return null;
}

function sampleColor(state: SelectionState, event: unknown): void {
  const sample = getPaintSample(state, event);
  const paintTool = readNativeProperty(state.tool, 'Av');
  if (!sample || !isNativeObject(paintTool)) return;
  const values = Object.fromEntries(getCopyableValues(paintTool));
  state.selecting = true;
  try {
    callMethod(paintTool, 'bk', [{ ...values, [sample.property]: sample.color }]);
  } finally {
    state.selecting = false;
  }
  let changed = false;
  for (const record of state.records) {
    const paint = getPaint(record);
    if (!paint || !Reflect.has(paint, sample.property)) continue;
    if (Number(readNativeProperty(paint, sample.property)) === sample.color) continue;
    setNativeReflectProperty(paint, sample.property, sample.color);
    callMethod(record.wrapper, 'fv', [paint]);
    changed = true;
  }
  if (changed) callMethod(state.tool, 'Eb');
  state.paintValues = getCopyableValues(paintTool);
  redrawSelection(state);
  updatePaintPreviews(state);
}

function applyMarqueeSelection(state: SelectionState, event: unknown, marquee: MarqueeSelection): void {
  const end = getEventPoint(event);
  if (!end) return;
  if (Math.hypot(end.x - marquee.start.x, end.y - marquee.start.y) < MARQUEE_DRAG_THRESHOLD_PX) {
    if (marquee.modified) restoreSelection(state, marquee.records);
    else clearEditorSelection(state);
    return;
  }
  const candidates: SelectionRecord[] = [];
  const area = getArea(marquee.start, end);
  for (const target of getMarqueeTargets(state, area)) {
    const record = selectNatively(state, event, true, target, true);
    if (
      record &&
      renderedShapeIntersectsArea(state, record, area) &&
      !findWrapperRecord(candidates, record.wrapper)
    ) candidates.push(record);
  }

  const expanded = candidates.flatMap(candidate => expandBodyGroup(state, candidate));
  const records = marquee.modified ? [...marquee.records] : [];
  for (const candidate of expanded.filter((record, index) =>
    expanded.findIndex(other => other.model === record.model) === index
  )) {
    const existing = records.findIndex(record =>
      record.model === candidate.model || wrapperMatchesModel(candidate.wrapper, record.model)
    );
    if (existing >= 0) {
      if (marquee.modified) records.splice(existing, 1);
    } else {
      records.push(candidate);
    }
  }
  restoreSelection(state, records);
}

function handleSelectionStart(state: SelectionState, event: unknown): unknown {
  state.lastPointerEvent = event;
  if (!state.pointerDownRecords) syncRecords(state);
  const oldRecords = [...(state.pointerDownRecords ?? state.records)];
  const specialBodyId = state.specialBodyId;
  if (readNativeProperty(state.tool, 'yb') === true && isColorPickerActive()) {
    setRecords(state, oldRecords);
    state.samplingColor = true;
    getRendererView(state.renderer)?.parentElement?.classList.remove('qolboxEditorDragging');
    sampleColor(state, event);
    return undefined;
  }
  const hitBody = getHitBody(state, event, oldRecords);
  if (
    specialBodyId === Number(readNativeProperty(hitBody, 'id')) &&
    !hasSelectionModifier(event)
  ) {
    state.specialDragStart = getEventPoint(event);
    startGroupDrag(state, event);
    return undefined;
  }
  const special = selectGroupedBodyNatively(state, event);
  if (special) {
    state.specialBodyId = Number(readNativeProperty(special.model, 'id'));
    setRecords(state, [special]);
    startGroupDrag(state, event);
    redrawSelection(state);
    rememberPaintValues(state);
    patchPropertyControls(state);
    return undefined;
  }
  const modified = hasSelectionModifier(event);
  const selected = selectNatively(state, event, modified);
  if (
    selected &&
    Number(readNativeProperty(selected?.model, 'id')) === specialBodyId &&
    !modified
  ) {
    state.specialBodyId = specialBodyId;
    state.specialDragStart = getEventPoint(event);
    setRecords(state, [selected]);
    startGroupDrag(state, event);
    redrawSelection(state);
    patchPropertyControls(state);
    return undefined;
  }
  if (
    selected &&
    !isSelectionOutlineTarget(state, event) &&
    !renderedShapeContainsPoint(state, selected, event)
  ) {
    restoreSelection(state, oldRecords);
    if (readNativeProperty(state.tool, 'yb') === true) startMarquee(state, event, oldRecords);
    return undefined;
  }
  if (!selected) {
    if (
      readNativeProperty(state.tool, 'yb') === true &&
      isEditorBackgroundTarget(state, event)
    ) {
      startMarquee(state, event, oldRecords);
    } else {
      syncRecords(state);
    }
    return undefined;
  }

  state.specialBodyId = null;
  const selectedRecords = expandBodyGroup(state, selected);
  const selectedModels = new Set(selectedRecords.map(record => record.model));
  const existing = oldRecords.filter(record => selectedModels.has(record.model));
  if (modified && existing.length) {
    restoreSelection(state, oldRecords.filter(record => !selectedModels.has(record.model)));
    return undefined;
  }
  const records = modified
    ? [...selectedRecords, ...oldRecords.filter(record => !selectedModels.has(record.model))]
    : existing.length && selectedRecords.length === 1 && oldRecords.length > 1
      ? [...selectedRecords, ...oldRecords.filter(record => !selectedModels.has(record.model))]
      : selectedRecords;
  setRecords(state, records);
  startGroupDrag(state, event);
  redrawSelection(state);
  rememberPaintValues(state);
  patchPropertyControls(state);
  return undefined;
}

function handleSelectionMove(state: SelectionState, event: unknown): unknown {
  if (drawMarquee(state, event)) return undefined;
  if (readNativeProperty(state.tool, 'xb') === true) {
    const point = getEventPoint(event);
    if (
      !state.dragStart ||
      point && Math.hypot(point.x - state.dragStart.x, point.y - state.dragStart.y) >= MARQUEE_DRAG_THRESHOLD_PX
    ) getRendererView(state.renderer)?.parentElement?.classList.add('qolboxEditorDragging');
  }
  syncRecords(state);
  if (state.records.length < 2) return Reflect.apply(state.originalWb, state.tool, [event]);

  const [primary, ...secondary] = state.records;
  if (!primary) return undefined;
  const originalMove = readNativeProperty(primary.wrapper, 'mv');
  if (typeof originalMove !== 'function') return Reflect.apply(state.originalWb, state.tool, [event]);
  const ownMove = Object.getOwnPropertyDescriptor(primary.wrapper, 'mv');
  const installedIv = readNativeProperty(state.tool, 'Iv');
  const installedNb = readNativeProperty(state.tool, 'nb');
  let delta: unknown;
  const captureMove = function (this: unknown, value: unknown) {
    delta = value;
    return Reflect.apply(originalMove, this, [value]);
  };

  setNativeReflectProperty(primary.wrapper, 'mv', captureMove);
  setNativeReflectProperty(state.tool, 'Iv', () => undefined);
  setNativeReflectProperty(state.tool, 'nb', () => undefined);
  try {
    Reflect.apply(state.originalWb, state.tool, [event]);
  } finally {
    if (ownMove) Object.defineProperty(primary.wrapper, 'mv', ownMove);
    else Reflect.deleteProperty(primary.wrapper, 'mv');
    setNativeReflectProperty(state.tool, 'Iv', installedIv);
    setNativeReflectProperty(state.tool, 'nb', installedNb);
  }
  if (isNativeObject(delta)) secondary.forEach(record => callMethod(record.wrapper, 'mv', [delta]));
  redrawSelection(state);
  return undefined;
}

function handleSelectionEnd(state: SelectionState, event: unknown, original: NativeFunction): unknown {
  state.pointerDownRecords = null;
  state.dragStart = null;
  if (state.samplingColor) {
    state.samplingColor = false;
    setNativeReflectProperty(state.tool, 'xb', false);
    return undefined;
  }
  const marquee = state.marquee;
  if (!marquee) {
    const result = Reflect.apply(original, state.tool, [event]);
    getRendererView(state.renderer)?.parentElement?.classList.remove('qolboxEditorDragging');
    const start = state.specialDragStart;
    state.specialDragStart = null;
    const end = getEventPoint(event);
    const special = state.records.find(record => Number(readNativeProperty(record.model, 'id')) === state.specialBodyId);
    if (start && end && special && Math.hypot(end.x - start.x, end.y - start.y) < MARQUEE_DRAG_THRESHOLD_PX) {
      restoreSelection(state, expandBodyGroup(state, special));
    }
    return result;
  }
  clearMarquee(state);
  applyMarqueeSelection(state, event, marquee);
  Reflect.apply(state.originalNb, state.tool, []);
  return undefined;
}

function installRendererRefresh(state: SelectionState): void {
  const original = readNativeProperty(state.renderer, 'render');
  if (typeof original !== 'function') return;
  const wrapped = function (this: unknown, ...args: unknown[]) {
    const result = Reflect.apply(original, this, args);
    const recordsChanged = syncRecords(state);
    if (!state.records.length) {
      const hadExtraOutline = Boolean(state.extraOutline);
      clearExtraOutline(state);
      if (hadExtraOutline) Reflect.apply(original, this, args);
    } else {
      const viewsChanged = refreshWrapperViews(state);
      const parent = readNativeProperty(state.nativeOutline, 'parent');
      const primary = state.records[0]!;
      const geometryChanged = isNativeObject(parent) &&
        getOutlineSignature(getWrapperOutlineGeometry(primary.wrapper, parent, 'bounds')) !== state.outlineSignature;
      if (
        !state.redrawing &&
        !state.selecting &&
        !state.refreshPending &&
        (recordsChanged || viewsChanged || geometryChanged)
      ) {
        state.refreshPending = true;
        queueMicrotask(() => {
          state.refreshPending = false;
          redrawSelection(state);
        });
      }
    }
    return result;
  };
  setNativeReflectProperty(state.renderer, 'render', wrapped);
}

function installPaintSync(state: SelectionState): void {
  const paintTool = readNativeProperty(state.tool, 'Av');
  const emitter = readNativeProperty(paintTool, 'Pk');
  const original = readNativeProperty(emitter, 'Tk');
  if (!isNativeObject(emitter) || typeof original !== 'function') return;
  const wrapped = function (this: unknown, ...args: unknown[]) {
    const currentValues = getCopyableValues(paintTool as object);
    const changedKeys = new Set([...currentValues].flatMap(([key, value]) =>
      !copyableEqual(state.paintValues.get(key), value) ? [key] : []
    ));
    const strokeWidth = document.querySelector<HTMLInputElement>('#editorContainer .strokeThicknessInput');
    if (strokeWidth?.dataset.qolboxMixed === 'true' && document.activeElement === strokeWidth && currentValues.has('aa')) {
      changedKeys.add('aa');
    }
    const result = Reflect.apply(original, this, args);
    if (!state.selecting && changedKeys.size) {
      for (const record of state.records.slice(1)) {
        const paint = getPaint(record);
        if (!paint) continue;
        for (const key of changedKeys) {
          if (Reflect.has(paint, key)) setNativeReflectProperty(paint, key, currentValues.get(key));
        }
        callMethod(record.wrapper, 'fv', [paint]);
      }
      redrawSelection(state);
    }
    state.paintValues = currentValues;
    updatePaintPreviews(state);
    return result;
  };
  setNativeReflectProperty(emitter, 'Tk', wrapped);
}

function isCopyable(value: unknown): boolean {
  return value === null || ['boolean', 'number', 'string', 'undefined'].includes(typeof value) ||
    (Array.isArray(value) && value.every(item => item === null || ['boolean', 'number', 'string'].includes(typeof item)));
}

function cloneCopyable(value: unknown): unknown {
  return Array.isArray(value) ? [...value] : value;
}

function getCopyableValues(model: object): Map<PropertyKey, unknown> {
  const values = new Map<PropertyKey, unknown>();
  let current: object | null = model;
  for (let depth = 0; current && current !== Object.prototype && depth < 8; depth += 1) {
    for (const key of Reflect.ownKeys(current)) {
      if (key === 'constructor' || values.has(key)) continue;
      const value = readNativeReflectProperty(model, key);
      if (isCopyable(value)) values.set(key, cloneCopyable(value));
    }
    current = Object.getPrototypeOf(current) as object | null;
  }
  return values;
}

function copyableEqual(left: unknown, right: unknown): boolean {
  return Array.isArray(left) && Array.isArray(right)
    ? left.length === right.length && left.every((value, index) => Object.is(value, right[index]))
    : Object.is(left, right);
}

function getPathValue(source: object, path: readonly PropertyKey[]): unknown {
  let value: unknown = source;
  for (const key of path) {
    if (!isNativeObject(value) || !Reflect.has(value, key)) return undefined;
    value = readNativeReflectProperty(value, key);
  }
  return value;
}

function hasPropertyPath(source: object, path: readonly PropertyKey[]): boolean {
  let value: unknown = source;
  for (const key of path) {
    if (!isNativeObject(value) || !Reflect.has(value, key)) return false;
    value = readNativeReflectProperty(value, key);
  }
  return true;
}

function setPathValue(source: object, path: readonly PropertyKey[], value: unknown): void {
  let parent: unknown = source;
  for (const key of path.slice(0, -1)) parent = readNativeReflectProperty(parent, key);
  const key = path[path.length - 1];
  if (isNativeObject(parent) && key != null) setNativeReflectProperty(parent, key, value);
}

function snapshotProperty(
  state: SelectionState,
  path: readonly PropertyKey[],
  force: boolean,
  kind: PropertySnapshot['kind'],
): PropertySnapshot | null {
  const records = getCompatibleRecords(state).filter(record => hasPropertyPath(record.model, path));
  if (records.length < 2) return null;
  const model = state.records[0]?.model;
  if (!model) return null;
  const value = getPathValue(model, path);
  return isCopyable(value) ? {
    force,
    kind,
    model,
    path,
    records,
    state,
    value: cloneCopyable(value),
    values: new Map(records.map(record => [record.model, cloneCopyable(getPathValue(record.model, path))])),
  } : null;
}

function syncChangedProperties(snapshot: PropertySnapshot): void {
  const { force, kind, model, path, records, state, value } = snapshot;
  if (state.records[0]?.model !== model) return;
  const after = getPathValue(model, path);
  if (!isCopyable(after) || (!force && copyableEqual(value, after))) return;
  const group = path.length === 1 && path[0] === 'angle' ? getCompleteBodyGroup(state, records) : null;
  const angle = group ? Number(after) - Number(value) : 0;
  const center = group && Number.isFinite(angle) ? getBodyGroupCenter(state, group) : null;
  if (center && angle) orbitBodies(group!, center, angle);
  for (const record of records.slice(1)) {
    if (kind === 'connect') {
      setPathValue(record.model, path, after);
      const anchor = readNativeProperty(record.model, 'Oa');
      if (isNativeObject(anchor)) {
        const body = Number(after) === -1
          ? readNativePath(state.tool, ['Bv', 'pl', Number(readNativeProperty(record.model, 'La'))])
          : null;
        setNativeReflectProperty(anchor, 'x', Number(readNativeProperty(body, 'x')) || 0);
        setNativeReflectProperty(anchor, 'y', Number(readNativeProperty(body, 'y')) || 0);
      }
      continue;
    }
    const current = getPathValue(record.model, path);
    if (group && typeof current === 'number') {
      setPathValue(record.model, path, current + angle);
      continue;
    }
    if (Array.isArray(current) && Array.isArray(after)) current.splice(0, current.length, ...after);
    else setPathValue(record.model, path, after);
  }
  redrawSelection(state);
}

function applyRelativeProperty(snapshot: PropertySnapshot, amount: number): void {
  const { model, path, records, state } = snapshot;
  if (state.records[0]?.model !== model) return;
  const delta = path.length === 1 && path[0] === 'angle' ? amount * Math.PI / 180 : amount;
  const group = path.length === 1 && path[0] === 'angle' ? getCompleteBodyGroup(state, records) : null;
  const center = group && delta ? getBodyGroupCenter(state, group) : null;
  if (center) orbitBodies(group!, center, delta);
  for (const record of records) {
    const current = snapshot.values.get(record.model);
    if (typeof current === 'number') setPathValue(record.model, path, current + delta);
  }
}

function getPropertyPath(control: HTMLElement, model: object): readonly PropertyKey[] | null {
  const title = control.closest('.row')?.querySelector('.title')?.textContent ?? '';
  if (title === 'Poly point x' || title === 'Poly point y') {
    const matching = [...document.querySelectorAll<HTMLElement>('.editorPropertiesWindow input, .editorPropertiesWindow select')]
      .filter(candidate => candidate.closest('.row')?.querySelector('.title')?.textContent === title);
    const index = matching.indexOf(control);
    return index >= 0 && hasPropertyPath(model, ['ca', index, title.endsWith('x') ? 'x' : 'y'])
      ? ['ca', index, title.endsWith('x') ? 'x' : 'y']
      : null;
  }
  return EDITOR_PROPERTY_PATHS[title]?.find(path => hasPropertyPath(model, path)) ?? null;
}

function getComparablePropertyValue(control: HTMLElement, model: object, path: readonly PropertyKey[]): unknown {
  const value = getPathValue(model, path);
  return control.closest('.row')?.querySelector('.title')?.textContent === 'Connect to'
    ? Number(value) === -1 ? -1 : 0
    : value;
}

function setMixedControl(control: HTMLElement, mixed: boolean): void {
  if (mixed && control instanceof HTMLInputElement && control.dataset.qolboxMixed !== 'true') {
    control.dataset.qolboxPrimaryValue = control.value;
  }
  if (mixed) control.dataset.qolboxMixed = 'true';
  else delete control.dataset.qolboxMixed;
  if (control instanceof HTMLInputElement) {
    if (mixed) {
      guardMixedInputValue(control);
      control.value = '';
      control.placeholder = 'Mixed';
    } else if (control.placeholder === 'Mixed') {
      control.placeholder = '';
      delete control.dataset.qolboxPrimaryValue;
    }
    return;
  }
  if (!(control instanceof HTMLSelectElement)) return;
  const existing = [...control.options].find(option => option.value === MIXED_OPTION_VALUE);
  if (!mixed) {
    existing?.remove();
    return;
  }
  const option = existing ?? new Option('Mixed', MIXED_OPTION_VALUE, true, true);
  option.disabled = true;
  if (!existing) control.add(option, 0);
  control.value = MIXED_OPTION_VALUE;
}

function installRelativePropertyCommands(
  input: HTMLInputElement,
  state: SelectionState,
  path: readonly PropertyKey[],
): void {
  if (relativeCommandInputs.has(input)) return;
  relativeCommandInputs.add(input);
  input.addEventListener('focus', () => {
    input.dataset.qolboxCommandBase = input.dataset.qolboxPrimaryValue ?? input.value;
  });
  const commit = (event: Event): void => {
    const match = /^=([+-])\s*(\d+(?:\.\d*)?|\.\d+)$/i.exec(input.value.trim());
    if (!match) return;
    const modelValue = getPathValue(state.records[0]?.model ?? {}, path);
    const base = typeof modelValue === 'number'
      ? path.length === 1 && path[0] === 'angle' ? modelValue * 180 / Math.PI : modelValue
      : Number(input.dataset.qolboxPrimaryValue ?? input.dataset.qolboxCommandBase);
    const amount = Number(match[2]);
    if (!Number.isFinite(base) || !Number.isFinite(amount)) return;
    const tab = event instanceof KeyboardEvent && event.key === 'Tab';
    if (!tab) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
    const next = String(base + (match[1] === '-' ? -amount : amount));
    input.value = next;
    const delta = match[1] === '-' ? -amount : amount;
    relativePropertyUpdates.set(input, delta);
    try {
      input.dispatchEvent(new Event('input', { bubbles: true }));
    } finally {
      relativePropertyUpdates.delete(input);
    }
    if (input.dataset.qolboxMixed === 'true') input.dataset.qolboxPrimaryValue = next;
    input.dataset.qolboxCommandBase = next;
  };
  input.addEventListener('change', commit, true);
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === 'Tab') commit(event);
  }, true);
}

function guardMixedInputValue(input: HTMLInputElement): void {
  if (guardedMixedInputs.has(input)) return;
  const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
  if (!descriptor?.get || !descriptor.set) return;
  guardedMixedInputs.add(input);
  Object.defineProperty(input, 'value', {
    configurable: true,
    get: descriptor.get,
    set(value: string) {
      descriptor.set?.call(this, this.dataset.qolboxMixed === 'true' && document.activeElement !== this ? '' : value);
    },
  });
}

function updateMixedPropertyControls(state: SelectionState): void {
  const records = getCompatibleRecords(state);
  for (const control of document.querySelectorAll<HTMLElement>('.editorPropertiesWindow input, .editorPropertiesWindow select')) {
    const path = propertyPaths.get(control);
    if (!path) continue;
    const values = records
      .filter(record => hasPropertyPath(record.model, path))
      .map(record => getComparablePropertyValue(control, record.model, path));
    setMixedControl(control, values.length > 1 && values.some(value => !copyableEqual(values[0], value)));
  }
}

function colorHex(value: unknown): string | null {
  const color = Number(value);
  return Number.isFinite(color) ? `#${(color >>> 0).toString(16).padStart(6, '0').slice(-6)}` : null;
}

function setPaintPreview(selector: string, colors: string[]): void {
  const preview = document.querySelector<HTMLElement>(`#editorContainer ${selector}`);
  if (!preview || !colors.length) return;
  const unique = [...new Set(colors)].sort();
  preview.dataset.qolboxMixedColors = unique.join(',');
  if (unique.length === 1) {
    preview.style.backgroundColor = unique[0] ?? '';
    preview.style.backgroundImage = '';
    preview.style.backgroundPosition = '';
    preview.style.backgroundRepeat = '';
    preview.style.backgroundSize = '';
    return;
  }
  const rowCount = unique.length < 3 ? 1 : Math.max(2, Math.floor(Math.sqrt(unique.length)));
  const columns = Math.ceil(unique.length / rowCount);
  const rows = Array.from(
    { length: Math.ceil(unique.length / columns) },
    (_, index) => unique.slice(index * columns, (index + 1) * columns),
  );
  let used = 0;
  preview.style.backgroundColor = '';
  preview.style.backgroundImage = rows.map(row => `linear-gradient(to right, ${row.map((color, index) =>
    `${color} ${index * 100 / row.length}% ${(index + 1) * 100 / row.length}%`
  ).join(', ')})`).join(',');
  preview.style.backgroundPosition = rows.map(row => {
    const height = row.length / unique.length;
    const position = height === 1 ? 0 : used / unique.length / (1 - height) * 100;
    used += row.length;
    return `0 ${position}%`;
  }).join(',');
  preview.style.backgroundRepeat = 'no-repeat';
  preview.style.backgroundSize = rows.map(row => `100% ${row.length * 100 / unique.length}%`).join(',');
}

function updatePaintPreviews(state: SelectionState): void {
  const paints = state.records.map(getPaint).filter((paint): paint is object => Boolean(paint));
  const strokeWidths = paints
    .filter(paint => Reflect.has(paint, 'aa'))
    .map(paint => readNativeProperty(paint, 'aa'));
  const strokeWidth = document.querySelector<HTMLInputElement>('#editorContainer .strokeThicknessInput');
  if (strokeWidth) {
    setMixedControl(strokeWidth, strokeWidths.length > 1 &&
      strokeWidths.some(value => !copyableEqual(strokeWidths[0], value)));
  }
  setPaintPreview('.fillPreview', paints.flatMap(paint => colorHex(readNativeProperty(paint, 'color')) ?? []));
  setPaintPreview('.strokeColorPreview', paints.flatMap(paint =>
    Number(readNativeProperty(paint, 'aa')) > 0 ? colorHex(readNativeProperty(paint, 'la')) ?? [] : []
  ));
  updateHexInputs(state);
}

function updateHexInputs(state: SelectionState): void {
  const paints = state.records.map(getPaint).filter((paint): paint is object => Boolean(paint));
  const paintTool = readNativeProperty(state.tool, 'Av');
  const sources = paints.length ? paints : isNativeObject(paintTool) ? [paintTool] : [];
  setHexInputValue(
    document.querySelector<HTMLInputElement>('#editorContainer .qolboxFillHex'),
    sources.flatMap(paint => colorHex(readNativeProperty(paint, 'color')) ?? []),
  );
  setHexInputValue(
    document.querySelector<HTMLInputElement>('#editorContainer .qolboxStrokeHex'),
    sources.flatMap(paint => colorHex(readNativeProperty(paint, 'la')) ?? []),
  );
  updateBackgroundHexInputs();
}

function updateBackgroundHexInputs(): void {
  const settings = getActiveEditorContext()?.settings;
  if (!settings) return;
  setHexInputValue(
    document.querySelector<HTMLInputElement>('#editorContainer .qolboxBackgroundTopHex'),
    colorHex(readNativeProperty(settings, 'Kn')) ? [colorHex(readNativeProperty(settings, 'Kn'))!] : [],
  );
  setHexInputValue(
    document.querySelector<HTMLInputElement>('#editorContainer .qolboxBackgroundBottomHex'),
    colorHex(readNativeProperty(settings, 'Xn')) ? [colorHex(readNativeProperty(settings, 'Xn'))!] : [],
  );
}

function rememberPaintValues(state: SelectionState): void {
  const paintTool = readNativeProperty(state.tool, 'Av');
  if (isNativeObject(paintTool)) state.paintValues = getCopyableValues(paintTool);
  updatePaintPreviews(state);
}

function patchPropertyControls(state: SelectionState): void {
  patchSubbodyHeader(state);
  const controls = document.querySelectorAll<HTMLElement>('.editorPropertiesWindow input, .editorPropertiesWindow select');
  for (const control of controls) {
    const model = state.records[0]?.model;
    const path = model && getPropertyPath(control, model);
    if (!path) continue;
    propertyPaths.set(control, path);
    if (control instanceof HTMLInputElement && typeof getPathValue(model, path) === 'number') {
      installRelativePropertyCommands(control, state, path);
    }
    for (const property of ['oninput', 'onchange', 'onclick'] as const) {
      const original = control[property];
      if (typeof original !== 'function' || readNativeReflectProperty(original, PROPERTY_HANDLER_MARKER)) continue;
      const wrapped = function (this: HTMLElement, event: Event) {
        if (
          this instanceof HTMLInputElement &&
          this.value.trimStart().startsWith('=') &&
          !relativePropertyUpdates.has(this)
        ) return undefined;
        const mixed = this.dataset.qolboxMixed === 'true';
        const kind = this.closest('.row')?.querySelector('.title')?.textContent === 'Connect to' ? 'connect' : null;
        const snapshot = snapshotProperty(state, path, mixed, kind);
        const relative = this instanceof HTMLInputElement ? relativePropertyUpdates.get(this) : undefined;
        if (snapshot && relative != null) {
          callMethod(state.tool, 'Eb');
          applyRelativeProperty(snapshot, relative);
        }
        const result = Reflect.apply(original, this, [event]);
        if (snapshot) {
          if (relative != null) {
            redrawSelection(state);
          } else syncChangedProperties(snapshot);
        }
        updateMixedPropertyControls(state);
        return result;
      };
      Object.defineProperty(wrapped, PROPERTY_HANDLER_MARKER, { value: true });
      setNativeReflectProperty(control, property, wrapped);
    }
  }
  updateMixedPropertyControls(state);
}

function patchSubbodyHeader(state: SelectionState): void {
  const title = document.querySelector<HTMLElement>('.editorPropertiesWindow .topBar');
  if (!title || state.specialBodyId == null) return;
  const text = [...title.childNodes].find(node => node.nodeType === Node.TEXT_NODE);
  if (text) text.textContent = 'Subbody';
  else title.prepend(document.createTextNode('Subbody'));
  if (title.querySelector('.qolboxUngroupButton')) return;
  const record = state.records.find(candidate => Number(readNativeProperty(candidate.model, 'id')) === state.specialBodyId);
  if (!record || !getBodyGroup(state, record.model)) return;
  const button = document.createElement('button');
  button.className = 'qolboxUngroupButton';
  button.type = 'button';
  button.textContent = 'Ungroup';
  button.addEventListener('pointerdown', event => event.stopPropagation());
  button.addEventListener('click', event => {
    event.stopPropagation();
    forgetGroupedBody(state, record.model);
    restoreSelection(state, [record]);
  });
  title.appendChild(button);
}

function installEditorMergeGrouping(windowObject: unknown): void {
  if (!isNativeObject(windowObject) || mergeGroupingWindows.has(windowObject)) return;
  const documentObject = readNativeProperty(windowObject, 'document');
  const addEventListener = readNativeProperty(documentObject, 'addEventListener');
  if (!isNativeObject(documentObject) || !isNativeFunction(addEventListener)) return;
  mergeGroupingWindows.add(windowObject);
  Reflect.apply(addEventListener, documentObject, ['click', (event: unknown) => {
    const control = callMethod(readNativeProperty(event, 'target'), 'closest', ['.editorPropertiesWindow *']);
    const panel = callMethod(control, 'closest', ['.editorPropertiesWindow']);
    const title = callMethod(panel, 'querySelector', ['.topBar']);
    if (
      String(readNativeProperty(control, 'textContent') ?? '').trim().toLowerCase() !== 'merge' ||
      !String(readNativeProperty(title, 'textContent') ?? '').includes('Merge Shapes')
    ) return;
    const inputs = callMethod(panel, 'querySelectorAll', ['input']);
    const state = activeSelectionState;
    const bodies = state && readNativePath(state.tool, ['Bv', 'pl']);
    const source = Array.isArray(bodies)
      ? bodies[Number(readNativeProperty(readNativeProperty(inputs, 0), 'value'))]
      : null;
    const target = Array.isArray(bodies)
      ? bodies[Number(readNativeProperty(readNativeProperty(inputs, 1), 'value'))]
      : null;
    if (!state || !isNativeObject(source) || !isNativeObject(target) || source === target) return;
    callMethod(event, 'preventDefault');
    callMethod(event, 'stopImmediatePropagation');
    mergeBodyGroups(state, source, target);
  }, true]);
}

function installSelectionTool(renderer: object, tool: object): void {
  if (statesByRenderer.has(renderer)) return;
  const root = readNativeProperty(renderer, 'Cg');
  const children = readNativeProperty(root, 'children');
  const nativeOutline = Array.isArray(children) ? children[children.length - 1] : null;
  const originalAb = readNativeProperty(tool, 'ab');
  const originalWb = readNativeProperty(tool, 'wb');
  const originalIv = readNativeProperty(tool, 'Iv');
  const originalNb = readNativeProperty(tool, 'nb');
  const originalPb = readNativeProperty(tool, 'pb');
  const originalUb = readNativeProperty(tool, 'ub');
  const originalFv = readNativeProperty(tool, 'Fv');
  if (
    !isNativeObject(nativeOutline) ||
    !isNativeFunction(originalAb) ||
    !isNativeFunction(originalWb) ||
    !isNativeFunction(originalIv) ||
    !isNativeFunction(originalNb) ||
    !isNativeFunction(originalPb) ||
    !isNativeFunction(originalUb) ||
    !isNativeFunction(originalFv)
  ) return;

  const state: SelectionState = {
    bodyGroups: new Map(),
    dragStart: null,
    extraLabels: [],
    extraOutline: null,
    nativeOutline,
    originalAb,
    originalFv,
    originalIv,
    originalNb,
    originalPb,
    originalUb,
    originalWb,
    outlineSignature: '',
    labelConstructor: null,
    labelStyle: null,
    lastPointerEvent: null,
    marquee: null,
    paintValues: new Map(),
    pointerDownRecords: null,
    records: [],
    redrawing: false,
    refreshPending: false,
    renderer,
    samplingColor: false,
    selecting: false,
    specialBodyId: null,
    specialDragStart: null,
    tool,
  };
  statesByRenderer.set(renderer, state);
  activeSelectionState = state;
  if (pendingPaintHex.size) {
    const paintTool = readNativeProperty(tool, 'Av');
    if (isNativeObject(paintTool)) {
      callMethod(paintTool, 'bk', [{
        ...Object.fromEntries(getCopyableValues(paintTool)),
        ...Object.fromEntries(pendingPaintHex),
      }]);
      pendingPaintHex.clear();
      state.paintValues = getCopyableValues(paintTool);
    }
  }
  window.addEventListener('blur', () => {
    cancelMarquee(state);
    state.dragStart = null;
    state.samplingColor = false;
    state.specialDragStart = null;
    getRendererView(state.renderer)?.parentElement?.classList.remove('qolboxEditorDragging');
  });
  setNativeReflectProperty(tool, 'ab', function (this: unknown, event: unknown) {
    return handleSelectionStart(state, event);
  });
  setNativeReflectProperty(tool, 'wb', function (this: unknown, event: unknown) {
    return handleSelectionMove(state, event);
  });
  setNativeReflectProperty(tool, 'ub', function (this: unknown, event: unknown) {
    return handleSelectionEnd(state, event, state.originalUb);
  });
  setNativeReflectProperty(tool, 'pb', function (this: unknown, event: unknown) {
    return handleSelectionEnd(state, event, state.originalPb);
  });
  setNativeReflectProperty(tool, 'Iv', function (this: unknown) {
    if (state.selecting) return Reflect.apply(state.originalIv, state.tool, []);
    redrawSelection(state);
    return undefined;
  });
  installRendererRefresh(state);
  installPaintSync(state);
}

function discoverSelectionTool(renderer: object, listener: object, callback: NativeFunction): void {
  const descriptor = Object.getOwnPropertyDescriptor(Array.prototype, 'forEach');
  if (!descriptor) return;
  const stop = {};
  const captureForEach = function (this: unknown[]) {
    const tool = Array.isArray(this) ? this.find(isSelectionTool) : null;
    if (tool) installSelectionTool(renderer, tool);
    throw stop;
  };
  try {
    Object.defineProperty(Array.prototype, 'forEach', { ...descriptor, value: captureForEach });
    Reflect.apply(callback, readNativeProperty(listener, 'context'), [{
      data: { button: 0, global: { x: 0, y: 0 } },
    }]);
  } catch (error) {
    if (error !== stop) return;
  } finally {
    Object.defineProperty(Array.prototype, 'forEach', descriptor);
  }
}

function installPointerCapture(renderer: object): void {
  if (statesByRenderer.has(renderer)) return;
  const events = readNativeProperty(readNativeProperty(renderer, 'Cg'), '_events');
  const rawListeners = readNativeProperty(events, 'pointerdown');
  const listeners = Array.isArray(rawListeners) ? rawListeners : [rawListeners];
  for (const listener of listeners) {
    const original = readNativeProperty(listener, 'fn');
    if (!isNativeObject(listener) || typeof original !== 'function' || readNativeReflectProperty(original, POINTER_LISTENER_MARKER)) continue;
    discoverSelectionTool(renderer, listener, original as NativeFunction);
    const wrapped = function (this: unknown, ...args: unknown[]) {
      const descriptor = Object.getOwnPropertyDescriptor(Array.prototype, 'forEach');
      if (!descriptor) return Reflect.apply(original, this, args);
      const nativeForEach = Array.prototype.forEach;
      const captureForEach = function (this: unknown[], callback: (value: unknown, index: number, array: unknown[]) => void, thisArg?: unknown) {
        const tool = Array.isArray(this) ? this.find(isSelectionTool) : null;
        if (tool) {
          if (!statesByRenderer.has(renderer)) installSelectionTool(renderer, tool);
          const state = statesByRenderer.get(renderer);
          if (state) {
            if (!state.pointerDownRecords) {
              syncRecords(state);
              state.pointerDownRecords = [...state.records];
            }
          }
          const cameraTool = this[0];
          const moveCamera = readNativeProperty(cameraTool, 'wb');
          if (
            statesByRenderer.has(renderer) &&
            isNativeFunction(moveCamera) &&
            !readNativeReflectProperty(moveCamera, CAMERA_MOVE_MARKER)
          ) {
            // Camera movement requires the physical right button, even if Hitbox missed its release.
            const guardedMoveCamera = function (this: unknown, event: unknown) {
              const buttons = Number(readNativeProperty(getOriginalPointerEvent(event), 'buttons'));
              if (buttons & 2) return Reflect.apply(moveCamera, this, [event]);
              return undefined;
            };
            Object.defineProperty(guardedMoveCamera, CAMERA_MOVE_MARKER, { value: true });
            setNativeReflectProperty(cameraTool, 'wb', guardedMoveCamera);
          }
        }
        return Reflect.apply(nativeForEach, this, [callback, thisArg]);
      };
      try {
        Object.defineProperty(Array.prototype, 'forEach', { ...descriptor, value: captureForEach });
        return Reflect.apply(original, this, args);
      } finally {
        Object.defineProperty(Array.prototype, 'forEach', descriptor);
      }
    };
    Object.defineProperty(wrapped, POINTER_LISTENER_MARKER, { value: true });
    setNativeReflectProperty(listener, 'fn', wrapped);
  }
}

function installEditorInputOwnership(windowObject: unknown): void {
  if (!isNativeObject(windowObject) || inputOwnershipWindows.has(windowObject)) return;
  const addEventListener = readNativeProperty(windowObject, 'addEventListener');
  const KeyboardEventConstructor = readNativeProperty(windowObject, 'KeyboardEvent');
  if (!isNativeFunction(addEventListener) || !isNativeFunction(KeyboardEventConstructor)) return;

  inputOwnershipWindows.add(windowObject);
  Reflect.apply(addEventListener, windowObject, ['pointerdown', (event: unknown) => {
    const target = readNativeProperty(event, 'target');
    const button = Number(readNativeProperty(event, 'button'));
    const editor = callMethod(target, 'closest', ['#editorContainer']);
    const editorCanvas = String(readNativeProperty(target, 'tagName')).toUpperCase() === 'CANVAS' && isNativeObject(editor);
    const editorPointer = button === 0 && editorCanvas;
    editorPointerModified = editorPointer && Boolean(
      readNativeProperty(event, 'ctrlKey') ||
      readNativeProperty(event, 'metaKey') ||
      readNativeProperty(event, 'shiftKey')
    );
    editorPointerControlModified = editorPointer && Boolean(
      readNativeProperty(event, 'ctrlKey') || readNativeProperty(event, 'metaKey')
    );
    if (editorCanvas && button === 2) {
      callMethod(readNativeProperty(editor, 'classList'), 'add', ['qolboxEditorDragging']);
    }
    if (!editorPointer) return;
    const releaseControl = Reflect.construct(KeyboardEventConstructor, ['keyup', {
      bubbles: true,
      code: 'ControlLeft',
      key: 'Control',
    }]);
    callMethod(windowObject, 'dispatchEvent', [releaseControl]);
  }, true]);
  const stopDragging = (): void => {
    document.querySelector('#editorContainer')?.classList.remove('qolboxEditorDragging');
  };
  for (const event of ['pointerup', 'pointercancel']) {
    Reflect.apply(addEventListener, windowObject, [event, stopDragging, true]);
  }
  Reflect.apply(addEventListener, windowObject, ['blur', (event: unknown) => {
    if (readNativeProperty(event, 'target') === windowObject) stopDragging();
  }, true]);
  Reflect.apply(addEventListener, windowObject, ['dblclick', (event: unknown) => {
    const target = readNativeProperty(event, 'target');
    if (
      String(readNativeProperty(target, 'tagName')).toUpperCase() === 'CANVAS' &&
      isNativeObject(callMethod(target, 'closest', ['#editorContainer'])) &&
      activeSelectionState &&
      selectShapeNatively(activeSelectionState)
    ) callMethod(event, 'preventDefault');
  }, true]);
}

export function patchEditorSelectionControls(windowObject: unknown = window): void {
  installEditorInputOwnership(windowObject);
  installEditorColorPicker();
  installEditorTopMenuDismissal();
  installEditorMirrorMenu(windowObject);
  installEditorHelp();
  installEditorMergeGrouping(windowObject);
  for (const renderer of getKnownFullscreenRenderers(windowObject)) {
    if (getRendererView(renderer)?.parentElement?.id !== 'editorContainer') continue;
    installEditorZoomSafety(renderer);
    installEditorMapFitZoom(renderer, () => statesByRenderer.get(renderer)?.bodyGroups.clear());
    installPointerCapture(renderer);
    activeSelectionState = statesByRenderer.get(renderer) ?? activeSelectionState;
  }
}

export function setEditorSelectionPaintTestState(
  renderer: object,
  index: number,
  values: Record<string, unknown>,
): boolean {
  const state = statesByRenderer.get(renderer);
  const record = state?.records[index];
  const paint = record && getPaint(record);
  if (!state || !record || !paint) return false;
  for (const [key, value] of Object.entries(values)) {
    if (Reflect.has(paint, key)) setNativeReflectProperty(paint, key, value);
  }
  callMethod(record.wrapper, 'fv', [paint]);
  redrawSelection(state);
  updatePaintPreviews(state);
  return true;
}

export function setEditorSelectionTestIds(renderer: object, ids: unknown[]): boolean {
  const state = statesByRenderer.get(renderer);
  if (!state) return false;
  const wanted = new Set(ids);
  const records: SelectionRecord[] = [];
  for (const target of getSelectionTargets(state)) {
    const record = selectNatively(state, { data: { global: { x: 0, y: 0 } }, target }, true, target, true);
    if (
      record &&
      wanted.has(readNativeProperty(record.model, 'id')) &&
      !records.some(candidate => candidate.model === record.model)
    ) records.push(record);
  }
  restoreSelection(state, records);
  return records.length === wanted.size;
}

export function setEditorSelectionTestTypes(renderer: object, type: string, indices: number[]): boolean {
  const state = statesByRenderer.get(renderer);
  if (!state) return false;
  const candidates: SelectionRecord[] = [];
  for (const target of getSelectionTargets(state)) {
    const record = selectNatively(state, { data: { global: { x: 0, y: 0 } }, target }, true, target, true);
    if (record?.type === type && !candidates.some(candidate => candidate.model === record.model)) candidates.push(record);
  }
  const records = indices.flatMap(index => candidates[index] ?? []);
  restoreSelection(state, records);
  return records.length === indices.length;
}

export function setEditorPaintPreviewTestColors(selector: string, colors: string[]): void {
  setPaintPreview(selector, colors);
}

export function getEditorSelectionTargetTestState(renderer: object): Array<{
  bounds: Bounds;
  id: unknown;
  points: Record<string, { x: number; y: number }>;
  shapeIndex: number | null;
  type: string;
}> {
  const state = statesByRenderer.get(renderer);
  if (!state) return [];
  const records = [...state.records];
  const selectedBody = readNativeProperty(state.tool, 'yk');
  const shapeMode = readNativeProperty(state.tool, 'wk');
  const targets = getSelectionTargets(state).flatMap(target => {
    const record = selectNatively(state, { data: { global: { x: 0, y: 0 } }, target }, true, target, true);
    const bounds = readBounds(target);
    if (!record || !bounds) return [];
    const points = Object.fromEntries(['Oa', 'Va', 'Ra'].flatMap(key => {
      const point = readNativeProperty(record.model, key);
      const x = Number(readNativeProperty(point, 'x'));
      const y = Number(readNativeProperty(point, 'y'));
      return Number.isFinite(x) && Number.isFinite(y) ? [[key, { x, y }]] : [];
    }));
    const body = readNativePath(target, ['sd', 'Kc']);
    const shape = readNativePath(target, ['td', 'Hc']);
    const shapes = readNativeProperty(body, 'Sa');
    const shapeIndex = Array.isArray(shapes) ? shapes.indexOf(shape) : -1;
    return [{
      bounds,
      id: readNativeProperty(record.model, 'id'),
      points,
      shapeIndex: shapeIndex >= 0 ? shapeIndex : null,
      type: record.type,
    }];
  });
  setNativeReflectProperty(state.tool, 'yk', selectedBody);
  setNativeReflectProperty(state.tool, 'wk', shapeMode);
  restoreSelection(state, records);
  return targets;
}

export function getEditorBodyTestPosition(renderer: object, id: unknown): { x: number; y: number } | null {
  const bodies = readNativePath(statesByRenderer.get(renderer)?.tool, ['Bv', 'pl']);
  if (!Array.isArray(bodies)) return null;
  const body = bodies.find(candidate => readNativeProperty(candidate, 'id') === id);
  const x = Number(readNativeProperty(body, 'x'));
  const y = Number(readNativeProperty(body, 'y'));
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
}

export function getEditorSelectionTestState(renderer: object): {
  activePaintColor: number;
  background: { bottom: number; top: number } | null;
  colorPickerActive: boolean;
  count: number;
  editorPointerModified: boolean;
  extraLabels: Array<{ rotation: number; text: string; x: number; y: number }>;
  extraOutline: ReturnType<typeof getWrapperBounds>;
  extraPolygons: number[][];
  extraRectangles: Array<NonNullable<ReturnType<typeof getWrapperBounds>>>;
  nativeCenter: { x: number; y: number };
  nativeChildren: Array<{ x: number; y: number }>;
  nativeChildRotations: number[];
  nativeOutline: ReturnType<typeof getWrapperBounds>;
  nativePolygons: number[][];
  nativeRotation: number;
  nativeSelectionCount: number;
  renderedOutlinePolygons: number[][];
  nativeRectangle: ReturnType<typeof getWrapperBounds>;
  outlineScale: number;
  marquee: ReturnType<typeof getWrapperBounds>;
  marqueeModified: boolean;
  propertyBindings: Array<{ path: string; title: string }>;
  specialBodySelected: boolean;
  records: Array<{
    bounds: ReturnType<typeof getWrapperBounds>;
    renderedBounds: ReturnType<typeof getWrapperBounds>;
    model: Record<string, unknown>;
    paint: Record<string, unknown>;
    points: Record<string, { x: number; y: number }>;
    renderRotation: number;
    shapes: Array<{
      color: number;
      points: Array<{ x: number; y: number }>;
      strokeColor: number;
      strokeWidth: number;
      x: number;
      y: number;
    }>;
    type: string;
  }>;
} | null {
  const state = statesByRenderer.get(renderer);
  if (!state) return null;
  const settings = readNativePath(state.tool, ['Bv', 'settings', 0]);
  const getGraphicsBounds = (graphics: object | null) => {
    const bounds = callMethod(graphics, 'getBounds', [false]);
    return isNativeObject(bounds)
      ? {
          height: Number(readNativeProperty(bounds, 'height')),
          width: Number(readNativeProperty(bounds, 'width')),
          x: Number(readNativeProperty(bounds, 'x')),
          y: Number(readNativeProperty(bounds, 'y')),
        }
      : null;
  };
  const getValues = (model: unknown) => isNativeObject(model)
    ? Object.fromEntries([...getCopyableValues(model)].filter((entry): entry is [string, unknown] => typeof entry[0] === 'string'))
    : {};
  const getGraphicsRectangles = (graphics: object | null) => {
    const x = Number(readNativeProperty(graphics, 'x')) || 0;
    const y = Number(readNativeProperty(graphics, 'y')) || 0;
    const data = readNativeProperty(readNativeProperty(graphics, 'geometry'), 'graphicsData');
    if (!Array.isArray(data)) return [];
    return data.flatMap(item => {
      const shape = readNativeProperty(item, 'shape');
      const width = Number(readNativeProperty(shape, 'width'));
      const height = Number(readNativeProperty(shape, 'height'));
      const shapeX = Number(readNativeProperty(shape, 'x'));
      const shapeY = Number(readNativeProperty(shape, 'y'));
      return [width, height, shapeX, shapeY].every(Number.isFinite)
        ? [{ height, width, x: x + shapeX, y: y + shapeY }]
        : [];
    });
  };
  const getGraphicsPolygons = (graphics: object | null) => {
    const data = readNativeProperty(readNativeProperty(graphics, 'geometry'), 'graphicsData');
    if (!Array.isArray(data)) return [];
    return data.flatMap(item => {
      const points = readNativeProperty(readNativeProperty(item, 'shape'), 'points');
      return Array.isArray(points) && points.every(point => Number.isFinite(Number(point)))
        ? [points.map(Number)]
        : [];
    });
  };
  const nativeOutlineX = Number(readNativeProperty(state.nativeOutline, 'x')) || 0;
  const nativeOutlineY = Number(readNativeProperty(state.nativeOutline, 'y')) || 0;
  const outlineParent = readNativeProperty(state.nativeOutline, 'parent');
  const outlineTransform = readNativeProperty(state.nativeOutline, 'worldTransform');
  const parentTransform = readNativeProperty(outlineParent, 'worldTransform');
  const transformOutlinePoint = (point: { x: number; y: number }) => {
    const transformed = callMethod(outlineTransform, 'apply', [point]);
    return isNativeObject(transformed)
      ? { x: Number(readNativeProperty(transformed, 'x')), y: Number(readNativeProperty(transformed, 'y')) }
      : { x: nativeOutlineX + point.x, y: nativeOutlineY + point.y };
  };
  const nativeChildren = readNativeProperty(state.nativeOutline, 'children');
  const nativePolygonData = getGraphicsPolygons(state.nativeOutline);
  const nativePolygons = nativePolygonData.map(points => Array.from({ length: points.length / 2 }).flatMap((_, index) => {
    const point = transformOutlinePoint({ x: points[index * 2] ?? 0, y: points[index * 2 + 1] ?? 0 });
    return [point.x, point.y];
  }));
  const nativePolygonBounds = nativePolygonData[0] && (() => {
    const xs = nativePolygonData[0].filter((_, index) => index % 2 === 0);
    const ys = nativePolygonData[0].filter((_, index) => index % 2 === 1);
    return {
      height: Math.max(...ys) - Math.min(...ys),
      width: Math.max(...xs) - Math.min(...xs),
      x: nativeOutlineX + Math.min(...xs),
      y: nativeOutlineY + Math.min(...ys),
    };
  })();
  const primaryGeometry = state.records[0] && isNativeObject(outlineParent)
    ? getWrapperOutlineGeometry(
        state.records[0].wrapper,
        outlineParent,
        getOutlineMode(state.records[0]),
      )
    : null;
  const renderedOutlinePolygons = primaryGeometry?.contours.map(points =>
    Array.from({ length: points.length / 2 }).flatMap((_, index) => {
      const transformed = callMethod(parentTransform, 'apply', [{
        x: points[index * 2] ?? 0,
        y: points[index * 2 + 1] ?? 0,
      }]);
      return [Number(readNativeProperty(transformed, 'x')), Number(readNativeProperty(transformed, 'y'))];
    })
  ) ?? [];
  return {
    activePaintColor: Number(readNativeProperty(readNativeProperty(state.tool, 'Av'), 'color')),
    background: isNativeObject(settings) ? {
      bottom: Number(readNativeProperty(settings, 'Xn')),
      top: Number(readNativeProperty(settings, 'Kn')),
    } : null,
    colorPickerActive: isColorPickerActive(),
    count: state.records.length,
    editorPointerModified,
    extraLabels: state.extraLabels.map(label => ({
      rotation: Number(readNativeProperty(label, 'rotation')) || 0,
      text: String(readNativeProperty(label, 'text') ?? ''),
      x: Number(readNativeProperty(label, 'x')),
      y: Number(readNativeProperty(label, 'y')),
    })),
    extraOutline: getGraphicsBounds(state.extraOutline),
    extraPolygons: getGraphicsPolygons(state.extraOutline),
    extraRectangles: getGraphicsRectangles(state.extraOutline),
    nativeCenter: transformOutlinePoint({ x: 0, y: 0 }),
    nativeChildren: Array.isArray(nativeChildren) ? nativeChildren.map(child => transformOutlinePoint({
      x: Number(readNativeProperty(child, 'x')),
      y: Number(readNativeProperty(child, 'y')),
    })) : [],
    nativeChildRotations: Array.isArray(nativeChildren)
      ? nativeChildren.map(child => Number(readNativeProperty(child, 'rotation')) || 0)
      : [],
    nativeOutline: getGraphicsBounds(state.nativeOutline),
    nativePolygons,
    nativeRotation: Number(readNativeProperty(state.nativeOutline, 'rotation')) || 0,
    nativeSelectionCount: getSelection(state.tool)?.length ?? 0,
    renderedOutlinePolygons,
    nativeRectangle: getGraphicsRectangles(state.nativeOutline)[0] ?? nativePolygonBounds ?? null,
    outlineScale: 1,
    marquee: getGraphicsBounds(state.marquee?.graphics ?? null),
    marqueeModified: state.marquee?.modified ?? false,
    propertyBindings: [...document.querySelectorAll<HTMLElement>('.editorPropertiesWindow input, .editorPropertiesWindow select')].flatMap(control => {
      const path = propertyPaths.get(control);
      return path ? [{ path: path.join('.'), title: control.closest('.row')?.querySelector('.title')?.textContent ?? '' }] : [];
    }),
    specialBodySelected: state.specialBodyId != null &&
      Number(readNativeProperty(state.records[0]?.model, 'id')) === state.specialBodyId,
    records: state.records.map(record => {
      const display = callMethod(record.wrapper, 'Bb');
      const points = Object.fromEntries(['Oa', 'Va', 'Ra'].flatMap(key => {
        const point = readNativeProperty(record.model, key);
        const x = Number(readNativeProperty(point, 'x'));
        const y = Number(readNativeProperty(point, 'y'));
        return Number.isFinite(x) && Number.isFinite(y) ? [[key, { x, y }]] : [];
      }));
      const shapes = record.type === 'shape'
        ? [record.model]
        : readNativeProperty(record.model, 'Sa');
      return {
        bounds: getWrapperBounds(record.wrapper),
        renderedBounds: getWrapperBounds({ Bb: () => getRenderedView(state, record) }),
        model: getValues(record.model),
        paint: getValues(getPaint(record)),
        points,
        renderRotation: Number(readNativeProperty(readNativeProperty(display, 'Ic'), 'rotation')) || 0,
        shapes: Array.isArray(shapes) ? shapes.filter(isNativeObject).map(shape => ({
          color: Number(readNativeProperty(shape, 'color')),
          points: Array.isArray(readNativeProperty(shape, 'ca'))
            ? (readNativeProperty(shape, 'ca') as unknown[]).filter(isNativeObject).map(point => ({
                x: Number(readNativeProperty(point, 'x')),
                y: Number(readNativeProperty(point, 'y')),
            }))
            : [],
          strokeColor: Number(readNativeProperty(shape, 'la')),
          strokeWidth: Number(readNativeProperty(shape, 'aa')),
          x: Number(readNativeProperty(shape, 'x')),
          y: Number(readNativeProperty(shape, 'y')),
        })) : [],
        type: record.type,
      };
    }),
  };
}
