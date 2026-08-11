import {
  type EditorMapMetadata,
  exportEditorMapData,
  getEditorMapMetadata,
  importEditorMapData,
} from '../hitbox/editor-map-adapter';
import {
  getEditorMapDataFromParsedJson,
  getReadableEditorMapJson,
  getValidatedEditorMapData,
} from '../hitbox/editor-map-codec';

interface EditorMapFileTransferControllerOptions {
  isForceSaveEnabled(): boolean;
  isEditorMapTransferEnabled(): boolean;
  useReadableMapFiles(): boolean;
}

type StatusKind = 'error' | 'success';

const EDITOR_FILE_MENU_SELECTOR = '.fileMenu';
const EDITOR_MENU_ITEM_SELECTOR = '.item';
const EDITOR_TRANSFER_ITEM_SELECTOR = '[data-qolbox-editor-map-transfer]';
const EDITOR_MAP_FILE_INPUT_ID = 'qolboxEditorMapFileInput';
const EDITOR_MAP_STATUS_ID = 'qolboxEditorMapStatus';
const EDITOR_FORCE_SAVE_ATTR = 'data-qolbox-editor-force-save';
const EDITOR_FORCE_SAVE_WAS_DISABLED_ATTR = 'data-qolbox-editor-force-save-was-disabled';
const EDITOR_MAP_COMPACT_FILE_EXTENSION = 'hitboxmap';
const EDITOR_MAP_JSON_FILE_EXTENSION = 'json';
const STATUS_HIDE_DELAY_MS = 2400;
const FILE_MENU_SYNC_RETRY_DELAYS_MS: readonly number[] = [0, 25, 75, 150, 300];
const MAX_FILENAME_PART_LENGTH = 80;
const MAX_DOWNLOAD_BASENAME_LENGTH = 180;
const MAX_EDITOR_MAP_FILE_SIZE_BYTES = 8 * 1024 * 1024;
const WINDOWS_RESERVED_FILENAMES = new Set([
  'CON',
  'PRN',
  'AUX',
  'NUL',
  'COM1',
  'COM2',
  'COM3',
  'COM4',
  'COM5',
  'COM6',
  'COM7',
  'COM8',
  'COM9',
  'LPT1',
  'LPT2',
  'LPT3',
  'LPT4',
  'LPT5',
  'LPT6',
  'LPT7',
  'LPT8',
  'LPT9',
]);

function getMenuItems(fileMenu: Element): HTMLElement[] {
  return Array.from(fileMenu.querySelectorAll(EDITOR_MENU_ITEM_SELECTOR)).filter(
    (child): child is HTMLElement => child instanceof HTMLElement
  );
}

function findMenuItem(fileMenu: Element, label: string): HTMLElement | null {
  return getMenuItems(fileMenu).find(item => item.textContent?.trim() === label) || null;
}

function getDownloadTimestamp(): string {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ` +
    `${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
}

function sanitizeFilenamePart(value: string | null): string | null {
  const cleaned = String(value || '')
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/^[. ]+|[. ]+$/g, '')
    .trim()
    .slice(0, MAX_FILENAME_PART_LENGTH)
    .replace(/[. ]+$/g, '');

  if (!cleaned) {
    return null;
  }

  return WINDOWS_RESERVED_FILENAMES.has(cleaned.toUpperCase()) ? `${cleaned} map` : cleaned;
}

function getMapDownloadBaseName(metadata: EditorMapMetadata): string {
  const title = sanitizeFilenamePart(metadata.title);
  const author = sanitizeFilenamePart(metadata.author);
  const exportedAt = getDownloadTimestamp();
  const parts = ['hitbox-map', title, author, exportedAt].filter((part): part is string => Boolean(part));
  return parts.join(' - ').slice(0, MAX_DOWNLOAD_BASENAME_LENGTH).replace(/[. ]+$/g, '') || `hitbox-map-${getDownloadTimestamp()}`;
}

function createEditorMapMenuItem(label: string, action: 'export' | 'import', handler: () => void): HTMLElement {
  const item = document.createElement('div');
  item.className = 'item';
  item.textContent = label;
  item.tabIndex = 0;
  item.setAttribute('role', 'menuitem');
  item.setAttribute('data-qolbox-editor-map-transfer', action);
  const activate = (event: Event) => {
    event.preventDefault();
    event.stopPropagation();
    item.closest<HTMLElement>(EDITOR_FILE_MENU_SELECTOR)?.click();
    handler();
  };
  item.addEventListener(
    'click',
    activate,
    true
  );
  item.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      item.click();
    }
  }, true);
  return item;
}

function extractMapDataFromFileText(fileText: string): string | null {
  const trimmedText = fileText.trim();
  if (!trimmedText) {
    return null;
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(trimmedText) as unknown;
  } catch {
    return getValidatedEditorMapData(trimmedText);
  }

  return getEditorMapDataFromParsedJson(parsedJson);
}

export function createEditorMapFileTransferController(options: EditorMapFileTransferControllerOptions) {
  let statusHideTimer = 0;
  let documentHooksInstalled = false;
  let fileMenuSyncGeneration = 0;
  let lastPreOpenSyncedFileMenu: Element | null = null;
  let lastPreOpenSyncTime = 0;

  function getStatusElement(): HTMLElement | null {
    let status = document.getElementById(EDITOR_MAP_STATUS_ID);
    if (status instanceof HTMLElement) {
      return status;
    }

    const host = document.body || document.documentElement;
    if (!host) {
      return null;
    }

    status = document.createElement('div');
    status.id = EDITOR_MAP_STATUS_ID;
    status.className = 'qolboxEditorMapStatus';
    status.setAttribute('aria-live', 'polite');
    status.setAttribute('role', 'status');
    host.appendChild(status);
    return status;
  }

  function showStatus(message: string, kind: StatusKind = 'success'): void {
    const status = getStatusElement();
    if (!status) {
      return;
    }

    window.clearTimeout(statusHideTimer);
    status.textContent = message;
    status.classList.toggle('error', kind === 'error');
    status.classList.add('visible');
    statusHideTimer = window.setTimeout(() => {
      status.classList.remove('visible');
    }, STATUS_HIDE_DELAY_MS);
  }

  function closeOpenFileMenu(): void {
    const fileMenu = document.querySelector<HTMLElement>(EDITOR_FILE_MENU_SELECTOR);
    const dropdown = fileMenu?.querySelector<HTMLElement>('.container');
    if (fileMenu && dropdown && dropdown.getBoundingClientRect().height > 0) {
      fileMenu.click();
    }
  }

  function getFileInput(): HTMLInputElement | null {
    const existingInput = document.getElementById(EDITOR_MAP_FILE_INPUT_ID);
    if (existingInput instanceof HTMLInputElement) {
      return existingInput;
    }

    const host = document.body || document.documentElement;
    if (!host) {
      return null;
    }

    const input = document.createElement('input');
    input.id = EDITOR_MAP_FILE_INPUT_ID;
    input.type = 'file';
    input.accept = `.${EDITOR_MAP_COMPACT_FILE_EXTENSION},.${EDITOR_MAP_JSON_FILE_EXTENSION},.txt,application/json,text/plain`;
    input.style.display = 'none';
    input.addEventListener('change', () => {
      const file = input.files?.[0] || null;
      input.value = '';
      if (file) {
        void importMapFile(file);
      }
    });

    host.appendChild(input);
    return input;
  }

  function exportCurrentEditorMap(): void {
    const mapData = exportEditorMapData();
    if (!mapData) {
      showStatus('No editor map is available to export.', 'error');
      return;
    }

    try {
      const preferReadableFiles = options.useReadableMapFiles();
      const readableJson = preferReadableFiles ? getReadableEditorMapJson(mapData) : null;
      const exportText = readableJson || mapData;
      const fileExtension = readableJson ? EDITOR_MAP_JSON_FILE_EXTENSION : EDITOR_MAP_COMPACT_FILE_EXTENSION;
      const contentType = readableJson ? 'application/json;charset=utf-8' : 'text/plain;charset=utf-8';
      const blob = new Blob([exportText], { type: contentType });
      const objectUrl = URL.createObjectURL(blob);
      const downloadBaseName = getMapDownloadBaseName(getEditorMapMetadata());
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = `${downloadBaseName}.${fileExtension}`;
      anchor.style.display = 'none';
      (document.body || document.documentElement).appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      showStatus(readableJson || !preferReadableFiles ? 'Map export started.' : 'Map export started as compact data.');
    } catch {
      showStatus('Could not export this map.', 'error');
    }
  }

  function requestMapImport(): void {
    const input = getFileInput();
    if (!input) {
      showStatus('Could not open the file picker.', 'error');
      return;
    }

    input.click();
  }

  async function importMapFile(file: File): Promise<void> {
    if (file.size > MAX_EDITOR_MAP_FILE_SIZE_BYTES) {
      showStatus('This map file is too large to import safely.', 'error');
      return;
    }

    try {
      const mapData = extractMapDataFromFileText(await file.text());
      if (!mapData) {
        showStatus('Could not import this map file.', 'error');
        return;
      }

      const previousMapData = exportEditorMapData();
      if (!previousMapData) {
        showStatus('Could not back up the current map, so import was cancelled.', 'error');
        return;
      }

      if (!importEditorMapData(mapData)) {
        const restored = importEditorMapData(previousMapData);
        showStatus(
          restored
            ? 'Could not import this map file. The previous map was restored.'
            : 'Import failed and the previous map could not be restored.',
          'error'
        );
        return;
      }

      closeOpenFileMenu();
      showStatus('Map imported.');
    } catch {
      showStatus('Could not import this map file.', 'error');
    }
  }

  function removeTransferItems(fileMenu: Element = document.documentElement): void {
    fileMenuSyncGeneration += 1;
    fileMenu.querySelectorAll(EDITOR_TRANSFER_ITEM_SELECTOR).forEach(item => item.remove());
  }

  function restoreSaveItem(saveItem: Element): boolean {
    if (!(saveItem instanceof HTMLElement) || !saveItem.hasAttribute(EDITOR_FORCE_SAVE_ATTR)) {
      return false;
    }

    if (saveItem.getAttribute(EDITOR_FORCE_SAVE_WAS_DISABLED_ATTR) === 'true') {
      saveItem.classList.add('disabled');
      saveItem.setAttribute('aria-disabled', 'true');
    }

    saveItem.removeAttribute(EDITOR_FORCE_SAVE_ATTR);
    saveItem.removeAttribute(EDITOR_FORCE_SAVE_WAS_DISABLED_ATTR);
    return true;
  }

  function restoreSaveItems(root: Element | Document = document): boolean {
    let restored = false;
    root.querySelectorAll(`[${EDITOR_FORCE_SAVE_ATTR}]`).forEach(saveItem => {
      restored = restoreSaveItem(saveItem) || restored;
    });
    return restored;
  }

  function syncSaveItem(fileMenu: Element): boolean {
    const saveItem = findMenuItem(fileMenu, 'Save');
    if (!(saveItem instanceof HTMLElement)) {
      return false;
    }

    if (!options.isForceSaveEnabled()) {
      return restoreSaveItem(saveItem);
    }

    const firstSync = !saveItem.hasAttribute(EDITOR_FORCE_SAVE_ATTR);
    const wasDisabled = saveItem.classList.contains('disabled') || saveItem.getAttribute('aria-disabled') === 'true';
    if (firstSync) {
      saveItem.setAttribute(EDITOR_FORCE_SAVE_ATTR, 'true');
      saveItem.setAttribute(EDITOR_FORCE_SAVE_WAS_DISABLED_ATTR, wasDisabled ? 'true' : 'false');
    }
    saveItem.classList.remove('disabled');
    saveItem.setAttribute('aria-disabled', 'false');
    return firstSync && wasDisabled;
  }

  function syncOpenFileMenu(fileMenu: Element): boolean {
    const mapTransferEnabled = options.isEditorMapTransferEnabled();
    const forceSaveEnabled = options.isForceSaveEnabled();

    if (!mapTransferEnabled && !forceSaveEnabled) {
      removeTransferItems(fileMenu);
      restoreSaveItems(fileMenu);
      return false;
    }

    const saveChanged = forceSaveEnabled ? syncSaveItem(fileMenu) : restoreSaveItems(fileMenu);
    if (!mapTransferEnabled) {
      removeTransferItems(fileMenu);
      return saveChanged;
    }

    const loadItem = findMenuItem(fileMenu, 'Load');
    const dropdownContainer = loadItem?.parentElement || null;
    if (!loadItem || !dropdownContainer) {
      return saveChanged;
    }

    if (dropdownContainer.querySelector(EDITOR_TRANSFER_ITEM_SELECTOR)) {
      return saveChanged;
    }

    const exportItem = createEditorMapMenuItem('Export', 'export', exportCurrentEditorMap);
    const importItem = createEditorMapMenuItem('Import', 'import', requestMapImport);
    dropdownContainer.insertBefore(exportItem, loadItem);
    dropdownContainer.insertBefore(importItem, loadItem);
    return true;
  }

  function getEventFileMenu(event: Event): Element | null {
    return event.target instanceof Element ? event.target.closest(EDITOR_FILE_MENU_SELECTOR) : null;
  }

  function scheduleOpenFileMenuSync(fileMenu: Element): void {
    const syncGeneration = ++fileMenuSyncGeneration;
    for (const delay of FILE_MENU_SYNC_RETRY_DELAYS_MS) {
      window.setTimeout(() => {
        if (syncGeneration === fileMenuSyncGeneration && fileMenu.isConnected) {
          syncOpenFileMenu(fileMenu);
        }
      }, delay);
    }
  }

  function handleFileMenuPreOpen(event: Event): void {
    const fileMenu = getEventFileMenu(event);
    if (!fileMenu) {
      removeTransferItems();
      return;
    }

    syncOpenFileMenu(fileMenu);
    lastPreOpenSyncedFileMenu = fileMenu;
    lastPreOpenSyncTime = Date.now();
  }

  function installDocumentHooks(): boolean {
    if (documentHooksInstalled) {
      return false;
    }

    documentHooksInstalled = true;
    document.addEventListener('pointerdown', handleFileMenuPreOpen, true);
    document.addEventListener('mousedown', handleFileMenuPreOpen, true);
    document.addEventListener(
      'click',
      event => {
        const clickedFileMenu = getEventFileMenu(event);
        const hadTransferItems = Boolean(clickedFileMenu?.querySelector(EDITOR_TRANSFER_ITEM_SELECTOR));
        const clickedTransferItem = event.target instanceof Element
          && Boolean(event.target.closest(EDITOR_TRANSFER_ITEM_SELECTOR));
        const recentlySyncedBeforeOpen = clickedFileMenu === lastPreOpenSyncedFileMenu
          && Date.now() - lastPreOpenSyncTime < 500;
        window.setTimeout(() => {
          if (!clickedFileMenu) {
            removeTransferItems();
            return;
          }

          if (clickedTransferItem || (hadTransferItems && !recentlySyncedBeforeOpen)) {
            removeTransferItems(clickedFileMenu);
            return;
          }

          scheduleOpenFileMenuSync(clickedFileMenu);
        }, 0);
      },
      true
    );
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape') {
        removeTransferItems();
      }
    }, true);
    return true;
  }

  function removeEditorMapFileTransfer(): void {
    window.clearTimeout(statusHideTimer);
    removeTransferItems();
    restoreSaveItems();
    document.getElementById(EDITOR_MAP_FILE_INPUT_ID)?.remove();
    document.getElementById(EDITOR_MAP_STATUS_ID)?.remove();
  }

  function patchEditorMapFileTransfer(): boolean {
    if (!options.isEditorMapTransferEnabled() && !options.isForceSaveEnabled()) {
      removeEditorMapFileTransfer();
      return false;
    }

    if (!options.isForceSaveEnabled()) {
      restoreSaveItems();
    }

    const installed = installDocumentHooks();
    document.querySelectorAll(EDITOR_FILE_MENU_SELECTOR).forEach(fileMenu => {
      const loadItem = findMenuItem(fileMenu, 'Load');
      if (loadItem && loadItem.getBoundingClientRect().height > 0) {
        syncOpenFileMenu(fileMenu);
      }
    });
    return installed;
  }

  return {
    patchEditorMapFileTransfer,
    removeEditorMapFileTransfer,
  };
}
