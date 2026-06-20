import { mutationTouchesSelector } from '../dom/dom-helpers';
import type { ScheduledUiWorkRequest } from '../types/scheduled-work';

interface FullscreenMutationObserverOptions {
  featurePatchTargetSelector: string;
  layoutTargetSelector: string;
  scheduleUiWork(request: ScheduledUiWorkRequest): void;
  settlePasses: number;
  syncSpectateControlsBottomWithJukebox(): void;
  updateGameStartIndicator(): void;
}

const FULLSCREEN_OBSERVER_OPTIONS: MutationObserverInit = {
  subtree: true,
  childList: true,
  characterData: true,
  attributes: true,
  attributeFilter: ['class', 'style', 'id'],
};

export function createFullscreenMutationObserver(options: FullscreenMutationObserverOptions) {
  let fullscreenMutationObserver: MutationObserver | null = null;

  function handleMutationRecords(records: MutationRecord[]): void {
    let needsLayout = false;
    let needsFeatures = false;
    let needsSpectateSync = false;

    for (const record of records) {
      if (!needsLayout && mutationTouchesSelector(record, options.layoutTargetSelector)) {
        needsLayout = true;
      }

      if (!needsFeatures && mutationTouchesSelector(record, options.featurePatchTargetSelector)) {
        needsFeatures = true;
      }

      if (!needsSpectateSync && mutationTouchesSelector(record, '.jukebox')) {
        needsSpectateSync = true;
      }

      if (needsLayout && needsFeatures && needsSpectateSync) {
        break;
      }
    }

    if (needsSpectateSync) {
      options.syncSpectateControlsBottomWithJukebox();
    }

    if (needsLayout || needsFeatures) {
      options.updateGameStartIndicator();
      options.scheduleUiWork({
        force: needsLayout,
        features: needsFeatures,
        passes: needsLayout ? options.settlePasses : 1,
      });
    }
  }

  function installFullscreenMutationObserver(target: Element | null = document.documentElement): void {
    if (!target) {
      return;
    }

    fullscreenMutationObserver = new MutationObserver(handleMutationRecords);
    fullscreenMutationObserver.observe(target, FULLSCREEN_OBSERVER_OPTIONS);
  }

  return {
    installFullscreenMutationObserver,
  };
}
