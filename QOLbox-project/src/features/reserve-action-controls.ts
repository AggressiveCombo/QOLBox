import { hasDataset } from '../dom/element-guards';
import type { ReserveSelectedRoomState } from './reserve-selection-state';

const SELECTED_RESERVE_ROW_SELECTOR = '.roomListContainer .scrollBox tr.SELECTED';

interface ReserveActionControlsOptions {
  getReserveJoinButton(): Element | null;
  getReserveSelectedRoomState(): ReserveSelectedRoomState;
  isElementVisible(element: Element | null): boolean;
  isEnabled(): boolean;
  joinButtonText: string;
  reserveButtonText: string;
}

function getText(element: Element): string {
  return (element.textContent || '').trim();
}

function setDatasetValue(element: Element, key: string, value: string): void {
  if (hasDataset(element)) {
    element.dataset[key] = value;
  }
}

export function createReserveActionControls(options: ReserveActionControlsOptions) {
  let passwordPromptPending = false;

  function clearReservePasswordPromptPending(): void {
    passwordPromptPending = false;
  }

  function isReservePasswordPromptPending(): boolean {
    return passwordPromptPending;
  }

  function setReservePasswordPromptPending(pending: boolean): void {
    passwordPromptPending = Boolean(pending);
  }

  function syncReserveJoinButtonLabel(): void {
    const button = options.getReserveJoinButton();
    if (!(button instanceof Element)) {
      return;
    }

    if (!options.isEnabled()) {
      setDatasetValue(button, 'qolboxReserveFull', 'false');
      setDatasetValue(button, 'qolboxReserveUnavailable', 'false');
      button.classList.remove('qolboxReserveUnavailable');
      button.removeAttribute('aria-disabled');
      if (getText(button) === options.reserveButtonText) {
        button.textContent = options.joinButtonText;
      }
      return;
    }

    const selectedState = options.getReserveSelectedRoomState();
    const shouldReserve = selectedState.full || selectedState.unavailable;
    const isUnavailable = selectedState.unavailable;
    const nextText = shouldReserve ? options.reserveButtonText : options.joinButtonText;

    if (getText(button) !== nextText) {
      button.textContent = nextText;
    }

    setDatasetValue(button, 'qolboxReserveFull', shouldReserve ? 'true' : 'false');
    setDatasetValue(button, 'qolboxReserveUnavailable', isUnavailable ? 'true' : 'false');
    button.classList.toggle('qolboxReserveUnavailable', isUnavailable);
    button.setAttribute('aria-disabled', isUnavailable ? 'true' : 'false');
  }

  function syncReservePasswordPrompt(): void {
    if (!options.isEnabled()) {
      clearReservePasswordPromptPending();
      return;
    }

    const container = document.querySelector('.passwordWindowContainer');
    const joinButton = container?.querySelector('.joinButton') || null;

    if (!options.isElementVisible(container) || !joinButton) {
      clearReservePasswordPromptPending();
      return;
    }

    if (passwordPromptPending && getText(joinButton) !== options.reserveButtonText) {
      joinButton.textContent = options.reserveButtonText;
    }
  }

  function clearReserveVisibleRoomSelection(): void {
    for (const row of document.querySelectorAll(SELECTED_RESERVE_ROW_SELECTOR)) {
      row.classList.remove('SELECTED');
    }

    syncReserveJoinButtonLabel();
  }

  return {
    clearReservePasswordPromptPending,
    clearReserveVisibleRoomSelection,
    isReservePasswordPromptPending,
    setReservePasswordPromptPending,
    syncReserveJoinButtonLabel,
    syncReservePasswordPrompt,
  };
}
