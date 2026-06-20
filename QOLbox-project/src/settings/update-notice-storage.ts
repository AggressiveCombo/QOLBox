import { QOLBOX_VERSION } from '../config/qolbox-version';

const LAST_VERSION_KEY = 'vm.hitbox.qolboxLastVersion';
const ACK_VERSION_KEY = 'vm.hitbox.qolboxAcknowledgedVersion';

export interface PendingUpdateNotice {
  currentVersion: string;
  previousVersion: string;
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

export function loadPendingUpdateNotice(currentVersion = QOLBOX_VERSION, existingInstallWithoutVersion = false): PendingUpdateNotice | null {
  const previousVersion = safeGetLocalStorage(LAST_VERSION_KEY);
  const acknowledgedVersion = safeGetLocalStorage(ACK_VERSION_KEY);

  if (!previousVersion) {
    if (existingInstallWithoutVersion) {
      return { previousVersion: 'a pre-version-tracking build', currentVersion };
    }

    safeSetLocalStorage(LAST_VERSION_KEY, currentVersion);
    safeSetLocalStorage(ACK_VERSION_KEY, currentVersion);
    return null;
  }

  if (previousVersion === currentVersion || acknowledgedVersion === currentVersion) {
    if (previousVersion !== currentVersion) {
      safeSetLocalStorage(LAST_VERSION_KEY, currentVersion);
    }
    return null;
  }

  return { previousVersion, currentVersion };
}

export function acknowledgeUpdateNotice(currentVersion = QOLBOX_VERSION): void {
  safeSetLocalStorage(LAST_VERSION_KEY, currentVersion);
  safeSetLocalStorage(ACK_VERSION_KEY, currentVersion);
}
