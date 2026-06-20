const ONBOARDING_COMPLETE_KEY = 'vm.hitbox.qolboxOnboardingComplete';

export function loadOnboardingComplete(): boolean {
  try {
    return localStorage.getItem(ONBOARDING_COMPLETE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function saveOnboardingComplete(): void {
  try {
    localStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true');
  } catch {
    // Storage may be unavailable in privacy-restricted browser contexts.
  }
}
