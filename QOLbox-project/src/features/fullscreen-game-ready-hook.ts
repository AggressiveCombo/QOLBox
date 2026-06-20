import type { ScheduledUiWorkRequest } from '../types/scheduled-work';
import { installNativeGameReadyHook } from '../hitbox/native-game-adapter';

interface FullscreenGameReadyHookOptions {
  scheduleUiWork(request: ScheduledUiWorkRequest): void;
  settlePasses: number;
}

export function createFullscreenGameReadyHook(options: FullscreenGameReadyHookOptions) {
  let installed = false;

  function scheduleFullscreenSettle(): void {
    options.scheduleUiWork({ force: true, passes: options.settlePasses });
  }

  function installGameReadyHook(): void {
    if (installed) {
      return;
    }

    installed = true;
    installNativeGameReadyHook(scheduleFullscreenSettle);
  }

  return {
    installGameReadyHook,
  };
}
