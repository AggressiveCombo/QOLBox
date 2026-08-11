import { QOLBOX_VERSION } from './qolbox-version';
import { getLocalStorageItem, setLocalStorageItem } from '../utils/local-storage';
import { isRecord } from '../utils/object-properties';

export type QolboxReleaseNoteSource = 'github' | 'greasyfork' | 'local-fallback';

export interface QolboxReleaseNote {
  notes: readonly string[];
  publishedAt?: string;
  source: QolboxReleaseNoteSource;
  url?: string;
  version: string;
}

export interface QolboxReleaseHistoryState {
  notes: readonly QolboxReleaseNote[];
  status: 'fallback' | 'loading' | 'ready';
}

interface GitHubReleaseRecord {
  body?: unknown;
  draft?: unknown;
  html_url?: unknown;
  name?: unknown;
  prerelease?: unknown;
  published_at?: unknown;
  tag_name?: unknown;
}

interface VersionPoint {
  parts: readonly [number, number, number];
  prereleaseWeight: number;
  wildcardIndex: number | null;
}

interface ReleaseHistoryCacheRecord {
  entries: QolboxReleaseNote[];
  fetchedAt: number;
}

interface ReleaseHistoryBridgeResponse {
  error?: unknown;
  id?: unknown;
  ok?: unknown;
  source?: unknown;
  status?: unknown;
  text?: unknown;
  type?: unknown;
}

type ReleaseHistoryUpdateCallback = (state: QolboxReleaseHistoryState) => void;
type ReleaseHistoryEndpoint = 'github' | 'greasyfork';

declare global {
  interface Window {
    __qolboxReleaseHistoryBridgeReady?: boolean;
  }
}

const GREASYFORK_HISTORY_URL = 'https://greasyfork.org/en/scripts/568667-qolbox/versions?show_all_versions=1';
const GITHUB_RELEASES_URL = 'https://api.github.com/repos/AggressiveCombo/QOLBox/releases?per_page=100';
const RELEASE_HISTORY_CACHE_KEY = 'vm.hitbox.qolboxReleaseHistory.v2';
const RELEASE_HISTORY_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const RELEASE_HISTORY_FETCH_TIMEOUT_MS = 7000;
const RELEASE_HISTORY_BRIDGE_REQUEST_SOURCE = 'qolbox-release-history';
const RELEASE_HISTORY_BRIDGE_RESPONSE_SOURCE = 'qolbox-release-history-bridge';
const RELEASE_HISTORY_BRIDGE_REQUEST_TYPE = 'fetch';
const RELEASE_HISTORY_BRIDGE_RESPONSE_TYPE = 'fetch-result';
const LOCAL_CURRENT_RELEASE_FALLBACK_NOTES: readonly string[] = QOLBOX_VERSION.replace(/-dev$/i, '') === '3.0.0'
  ? [
      'Added editor multi-selection with Shift/Ctrl clicking and drag-box area selection; selected objects can be moved, copied, pasted, deleted, undone, redone, and edited together.',
      'Added shared editor property editing: different values show Mixed, fill and stroke swatches show every distinct selected color, unsupported objects stay unchanged, and selected object IDs remain visible.',
      'Added merged-body workflows, including group movement, rotation, mirroring and clipboard operations, direct Ctrl-click subbody editing, and Ungroup in Subbody Properties.',
      'Added horizontal and vertical Mirror actions plus relative value commands such as =+3 and =-3.',
      'Added an editor color picker with the I shortcut, fill/outline sampling, and exact #RGB or #RRGGBB fields for fill, stroke, and map background colors.',
      'Added exact #RGB or #RRGGBB entry for the native player appearance color.',
      'Added references for QOLBox controls, compact command syntax, sound-bank manifests, and effect filenames, plus a one-time step-by-step improved-editor introduction and a permanent Editor Help menu.',
      'Added an Editor Save option that keeps Hitbox\'s native Save action available after loading a map.',
      'Added View Patch Notes to the QOLBox About page.',
      'Added Room List to the in-room hamburger so the native browser opens over the current lobby or match and disconnects the current session before joining another room, plus Player Info for the registered-player level and exact XP progress Hitbox exposes.',
      'Added customizable QOLBox and Hitbox interface accent colors, with exact hex entry, contrast-aware text and icons, a themed native player emblem, and an option to keep both accents linked or separate.',
      'Added system-aware light mode for Hitbox and QOLBox, with readable themed surfaces and System, Dark, and Light choices in Appearance.',
      'Added inline slash-command completion with Tab or Right Arrow to accept and Up or Down Arrow to cycle matching commands.',
      'Added saved custom sound banks that replace individual game effects with uploaded audio or direct-URL manifests, include volume-matched previews, and keep the complete Vanilla bank available.',
      'Improved fullscreen rendering so the game stays sharp at the monitor\'s displayed resolution while preserving Hitbox\'s native camera, UI scale, and browser-zoom behavior, with proportionally cropped backgrounds instead of stretching or tiling at unusual aspect ratios.',
      'Improved editor outlines and hit testing so rotated polygons, circles, rectangles, and joints remain aligned through zoom and selection changes, and polygon selection follows the actual shape.',
      'Improved editor camera and map lifecycle behavior so the first view and new maps are centered, fullscreen changes preserve the same position and relative zoom, and stale selections or IDs do not survive map replacement.',
      'Improved editor zoom safety and WebGL recovery by respecting the active device\'s rendering limits and rebuilding the current game or editor scene after a restored context.',
      'Improved editor map import/export with descriptive filenames, optional readable JSON exports, strict validation, an 8 MiB input limit, backup-and-rollback imports, and support for compact .hitboxmap, readable JSON, and compatible text files.',
      'Improved keyboard navigation across the main menu, server browser, Quick Play, hamburger menus, lobby and map controls, native dialogs, and editor menus, including contained tab order and focus restoration.',
      'Improved the map browser so long descriptions can be scrolled and published-map like/dislike icons work with mouse or keyboard input.',
      'Improved Load Map responsiveness by pausing automatic previews during scrolling, rendering ordinary previews progressively, and skipping oversized automatic previews without blocking the selected map.',
      'Improved action clarity with icons across main, hamburger, Room List, QOLBox, popup, and editor controls, and consolidated Volume, Music, and Jukebox under one expandable Audio command with persistent mute controls and fine volume dragging.',
      'Improved in-game chat formatting so command results and jukebox suggestions retain the same semantic colors and action emphasis as the lobby.',
      'Improved the QOLBox menu with a larger responsive panel that can be resized and remembers its size, one global QOLBox Defaults action, cleaner footer placement, and reliable short-window scrolling.',
      'Improved fullscreen HUD spacing so spectator controls, the jukebox, editor object counter, and player action menus keep stable positions and margins as controls open or close.',
      'Fixed lobby music playing in-game; it now stops in lobbies and games and resumes after leaving.',
      'Fixed cancelling Reserve Spots leaving stale room selection or button state behind.',
      'Fixed update history showing releases outside the installed-to-current version range.',
      'Fixed editor color wheels staying open after clicking the black void outside the map, and made open File, Tools, and Settings dropdowns close when the pointer leaves them.',
      'Fixed editor map actions leaving the File dropdown open or disappearing after native menu refreshes.',
      'Fixed the editor export fallback being able to trigger a real Play transition.',
      'Fixed editor object dragging and camera panning competing for the same pointer input.',
      'Fixed native connecting and loading controls so Cancel closes every popup without stale room selection, long errors wrap inside dialogs, and Room List refresh cannot leave a duplicate or permanently stuck spinner.',
    ]
  : ['No public update notes were found for this version.'];
const GREASYFORK_EMPTY_HISTORY_NOTES: readonly string[] = [
  'No public update notes were posted for this version.',
];
const INITIAL_RELEASE_NOTES: readonly string[] = [
  'Initial release.',
  'Persisted Hitbox game and jukebox volume, with wheel controls and jukebox mute.',
];

const LOCAL_CURRENT_RELEASE_FALLBACK: readonly QolboxReleaseNote[] = [
  {
    version: QOLBOX_VERSION,
    source: 'local-fallback',
    notes: LOCAL_CURRENT_RELEASE_FALLBACK_NOTES,
  },
];

function normalizeVersionKey(version: unknown): string {
  return String(version || '').trim().replace(/^v/i, '').toLowerCase();
}

function parseVersionPoint(version: unknown): VersionPoint | null {
  const normalized = normalizeVersionKey(version);
  if (!normalized) {
    return null;
  }

  const [main = '', prerelease = ''] = normalized.split('-', 2);
  const rawParts = main.split('.');
  if (!main || rawParts.length > 3) {
    return null;
  }
  const parts: number[] = [];
  let wildcardIndex: number | null = null;

  for (let index = 0; index < 3; index += 1) {
    const rawPart = rawParts[index] ?? '0';
    if (/^(x|\*)$/i.test(rawPart)) {
      if (wildcardIndex === null) {
        wildcardIndex = index;
      }
      parts.push(0);
      continue;
    }

    if (!/^\d+$/.test(rawPart)) {
      return null;
    }

    parts.push(Number(rawPart));
  }

  return {
    parts: parts as [number, number, number],
    prereleaseWeight: prerelease ? -1 : 0,
    wildcardIndex,
  };
}

function compareVersionPoints(left: VersionPoint, right: VersionPoint): number {
  for (let index = 0; index < 3; index += 1) {
    const delta = (left.parts[index] ?? 0) - (right.parts[index] ?? 0);
    if (delta) {
      return delta;
    }
  }

  return left.prereleaseWeight - right.prereleaseWeight;
}

function getWildcardUpperBound(point: VersionPoint): VersionPoint {
  if (point.wildcardIndex === null) {
    return point;
  }

  const parts = [...point.parts] as [number, number, number];
  for (let index = point.wildcardIndex; index < 3; index += 1) {
    parts[index] = Number.MAX_SAFE_INTEGER;
  }

  return {
    parts,
    prereleaseWeight: 0,
    wildcardIndex: null,
  };
}

function isVersionInUpgradeRange(version: string, previousVersion: string | null, currentVersion: string): boolean {
  const versionPoint = parseVersionPoint(version);
  const currentPoint = parseVersionPoint(currentVersion);
  if (!versionPoint) {
    return false;
  }

  if (currentPoint && compareVersionPoints(versionPoint, currentPoint) > 0) {
    return false;
  }

  if (!previousVersion) {
    return true;
  }

  const previousPoint = parseVersionPoint(previousVersion);
  if (!previousPoint) {
    return true;
  }

  const previousUpperBound = getWildcardUpperBound(previousPoint);
  return compareVersionPoints(versionPoint, previousUpperBound) > 0;
}

function compareReleaseVersionsNewestFirst(left: QolboxReleaseNote, right: QolboxReleaseNote): number {
  const leftPoint = parseVersionPoint(left.version);
  const rightPoint = parseVersionPoint(right.version);
  if (leftPoint && rightPoint) {
    const versionDelta = compareVersionPoints(rightPoint, leftPoint);
    if (versionDelta) {
      return versionDelta;
    }
  }

  return getReleaseTimestamp(right) - getReleaseTimestamp(left);
}

function getReleaseTimestamp(entry: QolboxReleaseNote): number {
  const timestamp = entry.publishedAt ? Date.parse(entry.publishedAt) : 0;
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function getSourcePriority(source: QolboxReleaseNoteSource): number {
  switch (source) {
    case 'github':
      return 3;
    case 'greasyfork':
      return 2;
    case 'local-fallback':
    default:
      return 1;
  }
}

function hasReleaseHistoryText(entry: QolboxReleaseNote): boolean {
  return !entry.notes.every(note => GREASYFORK_EMPTY_HISTORY_NOTES.includes(note));
}

function shouldReplaceReleaseEntry(next: QolboxReleaseNote, current: QolboxReleaseNote): boolean {
  const sourcePriorityDelta = getSourcePriority(next.source) - getSourcePriority(current.source);
  if (sourcePriorityDelta) {
    return sourcePriorityDelta > 0;
  }

  const noteQualityDelta = Number(hasReleaseHistoryText(next)) - Number(hasReleaseHistoryText(current));
  if (noteQualityDelta) {
    return noteQualityDelta > 0;
  }

  const timestampDelta = getReleaseTimestamp(next) - getReleaseTimestamp(current);
  if (timestampDelta) {
    return timestampDelta > 0;
  }
  return false;
}

function dedupeLatestReleaseEntries(entries: readonly QolboxReleaseNote[]): QolboxReleaseNote[] {
  const byVersion = new Map<string, QolboxReleaseNote>();

  for (const entry of entries) {
    const versionKey = normalizeVersionKey(entry.version);
    if (!versionKey || !entry.notes.length) {
      continue;
    }

    const current = byVersion.get(versionKey);
    if (!current || shouldReplaceReleaseEntry(entry, current)) {
      byVersion.set(versionKey, entry);
    }
  }

  return Array.from(byVersion.values()).sort(compareReleaseVersionsNewestFirst);
}

function cleanReleaseText(text: string): string {
  return text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/__([^_]+)__/g, '$1')
    .replace(/(^|[\s(])([*_])([^*_\n]+)\2(?=$|[\s).,;:!?])/g, '$1$3')
    .replace(/^>\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function extractMarkdownNotes(markdown: unknown): string[] {
  if (typeof markdown !== 'string') {
    return [];
  }

  const notes: string[] = [];
  for (const rawLine of markdown.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || /^#{1,6}\s+/.test(line)) {
      continue;
    }

    const bulletMatch = line.match(/^[-*+]\s+(.+)$/) || line.match(/^\d+[.)]\s+(.+)$/);
    if (bulletMatch) {
      const note = cleanReleaseText(bulletMatch[1] ?? '');
      if (note) {
        notes.push(note);
      }
    }
  }

  if (notes.length) {
    return notes;
  }

  const fallback = markdown
    .split(/\r?\n/)
    .map(cleanReleaseText)
    .find(line => line && !/^#{1,6}\s+/.test(line));
  return fallback ? [fallback] : [];
}

function parseGitHubReleaseEntries(rawValue: unknown): QolboxReleaseNote[] {
  if (!Array.isArray(rawValue)) {
    return [];
  }

  return rawValue
    .filter((record): record is GitHubReleaseRecord => isRecord(record))
    .filter(record => record.draft !== true && record.prerelease !== true)
    .map(record => {
      const version = normalizeVersionKey(record.tag_name);
      const notes = extractMarkdownNotes(record.body);
      return {
        version,
        source: 'github' as const,
        publishedAt: typeof record.published_at === 'string' ? record.published_at : undefined,
        url: typeof record.html_url === 'string' ? record.html_url : undefined,
        notes: notes.length
          ? notes
          : [cleanReleaseText(typeof record.name === 'string' ? record.name : `QOLBox ${version}`)],
      };
    })
    .filter(entry => entry.version && entry.notes.length);
}

async function fetchTextWithPageFetch(url: string, headers: Record<string, string>): Promise<string> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), RELEASE_HISTORY_FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        ...headers,
      },
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.text();
  } finally {
    window.clearTimeout(timer);
  }
}

function isReleaseHistoryBridgeResponse(value: unknown, id: string): value is ReleaseHistoryBridgeResponse {
  return (
    isRecord(value) &&
    value.source === RELEASE_HISTORY_BRIDGE_RESPONSE_SOURCE &&
    value.type === RELEASE_HISTORY_BRIDGE_RESPONSE_TYPE &&
    value.id === id
  );
}

function makeBridgeRequestId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function fetchTextWithUserscriptBridge(endpoint: ReleaseHistoryEndpoint): Promise<string> {
  if (!window.__qolboxReleaseHistoryBridgeReady) {
    return Promise.reject(new Error('Release-history bridge is unavailable.'));
  }

  return new Promise((resolve, reject) => {
    const id = makeBridgeRequestId();
    const timer = window.setTimeout(() => {
      cleanup();
      reject(new Error('Release-history bridge timed out.'));
    }, RELEASE_HISTORY_FETCH_TIMEOUT_MS);

    const cleanup = () => {
      window.clearTimeout(timer);
      window.removeEventListener('message', handleBridgeMessage);
    };

    const handleBridgeMessage = (event: MessageEvent) => {
      if (event.source !== window || !isReleaseHistoryBridgeResponse(event.data, id)) {
        return;
      }

      cleanup();
      if (event.data.ok === true && typeof event.data.text === 'string') {
        resolve(event.data.text);
        return;
      }

      reject(new Error(typeof event.data.error === 'string' ? event.data.error : 'Release-history bridge failed.'));
    };

    window.addEventListener('message', handleBridgeMessage);
    window.postMessage(
      {
        source: RELEASE_HISTORY_BRIDGE_REQUEST_SOURCE,
        type: RELEASE_HISTORY_BRIDGE_REQUEST_TYPE,
        id,
        endpoint,
      },
      window.location.origin
    );
  });
}

function getReleaseHistoryEndpoint(url: string): ReleaseHistoryEndpoint | null {
  if (url === GITHUB_RELEASES_URL) {
    return 'github';
  }

  return url === GREASYFORK_HISTORY_URL ? 'greasyfork' : null;
}

function firstFulfilled<T>(promises: readonly Promise<T>[]): Promise<T> {
  return new Promise((resolve, reject) => {
    let rejectionCount = 0;
    let lastError: unknown = null;

    for (const promise of promises) {
      promise.then(resolve, error => {
        rejectionCount += 1;
        lastError = error;
        if (rejectionCount >= promises.length) {
          reject(lastError);
        }
      });
    }
  });
}

async function fetchText(url: string, headers: Record<string, string> = {}): Promise<string> {
  const endpoint = getReleaseHistoryEndpoint(url);
  if (!endpoint) {
    throw new Error('Unknown release-history endpoint.');
  }

  const requestHeaders = {
    Accept: 'text/html',
    ...headers,
  };

  if (endpoint === 'github') {
    try {
      return await fetchTextWithPageFetch(url, requestHeaders);
    } catch {
      return fetchTextWithUserscriptBridge(endpoint);
    }
  }

  return fetchTextWithUserscriptBridge(endpoint);
}

async function fetchJson(url: string, headers: Record<string, string> = {}): Promise<unknown> {
  return JSON.parse(await fetchText(url, {
    Accept: 'application/json',
    ...headers,
  }));
}

async function fetchGitHubReleaseEntries(): Promise<QolboxReleaseNote[]> {
  return parseGitHubReleaseEntries(await fetchJson(GITHUB_RELEASES_URL));
}

function getGreasyForkHistoryNotes(version: string, changelogElement: Element | null): readonly string[] {
  if (!changelogElement) {
    return version === '1.0.0' ? INITIAL_RELEASE_NOTES : GREASYFORK_EMPTY_HISTORY_NOTES;
  }

  const notes = Array.from(changelogElement.querySelectorAll('li, p'))
    .map(element => cleanReleaseText(element.textContent || ''))
    .filter(Boolean);

  return notes.length ? notes : GREASYFORK_EMPTY_HISTORY_NOTES;
}

function parseGreasyForkHistoryEntries(html: string): QolboxReleaseNote[] {
  const document = new DOMParser().parseFromString(html, 'text/html');
  return Array.from(document.querySelectorAll('.history_versions > li'))
    .map((item): QolboxReleaseNote | null => {
      const versionLink = item.querySelector('.version-number a');
      const version = normalizeVersionKey(versionLink?.textContent);
      if (!version) {
        return null;
      }

      const href = versionLink?.getAttribute('href') || '';
      return {
        version,
        source: 'greasyfork' as const,
        publishedAt: item.querySelector('relative-time')?.getAttribute('datetime') || undefined,
        url: href ? new URL(href, GREASYFORK_HISTORY_URL).href : undefined,
        notes: getGreasyForkHistoryNotes(version, item.querySelector('.version-changelog')),
      };
    })
    .filter((entry): entry is QolboxReleaseNote => Boolean(entry));
}

async function fetchGreasyForkReleaseEntries(): Promise<QolboxReleaseNote[]> {
  return parseGreasyForkHistoryEntries(await fetchText(GREASYFORK_HISTORY_URL));
}

function getReleaseHistoryStateFromEntries(
  previousVersion: string | null,
  currentVersion: string,
  entries: readonly QolboxReleaseNote[],
  status: QolboxReleaseHistoryState['status'] = 'ready'
): QolboxReleaseHistoryState {
  return {
    status,
    notes: getReleaseNotesBetween(previousVersion, currentVersion, entries),
  };
}

function mergeReleaseHistoryEntries(
  externalEntries: readonly QolboxReleaseNote[],
  cachedEntries: readonly QolboxReleaseNote[] = []
): QolboxReleaseNote[] {
  return dedupeLatestReleaseEntries([
    ...LOCAL_CURRENT_RELEASE_FALLBACK,
    ...cachedEntries,
    ...externalEntries,
  ]);
}

function handleReleaseHistoryCompletion(
  previousVersion: string | null,
  currentVersion: string,
  externalPromises: readonly Promise<QolboxReleaseNote[]>[],
  cachedEntries: readonly QolboxReleaseNote[],
  onUpdate?: ReleaseHistoryUpdateCallback
): void {
  void Promise.allSettled(externalPromises).then(results => {
    const externalEntries = results.flatMap(result => result.status === 'fulfilled' ? result.value : []);
    if (!externalEntries.length) {
      return;
    }

    const entries = mergeReleaseHistoryEntries(externalEntries, cachedEntries);
    saveReleaseHistoryCache(entries);
    onUpdate?.(getReleaseHistoryStateFromEntries(previousVersion, currentVersion, entries));
  });
}

function parseCachedReleaseHistory(rawValue: string | null): ReleaseHistoryCacheRecord | null {
  if (!rawValue) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(rawValue);
    if (!isRecord(parsed) || !Number.isFinite(parsed.fetchedAt) || !Array.isArray(parsed.entries)) {
      return null;
    }

    const entries = parsed.entries
      .filter((entry): entry is Record<string, unknown> =>
        isRecord(entry) && typeof entry.version === 'string' && Array.isArray(entry.notes)
      )
      .map((entry): QolboxReleaseNote => ({
        version: entry.version as string,
        source:
          entry.source === 'github'
            || entry.source === 'greasyfork'
            || entry.source === 'local-fallback'
            ? entry.source
            : 'local-fallback',
        publishedAt: typeof entry.publishedAt === 'string' ? entry.publishedAt : undefined,
        url: typeof entry.url === 'string' ? entry.url : undefined,
        notes: (entry.notes as unknown[])
          .filter((note): note is string => typeof note === 'string')
          .map(note => note.trim())
          .filter(Boolean),
      }))
      .filter(entry => entry.notes.length > 0);

    return { fetchedAt: parsed.fetchedAt as number, entries };
  } catch {
    return null;
  }
}

function getCachedReleaseHistoryEntries(allowStale = false): QolboxReleaseNote[] | null {
  const cached = parseCachedReleaseHistory(getLocalStorageItem(RELEASE_HISTORY_CACHE_KEY));
  if (!cached) {
    return null;
  }

  if (!allowStale && Date.now() - cached.fetchedAt > RELEASE_HISTORY_CACHE_TTL_MS) {
    return null;
  }

  return dedupeLatestReleaseEntries([...LOCAL_CURRENT_RELEASE_FALLBACK, ...cached.entries]);
}

function saveReleaseHistoryCache(entries: readonly QolboxReleaseNote[]): void {
  setLocalStorageItem(RELEASE_HISTORY_CACHE_KEY, JSON.stringify({
    fetchedAt: Date.now(),
    entries,
  }));
}

export function getReleaseNotesBetween(
  previousVersion: string | null,
  currentVersion = QOLBOX_VERSION,
  releaseHistory: readonly QolboxReleaseNote[] = LOCAL_CURRENT_RELEASE_FALLBACK
): QolboxReleaseNote[] {
  const entries = dedupeLatestReleaseEntries([...LOCAL_CURRENT_RELEASE_FALLBACK, ...releaseHistory]);
  return entries.filter(entry => isVersionInUpgradeRange(entry.version, previousVersion, currentVersion));
}

export function createInitialReleaseHistoryState(previousVersion: string | null, currentVersion = QOLBOX_VERSION): QolboxReleaseHistoryState {
  const cachedEntries = getCachedReleaseHistoryEntries();
  if (cachedEntries) {
    return getReleaseHistoryStateFromEntries(previousVersion, currentVersion, cachedEntries);
  }

  return {
    status: 'loading',
    notes: getReleaseNotesBetween(previousVersion, currentVersion),
  };
}

export async function loadReleaseHistoryState(
  previousVersion: string | null,
  currentVersion = QOLBOX_VERSION,
  onUpdate?: ReleaseHistoryUpdateCallback
): Promise<QolboxReleaseHistoryState> {
  const cachedEntries = getCachedReleaseHistoryEntries(true) || [];
  const githubPromise = fetchGitHubReleaseEntries();
  const greasyForkPromise = fetchGreasyForkReleaseEntries();
  const externalPromises = [githubPromise, greasyForkPromise];

  try {
    const firstEntries = await firstFulfilled(externalPromises);
    handleReleaseHistoryCompletion(previousVersion, currentVersion, externalPromises, cachedEntries, onUpdate);
    return getReleaseHistoryStateFromEntries(
      previousVersion,
      currentVersion,
      mergeReleaseHistoryEntries(firstEntries, cachedEntries)
    );
  } catch {
    if (cachedEntries.length) {
      return getReleaseHistoryStateFromEntries(previousVersion, currentVersion, cachedEntries, 'fallback');
    }

    return {
      status: 'fallback',
      notes: getReleaseNotesBetween(previousVersion, currentVersion),
    };
  }
}
