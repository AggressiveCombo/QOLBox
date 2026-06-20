interface JukeboxMenuControllerOptions {
  findChangeControlsItem(container: Element | null): Element | null;
  findSettingsContainer(): Element | null;
  getLabel(): string;
  isAudioEnabled(): boolean;
  onToggleMute(): void;
}

export interface JukeboxMenuController {
  patchJukeboxMenu(): boolean;
  removeJukeboxMenuItem(): void;
  updateJukeboxMenuItem(): void;
}

export function createJukeboxMenuController(options: JukeboxMenuControllerOptions): JukeboxMenuController {
  let currentJukeboxMenuItem: Element | null = null;

  function updateJukeboxMenuItem(): void {
    if (!currentJukeboxMenuItem || !currentJukeboxMenuItem.isConnected) {
      return;
    }

    currentJukeboxMenuItem.textContent = options.getLabel();
    currentJukeboxMenuItem.setAttribute('title', 'Remember the lobby radio mute state');
  }

  function patchJukeboxMenu(): boolean {
    if (!options.isAudioEnabled()) {
      return false;
    }

    const container = options.findSettingsContainer();
    if (!container) {
      return false;
    }

    let item = container.querySelector('.item[data-qolbox-jukebox-menu="true"]');
    if (!item) {
      const createdItem = document.createElement('div');
      createdItem.className = 'item';
      createdItem.dataset.qolboxJukeboxMenu = 'true';
      createdItem.addEventListener(
        'click',
        event => {
          event.preventDefault();
          event.stopImmediatePropagation();
          options.onToggleMute();
        },
        true
      );

      const beforeItem = options.findChangeControlsItem(container);
      if (beforeItem) {
        container.insertBefore(createdItem, beforeItem);
      } else {
        container.appendChild(createdItem);
      }
      item = createdItem;
    }

    currentJukeboxMenuItem = item;
    updateJukeboxMenuItem();
    return true;
  }

  function removeJukeboxMenuItem(): void {
    if (currentJukeboxMenuItem && currentJukeboxMenuItem.isConnected) {
      currentJukeboxMenuItem.remove();
    }
    currentJukeboxMenuItem = null;
  }

  return {
    patchJukeboxMenu,
    removeJukeboxMenuItem,
    updateJukeboxMenuItem,
  };
}
