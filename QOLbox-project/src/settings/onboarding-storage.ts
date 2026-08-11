import { getLocalStorageItem, setLocalStorageItem } from '../utils/local-storage';

const ONBOARDING_COMPLETE_KEY = 'vm.hitbox.qolboxOnboardingComplete';

export function loadOnboardingComplete(): boolean {
  return getLocalStorageItem(ONBOARDING_COMPLETE_KEY) === 'true';
}

export function saveOnboardingComplete(): void {
  setLocalStorageItem(ONBOARDING_COMPLETE_KEY, 'true');
}
