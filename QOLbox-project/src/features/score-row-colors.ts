import { getPlayerColorCandidates, getPlayerDisplayName } from '../hitbox/player-appearance-adapter';
import {
  blendRgbColors,
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
  const scoreRowColorsByKey = new Map<string, RgbColor>();

  function isFallbackScoreRowColor(color: RgbColor | null): boolean {
    return colorsMatch(color, options.fallbackRgb);
  }

  function getPlayerDirectScoreColor(player: unknown): RgbColor | null {
    for (const value of getPlayerColorCandidates(player)) {
      const parsed = parsePlayerRgbColor(value);
      if (parsed) {
        return parsed;
      }
    }

    return null;
  }

  function getScoreRowColorKeys(row: Element, player: unknown): string[] {
    const keys = new Set<string>();
    const rowName = getScoreRowName(row);
    const playerName = normalizeScoreName(getPlayerDisplayName(player));
    const teamState = options.getPlayerTeamState(player);

    if (rowName) {
      keys.add(`row:${rowName}`);
    }

    if (playerName) {
      keys.add(`player:${playerName}`);
    }

    if (Number.isFinite(teamState)) {
      keys.add(`team:${teamState}`);
    }

    return Array.from(keys);
  }

  function rememberScoreRowColor(keys: readonly string[], color: RgbColor | null): void {
    if (!color || isFallbackScoreRowColor(color)) {
      return;
    }

    for (const key of keys) {
      scoreRowColorsByKey.set(key, { ...color, alpha: 1 });
    }
  }

  function getRememberedScoreRowColor(keys: readonly string[]): RgbColor | null {
    for (const key of keys) {
      const color = scoreRowColorsByKey.get(key);
      if (color) {
        return color;
      }
    }

    return null;
  }

  function getTeamScoreColor(player: unknown): RgbColor | null {
    return options.teamScoreColors.get(options.getPlayerTeamState(player)) || null;
  }

  function getPlayerScoreColor(row: Element, player: unknown): RgbColor | null {
    const keys = getScoreRowColorKeys(row, player);
    return getPlayerDirectScoreColor(player) || getRememberedScoreRowColor(keys) || getTeamScoreColor(player);
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
      const effectiveCurrentColor = currentColor && currentColor.alpha < 1
        ? blendRgbColors(currentColor, background)
        : currentColor;
      if (effectiveCurrentColor && getContrastRatio(effectiveCurrentColor, background) >= MIN_SCORE_TEXT_CONTRAST) {
        continue;
      }

      options.setImportantStyle(element, 'color', readableColor);
      changed = true;
    }

    return changed;
  }

  function getUniquePlayersByName(players: readonly unknown[]): Map<string, unknown | null> {
    const playersByName = new Map<string, unknown | null>();
    for (const player of players) {
      const name = normalizeScoreName(getPlayerDisplayName(player));
      if (!name) {
        continue;
      }

      playersByName.set(name, playersByName.has(name) ? null : player);
    }

    return playersByName;
  }

  function syncScoreRowsFromPlayers(scorePanel: Element): boolean {
    const rows = Array.from(scorePanel.querySelectorAll('.entryContainer'));
    const players = options.getScorePlayers();
    if (!rows.length || !players.length) {
      return false;
    }

    const playersByName = getUniquePlayersByName(players);

    let changed = false;
    rows.forEach((row, index) => {
      const inlineColor = parseCssRgbColor(getElementBackgroundColor(row));
      const computedColor = parseCssRgbColor(window.getComputedStyle(row).backgroundColor);
      const currentColor = inlineColor || computedColor;
      const namedPlayer = playersByName.get(getScoreRowName(row));
      const player = namedPlayer || players[index];
      const colorKeys = getScoreRowColorKeys(row, player);

      if (currentColor && !isFallbackScoreRowColor(currentColor)) {
        rememberScoreRowColor(colorKeys, currentColor);
      }

      const playerColor = getPlayerScoreColor(row, player);

      if (!playerColor) {
        changed = syncScoreRowTextContrast(row) || changed;
        return;
      }

      if (currentColor && colorsMatch(currentColor, playerColor)) {
        changed = syncScoreRowTextContrast(row) || changed;
        return;
      }

      options.setImportantStyle(row, 'background-color', `rgb(${playerColor.red}, ${playerColor.green}, ${playerColor.blue})`);
      syncScoreRowTextContrast(row);
      changed = true;
    });

    return changed;
  }

  function syncAllScoreRowsFromPlayers(): boolean {
    let changed = false;
    for (const scorePanel of document.querySelectorAll('.scores')) {
      changed = syncScoreRowsFromPlayers(scorePanel) || changed;
    }

    return changed;
  }

  function makeScoreRowsOpaque(scorePanel: Element): void {
    const rows = Array.from(scorePanel.querySelectorAll('.entryContainer'));
    const players = options.getScorePlayers();

    rows.forEach((row, index) => {
      const inlineColor = parseCssRgbColor(getElementBackgroundColor(row));
      const computedColor = parseCssRgbColor(window.getComputedStyle(row).backgroundColor);
      const parsedColor = inlineColor || computedColor;
      const player = players[index];
      const colorKeys = getScoreRowColorKeys(row, player);

      if (parsedColor && !isFallbackScoreRowColor(parsedColor)) {
        rememberScoreRowColor(colorKeys, parsedColor);
      }

      if (parsedColor && parsedColor.alpha < 1 && (inlineColor || !isFallbackScoreRowColor(parsedColor))) {
        options.setImportantStyle(
          row,
          'background-color',
          `rgb(${parsedColor.red}, ${parsedColor.green}, ${parsedColor.blue})`
        );
      }

      syncScoreRowTextContrast(row);
    });
  }

  return {
    makeScoreRowsOpaque,
    syncAllScoreRowsFromPlayers,
    syncScoreRowsFromPlayers,
  };
}
