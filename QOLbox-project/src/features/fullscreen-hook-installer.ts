import type { ScheduledUiWorkRequest } from '../types/scheduled-work';

interface FullscreenHookInstallerOptions {
  fullscreenSettlePasses: number;
  installChatCommandAliasHooks(): void;
  installChatEscapeHooks(): void;
  installFullscreenMutationObserver(target: Element | null): void;
  installGameStartIndicatorHooks(): void;
  installGameplayBackgroundFocusHooks(): void;
  installQolboxMenuHooks(): void;
  installReserveSocketCaptureHook(): void;
  installTabFocusHooks(): void;
  isAudioEnabled(): boolean;
  isGameStartAlertEnabled(): boolean;
  isReserveEnabled(): boolean;
  refreshObservedResizeTargets(): void;
  resizeSettlePasses: number;
  scheduleUiWork(request: ScheduledUiWorkRequest): void;
  setFullscreenResizeObserver(observer: ResizeObserver): void;
}

export function createFullscreenHookInstaller(options: FullscreenHookInstallerOptions) {
  let installed = false;

  function scheduleResizeSettle(): void {
    options.scheduleUiWork({ passes: options.resizeSettlePasses });
  }

  function installFullscreenHooks(): void {
    if (installed) {
      return;
    }

    if (!document.documentElement) {
      options.scheduleUiWork({ features: true, passes: options.fullscreenSettlePasses });
      return;
    }

    installed = true;
    options.installQolboxMenuHooks();
    options.installChatEscapeHooks();
    options.installChatCommandAliasHooks();
    options.installGameplayBackgroundFocusHooks();

    if (options.isAudioEnabled()) {
      options.installTabFocusHooks();
    }

    if (options.isGameStartAlertEnabled()) {
      options.installGameStartIndicatorHooks();
    }

    if (options.isReserveEnabled()) {
      options.installReserveSocketCaptureHook();
    }

    window.addEventListener('resize', scheduleResizeSettle, true);
    window.addEventListener('orientationchange', scheduleResizeSettle, true);
    window.addEventListener(
      'load',
      () => options.scheduleUiWork({ features: true, passes: options.fullscreenSettlePasses }),
      true
    );
    window.addEventListener(
      'pageshow',
      () => options.scheduleUiWork({ features: true, passes: options.resizeSettlePasses }),
      true
    );
    document.addEventListener(
      'visibilitychange',
      () => {
        if (!document.hidden) {
          options.scheduleUiWork({ features: true, passes: options.resizeSettlePasses });
        }
      },
      true
    );
    document.addEventListener('fullscreenchange', scheduleResizeSettle, true);

    options.installFullscreenMutationObserver(document.documentElement);

    const ResizeObserverConstructor = window.ResizeObserver;
    if (typeof ResizeObserverConstructor === 'function') {
      options.setFullscreenResizeObserver(
        new ResizeObserverConstructor(() => {
          options.scheduleUiWork({ passes: 1 });
        })
      );
      options.refreshObservedResizeTargets();
    }
  }

  return {
    installFullscreenHooks,
  };
}
