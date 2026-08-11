import type { FullscreenDimensions } from './fullscreen-types';
import { removeFullscreenInlineProperties } from './fullscreen-inline-style';
import { createFullscreenSpectateControlsLayout } from './fullscreen-spectate-controls-layout';

interface FullscreenHudLayoutOptions {
  hasVisibleLayer(selector: string): boolean;
  isElementVisible(element: Element | null): boolean;
  isFullscreenEnabled(): boolean;
  isSessionMatchActive(): boolean;
  makeScoreRowsOpaque(scorePanel: Element): void;
  scoresSelector: string;
  setImportantStyle(element: unknown, property: string, value: string): void;
  spectateControlsSelector: string;
  syncScoreRowsFromPlayers(scorePanel: Element): void;
  syncTypingIndicators(scorePanel: Element): void;
}

function isLoadingScreenVisible(): boolean {
  const loading = document.getElementById('ccLoading');
  if (!loading || !loading.isConnected) {
    return false;
  }

  const style = window.getComputedStyle(loading);
  return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
}

export function createFullscreenHudLayout(options: FullscreenHudLayoutOptions) {
  const spectateControlsLayout = createFullscreenSpectateControlsLayout({
    isElementVisible: options.isElementVisible,
    isFullscreenEnabled: options.isFullscreenEnabled,
    isSessionMatchActive: options.isSessionMatchActive,
    setImportantStyle: options.setImportantStyle,
    spectateControlsSelector: options.spectateControlsSelector,
  });

  function resetScorePanelLayout(scorePanel: Element): void {
    removeFullscreenInlineProperties(scorePanel, [
      'position',
      'left',
      'top',
      'right',
      'bottom',
      'transform',
      'text-align',
      'margin-top',
      'z-index',
    ]);
  }

  function layoutRelativeHud(_relativeBounds: unknown, dimensions: FullscreenDimensions): void {
    const isLoading = isLoadingScreenVisible();
    const useGameplayHudLayout =
      !isLoading &&
      (dimensions.mode === 'gameplay' ||
        (options.isSessionMatchActive() && options.hasVisibleLayer(options.spectateControlsSelector)));

    for (const scorePanel of document.querySelectorAll(options.scoresSelector)) {
      if (!useGameplayHudLayout) {
        resetScorePanelLayout(scorePanel);
        options.setImportantStyle(scorePanel, 'display', 'none');
        continue;
      }

      options.syncScoreRowsFromPlayers(scorePanel);
      options.makeScoreRowsOpaque(scorePanel);
      options.syncTypingIndicators(scorePanel);

      options.setImportantStyle(scorePanel, 'display', 'block');
      options.setImportantStyle(scorePanel, 'position', 'absolute');
      options.setImportantStyle(scorePanel, 'left', '50%');
      options.setImportantStyle(scorePanel, 'top', '12px');
      options.setImportantStyle(scorePanel, 'right', 'auto');
      options.setImportantStyle(scorePanel, 'bottom', 'auto');
      options.setImportantStyle(scorePanel, 'transform', 'translateX(-50%)');
      options.setImportantStyle(scorePanel, 'text-align', 'center');
      options.setImportantStyle(scorePanel, 'margin-top', '0');
      options.setImportantStyle(scorePanel, 'z-index', '10');
    }

    spectateControlsLayout.layoutSpectateControls(useGameplayHudLayout);
  }

  return {
    layoutRelativeHud,
    resetScorePanelLayout,
    resetSpectateControlsLayout: spectateControlsLayout.resetSpectateControlsLayout,
    syncSpectateControlsBottomWithJukebox: spectateControlsLayout.syncSpectateControlsBottomWithJukebox,
  };
}
