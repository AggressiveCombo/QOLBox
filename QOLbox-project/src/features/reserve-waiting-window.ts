interface ReserveWaitingState {
  active?: boolean;
  lastStatusText?: string;
  message?: string;
  nextRetryAt?: number;
  terminal?: boolean;
  unavailable?: boolean;
}

interface ReserveWaitingWindowOptions {
  getReserveStatusLines(): string[];
  getState(): ReserveWaitingState | null;
  getRetryDelayMs(): number;
  onCancel(): void;
  onePersonText: string;
  statusFallbackText: string;
  unavailableTitleText: string;
  waitTitleText: string;
}

const RESERVE_WINDOW_ID = 'qolboxReserveWindow';

function getReserveWindowHost(): HTMLElement {
  return document.getElementById('appContainer') || document.body || document.documentElement;
}

export function createReserveWaitingWindow(options: ReserveWaitingWindowOptions) {
  function ensureReserveWaitingWindow(): HTMLElement {
    const existing = document.getElementById(RESERVE_WINDOW_ID);
    if (existing) {
      return existing;
    }

    const container = document.createElement('div');
    container.id = RESERVE_WINDOW_ID;
    container.className = 'connectingWindowContainer qolboxReserveWindowContainer';
    container.innerHTML = `
      <div class="behindBlocker"></div>
      <div class="connectingWindow">
        <div class="topBar"></div>
        <div class="qolboxReserveContent">
          <div class="spinner" aria-hidden="true"></div>
          <div class="qolboxReserveStatus"></div>
          <div class="qolboxReserveCountdown"></div>
          <div class="qolboxReserveMessage"></div>
        </div>
        <div class="cancelButton">CANCEL</div>
      </div>
    `;

    container.querySelector<HTMLElement>('.cancelButton')?.addEventListener('click', () => {
      options.onCancel();
    });

    getReserveWindowHost().appendChild(container);
    return container;
  }

  function getReserveStatusText(): string {
    const statusText = options.getReserveStatusLines().slice(-2).join(' - ');
    const state = options.getState();
    if (statusText) {
      if (state) {
        state.lastStatusText = statusText;
      }

      return statusText;
    }

    return state?.lastStatusText || options.statusFallbackText;
  }

  function getReserveCountdownText(): string {
    const nextRetryAt = options.getState()?.nextRetryAt;
    const remainingMs = nextRetryAt ? Math.max(0, nextRetryAt - Date.now()) : options.getRetryDelayMs();
    return `Retrying in ${(remainingMs / 1000).toFixed(1)} seconds...`;
  }

  function updateReserveWaitingWindow(): void {
    const container = ensureReserveWaitingWindow();
    const state = options.getState();
    const title = container.querySelector<HTMLElement>('.topBar');
    const spinner = container.querySelector<HTMLElement>('.spinner');
    const status = container.querySelector<HTMLElement>('.qolboxReserveStatus');
    const countdown = container.querySelector<HTMLElement>('.qolboxReserveCountdown');
    const message = container.querySelector<HTMLElement>('.qolboxReserveMessage');
    const isTerminalMessage = Boolean(state && (state.unavailable || state.terminal));
    const isUnavailable = Boolean(state?.unavailable);

    if (title) {
      title.textContent = isUnavailable ? options.unavailableTitleText : options.waitTitleText;
    }

    if (spinner) {
      spinner.hidden = isTerminalMessage;
    }

    if (status) {
      status.hidden = isTerminalMessage;
      status.textContent = isTerminalMessage ? '' : getReserveStatusText();
    }

    if (countdown) {
      countdown.hidden = isTerminalMessage;
      countdown.textContent = isTerminalMessage ? '' : getReserveCountdownText();
    }

    if (message) {
      message.hidden = !isTerminalMessage;
      message.textContent = isTerminalMessage ? state?.message || options.onePersonText : '';
    }
  }

  function setReserveWaitingVisible(visible: boolean): void {
    document.body?.classList.toggle('qolbox-reserve-active', visible);
    ensureReserveWaitingWindow().style.display = visible ? 'block' : 'none';
  }

  return {
    ensureReserveWaitingWindow,
    getReserveCountdownText,
    getReserveStatusText,
    setReserveWaitingVisible,
    updateReserveWaitingWindow,
  };
}
