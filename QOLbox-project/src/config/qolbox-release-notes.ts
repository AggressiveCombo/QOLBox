import { QOLBOX_VERSION } from './qolbox-version';

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

interface UserscriptHttpResponse {
  responseText?: unknown;
  status?: unknown;
  statusText?: unknown;
}

interface UserscriptHttpRequestDetails {
  headers?: Record<string, string>;
  method: 'GET';
  onerror(error: unknown): void;
  onload(response: UserscriptHttpResponse): void;
  ontimeout(): void;
  timeout: number;
  url: string;
}

interface UserscriptHttpRequestHandle {
  abort?(): void;
}

type UserscriptHttpRequest = (details: UserscriptHttpRequestDetails) => Promise<UserscriptHttpResponse> | UserscriptHttpRequestHandle | void;

const GREASYFORK_HISTORY_URL = 'https://greasyfork.org/en/scripts/568667-qolbox/versions?show_all_versions=1';
const GITHUB_RELEASES_URL = 'https://api.github.com/repos/AggressiveCombo/QOLBox/releases?per_page=100';
const RELEASE_HISTORY_CACHE_KEY = 'vm.hitbox.qolboxReleaseHistory.v2';
const RELEASE_HISTORY_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const RELEASE_HISTORY_FETCH_TIMEOUT_MS = 7000;
const LOCAL_CURRENT_RELEASE_FALLBACK_NOTES: readonly string[] = [
  'No public update notes were found for this version.',
];
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeVersionKey(version: unknown): string {
  return String(version || '').trim().replace(/^v/i, '').toLowerCase();
}

function parseVersionPoint(version: unknown): VersionPoint | null {
  const normalized = normalizeVersionKey(version);
  if (!normalized) {
    return null;
  }

  const [main, prerelease = ''] = normalized.split('-', 2);
  const rawParts = main.split('.');
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
    const delta = left.parts[index] - right.parts[index];
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
    .replace(/[`*_>#]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractMarkdownNotes(markdown: unknown): string[] {
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
      const note = cleanReleaseText(bulletMatch[1]);
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
    .filter(record => record.draft !== true)
    .map(record => {
      const version = normalizeVersionKey(record.tag_name);
      const notes = extractMarkdownNotes(record.body);
      return {
        version,
        source: 'github' as const,
        publishedAt: typeof record.published_at === 'string' ? record.published_at : undefined,
        url: typeof record.html_url === 'string' ? record.html_url : undefined,
        notes: notes.length ? notes : [cleanReleaseText(String(record.name || `QOLBox ${version}`))],
      };
    })
    .filter(entry => entry.version && entry.notes.length);
}

function getUserscriptHttpRequest(): UserscriptHttpRequest | null {
  const globalScope = globalThis as {
    GM_xmlhttpRequest?: UserscriptHttpRequest;
  };
  return typeof globalScope.GM_xmlhttpRequest === 'function' ? globalScope.GM_xmlhttpRequest : null;
}

function getUserscriptResponseText(response: UserscriptHttpResponse): string {
  return typeof response.responseText === 'string' ? response.responseText : '';
}

function isSuccessfulHttpStatus(status: unknown): boolean {
  return typeof status === 'number' && status >= 200 && status < 300;
}

function fetchTextWithUserscriptRequest(url: string, headers: Record<string, string>): Promise<string> {
  const request = getUserscriptHttpRequest();
  if (!request) {
    return Promise.reject(new Error('GM_xmlhttpRequest is unavailable.'));
  }

  return new Promise((resolve, reject) => {
    const details: UserscriptHttpRequestDetails = {
      method: 'GET',
      url,
      headers,
      timeout: RELEASE_HISTORY_FETCH_TIMEOUT_MS,
      onload(response) {
        if (!isSuccessfulHttpStatus(response.status)) {
          reject(new Error(`HTTP ${String(response.status || 0)}${response.statusText ? ` ${String(response.statusText)}` : ''}`));
          return;
        }
        resolve(getUserscriptResponseText(response));
      },
      onerror(error) {
        reject(error instanceof Error ? error : new Error('GM_xmlhttpRequest failed.'));
      },
      ontimeout() {
        reject(new Error('GM_xmlhttpRequest timed out.'));
      },
    };

    const maybePromise = request(details);
    if (maybePromise && typeof (maybePromise as Promise<UserscriptHttpResponse>).then === 'function') {
      (maybePromise as Promise<UserscriptHttpResponse>).then(details.onload, details.onerror);
    }
  });
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

async function fetchText(url: string, headers: Record<string, string> = {}): Promise<string> {
  const requestHeaders = {
    Accept: 'text/html',
    ...headers,
  };

  try {
    return await fetchTextWithPageFetch(url, requestHeaders);
  } catch {
    return fetchTextWithUserscriptRequest(url, requestHeaders);
  }
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

function safeGetLocalStorage(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSetLocalStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage may be unavailable in privacy-restricted browser contexts.
  }
}

function parseCachedReleaseHistory(rawValue: string | null): ReleaseHistoryCacheRecord | null {
  if (!rawValue) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(rawValue);
    if (!isRecord(parsed) || typeof parsed.fetchedAt !== 'number' || !Array.isArray(parsed.entries)) {
      return null;
    }

    const entries = parsed.entries
      .filter((entry): entry is QolboxReleaseNote => isRecord(entry) && typeof entry.version === 'string' && Array.isArray(entry.notes))
      .map(entry => ({
        version: entry.version,
        source:
          entry.source === 'github'
            || entry.source === 'greasyfork'
            || entry.source === 'local-fallback'
            ? entry.source
            : 'local-fallback',
        publishedAt: typeof entry.publishedAt === 'string' ? entry.publishedAt : undefined,
        url: typeof entry.url === 'string' ? entry.url : undefined,
        notes: entry.notes.map(note => String(note)).filter(Boolean),
      }));

    return { fetchedAt: parsed.fetchedAt, entries };
  } catch {
    return null;
  }
}

function getCachedReleaseHistoryEntries(allowStale = false): QolboxReleaseNote[] | null {
  const cached = parseCachedReleaseHistory(safeGetLocalStorage(RELEASE_HISTORY_CACHE_KEY));
  if (!cached) {
    return null;
  }

  if (!allowStale && Date.now() - cached.fetchedAt > RELEASE_HISTORY_CACHE_TTL_MS) {
    return null;
  }

  return dedupeLatestReleaseEntries([...LOCAL_CURRENT_RELEASE_FALLBACK, ...cached.entries]);
}

function saveReleaseHistoryCache(entries: readonly QolboxReleaseNote[]): void {
  safeSetLocalStorage(RELEASE_HISTORY_CACHE_KEY, JSON.stringify({
    fetchedAt: Date.now(),
    entries,
  }));
}

async function fetchExternalReleaseHistoryEntries(): Promise<QolboxReleaseNote[]> {
  const [githubResult, greasyForkResult] = await Promise.allSettled([
    fetchGitHubReleaseEntries(),
    fetchGreasyForkReleaseEntries(),
  ]);
  const externalEntries = [
    ...(githubResult.status === 'fulfilled' ? githubResult.value : []),
    ...(greasyForkResult.status === 'fulfilled' ? greasyForkResult.value : []),
  ];

  if (!externalEntries.length) {
    throw new Error('No public release history entries loaded.');
  }

  const entries = dedupeLatestReleaseEntries([...LOCAL_CURRENT_RELEASE_FALLBACK, ...externalEntries]);
  saveReleaseHistoryCache(entries);
  return entries;
}

export function getReleaseNotesBetween(
  previousVersion: string | null,
  currentVersion = QOLBOX_VERSION,
  releaseHistory: readonly QolboxReleaseNote[] = LOCAL_CURRENT_RELEASE_FALLBACK
): QolboxReleaseNote[] {
  const entries = dedupeLatestReleaseEntries([...LOCAL_CURRENT_RELEASE_FALLBACK, ...releaseHistory]);
  return entries.filter(entry => isVersionInUpgradeRange(entry.version, null, currentVersion));
}

export function createInitialReleaseHistoryState(previousVersion: string, currentVersion = QOLBOX_VERSION): QolboxReleaseHistoryState {
  const cachedEntries = getCachedReleaseHistoryEntries();
  if (cachedEntries) {
    const notes = getReleaseNotesBetween(previousVersion, currentVersion, cachedEntries);
    return {
      status: 'ready',
      notes,
    };
  }

  const notes = getReleaseNotesBetween(previousVersion, currentVersion);
  return {
    status: 'loading',
    notes,
  };
}

export async function loadReleaseHistoryState(previousVersion: string, currentVersion = QOLBOX_VERSION): Promise<QolboxReleaseHistoryState> {
  try {
    const entries = await fetchExternalReleaseHistoryEntries();
    const notes = getReleaseNotesBetween(previousVersion, currentVersion, entries);
    return {
      status: 'ready',
      notes,
    };
  } catch {
    const cachedEntries = getCachedReleaseHistoryEntries(true);
    if (cachedEntries) {
      const notes = getReleaseNotesBetween(previousVersion, currentVersion, cachedEntries);
      return {
        status: 'fallback',
        notes,
      };
    }

    const notes = getReleaseNotesBetween(previousVersion, currentVersion);
    return {
      status: 'fallback',
      notes,
    };
  }
}
