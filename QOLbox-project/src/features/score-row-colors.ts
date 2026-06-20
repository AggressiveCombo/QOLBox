import { getPlayerColorCandidates, getPlayerDisplayName } from '../hitbox/player-appearance-adapter';
import {
  colorsMatch,
  getContrastRatio,
  getElementBackgroundColor,
  getEffectiveBackgroundColor,
  getReadableTextColor,
  parseCssRgbColor,
  parsePlayerRgbColor,
  toCssRgb,
  type RgbColor,
} from './score-row-color-values';

interface ScoreRowColorOptions {
  fallbackRgb: RgbColor;
  teamScoreColors: ReadonlyMap<number, RgbColor>;
  getPlayerTeamState(player: unknown): number;
  getScorePlayers(): readonly unknown[];
  setImportantStyle(element: Element, property: string, value: string): void;
}

const MIN_SCORE_TEXT_CONTRAST = 4.5;

export function normalizeScoreName(value: unknown): string {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

export function getScoreRowName(row: Element | null | undefined): string {
  const nameElement = row && row.querySelector ? row.querySelector('.name') : null;
  return normalizeScoreName(nameElement ? nameElement.textContent : row && row.textContent);
}

export function createScoreRowColorController(options: ScoreRowColorOptions) {
  function isFallbackScoreRowColor(color: RgbColor | null): boolean {
    return colorsMatch(color, options.fallbackRgb);
  }

  function getPlayerScoreColor(player: unknown): RgbColor | null {
    for (const value of getPlayerColorCandidates(player)) {
      const parsed = parsePlayerRgbColor(value);
      if (parsed) {
        return parsed;
      }
    }

    return options.teamScoreColors.get(options.getPlayerTeamState(player)) || null;
  }

  function syncScoreRowTextContrast(row: Element): boolean {
    const background = getEffectiveBackgroundColor(row);
    const readableColor = toCssRgb(getReadableTextColor(background));
    let changed = false;

    const textElements = [row, ...Array.from(row.querySelectorAll('.number, .name'))];
    for (const element of textElements) {
      if (!(element.textContent || '').trim()) {
        continue;
      }

      const currentColor = parseCssRgbColor(window.getComputedStyle(element).color);
      if (currentColor && getContrastRatio(currentColor, background) >= MIN_SCORE_TEXT_CONTRAST) {
        continue;
      }

      options.setImportantStyle(element, 'color', readableColor);
      changed = true;
    }

    return changed;
  }

  function syncScoreRowsFromPlayers(scorePanel: Element): boolean {
    const rows = Array.from(scorePanel.querySelectorAll('.entryContainer'));
    const players = options.getScorePlayers();
    if (!rows.length || !players.length) {
      return false;
    }

    const playersByName = new Map<string, unknown>();
    for (const player of players) {
      const name = normalizeScoreName(getPlayerDisplayName(player));
      if (name) {
        playersByName.set(name, player);
      }
    }

    let changed = false;
    rows.forEach((row, index) => {
      const inlineColor = parseCssRgbColor(getElementBackgroundColor(row));
      const computedColor = parseCssRgbColor(window.getComputedStyle(row).backgroundColor);
      const player = playersByName.get(getScoreRowName(row)) || players[index];
      const playerColor = getPlayerScoreColor(player);

      if (!playerColor || (inlineColor && !isFallbackScoreRowColor(inlineColor))) {
        changed = syncScoreRowTextContrast(row) || changed;
        return;
      }

      if (!inlineColor && computedColor && !isFallbackScoreRowColor(computedColor)) {
        changed = syncScoreRowTextContrast(row) || changed;
        return;
      }

      options.setImportantStyle(row, 'background-color', `rgb(${playerColor.red}, ${playerColor.green}, ${playerColor.blue})`);
      syncScoreRowTextContrast(row);
      changed = true;
    });

    return changed;
  }

  function makeScoreRowsOpaque(scorePanel: Element): void {
    for (const row of scorePanel.querySelectorAll('.entryContainer')) {
      const inlineColor = parseCssRgbColor(getElementBackgroundColor(row));
      const computedColor = parseCssRgbColor(window.getComputedStyle(row).backgroundColor);
      const parsedColor = inlineColor || computedColor;
      if (!parsedColor || parsedColor.alpha >= 1) {
        syncScoreRowTextContrast(row);
        continue;
      }

      // The vanilla CSS fallback is red; locking that in before the game fills player colors makes every pill red.
      if (!inlineColor && isFallbackScoreRowColor(parsedColor)) {
        syncScoreRowTextContrast(row);
        continue;
      }

      options.setImportantStyle(
        row,
        'background-color',
        `rgb(${parsedColor.red}, ${parsedColor.green}, ${parsedColor.blue})`
      );
      syncScoreRowTextContrast(row);
    }
  }

  return {
    makeScoreRowsOpaque,
    syncScoreRowsFromPlayers,
  };
}
