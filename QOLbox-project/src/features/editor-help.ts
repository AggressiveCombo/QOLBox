import { EDITOR_REFERENCE_SECTIONS } from './editor-reference';

const EDITOR_INTRO_COMPLETE_KEY = 'vm.hitbox.qolboxEditorIntro.v3';

function shouldShowEditorIntro(): boolean {
  try {
    return localStorage.getItem(EDITOR_INTRO_COMPLETE_KEY) !== 'true';
  } catch {
    return false;
  }
}

function markEditorIntroComplete(): void {
  try {
    localStorage.setItem(EDITOR_INTRO_COMPLETE_KEY, 'true');
  } catch {
    // Storage may be unavailable in restricted userscript contexts.
  }
}

function positionEditorHelp(menu: HTMLElement, settings: HTMLElement): void {
  const nativeMenu = settings.closest<HTMLElement>('.topMenu');
  menu.style.zoom = nativeMenu?.style.zoom || (nativeMenu ? getComputedStyle(nativeMenu).zoom : '');
  const left = settings.offsetLeft + settings.offsetWidth;
  menu.style.left = `${left}px`;
  const settingsBounds = settings.getBoundingClientRect();
  const menuBounds = menu.getBoundingClientRect();
  const scale = settings.offsetWidth ? settingsBounds.width / settings.offsetWidth : 1;
  if (Number.isFinite(scale) && scale > 0) {
    menu.style.left = `${left - (menuBounds.left - settingsBounds.right) / scale}px`;
  }
}

export function installEditorHelp(): void {
  const editor = document.querySelector<HTMLElement>('#editorContainer');
  const settings = editor?.querySelector<HTMLElement>('.settingsMenu');
  if (!editor || !settings) return;
  const existing = editor.querySelector<HTMLElement>('.qolboxEditorHelp');
  const existingPanel = editor.querySelector<HTMLElement>('.qolboxEditorHelpWindow');
  if (existing && existingPanel) {
    positionEditorHelp(existing, settings);
    if (editor.offsetParent && existingPanel.dataset.qolboxIntroPending === 'true') {
      existing.querySelector<HTMLElement>(':scope > .topLabel')?.click();
    }
    return;
  }
  existing?.remove();
  existingPanel?.remove();

  const menu = document.createElement('div');
  menu.className = 'topMenu qolboxEditorHelp';
  const label = document.createElement('div');
  label.className = 'topLabel';
  label.append(document.createTextNode('Help'));
  label.dataset.qolboxIcon = 'circle-help';
  label.tabIndex = 0;
  label.setAttribute('role', 'button');
  label.setAttribute('aria-haspopup', 'dialog');
  label.setAttribute('aria-expanded', 'false');
  menu.appendChild(label);

  const panel = document.createElement('dialog');
  panel.className = 'qolboxMenuPanel qolboxEditorHelpWindow';
  panel.setAttribute('aria-label', 'QOLBox Editor Help');
  const body = document.createElement('div');
  body.className = 'qolboxMenuBody qolboxEditorHelpBody';
  const header = document.createElement('div');
  header.className = 'qolboxMenuHeaderLine';
  const title = document.createElement('h1');
  title.className = 'qolboxMenuTitle';
  title.textContent = 'QOLBox Editor Help';
  header.appendChild(title);
  const close = document.createElement('button');
  close.className = 'qolboxMenuButton qolboxEditorHelpClose';
  close.type = 'button';
  close.textContent = 'Close';
  close.setAttribute('aria-label', 'Close editor help');
  const content = document.createElement('div');
  content.className = 'contentDiv qolboxEditorHelpReference';
  content.setAttribute('aria-label', 'QOLBox editor features');
  content.addEventListener('wheel', event => event.stopPropagation());
  const sections = EDITOR_REFERENCE_SECTIONS;
  const topics = document.createElement('div');
  topics.className = 'qolboxEditorHelpTopics';
  topics.setAttribute('aria-label', 'Editor features');
  topics.setAttribute('aria-orientation', 'vertical');
  topics.setAttribute('role', 'tablist');
  const detail = document.createElement('div');
  detail.className = 'qolboxEditorHelpDetail';
  detail.id = 'qolboxEditorHelpDetail';
  detail.setAttribute('role', 'tabpanel');
  detail.tabIndex = 0;
  const topicButtons: HTMLButtonElement[] = [];
  let activeTopic = 0;
  let introActive = shouldShowEditorIntro();
  panel.dataset.qolboxIntroPending = String(introActive);
  let updateIntroControls = (): void => {};
  const selectTopic = (index: number, focus = false): void => {
    activeTopic = Math.max(0, Math.min(sections.length - 1, index));
    const [, entries] = sections[activeTopic]!;
    const fragment = document.createDocumentFragment();
    for (const [entryTitle, description] of entries) {
      const entry = document.createElement('section');
      entry.className = 'qolboxEditorHelpEntry';
      const heading = document.createElement('h2');
      heading.textContent = entryTitle;
      const text = document.createElement('p');
      text.textContent = description;
      entry.append(heading, text);
      fragment.appendChild(entry);
    }
    detail.replaceChildren(fragment);
    topicButtons.forEach((button, buttonIndex) => {
      const selected = buttonIndex === activeTopic;
      button.setAttribute('aria-selected', String(selected));
      button.tabIndex = selected ? 0 : -1;
    });
    const button = topicButtons[activeTopic];
    if (button) {
      detail.setAttribute('aria-labelledby', button.id);
      if (focus) {
        button.focus({ preventScroll: true });
        button.scrollIntoView({ block: 'nearest' });
      }
    }
    updateIntroControls();
  };
  sections.forEach(([topic], index) => {
    const button = document.createElement('button');
    button.className = 'qolboxEditorHelpTopic';
    button.id = `qolboxEditorHelpTopic${index}`;
    button.type = 'button';
    button.setAttribute('aria-controls', detail.id);
    button.setAttribute('role', 'tab');
    button.textContent = topic;
    button.addEventListener('click', () => selectTopic(index));
    button.addEventListener('keydown', event => {
      let next = index;
      if (event.key === 'ArrowUp') next = (index + sections.length - 1) % sections.length;
      else if (event.key === 'ArrowDown') next = (index + 1) % sections.length;
      else if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = sections.length - 1;
      else return;
      event.preventDefault();
      selectTopic(next, true);
    });
    topicButtons.push(button);
    topics.appendChild(button);
  });
  content.append(topics, detail);
  const actions = document.createElement('div');
  actions.className = 'qolboxMenuActions';
  const progress = document.createElement('span');
  progress.className = 'qolboxEditorIntroProgress';
  const back = document.createElement('button');
  back.className = 'qolboxMenuButton qolboxEditorIntroBack';
  back.type = 'button';
  back.textContent = 'Back';
  const next = document.createElement('button');
  next.className = 'qolboxMenuButton primary qolboxEditorIntroNext';
  next.type = 'button';
  updateIntroControls = () => {
    body.classList.toggle('intro', introActive);
    title.textContent = introActive ? 'Improved Editor' : 'QOLBox Editor Help';
    close.textContent = introActive ? 'Skip' : 'Close';
    close.classList.toggle('primary', !introActive);
    progress.hidden = !introActive;
    back.hidden = !introActive;
    next.hidden = !introActive;
    progress.textContent = `${activeTopic + 1} of ${sections.length}`;
    back.disabled = activeTopic === 0;
    next.textContent = activeTopic === sections.length - 1 ? 'Done' : 'Next';
  };
  actions.append(close, progress, back, next);
  selectTopic(0);
  body.append(header, content, actions);
  panel.append(body);
  editor.append(menu, panel);
  positionEditorHelp(menu, settings);

  const setOpen = (open: boolean): void => {
    if (open) {
      if (!panel.open) panel.showModal();
    } else if (panel.open) panel.close();
    label.setAttribute('aria-expanded', String(open));
    if (open) selectTopic(activeTopic, true);
    else label.focus();
  };
  label.addEventListener('click', () => {
    if (!panel.open && introActive) {
      panel.dataset.qolboxIntroPending = 'false';
      markEditorIntroComplete();
    }
    setOpen(!panel.open);
  });
  label.addEventListener('keydown', event => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    setOpen(!panel.open);
  });
  const finishIntro = (): void => {
    if (introActive) {
      introActive = false;
      markEditorIntroComplete();
      updateIntroControls();
    }
    setOpen(false);
  };
  close.addEventListener('click', finishIntro);
  back.addEventListener('click', () => selectTopic(activeTopic - 1, true));
  next.addEventListener('click', () => {
    if (activeTopic < sections.length - 1) selectTopic(activeTopic + 1, true);
    else finishIntro();
  });
  panel.addEventListener('keydown', event => {
    if (event.key === 'Escape') {
      event.preventDefault();
      finishIntro();
    }
  });
  if (introActive) {
    queueMicrotask(() => {
      if (editor.offsetParent) label.click();
    });
  }
}
