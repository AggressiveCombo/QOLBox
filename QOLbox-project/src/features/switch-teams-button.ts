import { isElementVisible } from '../dom/dom-helpers';
import { getMultiplayerSession, isHostSession } from '../hitbox/session-adapter';

interface SwitchTeamsButtonDependencies {
  isEnabled(): boolean;
  isSwitching(): boolean;
  isTeamMode(session?: unknown): boolean;
  switchTeams(): boolean;
}

export interface SwitchTeamsButtonController {
  patchSwitchTeamsButton(): boolean;
  removeSwitchTeamsButton(): void;
}

export function createSwitchTeamsButtonController(
  dependencies: SwitchTeamsButtonDependencies
): SwitchTeamsButtonController {
  function removeSwitchTeamsButton(): void {
    for (const button of document.querySelectorAll('.qolboxSwitchTeamsButton')) {
      button.remove();
    }
  }

  function handleSwitchTeamsButtonClick(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    if (dependencies.isSwitching()) {
      return;
    }

    dependencies.switchTeams();
  }

  function patchSwitchTeamsButton(): boolean {
    const session = getMultiplayerSession();
    const container = document.querySelector('.lobbyContainer .playerBox .teamsButtonContainer');
    if (
      !dependencies.isEnabled() ||
      !container ||
      !isHostSession(session) ||
      !dependencies.isTeamMode(session) ||
      !isElementVisible(container)
    ) {
      removeSwitchTeamsButton();
      return false;
    }

    let button = container.querySelector<HTMLElement>('.qolboxSwitchTeamsButton');
    if (!button) {
      button = document.createElement('div');
      button.className = 'teamButton qolboxSwitchTeamsButton';
      button.dataset.qolboxSwitchTeams = 'true';
    }

    const switching = dependencies.isSwitching();
    button.onclick = handleSwitchTeamsButtonClick;
    button.classList.toggle('qolboxSwitchTeamsButtonBusy', switching);
    button.setAttribute('aria-disabled', switching ? 'true' : 'false');
    button.setAttribute('title', switching ? 'Switching teams...' : 'Switch red and blue teams');
    const label = switching ? 'SWITCHING' : 'SWITCH';
    if (button.textContent !== label) {
      button.textContent = label;
    }
    const blueButton = Array.from(container.querySelectorAll('.teamButton')).find(element =>
      /^\s*JOIN\s+BLUE\s*$/i.test(element.textContent || '')
    );
    // This container is observed for feature updates; avoid moving an already ordered button.
    if (blueButton && blueButton !== button && button.nextElementSibling !== blueButton) {
      container.insertBefore(button, blueButton);
    } else if (button.parentElement !== container) {
      container.appendChild(button);
    }

    return true;
  }

  return { patchSwitchTeamsButton, removeSwitchTeamsButton };
}
