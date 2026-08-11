import { QOLBOX_VERSION } from '../config/qolbox-version';
import { getLocalStorageItem, setLocalStorageItem } from '../utils/local-storage';

const LAST_VERSION_KEY = 'vm.hitbox.qolboxLastVersion';
const ACK_VERSION_KEY = 'vm.hitbox.qolboxAcknowledgedVersion';

export interface PendingUpdateNotice {
  currentVersion: string;
  previousVersion: string;
}

export function loadPendingUpdateNotice(currentVersion = QOLBOX_VERSION, existingInstallWithoutVersion = false): PendingUpdateNotice | null {
  const previousVersion = getLocalStorageItem(LAST_VERSION_KEY);
  const acknowledgedVersion = getLocalStorageItem(ACK_VERSION_KEY);

  if (!previousVersion) {
    if (existingInstallWithoutVersion) {
      return { previousVersion: 'a pre-version-tracking build', currentVersion };
    }

    setLocalStorageItem(LAST_VERSION_KEY, currentVersion);
    setLocalStorageItem(ACK_VERSION_KEY, currentVersion);
    return null;
  }

  if (previousVersion === currentVersion || acknowledgedVersion === currentVersion) {
    if (previousVersion !== currentVersion) {
      setLocalStorageItem(LAST_VERSION_KEY, currentVersion);
    }
    return null;
  }

  return { previousVersion, currentVersion };
}

export function acknowledgeUpdateNotice(currentVersion = QOLBOX_VERSION): void {
  setLocalStorageItem(LAST_VERSION_KEY, currentVersion);
  setLocalStorageItem(ACK_VERSION_KEY, currentVersion);
}
