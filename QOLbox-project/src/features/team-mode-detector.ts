import { isElementVisible } from '../dom/dom-helpers';
import { getMultiplayerSession, getPlayerTeamState, getSessionPlayers, isNativeTeamMode } from '../hitbox/session-adapter';
import { TEAM_STATE_BLUE, TEAM_STATE_RED } from '../hitbox/team-state';

const TEAM_MODE_VALUES = new Set([3, 4, 5]);

function getSelectedLobbyModeValue(): number | null {
  const modeSelect = document.querySelector<HTMLSelectElement>('select.modeDropdown.left, select.modeDropdown');
  if (!modeSelect) {
    return null;
  }

  const mode = Number(modeSelect.value);
  return Number.isFinite(mode) ? mode : null;
}

function hasVisibleTeamModeControls(): boolean {
  for (const element of document.querySelectorAll('button, .button, .bottomButton, .item, div')) {
    if (!isElementVisible(element)) {
      continue;
    }

    if (/^\s*JOIN\s+(RED|BLUE)\s*$/i.test(element.textContent || '')) {
      return true;
    }
  }

  return false;
}

export function isTeamMode(session: unknown = getMultiplayerSession()): boolean {
  if (isNativeTeamMode(session)) {
    return true;
  }

  const selectedMode = getSelectedLobbyModeValue();
  if (TEAM_MODE_VALUES.has(selectedMode ?? Number.NaN)) {
    return true;
  }

  if (hasVisibleTeamModeControls()) {
    return true;
  }

  return getSessionPlayers(session).some(({ player }) => {
    const team = getPlayerTeamState(player);
    return team === TEAM_STATE_RED || team === TEAM_STATE_BLUE;
  });
}
