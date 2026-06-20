import { getScoreRowName, normalizeScoreName } from './score-row-colors';

export interface ScoreTypingPlayer {
  name: string;
}

export function clearScoreTypingIndicators(): void {
  for (const indicator of document.querySelectorAll('.qolboxTypingIndicator')) {
    indicator.remove();
  }
}

export function syncScoreTypingIndicators(
  scorePanel: Element | null,
  typingPlayers: readonly ScoreTypingPlayer[]
): boolean {
  const panels = scorePanel ? [scorePanel] : Array.from(document.querySelectorAll('.scores'));
  let changed = false;

  for (const panel of panels) {
    for (const row of panel.querySelectorAll('.entryContainer')) {
      const nameElement = row.querySelector('.name') || row;
      const rowName = getScoreRowName(row);
      const rowText = normalizeScoreName(row.textContent);
      const isTyping = typingPlayers.some(
        entry => entry.name && (entry.name === rowName || rowText.includes(entry.name))
      );
      const indicator = nameElement.querySelector('.qolboxTypingIndicator');

      if (isTyping && !indicator) {
        const newIndicator = document.createElement('span');
        newIndicator.className = 'qolboxTypingIndicator';
        newIndicator.setAttribute('aria-label', 'typing');
        nameElement.appendChild(newIndicator);
        changed = true;
      } else if (!isTyping && indicator) {
        indicator.remove();
        changed = true;
      }
    }
  }

  return changed;
}
