import type { ScheduledUiWorkRequest } from '../types/scheduled-work';

interface FullscreenWorkSchedulerOptions {
  applyFeatureRootClasses(): void;
  applyPersistentFeatures(): void;
  ensureGlobalStyle(): void;
  installFullscreenHooks(): void;
  refreshFullscreen(force: boolean): unknown;
  refreshObservedResizeTargets(): void;
}

export function createFullscreenWorkScheduler(options: FullscreenWorkSchedulerOptions) {
  let scheduledWorkRaf = 0;
  let scheduledWorkForce = false;
  let scheduledWorkFeatures = false;
  let scheduledWorkPasses = 0;

  // Coalesce DOM churn; hidden tabs use a timeout because requestAnimationFrame can pause.
  function scheduleUiWork({ force = false, features = false, passes = 1 }: ScheduledUiWorkRequest = {}): void {
    scheduledWorkForce = scheduledWorkForce || force;
    scheduledWorkFeatures = scheduledWorkFeatures || features;
    scheduledWorkPasses = Math.max(scheduledWorkPasses, Math.max(1, passes));

    if (scheduledWorkRaf) {
      return;
    }

    const runScheduledWork = () => {
      scheduledWorkRaf = 0;

      const shouldForce = scheduledWorkForce;
      const shouldPatchFeatures = scheduledWorkFeatures;
      const remainingPasses = scheduledWorkPasses;

      scheduledWorkForce = false;
      scheduledWorkFeatures = false;
      scheduledWorkPasses = 0;

      options.ensureGlobalStyle();
      options.applyFeatureRootClasses();
      options.installFullscreenHooks();

      if (shouldPatchFeatures) {
        options.applyPersistentFeatures();
      }

      options.refreshFullscreen(shouldForce);
      options.refreshObservedResizeTargets();

      if (remainingPasses > 1) {
        scheduleUiWork({ force: true, passes: remainingPasses - 1 });
      }
    };

    scheduledWorkRaf = document.hidden
      ? window.setTimeout(runScheduledWork, 0)
      : window.requestAnimationFrame(runScheduledWork);
  }

  return {
    scheduleUiWork,
  };
}
