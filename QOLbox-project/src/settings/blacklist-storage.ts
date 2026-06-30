const BLACKLIST_STORAGE_KEY = 'vm.hitbox.qolboxBlacklist.v1';
export const MAX_BLACKLIST_ENTRIES = 200;

function normalizeStoredName(name: unknown): string {
  return String(name || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function sanitizeBlacklistNames(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const names: string[] = [];
  const seen = new Set<string>();
  for (const rawName of value) {
    const name = String(rawName || '').replace(/\s+/g, ' ').trim();
    const normalizedName = normalizeStoredName(name);
    if (!normalizedName || seen.has(normalizedName)) {
      continue;
    }

    seen.add(normalizedName);
    names.push(name);
    if (names.length >= MAX_BLACKLIST_ENTRIES) {
      break;
    }
  }

  return names;
}

export function loadBlacklistNames(): string[] {
  try {
    return sanitizeBlacklistNames(JSON.parse(localStorage.getItem(BLACKLIST_STORAGE_KEY) || '[]'));
  } catch {
    return [];
  }
}

export function saveBlacklistNames(names: readonly string[]): string[] {
  const sanitizedNames = sanitizeBlacklistNames(names);
  try {
    localStorage.setItem(BLACKLIST_STORAGE_KEY, JSON.stringify(sanitizedNames));
  } catch {
    // Storage may be unavailable in privacy-restricted browser contexts.
  }
  return sanitizedNames;
}
