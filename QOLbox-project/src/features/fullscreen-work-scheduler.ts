import type { ScheduledUiWorkRequest } from '../types/scheduled-work';

interface FullscreenWorkSchedulerOptions {
  applyFeatureRootClasses(): void;
  applyPersistentFeatures(): void;
  discardObservedMutations(): void;
  ensureGlobalStyle(): void;
  installFullscreenHooks(): void;
  refreshFullscreen(): unknown;
  refreshObservedResizeTargets(): void;
}

export function createFullscreenWorkScheduler(options: FullscreenWorkSchedulerOptions) {
  let scheduledWorkRaf = 0;
  let scheduledWorkFeatures = false;
  let scheduledWorkPasses = 0;

  // Coalesce DOM churn; hidden tabs use a timeout because requestAnimationFrame can pause.
  function scheduleUiWork({ features = false, passes = 1 }: ScheduledUiWorkRequest = {}): void {
    scheduledWorkFeatures = scheduledWorkFeatures || features;
    scheduledWorkPasses = Math.max(scheduledWorkPasses, Math.max(1, passes));

    if (scheduledWorkRaf) {
      return;
    }

    const runScheduledWork = () => {
      scheduledWorkRaf = 0;

      const shouldPatchFeatures = scheduledWorkFeatures;
      const remainingPasses = scheduledWorkPasses;

      scheduledWorkFeatures = false;
      scheduledWorkPasses = 0;

      options.ensureGlobalStyle();
      options.applyFeatureRootClasses();
      options.installFullscreenHooks();

      if (shouldPatchFeatures) {
        options.applyPersistentFeatures();
      }

      options.refreshFullscreen();
      options.refreshObservedResizeTargets();
      // Everything above is a complete, idempotent pass. Drop its synchronous
      // mutation records so QOLBox does not schedule itself forever.
      options.discardObservedMutations();

      if (remainingPasses > 1) {
        scheduleUiWork({ passes: remainingPasses - 1 });
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
