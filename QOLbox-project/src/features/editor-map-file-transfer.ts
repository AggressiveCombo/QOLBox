import { exportEditorMapData, importEditorMapData } from '../hitbox/editor-map-adapter';

interface EditorMapFileTransferControllerOptions {
  isEditorMapTransferEnabled(): boolean;
}

type StatusKind = 'error' | 'success';

const EDITOR_FILE_MENU_SELECTOR = '.fileMenu';
const EDITOR_MENU_ITEM_SELECTOR = '.item';
const EDITOR_TRANSFER_ITEM_SELECTOR = '[data-qolbox-editor-map-transfer]';
const EDITOR_MAP_FILE_INPUT_ID = 'qolboxEditorMapFileInput';
const EDITOR_MAP_STATUS_ID = 'qolboxEditorMapStatus';
const EDITOR_MAP_FILE_EXTENSION = 'hitboxmap';
const STATUS_HIDE_DELAY_MS = 2400;

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
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    '-',
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join('');
}

function createEditorMapMenuItem(label: string, action: 'export' | 'import', handler: () => void): HTMLElement {
  const item = document.createElement('div');
  item.className = 'item';
  item.textContent = label;
  item.setAttribute('data-qolbox-editor-map-transfer', action);
  item.addEventListener(
    'click',
    event => {
      event.preventDefault();
      event.stopPropagation();
      handler();
    },
    true
  );
  return item;
}

function isStringRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function extractMapDataFromParsedJson(value: unknown): string | null {
  if (typeof value === 'string') {
    return value.trim() || null;
  }

  if (!isStringRecord(value)) {
    return null;
  }

  for (const key of ['leveldata', 'levelData', 'map', 'mapData', 'data']) {
    const mapData = value[key];
    if (typeof mapData === 'string' && mapData.trim()) {
      return mapData.trim();
    }
  }

  return null;
}

function extractMapDataFromFileText(fileText: string): string | null {
  const trimmedText = fileText.trim();
  if (!trimmedText) {
    return null;
  }

  try {
    const jsonMapData = extractMapDataFromParsedJson(JSON.parse(trimmedText) as unknown);
    if (jsonMapData) {
      return jsonMapData;
    }
  } catch {
    // Native exports are plain compact map strings, not JSON.
  }

  return trimmedText;
}

export function createEditorMapFileTransferController(options: EditorMapFileTransferControllerOptions) {
  let statusHideTimer = 0;
  let documentHooksInstalled = false;

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
    input.accept = `.${EDITOR_MAP_FILE_EXTENSION},.txt,.json,application/json,text/plain`;
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
      const blob = new Blob([mapData], { type: 'text/plain;charset=utf-8' });
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = `hitbox-map-${getDownloadTimestamp()}.${EDITOR_MAP_FILE_EXTENSION}`;
      anchor.style.display = 'none';
      (document.body || document.documentElement).appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
      showStatus('Map export started.');
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
    try {
      const mapData = extractMapDataFromFileText(await file.text());
      if (!mapData || !importEditorMapData(mapData)) {
        showStatus('Could not import this map file.', 'error');
        return;
      }

      showStatus('Map imported.');
    } catch {
      showStatus('Could not import this map file.', 'error');
    }
  }

  function removeTransferItems(fileMenu: Element = document.documentElement): void {
    fileMenu.querySelectorAll(EDITOR_TRANSFER_ITEM_SELECTOR).forEach(item => item.remove());
  }

  function syncOpenFileMenu(fileMenu: Element): boolean {
    if (!options.isEditorMapTransferEnabled()) {
      removeTransferItems(fileMenu);
      return false;
    }

    const loadItem = findMenuItem(fileMenu, 'Load');
    const dropdownContainer = loadItem?.parentElement || null;
    if (!loadItem || !dropdownContainer) {
      return false;
    }

    if (dropdownContainer.querySelector(EDITOR_TRANSFER_ITEM_SELECTOR)) {
      return false;
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

  function installDocumentHooks(): boolean {
    if (documentHooksInstalled) {
      return false;
    }

    documentHooksInstalled = true;
    document.addEventListener(
      'click',
      event => {
        const clickedFileMenu = getEventFileMenu(event);
        const hadTransferItems = Boolean(clickedFileMenu?.querySelector(EDITOR_TRANSFER_ITEM_SELECTOR));
        window.setTimeout(() => {
          if (!clickedFileMenu) {
            removeTransferItems();
            return;
          }

          if (hadTransferItems) {
            removeTransferItems(clickedFileMenu);
            return;
          }

          syncOpenFileMenu(clickedFileMenu);
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
    document.getElementById(EDITOR_MAP_FILE_INPUT_ID)?.remove();
    document.getElementById(EDITOR_MAP_STATUS_ID)?.remove();
  }

  function patchEditorMapFileTransfer(): boolean {
    if (!options.isEditorMapTransferEnabled()) {
      removeEditorMapFileTransfer();
      return false;
    }

    return installDocumentHooks();
  }

  return {
    patchEditorMapFileTransfer,
    removeEditorMapFileTransfer,
  };
}
