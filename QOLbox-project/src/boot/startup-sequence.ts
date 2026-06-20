import { FULLSCREEN_SETTLE_PASSES } from '../config/qolbox-constants';
import type { ScheduledUiWorkRequest } from '../types/scheduled-work';

interface StartupSequenceOptions {
  applyFeatureRootClasses(): void;
  ensureGlobalStyle(): void;
  installFullscreenHooks(): void;
  installQolboxMenuHooks(): void;
  installReserveSocketCaptureHook(): void;
  installYouTubeReadyCallbackHook(): void;
  isAudioEnabled(): boolean;
  isReserveEnabled(): boolean;
  scheduleFirstBootOnboarding(): void;
  scheduleUiWork(request: ScheduledUiWorkRequest): void;
}

export function runQolboxStartupSequence(options: StartupSequenceOptions): void {
  const scheduleInitialSettle = () => {
    options.scheduleUiWork({
      force: true,
      features: true,
      passes: FULLSCREEN_SETTLE_PASSES,
    });
  };

  options.applyFeatureRootClasses();
  options.ensureGlobalStyle();
  options.installQolboxMenuHooks();

  if (options.isReserveEnabled()) {
    options.installReserveSocketCaptureHook();
  }

  if (options.isAudioEnabled()) {
    options.installYouTubeReadyCallbackHook();
  }

  options.installFullscreenHooks();
  options.scheduleFirstBootOnboarding();
  scheduleInitialSettle();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', scheduleInitialSettle, { once: true });
  } else {
    scheduleInitialSettle();
  }
}
