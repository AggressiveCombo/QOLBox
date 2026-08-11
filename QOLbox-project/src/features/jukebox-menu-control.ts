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
  let createdJukeboxMenuItem = false;
  let adoptedView: { icon: string | null; item: Element; text: string | null; title: string | null } | null = null;
  const wiredItems = new WeakSet<Element>();

  function updateJukeboxMenuItem(): void {
    if (!currentJukeboxMenuItem || !currentJukeboxMenuItem.isConnected) {
      return;
    }

    const label = options.getLabel();
    currentJukeboxMenuItem.setAttribute(
      'data-qolbox-icon',
      label.startsWith('Unmute') ? 'radio-off' : 'radio'
    );
    if (currentJukeboxMenuItem.textContent?.trim() !== label) {
      currentJukeboxMenuItem.textContent = label;
    }
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
      item = Array.from(container.querySelectorAll(':scope > .item'))
        .find(candidate => /^(?:Mute|Unmute) Jukebox$/.test(candidate.textContent?.trim() || '')) || null;
      createdJukeboxMenuItem = !item;
      if (!item) {
        item = document.createElement('div');
        item.className = 'item';
        const beforeItem = options.findChangeControlsItem(container);
        container.insertBefore(item, beforeItem);
      } else {
        adoptedView = {
          icon: item.getAttribute('data-qolbox-icon'),
          item,
          text: item.textContent,
          title: item.getAttribute('title'),
        };
      }
      (item as HTMLElement).dataset.qolboxJukeboxMenu = 'true';
    }

    if (!wiredItems.has(item)) {
      wiredItems.add(item);
      item.addEventListener(
        'click',
        event => {
          if (!options.isAudioEnabled()) return;
          event.preventDefault();
          event.stopImmediatePropagation();
          options.onToggleMute();
        },
        true
      );
    }

    currentJukeboxMenuItem = item;
    updateJukeboxMenuItem();
    return true;
  }

  function removeJukeboxMenuItem(): void {
    if (currentJukeboxMenuItem && currentJukeboxMenuItem.isConnected) {
      if (createdJukeboxMenuItem) {
        currentJukeboxMenuItem.remove();
      } else if (adoptedView?.item === currentJukeboxMenuItem) {
        currentJukeboxMenuItem.textContent = adoptedView.text;
        for (const [attribute, value] of [['data-qolbox-icon', adoptedView.icon], ['title', adoptedView.title]] as const) {
          if (value === null) currentJukeboxMenuItem.removeAttribute(attribute);
          else currentJukeboxMenuItem.setAttribute(attribute, value);
        }
        delete (currentJukeboxMenuItem as HTMLElement).dataset.qolboxJukeboxMenu;
      }
    }
    currentJukeboxMenuItem = null;
    createdJukeboxMenuItem = false;
    adoptedView = null;
  }

  return {
    patchJukeboxMenu,
    removeJukeboxMenuItem,
    updateJukeboxMenuItem,
  };
}
