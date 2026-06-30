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
  message: string;
  notes: readonly QolboxReleaseNote[];
  sourceLabel: string;
  status: 'fallback' | 'loading' | 'ready';
}

interface GreasyForkVersionRecord {
  created_at?: unknown;
  url?: unknown;
  version?: unknown;
}

interface GreasyForkScriptRecord {
  code_updated_at?: unknown;
  description?: unknown;
  url?: unknown;
  version?: unknown;
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

const GREASYFORK_VERSIONS_URL = 'https://greasyfork.org/en/scripts/568667-qolbox/versions.json';
const GITHUB_RELEASES_URL = 'https://api.github.com/repos/AggressiveCombo/QOLBox/releases?per_page=100';
const RELEASE_HISTORY_CACHE_KEY = 'vm.hitbox.qolboxReleaseHistory.v1';
const RELEASE_HISTORY_CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const RELEASE_HISTORY_FETCH_TIMEOUT_MS = 7000;
const LOCAL_CURRENT_RELEASE_FALLBACK_NOTES: readonly string[] = [
  'Public release notes could not be loaded for this version.',
  'Check GitHub releases or GreasyFork version history for the full changelog when available.',
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

function areVersionKeysEquivalent(left: unknown, right: unknown): boolean {
  const leftPoint = parseVersionPoint(left);
  const rightPoint = parseVersionPoint(right);
  if (leftPoint && rightPoint) {
    return compareVersionPoints(leftPoint, rightPoint) === 0;
  }

  return normalizeVersionKey(left) === normalizeVersionKey(right);
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

function shouldReplaceReleaseEntry(next: QolboxReleaseNote, current: QolboxReleaseNote): boolean {
  const sourcePriorityDelta = getSourcePriority(next.source) - getSourcePriority(current.source);
  if (sourcePriorityDelta) {
    return sourcePriorityDelta > 0;
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

function parseGreasyForkDetailEntry(record: GreasyForkScriptRecord, fallback: GreasyForkVersionRecord): QolboxReleaseNote | null {
  const version = normalizeVersionKey(record.version || fallback.version);
  if (!version) {
    return null;
  }

  const description = typeof record.description === 'string' ? cleanReleaseText(record.description) : '';
  return {
    version,
    source: 'greasyfork',
    publishedAt:
      typeof record.code_updated_at === 'string'
        ? record.code_updated_at
        : typeof fallback.created_at === 'string'
          ? fallback.created_at
          : undefined,
    url: typeof record.url === 'string' ? record.url : undefined,
    notes: description ? [description] : [`Published on GreasyFork as QOLBox ${version}.`],
  };
}

async function fetchJson(url: string, headers: Record<string, string> = {}): Promise<unknown> {
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
    return await response.json();
  } finally {
    window.clearTimeout(timer);
  }
}

async function fetchGitHubReleaseEntries(): Promise<QolboxReleaseNote[]> {
  return parseGitHubReleaseEntries(await fetchJson(GITHUB_RELEASES_URL));
}

async function fetchGreasyForkReleaseEntries(): Promise<QolboxReleaseNote[]> {
  const rawVersions = await fetchJson(GREASYFORK_VERSIONS_URL);
  if (!Array.isArray(rawVersions)) {
    return [];
  }

  const versions = rawVersions.filter((record): record is GreasyForkVersionRecord => isRecord(record));
  const detailResults = await Promise.allSettled(
    versions.map(async versionRecord => {
      if (typeof versionRecord.url !== 'string') {
        return null;
      }

      const detail = await fetchJson(versionRecord.url);
      return isRecord(detail) ? parseGreasyForkDetailEntry(detail, versionRecord) : null;
    })
  );

  return detailResults
    .filter((result): result is PromiseFulfilledResult<QolboxReleaseNote | null> => result.status === 'fulfilled')
    .map(result => result.value)
    .filter((entry): entry is QolboxReleaseNote => Boolean(entry));
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
          entry.source === 'github' || entry.source === 'greasyfork' || entry.source === 'local-fallback'
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
  const entries = dedupeLatestReleaseEntries(releaseHistory);
  const selectedEntries = entries.filter(entry => isVersionInUpgradeRange(entry.version, previousVersion, currentVersion));
  if (selectedEntries.length > 1 || !previousVersion) {
    return selectedEntries;
  }

  const previousEntry = entries.find(entry => areVersionKeysEquivalent(entry.version, previousVersion));
  return previousEntry && !selectedEntries.some(entry => areVersionKeysEquivalent(entry.version, previousEntry.version))
    ? [...selectedEntries, previousEntry]
    : selectedEntries;
}

export function getReleaseHistorySourceLabel(notes: readonly QolboxReleaseNote[]): string {
  const sources = new Set(notes.map(note => note.source));
  const hasFallback = sources.has('local-fallback');
  const hasGitHub = sources.has('github');
  const hasGreasyFork = sources.has('greasyfork');
  let remoteLabel = '';

  if (hasGitHub && hasGreasyFork) {
    remoteLabel = 'GitHub releases and GreasyFork version history';
  } else if (hasGitHub) {
    remoteLabel = 'GitHub releases';
  } else if (hasGreasyFork) {
    remoteLabel = 'GreasyFork version history';
  }

  if (hasFallback && remoteLabel) {
    return `bundled fallback notes and ${remoteLabel}`;
  }
  if (hasFallback) {
    return 'bundled fallback notes';
  }

  return remoteLabel || 'release history';
}

function getLoadedReleaseHistoryMessage(notes: readonly QolboxReleaseNote[]): string {
  const hasFallback = notes.some(note => note.source === 'local-fallback');
  const hasRemote = notes.some(note => note.source === 'github' || note.source === 'greasyfork');

  if (hasFallback && hasRemote) {
    return 'Loaded public version history where available. Showing bundled fallback messages for missing entries.';
  }
  if (hasFallback) {
    return 'No public notes matched this update. Showing a bundled fallback message.';
  }
  return 'Loaded public version history.';
}

function getCachedReleaseHistoryMessage(notes: readonly QolboxReleaseNote[]): string {
  const hasFallback = notes.some(note => note.source === 'local-fallback');
  const hasRemote = notes.some(note => note.source === 'github' || note.source === 'greasyfork');

  if (hasFallback && hasRemote) {
    return 'Loaded cached public version history where available. Showing bundled fallback messages for missing entries.';
  }
  if (hasFallback) {
    return 'No cached public notes matched this update. Showing a bundled fallback message.';
  }
  return 'Loaded cached public version history.';
}

export function createInitialReleaseHistoryState(previousVersion: string, currentVersion = QOLBOX_VERSION): QolboxReleaseHistoryState {
  const cachedEntries = getCachedReleaseHistoryEntries();
  if (cachedEntries) {
    const notes = getReleaseNotesBetween(previousVersion, currentVersion, cachedEntries);
    return {
      status: 'ready',
      notes,
      sourceLabel: getReleaseHistorySourceLabel(notes),
      message: getCachedReleaseHistoryMessage(notes),
    };
  }

  const notes = getReleaseNotesBetween(previousVersion, currentVersion);
  return {
    status: 'loading',
    notes,
    sourceLabel: getReleaseHistorySourceLabel(notes),
    message: 'Loading public version history...',
  };
}

export async function loadReleaseHistoryState(previousVersion: string, currentVersion = QOLBOX_VERSION): Promise<QolboxReleaseHistoryState> {
  try {
    const entries = await fetchExternalReleaseHistoryEntries();
    const notes = getReleaseNotesBetween(previousVersion, currentVersion, entries);
    return {
      status: 'ready',
      notes,
      sourceLabel: getReleaseHistorySourceLabel(notes),
      message: getLoadedReleaseHistoryMessage(notes),
    };
  } catch {
    const cachedEntries = getCachedReleaseHistoryEntries(true);
    if (cachedEntries) {
      const notes = getReleaseNotesBetween(previousVersion, currentVersion, cachedEntries);
      return {
        status: 'fallback',
        notes,
        sourceLabel: getReleaseHistorySourceLabel(notes),
        message: `Could not refresh public version history. ${getCachedReleaseHistoryMessage(notes)}`,
      };
    }

    const notes = getReleaseNotesBetween(previousVersion, currentVersion);
    return {
      status: 'fallback',
      notes,
      sourceLabel: getReleaseHistorySourceLabel(notes),
      message: 'Could not load public version history. Showing a bundled fallback message.',
    };
  }
}
