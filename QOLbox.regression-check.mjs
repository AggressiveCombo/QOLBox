import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const scriptPath = path.join(path.dirname(fileURLToPath(import.meta.url)), 'QOLbox.user.js');
let source = fs.readFileSync(scriptPath, 'utf8');

const testApiInjection = `
  window.__qolboxTest = {
    angleToJukeboxPercent,
    clampJukeboxPercent,
    clampPercent,
    fitEditorCanvasToNative,
    fitEditorLayerToFrame,
    captureGameplayInputFocus,
    getFullscreenDimensions,
    getScaledEditorFrame,
    getEffectiveJukeboxPercent,
    getKeyboardPercentTarget,
    getOnboardingSteps,
    getReleaseNotesBetween,
    getWorldTypingPosition,
    acknowledgeUpdateNotice,
    endCurrentGame,
    restartCurrentGame,
    expandNativeChatAlias,
    handleJoinSlashCommand,
    handleSpecSlashCommand,
    isPlayableLobby,
    isFeatureEnabled,
    isPlayingMatch,
    handleGameplayBackgroundFocus,
    findPlayerByName,
    handleQolboxSlashCommand,
    handleGameStartInteractionFocus,
    handleMobileGrabPointerStart,
    hideMobileGrabButton,
    isTeamMode,
    isMobileGameMode,
    isMobileQolboxMenuContext,
    layoutRelativeHud,
    layoutMobileGrabButton,
    makeScoreRowsOpaque,
    notePlayerTyping,
    noteLocallyInitiatedPlayTransition,
    hasPendingLocalPlayTransition,
    loadPendingUpdateNotice,
    patchInGameChatScroll,
    patchMultiplayerSessionGameStartHooks,
    patchMobileGrabButton,
    patchMobileQolboxHamburgerEntry,
    patchSlashCommands,
    patchSwitchTeamsButton,
    patchTypingIndicatorHooks,
    loadGamePercent,
    parseJukeboxAngleFromTransform,
    percentToJukeboxVolume,
    percentToJukeboxAngle,
    requestTeamState,
    requestBulkTeamState,
    showAllHostSettings,
    restoreLobbyChatPrompt,
    setMobileGrabPressed,
    shouldShowMobileGrabButton,
    switchTeamPlayers,
    syncMobileGrabButton,
    clearGameStartIndicator,
    clearFullscreenLayoutStyles,
    restoreNativeLayoutSizeFallback,
    setImportantStyle,
    shouldCaptureGameplayBackgroundFocus,
    syncWorldTypingIndicators,
    syncScoreRowsFromPlayers,
    syncTypingIndicators,
    updateGameStartIndicator,
    setFeatureEnabled,
    setGameStartPageFocused,
    setGameStartWasPlayingWhenUnfocused,
    setGameStartWasInLobbyWhenUnfocused,
    setJukeboxState,
  };
`;

let instrumentedSource = source.replace(
  /\r?\n  \}\)\(\);\r?\n\}\)\(\);\s*$/,
  `${testApiInjection}  })();
})();`
);

if (instrumentedSource === source) {
  instrumentedSource = source.replace(/\r?\n\}\)\(\);\s*$/, `${testApiInjection}})();`);
}

if (instrumentedSource === source) {
  throw new Error('Unable to instrument QOLbox.user.js; userscript wrapper ending was not found.');
}

source = instrumentedSource;

class FakeElement {
  constructor(tagName = 'DIV') {
    this.children = [];
    this.dataset = {};
    this.id = '';
    this.isConnected = true;
    this.parentElement = null;
    this.rect = { height: 0, left: 0, top: 0, width: 0 };
    this.clientHeight = 0;
    this.scrollHeight = 0;
    this.scrollTop = 0;
    this.style = {
      getPropertyPriority(property) {
        return this[`${property}Priority`] || '';
      },
      getPropertyValue(property) {
        return this[property] || '';
      },
      removeProperty(property) {
        delete this[property];
        delete this[`${property}Priority`];
      },
      setProperty(property, value, priority = '') {
        this[property] = value;
        this[`${property}Priority`] = priority;
      },
    };
    this.tagName = tagName.toUpperCase();
    this.textContent = '';
    this.classList = {
      add() {},
      contains() {
        return false;
      },
      remove() {},
      toggle() {},
    };
  }

  addEventListener() {}
  append(...children) {
    this.children.push(...children);
    for (const child of children) {
      child.parentElement = this;
    }
  }
  appendChild(child) {
    this.children.push(child);
    child.parentElement = this;
    return child;
  }
  insertBefore(child, beforeChild) {
    this.children = this.children.filter(existing => existing !== child);
    const index = this.children.indexOf(beforeChild);
    if (index < 0) {
      return this.appendChild(child);
    }

    this.children.splice(index, 0, child);
    child.parentElement = this;
    return child;
  }
  getBoundingClientRect() {
    return this.rect;
  }
  hasAttribute(name) {
    return this[name] !== undefined;
  }
  closest() {
    return null;
  }
  matches() {
    return false;
  }
  querySelector() {
    return null;
  }
  querySelectorAll() {
    return [];
  }
  getAttribute(name) {
    return this[name] ?? null;
  }
  remove() {
    if (this.parentElement) {
      this.parentElement.children = this.parentElement.children.filter(child => child !== this);
      this.parentElement = null;
    }
  }
  removeAttribute(name) {
    delete this[name];
  }
  setAttribute(name, value) {
    this[name] = value;
  }
}

function createContext() {
  const context = {
    console,
    Date,
    Element: FakeElement,
    HTMLElement: FakeElement,
    HTMLCanvasElement: FakeElement,
    HTMLInputElement: FakeElement,
    HTMLSelectElement: FakeElement,
    Node: FakeElement,
    MutationObserver: class {
      observe() {}
    },
    localStorage: {
      store: new Map(),
      getItem(key) {
        return this.store.has(key) ? this.store.get(key) : null;
      },
      setItem(key, value) {
        this.store.set(key, String(value));
      },
    },
    location: {
      pathname: '/game2.html',
    },
    performance: {
      now() {
        return 0;
      },
    },
    window: null,
  };

  context.window = context;
  context.document = {
    body: new FakeElement(),
    documentElement: new FakeElement(),
    head: new FakeElement(),
    hidden: false,
    readyState: 'complete',
    addEventListener() {},
    createElement() {
      return new FakeElement();
    },
    createElementNS() {
      return new FakeElement();
    },
    getElementById() {
      return null;
    },
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    },
  };
  context.addEventListener = () => {};
  context.cancelAnimationFrame = () => {};
  context.clearTimeout = () => {};
  context.devicePixelRatio = 1;
  context.getComputedStyle = () => ({ display: 'block', transform: 'none', visibility: 'visible' });
  context.innerHeight = 768;
  context.innerWidth = 1366;
  context.requestAnimationFrame = () => 1;
  let runningTimeout = false;
  context.setTimeout = callback => {
    if (callback && callback.name === 'flashGameStartIndicator') {
      return 1;
    }

    if (!runningTimeout) {
      runningTimeout = true;
      try {
        callback();
      } finally {
        runningTimeout = false;
      }
    }
    return 1;
  };

  vm.createContext(context);
  context.localStorage.store.set('vm.hitbox.qolboxOnboardingComplete', 'true');
  context.localStorage.store.set('vm.hitbox.qolboxLastVersion', '2.0.0');
  context.localStorage.store.set('vm.hitbox.qolboxAcknowledgedVersion', '2.0.0');
  vm.runInContext(source, context, { filename: scriptPath });
  return context;
}

const context = createContext();
const q = context.window.__qolboxTest;
const failures = [];

function check(name, condition, details = '') {
  if (!condition) {
    failures.push({ name, details });
  }
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasStringAssignment(name, value) {
  return new RegExp(`\\b(?:const|let|var)\\s+${escapeRegExp(name)}\\s*=\\s*["']${escapeRegExp(value)}["']`).test(source);
}

function hasNumberAssignment(name, valuePattern) {
  return new RegExp(`\\b(?:const|let|var)\\s+${escapeRegExp(name)}\\s*=\\s*${valuePattern}\\b`).test(source);
}

function hasRegexAssignment(name, patternSource) {
  return new RegExp(`\\b(?:const|let|var)\\s+${escapeRegExp(name)}\\s*=\\s*${patternSource}`).test(source);
}

const injectedStyle = context.document.head.children.find(child => child.id === 'qolbox-style');
check('userscript name is QOLBox', /^\/\/ @name\s+QOLBox$/m.test(source));
check('userscript version is 2.0.0', /^\/\/ @version\s+2\.0\.0$/m.test(source));
check('userscript description mentions reserve spots', /^\/\/ @description\s+.*reserve spots/im.test(source));
function setUpdateStorage(previousVersion, acknowledgedVersion) {
  context.localStorage.store.delete('vm.hitbox.qolboxLastVersion');
  context.localStorage.store.delete('vm.hitbox.qolboxAcknowledgedVersion');
  if (previousVersion !== undefined) {
    context.localStorage.store.set('vm.hitbox.qolboxLastVersion', previousVersion);
  }
  if (acknowledgedVersion !== undefined) {
    context.localStorage.store.set('vm.hitbox.qolboxAcknowledgedVersion', acknowledgedVersion);
  }
}

function getPendingUpdateFor(previousVersion, acknowledgedVersion, existingInstallWithoutVersion = false) {
  setUpdateStorage(previousVersion, acknowledgedVersion);
  return q.loadPendingUpdateNotice('2.0.0', existingInstallWithoutVersion);
}

const freshInstallNotice = getPendingUpdateFor(undefined, undefined, false);
check('fresh install records current v2.0.0 without showing an update notice', freshInstallNotice === null);
check(
  'fresh install stores current v2.0.0 as both last and acknowledged version',
  context.localStorage.store.get('vm.hitbox.qolboxLastVersion') === '2.0.0' &&
    context.localStorage.store.get('vm.hitbox.qolboxAcknowledgedVersion') === '2.0.0'
);
const existingUntrackedNotice = getPendingUpdateFor(undefined, undefined, true);
check(
  'existing installs without version tracking get the v2.0.0 update notice',
  existingUntrackedNotice?.previousVersion === 'a pre-version-tracking build' &&
    existingUntrackedNotice.currentVersion === '2.0.0',
  JSON.stringify(existingUntrackedNotice)
);
const simulatedPublicReleaseHistory = [
  { version: '2.0.0', source: 'local-fallback', publishedAt: '1970-01-01T00:00:00.000Z', notes: ['v2.0.0 fallback'] },
  { version: '1.5.1', source: 'greasyfork', publishedAt: '2026-05-15T19:48:59.000Z', notes: ['older duplicate'] },
  { version: '1.5.1', source: 'github', publishedAt: '2026-05-30T21:45:11Z', notes: ['latest GitHub 1.5.1 release'] },
  { version: '1.5.0', source: 'greasyfork', publishedAt: '2026-05-09T08:54:06.000Z', notes: ['1.5.0 metadata'] },
  { version: '1.4.0', source: 'greasyfork', publishedAt: '2026-05-07T19:01:33.000Z', notes: ['1.4.0 metadata'] },
  { version: '1.3.0', source: 'greasyfork', publishedAt: '2026-05-06T14:38:27.000Z', notes: ['1.3.0 metadata'] },
  { version: '1.2.1', source: 'greasyfork', publishedAt: '2026-05-01T16:53:40.000Z', notes: ['1.2.1 metadata'] },
  { version: '1.2.0', source: 'greasyfork', publishedAt: '2026-05-01T11:59:15.000Z', notes: ['1.2.0 metadata'] },
  { version: '1.1.1', source: 'greasyfork', publishedAt: '2026-04-28T17:31:59.000Z', notes: ['1.1.1 metadata'] },
  { version: '1.1', source: 'greasyfork', publishedAt: '2026-03-13T22:30:58.000Z', notes: ['1.1 metadata'] },
  { version: '1.0.0', source: 'greasyfork', publishedAt: '2026-03-06T23:18:56.000Z', notes: ['1.0.0 metadata'] },
];
for (const previousVersion of ['1.0', '1.3.0', '1.5.1', '2.0-dev', 'malformed-version']) {
  const notice = getPendingUpdateFor(previousVersion, previousVersion);
  const releaseNotes = q.getReleaseNotesBetween(previousVersion, '2.0.0', simulatedPublicReleaseHistory);
  check(
    `update notice selects release history for stored previous version ${previousVersion}`,
    notice?.previousVersion === previousVersion &&
      notice.currentVersion === '2.0.0' &&
      releaseNotes.length >= 1 &&
      releaseNotes[0].version === '2.0.0',
    JSON.stringify({ notice, releaseNotes })
  );
}
const fromVersion10 = q.getReleaseNotesBetween('1.0', '2.0.0', simulatedPublicReleaseHistory);
check(
  'upgrade from v1.0 gets browsable intermediate public version history, not only v2.0.0',
  fromVersion10.length > 6 &&
    fromVersion10[0].version === '2.0.0' &&
    fromVersion10.some(entry => entry.version === '1.5.1') &&
    fromVersion10.some(entry => entry.version === '1.3.0') &&
    !fromVersion10.some(entry => entry.version === '1.0.0'),
  JSON.stringify(fromVersion10)
);
const fromVersion13x = q.getReleaseNotesBetween('1.3.x', '2.0.0', simulatedPublicReleaseHistory);
check(
  'upgrade from v1.3.x starts after the v1.3 line and includes later public versions',
  fromVersion13x[0].version === '2.0.0' &&
    fromVersion13x.some(entry => entry.version === '1.4.0') &&
    fromVersion13x.some(entry => entry.version === '1.5.1') &&
    !fromVersion13x.some(entry => entry.version === '1.3.0'),
  JSON.stringify(fromVersion13x)
);
const fromVersion151 = q.getReleaseNotesBetween('1.5.1', '2.0.0', simulatedPublicReleaseHistory);
check(
  'upgrade from v1.5.1 includes the previous public release context plus v2.0.0',
  fromVersion151.length === 2 &&
    fromVersion151[0].version === '2.0.0' &&
    fromVersion151[1].version === '1.5.1' &&
    fromVersion151[1].source === 'github' &&
    fromVersion151[1].notes[0] === 'latest GitHub 1.5.1 release',
  JSON.stringify(fromVersion151)
);
const fromDev20 = q.getReleaseNotesBetween('2.0-dev', '2.0.0', simulatedPublicReleaseHistory);
check('upgrade from old v2.0-dev shows the final v2.0.0 entry', fromDev20.length === 1 && fromDev20[0].version === '2.0.0');
const fromMalformed = q.getReleaseNotesBetween('malformed-version', '2.0.0', simulatedPublicReleaseHistory);
check(
  'malformed old versions fall back to all known current-or-older history',
  fromMalformed.some(entry => entry.version === '2.0.0') && fromMalformed.some(entry => entry.version === '1.0.0'),
  JSON.stringify(fromMalformed)
);
check(
  'duplicate release-history versions keep only the newest matching entry',
  fromVersion10.filter(entry => entry.version === '1.5.1').length === 1 &&
    fromVersion10.find(entry => entry.version === '1.5.1')?.notes[0] === 'latest GitHub 1.5.1 release'
);
const fallbackOnlyHistory = q.getReleaseNotesBetween('1.0', '2.0.0');
check(
  'release-history fetch failure has a minimal bundled fallback instead of a fake full history',
  fallbackOnlyHistory.length === 1 && fallbackOnlyHistory[0].version === '2.0.0',
  JSON.stringify(fallbackOnlyHistory)
);
setUpdateStorage('1.5.1', undefined);
q.acknowledgeUpdateNotice('2.0.0');
check(
  'acknowledging the update stores v2.0.0 and prevents repeat notices',
  context.localStorage.store.get('vm.hitbox.qolboxLastVersion') === '2.0.0' &&
    context.localStorage.store.get('vm.hitbox.qolboxAcknowledgedVersion') === '2.0.0' &&
    q.loadPendingUpdateNotice('2.0.0', true) === null
);
check('current final v2.0.0 install does not show an update notice', getPendingUpdateFor('2.0.0', '2.0.0') === null);
check(
  'update showcase fetches public release history, caches it, and exposes version paging',
  source.includes('GITHUB_RELEASES_URL') &&
    source.includes('GREASYFORK_VERSIONS_URL') &&
    source.includes('qolboxReleaseHistory.v1') &&
    source.includes('data-qolbox-action="update-newer"') &&
    source.includes('data-qolbox-action="update-older"')
);
check(
  'userscript installs on top-level hitbox pages for the game-start title relay',
    /^\/\/ @match\s+https:\/\/hitbox\.io\/$/m.test(source) &&
    /^\/\/ @match\s+https:\/\/www\.hitbox\.io\/$/m.test(source) &&
    source.includes('installTopLevelGameStartRelay();') &&
    /feature:\s*["']gameStartIndicator["']/.test(source)
);
const onboardingSteps = q.getOnboardingSteps();
check(
  'first-start onboarding includes intro, every feature, and final menu keybind step',
  onboardingSteps.length === 9 &&
    onboardingSteps[0].type === 'intro' &&
    onboardingSteps.slice(1, 8).every(step => step.type === 'feature') &&
    onboardingSteps[8].type === 'finish' &&
    onboardingSteps[8].text.includes('F8') &&
    onboardingSteps[8].text.includes('hamburger dropdown'),
  JSON.stringify(onboardingSteps)
);
check(
  'onboarding descriptions cover current chat, command, and away-game attention behavior',
  onboardingSteps.some(step => step.featureKey === 'chat' && step.text.includes('readable game chat scrollable')) &&
    onboardingSteps.some(step => step.featureKey === 'gameStartAlert' && step.text.includes('need to play while away')) &&
    onboardingSteps.some(
      step =>
        step.featureKey === 'lobbyCommands' &&
        step.text.includes('/spec') &&
        step.text.includes('/join') &&
        step.text.includes('/red') &&
        step.text.includes('/blue') &&
        step.text.includes('/switch') &&
        step.text.includes('/lock') &&
        step.text.includes('/unlock') &&
        step.text.includes('/host') &&
        step.text.includes('/start') &&
        step.text.includes('/end') &&
        step.text.includes('/restart') &&
        step.text.includes('/r') &&
        step.text.includes('/rec') &&
        step.text.includes('/record') &&
        step.text.includes('all') &&
        step.text.includes('playing') &&
        step.text.includes('spectators') &&
        step.text.includes('/settings all') &&
        step.text.includes('/kick') &&
        step.text.includes('/ban')
    )
);
check(
  'onboarding feature toggles cover the real QOLBox features',
  hasStringAssignment('FEATURE_FULLSCREEN', 'fullscreen') &&
    hasStringAssignment('FEATURE_AUDIO', 'audio') &&
    hasStringAssignment('FEATURE_RESERVE', 'reserve') &&
    hasStringAssignment('FEATURE_CHAT', 'chat') &&
    hasStringAssignment('FEATURE_GAME_START_ALERT', 'gameStartAlert') &&
    hasStringAssignment('FEATURE_MOBILE_GRAB', 'mobileGrab') &&
    hasStringAssignment('FEATURE_LOBBY_COMMANDS', 'lobbyCommands') &&
    !source.includes('staminaNotches') &&
    !source.includes('qolboxStaminaNotch') &&
    source.includes('function shouldRunFeature(featureKey)') &&
    source.includes('action: "set-feature"') &&
    source.includes('data-qolbox-action="${action}"')
);
check(
  'F8 settings omits redundant open instructions and offers setup replay',
  !/function getSettingsMenuMarkup\(\)[\s\S]{0,900}Desktop: press/.test(source) &&
    source.includes('data-qolbox-action="redo-onboarding"') &&
    /case\s+["']redo-onboarding["']\s*:/.test(source)
);
check(
  'removed graphics scaling is absent from generated settings and renderer code',
  !source.includes('graphicsScale') &&
    !source.includes('Graphics Settings') &&
    !source.includes('data-page="graphics"') &&
    !source.includes('qolboxGraphicsFrame') &&
    !source.includes('getAdvancedGraphicsScaleMultiplier') &&
    !source.includes('installPixiRendererTracker')
);
check(
  'the optional Lobby Commands setting gates the gameplay-chat /rec alias hook',
  source.includes('function handleChatCommandAliasKeydown(event)') &&
    source.includes('areLobbyCommandsEnabled: featureGates.isLobbyCommandsEnabled') &&
    source.includes('isLobbyCommandsEnabled: () => shouldRunFeature(FEATURE_LOBBY_COMMANDS)')
);
check(
  'onboarding uses compact game-style markup without fake showcases or redundant labels',
  !source.includes('qolboxMenuTopBar') &&
    !source.includes('qolboxMenuKicker') &&
    !source.includes('qolboxMenuVisual') &&
    !source.includes('getOnboardingVisualMarkup') &&
    !source.includes('<svg viewBox="0 0 560 320"')
);
check(
  'QOLBox dialogs are removed when closed instead of retaining onboarding DOM',
  hasStringAssignment('QOLBOX_MENU_ID', 'qolboxMenu') &&
    !hasStringAssignment('QOLBOX_MENU_ID', 'qolboxOnboardingMenu') &&
    /function closeQolboxMenu\(\)[\s\S]{0,320}menu\.remove\(\)/.test(source)
);
check(
  'mobile Grab is a normal feature setting and not locked to mobile detection',
  source.includes('key: FEATURE_MOBILE_GRAB') &&
    /title:\s*["']Mobile Grab Button["']/.test(source) &&
    source.includes('case FEATURE_MOBILE_GRAB:') &&
    !/FEATURE_MOBILE_GRAB[\s\S]{0,240}(disabled|aria-disabled|not mobile|mobile-only)/i.test(source)
);
check(
  'mobile QOLBox access is added to the native hamburger dropdown only on mobile',
  source.includes('function patchMobileQolboxHamburgerEntry()') &&
    /item\.className\s*=\s*["']item["']/.test(source) &&
    /item\.textContent\s*=\s*["']QOLBox["']/.test(source) &&
    source.includes('if (!isMobileQolboxMenuContext())') &&
    !/qolboxMobileMenuButton|floating/i.test(source)
);
check(
  'mobile Grab button uses an icon-style native button instead of text',
  Boolean(
    injectedStyle &&
      injectedStyle.textContent.includes('.buttonArea.qolboxMobileGrabButton') &&
      injectedStyle.textContent.includes('background-image: url("data:image/svg+xml') &&
      injectedStyle.textContent.includes('background-size: 68%') &&
      injectedStyle.textContent.includes('box-sizing: border-box') &&
      !source.includes('textContent = \'GRAB\'') &&
      !source.includes('textContent = "GRAB"')
  )
);

const originalA8 = context.window.a8;
const originalMobileGetElementById = context.document.getElementById;
const originalMobileQuerySelector = context.document.querySelector;
const originalMobileQuerySelectorAll = context.document.querySelectorAll;
const originalNavigator = context.navigator;
const originalMatchMedia = context.matchMedia;
const originalMultiplayerSession = context.window.multiplayerSession;
const mobileRelative = new context.Element();
const mobileBat = new context.Element();
const mobilePush = new context.Element();
const mobileRocket = new context.Element();
const mobileMenu = new context.Element();
const mobileChangeControls = new context.Element();
mobileRelative.clientWidth = 800;
mobileRelative.clientHeight = 500;
mobileRelative.rect = { height: 500, left: 0, top: 0, width: 800 };
mobileBat.rect = { height: 90, left: 700, top: 400, width: 90 };
mobilePush.rect = { height: 90, left: 690, top: 300, width: 90 };
mobileRocket.rect = { height: 90, left: 680, top: 200, width: 90 };
mobileChangeControls.className = 'item';
mobileChangeControls.textContent = 'Change Controls';
mobileMenu.appendChild(mobileChangeControls);
mobileMenu.querySelector = selector => {
  if (selector === '.item[data-qolbox-mobile-menu="true"]') {
    return mobileMenu.children.find(child => child.dataset.qolboxMobileMenu === 'true') || null;
  }
  return null;
};
mobileMenu.querySelectorAll = selector => (selector === '.item' ? mobileMenu.children : []);
context.document.getElementById = id => (id === 'relativeContainer' ? mobileRelative : originalMobileGetElementById.call(context.document, id));
context.document.querySelector = selector => {
  if (selector === '.buttonArea.bat') {
    return mobileBat;
  }
  if (selector === '.items.left') {
    return mobileMenu;
  }
  if (selector === '.item[data-qolbox-mobile-menu="true"]') {
    return mobileMenu.children.find(child => child.dataset.qolboxMobileMenu === 'true') || null;
  }
  return originalMobileQuerySelector.call(context.document, selector);
};
context.document.querySelectorAll = selector => {
  if (selector === '.buttonArea.bat, .buttonArea.push, .buttonArea.rocket') {
    return [mobileBat, mobilePush, mobileRocket];
  }
  if (selector === '.item[data-qolbox-mobile-menu="true"]') {
    return mobileMenu.children.filter(child => child.dataset.qolboxMobileMenu === 'true');
  }
  return originalMobileQuerySelectorAll.call(context.document, selector);
};
const mobileInput = {};
context.window.a8 = {
  xm: true,
  PD: {
    oz: { hf: mobileBat },
    rz: { hf: mobilePush },
    az: { hf: mobileRocket },
    ED(inputState) {
      this.oz.hg = inputState;
      this.rz.hg = inputState;
      this.az.hg = inputState;
    },
    NL() {},
    _L() {},
  },
};
q.patchMobileGrabButton();
context.window.a8.PD.ED(mobileInput);
q.syncMobileGrabButton();
const mobileGrabButton = mobileRelative.children.find(child => child.dataset.qolboxMobileGrab === 'true');
check('mobile Grab button is created only inside the native relative container', Boolean(mobileGrabButton));
check('mobile Grab button follows the visible native controls', mobileGrabButton?.style.display === 'block');
check('mobile Grab button matches the native ability button size', mobileGrabButton?.style.width === '90px' && mobileGrabButton?.style.height === '90px');
check('mobile Grab button uses native vertical gap as horizontal spacing', mobileGrabButton?.style.left === '600px');
check('mobile Grab button stays fully inside the mobile screen vertically', mobileGrabButton?.style.top === '400px');
context.innerHeight = 460;
mobileBat.rect = { height: 90, left: 700, top: 430, width: 90 };
mobilePush.rect = { height: 90, left: 690, top: 330, width: 90 };
mobileRocket.rect = { height: 90, left: 680, top: 230, width: 90 };
q.syncMobileGrabButton();
check('mobile Grab button clamps inside the visible viewport when native controls sit low', mobileGrabButton?.style.top === '370px');
context.innerHeight = 768;
mobileBat.rect = { height: 90, left: 700, top: 400, width: 90 };
mobilePush.rect = { height: 90, left: 690, top: 300, width: 90 };
mobileRocket.rect = { height: 90, left: 680, top: 200, width: 90 };
q.syncMobileGrabButton();
let mobileGrabPrevented = false;
let mobileGrabStopped = false;
q.handleMobileGrabPointerStart({
  button: 0,
  preventDefault() {
    mobileGrabPrevented = true;
  },
  stopImmediatePropagation() {
    mobileGrabStopped = true;
  },
});
check('mobile Grab press sets the real grab input flag', mobileInput.Fn === true);
check('mobile Grab press consumes the pointer event', mobileGrabPrevented && mobileGrabStopped);
q.setMobileGrabPressed(false);
check('mobile Grab release clears the real grab input flag', mobileInput.Fn === false);
mobileBat.rect = { height: 0, left: 0, top: 0, width: 0 };
q.syncMobileGrabButton();
check('mobile Grab hides when the normal mobile ability buttons are hidden', mobileGrabButton?.style.display === 'none');
mobileBat.rect = { height: 90, left: 700, top: 400, width: 90 };
context.window.a8 = {};
context.window.multiplayerSession = { KR: { hg: {} } };
q.syncMobileGrabButton();
check('mobile Grab appears when real native buttons are visible even if the internal mobile controller is closed over', mobileGrabButton?.style.display === 'block');
q.handleMobileGrabPointerStart({
  button: 0,
  preventDefault() {},
  stopImmediatePropagation() {},
});
check('mobile Grab press uses the live multiplayer input state when the mobile controller is not exposed', context.window.multiplayerSession.KR.hg.Fn === true);
q.setMobileGrabPressed(false);
check('mobile Grab release clears the live multiplayer input state when the mobile controller is not exposed', context.window.multiplayerSession.KR.hg.Fn === false);
context.window.multiplayerSession.KR.hg.Fn = true;
q.hideMobileGrabButton();
check('hiding an inactive mobile Grab control does not cancel desktop Grab input', context.window.multiplayerSession.KR.hg.Fn === true);
context.window.multiplayerSession = originalMultiplayerSession;
context.window.a8 = {
  xm: true,
  PD: {
    oz: { hf: mobileBat },
    rz: { hf: mobilePush },
    az: { hf: mobileRocket },
    ED(inputState) {
      this.oz.hg = inputState;
      this.rz.hg = inputState;
      this.az.hg = inputState;
    },
    NL() {},
    _L() {},
  },
};
q.patchMobileQolboxHamburgerEntry();
check(
  'mobile QOLBox hamburger entry is inserted before Change Controls',
  mobileMenu.children[0]?.dataset.qolboxMobileMenu === 'true' &&
    mobileMenu.children[0]?.textContent === 'QOLBox' &&
    mobileMenu.children[1] === mobileChangeControls
);
context.window.a8 = {};
context.navigator = { maxTouchPoints: 5 };
context.matchMedia = query => ({ matches: query === '(hover: none) and (pointer: coarse)' });
q.patchMobileQolboxHamburgerEntry();
check(
  'mobile QOLBox hamburger entry is also available from the mobile main menu',
  mobileMenu.children.some(child => child.dataset.qolboxMobileMenu === 'true' && child.textContent === 'QOLBox')
);
context.navigator = { maxTouchPoints: 0 };
context.matchMedia = () => ({ matches: false });
context.window.a8 = {};
q.patchMobileQolboxHamburgerEntry();
check(
  'desktop does not keep the mobile QOLBox hamburger entry',
  !mobileMenu.children.some(child => child.dataset.qolboxMobileMenu === 'true')
);
context.window.a8 = originalA8;
context.navigator = originalNavigator;
context.matchMedia = originalMatchMedia;
context.window.multiplayerSession = originalMultiplayerSession;
context.document.getElementById = originalMobileGetElementById;
context.document.querySelector = originalMobileQuerySelector;
context.document.querySelectorAll = originalMobileQuerySelectorAll;

check('userscript has no stale lowercase dev marker names', !/qolboxDev|qolbox-dev/.test(source));
check(
  'game-start tab indicator is installed for unfocused player matches',
  hasStringAssignment('GAME_START_TITLE_PREFIX', '[GAME STARTED] ') &&
    hasStringAssignment('GAME_PULLED_TITLE_PREFIX', '[PULLED INTO GAME] ') &&
    /\b(?:const|let|var)\s+GAME_START_FAVICON_HREF\s*=/.test(source) &&
    source.includes('function isPlayableLobby()') &&
    source.includes('function isPlayingMatch()') &&
    source.includes('function getMultiplayerSession()') &&
    source.includes('function getIndicatorDocument()') &&
    source.includes('function isCurrentPlayerSpectating') &&
    source.includes('function handleInteractionFocus()') &&
    source.includes('function getPolledReason()') &&
    (source.includes('if (isSessionMatchActive(session))') ||
      source.includes('if (options.isSessionMatchActive(session))')) &&
    source.includes('function patchMultiplayerSessionGameStartHooks(session = options.getSession())') &&
    /(?:const|let|var)\s+REMOTE_START_METHODS\s*=\s*\[["']KJ["'],\s*["']ZJ["']\]/.test(source) &&
    source.includes('for (const methodName of REMOTE_START_METHODS)') &&
    source.includes('function installGameStartSessionHooks(session, callbacks)') &&
    (/!hasVisibleLayer\(["']\.spectateControls["']\)/.test(source) ||
      source.includes('!options.hasVisibleLayer(options.spectateControlsSelector)')) &&
    source.includes('!wasPlayingWhenUnfocused && playingMatch') &&
    source.includes('!options.isPlayableLobby()') &&
    source.includes('function scheduleWatch()') &&
    source.includes('function scheduleEndWatch()') &&
    source.includes('function scheduleIndicator') &&
    source.includes('function flashIndicator()') &&
    source.includes('setFavicon(flashOn)') &&
    /window\.addEventListener\(["']focus["'], handleReturn, true\)/.test(source) &&
    /["']blur["'],/.test(source) &&
    source.includes('scheduledWorkRaf = document.hidden') &&
    source.includes('updateGameStartIndicator();') &&
    hasNumberAssignment('GAME_START_WATCH_INTERVAL_MS', '750') &&
    hasNumberAssignment('GAME_START_FLASH_INTERVAL_MS', '700') &&
    hasNumberAssignment('GAME_START_END_WATCH_INTERVAL_MS', '(?:1000|1e3)')
);
check(
  'reverted editor scroll patch is absent',
  !/EDITOR_FLOATING_PANEL_SELECTOR|EDITOR_SCROLL_CONTAINER_SELECTOR|installEditorWheelHooks|handleEditorWheel|repairEditorPanels|getEditorWheelScrollTarget|scrollEditorWheelTarget/.test(source)
);
check('Esc chat close does not hide the chat history container', !/inGameChat\.style\.display\s*=\s*["']none["']/.test(source));
check(
  'in-game chat observed-history cap is above the old 80-message ceiling',
  hasNumberAssignment('MAX_RETAINED_MESSAGES', '(?:1000|1e3)') && !hasNumberAssignment('MAX_RETAINED_MESSAGES', '80')
);
check(
  'lobby chat is not mirrored through the QOLBox in-game retained-history buffer',
  /for\s*\(\s*const chat of document\.querySelectorAll\(["']\.inGameChat["']\)\s*\)/.test(source)
);

const originalChatQuerySelector = context.document.querySelector;
const originalChatQuerySelectorAll = context.document.querySelectorAll;
const chatCanvas = new context.Element('CANVAS');
chatCanvas.rect = { width: 800, height: 500, left: 0, top: 0 };
const inGameChat = new context.Element();
inGameChat.rect = { width: 320, height: 220, left: 10, top: 10 };
inGameChat.matches = () => false;
const inGameChatInput = new context.Element('INPUT');
inGameChatInput.rect = { width: 300, height: 22, left: 10, top: 190 };
const inGameChatContent = new context.Element();
inGameChatContent.scrollHeight = 2600;
Object.defineProperty(inGameChatContent, 'innerHTML', {
  configurable: true,
  get() {
    return this._innerHTML || this.children.map(child => child.outerHTML || '').join('');
  },
  set(value) {
    this._innerHTML = String(value);
    this.children = [];
    this.childNodes = [];
    this.textContent = String(value).replace(/<[^>]*>/g, '');
  },
});
function makeInGameChatMessage(index) {
  const message = new context.Element();
  message.textContent = `message ${index}`;
  message.outerHTML = `<div data-qolbox-test-message="${index}">message ${index}</div>`;
  return message;
}
function setInGameChatMessages(messages) {
  inGameChatContent.children = messages;
  inGameChatContent.childNodes = messages;
  inGameChatContent.textContent = messages.map(message => message.textContent).join(' ');
  inGameChatContent._innerHTML = '';
}
inGameChat.querySelector = selector => {
  if (selector === '.content') {
    return inGameChatContent;
  }
  if (selector === '.input') {
    return inGameChatInput;
  }
  return null;
};
context.document.querySelector = selector => (selector === '#pixiContainer canvas' ? chatCanvas : originalChatQuerySelector(selector));
context.document.querySelectorAll = selector =>
  selector === '.inGameChat' ? [inGameChat] : originalChatQuerySelectorAll(selector);

const observedInGameMessages = Array.from({ length: 120 }, (_, index) => makeInGameChatMessage(index));
setInGameChatMessages(observedInGameMessages);
q.patchInGameChatScroll();
setInGameChatMessages(observedInGameMessages.slice(-20));
q.patchInGameChatScroll();
const restoredInGameMessageIds = [...inGameChatContent.innerHTML.matchAll(/data-qolbox-test-message="(\d+)"/g)].map(
  match => Number(match[1])
);
check(
  'in-game chat restores more than 80 actually observed messages after the native DOM trims',
  restoredInGameMessageIds.length === 120 &&
    restoredInGameMessageIds[0] === 0 &&
    restoredInGameMessageIds[restoredInGameMessageIds.length - 1] === 119,
  `restored ${restoredInGameMessageIds.length} messages`
);
check(
  'in-game chat retained-history restore does not duplicate messages',
  restoredInGameMessageIds.length === new Set(restoredInGameMessageIds).size
);
context.document.querySelector = originalChatQuerySelector;
context.document.querySelectorAll = originalChatQuerySelectorAll;
check('full-room reserve button label is present', hasStringAssignment('RESERVE_BUTTON_TEXT', 'RESERVE'));
check('reserve waiting message is present', hasStringAssignment('RESERVE_WAIT_TEXT', 'Waiting for someone to leave...'));
check('reserve waiting popup has a friendly title', hasStringAssignment('RESERVE_WAIT_TITLE_TEXT', 'Waiting for a Spot'));
check(
  'reserve waiting popup uses native window classes with integrated wait details',
  source.includes('connectingWindowContainer qolboxReserveWindowContainer') &&
    source.includes('<div class="connectingWindow">') &&
    source.includes('<div class="spinner"') &&
    source.includes('qolboxReserveStatus') &&
    source.includes('qolboxReserveCountdown')
);
check(
  'reserve hides the raw native room_full window while waiting',
  Boolean(
    injectedStyle &&
      injectedStyle.textContent.includes('body.qolbox-reserve-active .connectingWindowContainer:not(.qolboxReserveWindowContainer)') &&
      injectedStyle.textContent.includes('display: none !important')
  )
);
check(
  'reserve retries the captured native socket join payload',
  source.includes('function createReserveCapturedJoinController') &&
    source.includes('function captureReserveJoin(socket, eventName, args)') &&
    source.includes('function emitReserveSocketJoinAttempt(attempt, options)') &&
    source.includes('return emitReserveSocketJoinAttempt(getRetryCapturedJoin(), {') &&
    source.includes('beforeEmit: options.suppressRetryAudio') &&
    source.includes('cloneValue: cloneReserveJoinValue') &&
    source.includes('Reflect.apply(emit, attempt.socket, [attempt.eventName, ...attempt.args.map(options.cloneValue)])')
);
check(
  'reserve direct-link detection handles native room_full text updates',
  source.includes('characterData: true') &&
    source.includes('function scheduleReserveStatusWatch') &&
    hasRegexAssignment('RESERVE_ROOM_FULL_PATTERN', '/room\\[_ \\]\\?full\\|room is full/i')
);
check(
  'reserve countdown updates every tenth of a second',
  hasNumberAssignment('RESERVE_COUNTDOWN_UPDATE_MS', '100') &&
    source.includes('function scheduleReserveCountdownUpdate') &&
    /Retrying in \$\{\(remainingMs \/ (?:1000|1e3)\)\.toFixed\(1\)\} seconds\.\.\./.test(source)
);
check(
  'reserve does not take over unrelated native room_full retries',
  source.includes('function isNativeAutoJoinMatch(joinId, password)') &&
    source.includes('return readNativeProperty(window, "autoJoin")') &&
    source.includes('autoReserve: isAutoReserveJoin(payload, options)') &&
    source.includes('isAutoJoinMatch: isNativeAutoJoinMatch') &&
    source.includes('function createReserveConnectingStateController(options)') &&
    source.includes('const canAutoReserve = options.canAutoReserveCapturedJoin()') &&
    source.includes('canAutoReserveCapturedJoin,')
);
check(
  'one-person full rooms are shown as unavailable instead of reservable',
  source.includes('function isReserveUnavailableRoom(row)') &&
    hasStringAssignment('RESERVE_ONE_PERSON_TEXT', 'This lobby only allows one person, so there is no spot to reserve.') &&
    source.includes('qolboxReserveUnavailable') &&
    source.includes('showReserveOnePersonUnavailable')
);
check(
  'one-person unavailable Cancel closes only the custom popup and clears selection',
  source.includes('function clearReserveVisibleRoomSelection()') &&
    /row\.classList\.remove\(["']SELECTED["']\)/.test(source) &&
    !/function clearReserveVisibleRoomSelection\(\)[\s\S]*?reserveSelectedRoomRow = null;[\s\S]*?function startReserveSpot/.test(source) &&
    source.includes('function createReserveInteractionHandlers(options)') &&
    source.includes('options.stopReserveSpot({ clearSelection: true })') &&
    source.includes('if (options.getState()?.unavailable)')
);
check(
  'reserve room selection survives room-list DOM rebuilds by room identity',
  source.includes('function createReserveSelectionState()') &&
    source.includes('let selectedSignature') &&
    source.includes('function getReserveRoomSignature(row)') &&
    source.includes('function findReserveRoomBySignature') &&
    source.includes('function getReserveSelectedRoomState()') &&
    source.includes('const shouldReserve = selectedState.full || selectedState.unavailable')
);
check(
  'reserve retries suppress repeated Howler play sounds',
  hasNumberAssignment('RESERVE_RETRY_AUDIO_SUPPRESS_MS', '900') &&
    source.includes('function createReserveRetryAudioSuppression') &&
    source.includes('function suppressReserveRetryAudio()') &&
    source.includes('function isReserveRetryAudioSuppressed()') &&
    source.includes('beforeEmit: options.suppressRetryAudio') &&
    source.includes('options.beforeEmit();') &&
    source.includes('suppressRetryAudio: suppressReserveRetryAudio') &&
    source.includes('function shouldSuppressReserveRetryAudio()') &&
    source.includes('__qolboxReserveAudioWrapped')
);
check(
  'reserve success suppresses late native room_full popups',
  hasNumberAssignment('RESERVE_JOINED_ROOM_FULL_SUPPRESS_MS', '(?:12000|12e3)') &&
    source.includes('function hasReserveSuccessfulJoinLayer()') &&
    (source.includes('hasVisibleLayer(FULLSCREEN_GAMEPLAY_LAYER_SELECTOR)') ||
      source.includes('options.hasVisibleLayer(options.gameplayLayerSelector)')) &&
    source.includes('function stopReserveAfterSuccessfulJoin()') &&
    source.includes('isRoomFullSuppressed: isReserveJoinedRoomFullSuppressed') &&
    source.includes('options.isRoomFullSuppressed() && options.hasSuccessfulJoinLayer() && options.roomFullPattern.test(nativeText)') &&
    source.includes('options.stopAfterSuccessfulJoin();')
);
check(
  'wrong password stops reserve retries inside the reserve popup',
  hasRegexAssignment('RESERVE_WRONG_PASSWORD_PATTERN', '/wrong\\[_ \\]\\?password\\|password incorrect\\|incorrect password/i') &&
    source.includes('options.showTerminalMessage("wrong-password", options.getReserveNativeMessage(options.wrongPasswordPattern))') &&
    source.includes('showTerminalMessage: showReserveTerminalMessage') &&
    source.includes('terminal: true') &&
    source.indexOf('options.wrongPasswordPattern.test(nativeText)') <
      source.indexOf('if (options.roomFullPattern.test(nativeText) && canAutoReserve)')
);

const slashEmits = [];
const slashMessages = [];
const slashSession = {
  JD: {
    $L: {
      J: 30,
      G: 0,
      H: 1,
      Y: true,
      q: 7,
      V: 1,
      K: 100,
      X: 10,
      Z: 5,
      $: 10,
      tt: 1,
      ct: true,
      it: 120,
      st: 2.1,
      ht: 30,
      nt: 13,
      at: 3,
      lt: 3,
      ut: 35,
      et: 8,
      ot: 0,
      rt: 1.5,
      dt: 3,
      wt: 6,
      ft: 8,
      gt: 15,
      yt: 30,
      bt: false,
      kt: 70,
      St: 15,
      Nt: 0.12,
      Mt: false,
      Ct: 0.11,
      Tt: 70,
      xt: 0.025,
      _t: 0,
      Pt: false,
      Et: 1,
      Bt: 5,
      It: 0,
      Ft: 1,
      At: 40,
      Ot: false,
      Rt: 0.11,
      Dt: 70,
      Lt: 1,
      Ut: 0.5,
      jt: 3,
      Wt: 0.09,
      Jt: 20,
      Gt: 75,
      Ht: 5,
      zt: 40,
      Yt: 15,
      qt: 0.12,
      Vt: 2,
      vt: false,
      Kt: 0.8,
      Zt: 5,
      pi() {
        return [
          '===',
          `timeScale: ${this.J}`,
          `bbEnabled: ${this.ct}`,
          `playerSize:${this.Kt}`,
          '===',
        ];
      },
    },
    Pi: {
      1: { N: 1, name: 'Host' },
      2: { N: 3, name: 'Guest' },
      3: { N: 2, name: 'Guest Two' },
    },
    ZD: {
      emit(eventName, payload) {
        slashEmits.push({ eventName, payload });
      },
    },
    vL: 1,
    XD() {
      return true;
    },
  },
  TJ: {
    NS: true,
    JD: {
      tP: [
        {
          state: {
            settings: [
              {
                J: 30,
                G: 0,
                H: 1,
                Y: true,
                q: 7,
                V: 1,
                K: 100,
                X: 10,
                Z: 5,
                $: 10,
                tt: 1,
                ct: true,
                it: 120,
                st: 2.1,
                ht: 30,
                nt: 13,
                at: 3,
                lt: 3,
                ut: 35,
                et: 8,
                ot: 0,
                rt: 1.5,
                dt: 3,
                wt: 6,
                ft: 8,
                gt: 15,
                yt: 30,
                bt: false,
                kt: 70,
                St: 15,
                Nt: 0.12,
                Mt: false,
                Ct: 0.11,
                Tt: 70,
                xt: 0.025,
                _t: 0,
                Pt: false,
                Et: 1,
                Bt: 5,
                It: 0,
                Ft: 1,
                At: 40,
                Ot: false,
                Rt: 0.11,
                Dt: 70,
                Lt: 1,
                Ut: 0.5,
                jt: 3,
                Wt: 0.09,
                Jt: 20,
                Gt: 75,
                Ht: 5,
                zt: 40,
                Yt: 15,
                qt: 0.12,
                Vt: 2,
                vt: false,
                Kt: 0.8,
                Zt: 5,
              },
            ],
          },
        },
      ],
    },
    YW(playerId, team) {
      this.lastTeamRow = { playerId, team };
    },
  },
  KR: { SL: false, AI: 12 },
  CJ(message) {
    this.nativeMessages = this.nativeMessages || [];
    this.nativeMessages.push(message);
    if (message === '/settings') {
      this.JD.$L.pi().forEach(line => this.vG(line));
    }
    if (message === '/help') {
      this.vG('* As host, you can type a number of commands:');
      this.vG('/kick playername');
      this.vG('/ban playername');
      this.vG('/settings -- view all gameplay commands');
    }
  },
  LL(playerId, previousTeam, nextTeam, frame) {
    this.llCalls = this.llCalls || [];
    this.llCalls.push({ playerId, previousTeam, nextTeam, frame });
    this.JD.Pi[playerId].N = nextTeam;
    this.TJ.YW(playerId, nextTeam);
  },
  vG(message) {
    slashMessages.push(message);
  },
};
context.window.multiplayerSession = slashSession;
q.patchSlashCommands();
slashSession.CJ('/spec');
check('slash /spec sends the native spectate team command for self', slashEmits.at(-1)?.payload?.[1] === 0);
slashSession.CJ('/spec Guest');
check(
  'slash /spec named player uses the vanilla host player move command',
  slashEmits.at(-1)?.payload?.[0] === 47 &&
    String(slashEmits.at(-1)?.payload?.[1]?.i) === '2' &&
    slashEmits.at(-1)?.payload?.[1]?.t === 0
);
slashSession.CJ('/red');
check('slash /red sends the native red team command for self in team mode', slashEmits.at(-1)?.payload?.[1] === 2);
slashSession.CJ('/blue Guest');
check('slash /blue named player handles already-correct team safely', slashMessages.at(-1) === '* Guest is already blue.');
slashSession.CJ('/red Guest');
check(
  'slash /red named player uses the vanilla host player move command',
  slashEmits.at(-1)?.payload?.[0] === 47 &&
    String(slashEmits.at(-1)?.payload?.[1]?.i) === '2' &&
    slashEmits.at(-1)?.payload?.[1]?.t === 2 &&
    slashSession.JD.Pi[2].N === 3,
  JSON.stringify({ lastEmit: slashEmits.at(-1), messages: slashMessages })
);
check('slash named command consumes handled commands instead of falling through to native chat', !slashSession.nativeMessages);
slashSession.CJ('/red Host');
check('slash named self command sends the native team command', slashEmits.at(-1)?.payload?.[1] === 2);
slashSession.CJ('/red Missing');
check('slash named command reports missing players', slashMessages.at(-1) === "* Couldn't find player 'Missing'.");
check('slash parser does not call native chat for handled QOLBox commands', !slashSession.nativeMessages);
const ambiguousResult = q.findPlayerByName('Gues');
check('slash player lookup detects ambiguous partial names', ambiguousResult.status === 'ambiguous');
const clearPrefixResult = q.findPlayerByName('Guest T');
check('slash player lookup uses a clear unique prefix match', clearPrefixResult.status === 'found' && clearPrefixResult.match.id === '3');
const clearContainsResult = q.findPlayerByName('Two');
check('slash player lookup uses a clear unique contained match', clearContainsResult.status === 'found' && clearContainsResult.match.id === '3');
const missingResult = q.findPlayerByName('Not Even Close');
check('slash player lookup reports missing instead of ambiguous when nobody matches', missingResult.status === 'missing');
slashSession.CJ('/red Gues');
check(
  'slash ambiguous player message lists the plausible matches',
  slashMessages.at(-1) === "* Player name 'Gues' is ambiguous: Guest, Guest Two.",
  slashMessages.at(-1)
);
const nativeCommandCountBeforeKick = (slashSession.nativeMessages || []).length;
slashSession.CJ('/kick Two');
check(
  'native /kick accepts unique partial player names through the exact native command path',
  slashSession.nativeMessages.length === nativeCommandCountBeforeKick + 1 &&
    slashSession.nativeMessages.at(-1) === '/kick Guest Two',
  JSON.stringify(slashSession.nativeMessages)
);
slashSession.CJ('/ban Gues');
check(
  'native /ban blocks ambiguous partial names instead of guessing',
  slashSession.nativeMessages.length === nativeCommandCountBeforeKick + 1 &&
    slashMessages.at(-1) === "* Player name 'Gues' is ambiguous: Guest, Guest Two.",
  JSON.stringify({ nativeMessages: slashSession.nativeMessages, slashMessages })
);
slashSession.CJ('/kick Missing Native');
check(
  'native /kick reports missing player targets before native execution',
  slashSession.nativeMessages.length === nativeCommandCountBeforeKick + 1 &&
    slashMessages.at(-1) === "* Couldn't find player 'Missing Native'.",
  JSON.stringify({ nativeMessages: slashSession.nativeMessages, slashMessages })
);
slashSession.CJ('/ban Host');
check(
  'native /ban preserves exact player-name behavior',
  slashSession.nativeMessages.at(-1) === '/ban Host',
  JSON.stringify(slashSession.nativeMessages)
);
slashSession.JD.Pi[1].N = 1;
slashSession.JD.Pi[2].N = 1;
slashSession.JD.Pi[3].N = 1;
slashSession.CJ('/red');
check('slash /red fails safely in non-team modes', slashMessages.at(-1) === '* red is only available in team modes.');
slashSession.JD.Pi[1].N = 0;
slashSession.CJ('/join');
check('slash /join sends the native FFA join state for the current player', slashEmits.at(-1)?.payload?.[1] === 1);
slashSession.JD.Pi[2].N = 0;
slashSession.CJ('/join Guest');
check(
  'slash /join named player uses the native host player move command in non-team modes',
  slashEmits.at(-1)?.payload?.[0] === 47 &&
    String(slashEmits.at(-1)?.payload?.[1]?.i) === '2' &&
    slashEmits.at(-1)?.payload?.[1]?.t === 1
);
slashSession.JD.Pi[2].N = 1;
slashSession.CJ('/join Guest');
check('slash /join reports an already-playing target cleanly', slashMessages.at(-1) === '* Guest is already playing.');
slashSession.JD.Pi[2].N = 0;
slashSession.CJ('/join Missing');
check('slash /join uses the shared missing-name result', slashMessages.at(-1) === "* Couldn't find player 'Missing'.");
slashSession.CJ('/join Gues');
check(
  'slash /join uses the shared ambiguity result',
  slashMessages.at(-1) === "* Player name 'Gues' is ambiguous: Guest, Guest Two."
);
slashSession.JD.Pi[1].N = 1;
slashSession.JD.Pi[2].N = 1;
slashSession.JD.Pi[3].N = 0;
slashSession.CJ('/spec all');
check(
  'slash /spec all moves each eligible playing player to spectator',
  slashEmits.slice(-2).some(entry => entry.payload?.[0] === 24 && entry.payload?.[1] === 0) &&
    slashEmits.slice(-2).some(
      entry => entry.payload?.[0] === 47 && String(entry.payload?.[1]?.i) === '2' && entry.payload?.[1]?.t === 0
    )
);
const emitCountBeforeSpecSpectators = slashEmits.length;
slashSession.JD.Pi[1].N = 1;
slashSession.JD.Pi[2].N = 0;
slashSession.JD.Pi[3].N = 0;
slashSession.CJ('/spec spectators');
check(
  'slash /spec spectators does not move already-spectating players',
  slashEmits.length === emitCountBeforeSpecSpectators &&
    slashMessages.at(-1) === '* No eligible players need to spectate.'
);
slashSession.JD.Pi[1].N = 0;
slashSession.JD.Pi[2].N = 0;
slashSession.JD.Pi[3].N = 0;
slashSession.CJ('/join all');
check(
  'slash /join all moves all spectators into non-team play',
  slashEmits.slice(-3).some(entry => entry.payload?.[0] === 24 && entry.payload?.[1] === 1) &&
    slashEmits.slice(-3).filter(entry => entry.payload?.[0] === 47 && entry.payload?.[1]?.t === 1).length === 2
);
slashSession.JD.Pi[1].N = 2;
slashSession.JD.Pi[2].N = 3;
slashSession.JD.Pi[3].N = 0;
slashSession.CJ('/red all');
check(
  'slash /red all moves every non-red lobby member, including spectators, to red',
  slashEmits.slice(-2).some(
    entry => entry.payload?.[0] === 47 && String(entry.payload?.[1]?.i) === '2' && entry.payload?.[1]?.t === 2
  ) &&
    slashEmits.slice(-2).some(
      entry => entry.payload?.[0] === 47 && String(entry.payload?.[1]?.i) === '3' && entry.payload?.[1]?.t === 2
    )
);
slashSession.JD.Pi[1].N = 2;
slashSession.JD.Pi[2].N = 3;
slashSession.JD.Pi[3].N = 0;
slashSession.CJ('/red playing');
check(
  'slash /red playing leaves spectators out of the bulk team move',
  slashEmits.at(-1)?.payload?.[0] === 47 &&
    String(slashEmits.at(-1)?.payload?.[1]?.i) === '2' &&
    slashEmits.at(-1)?.payload?.[1]?.t === 2
);
slashSession.JD.Pi[1].N = 2;
slashSession.JD.Pi[2].N = 3;
slashSession.JD.Pi[3].N = 0;
slashSession.CJ('/blue all');
check(
  'slash /blue all moves every non-blue lobby member using the same native path',
  slashEmits.slice(-2).some(entry => entry.payload?.[0] === 24 && entry.payload?.[1] === 3) &&
    slashEmits.slice(-2).some(
      entry => entry.payload?.[0] === 47 && String(entry.payload?.[1]?.i) === '3' && entry.payload?.[1]?.t === 3
    )
);
slashSession.JD.Pi[4] = { N: 0, name: 'all' };
slashSession.CJ('/spec "all"');
check(
  'quoted all intentionally targets a player literally named all instead of invoking bulk mode',
  slashMessages.at(-1) === '* all is already spectator.'
);
slashSession.CJ('/settings all');
check(
  'slash /settings all preserves native lines and appends only real omitted settings in native style',
  slashMessages.some(message => message === 'timeScale: 30') &&
    slashMessages.some(message => message === 'bbPower: 120') &&
    slashMessages.some(message => message === 'egEnabled: false') &&
    slashMessages.filter(message => message === 'bbEnabled: true').length === 1 &&
    !slashMessages.some(
      message => message.includes('All editable') || (message !== '===' && message.includes('=')) || message.includes('(hidden)')
    )
);
const nativeCountBeforeSettings = (slashSession.nativeMessages || []).length;
slashSession.CJ('/settings');
check(
  'plain slash /settings remains on the native game path',
  slashSession.nativeMessages.length === nativeCountBeforeSettings + 1 &&
    slashSession.nativeMessages.at(-1) === '/settings'
);
slashSession.CJ('/help');
check('slash /help remains on the native game path', slashSession.nativeMessages.at(-1) === '/help');
check(
  'slash /help keeps vanilla rows while correcting its settings distinction',
  slashMessages.some(message => message.includes('/kick playername')) &&
    slashMessages.some(message => message === '/settings -- view normal gameplay settings') &&
    !slashMessages.some(message => message === '/settings -- view all gameplay commands')
);
check(
  'slash /help appends native-style QOLBox command rows with target and all syntax',
  slashMessages.some(message => message.includes('QOLBox commands')) &&
    slashMessages.some(message => message.includes('/spec playername')) &&
    slashMessages.some(message => message.includes('/spec all')) &&
    slashMessages.some(message => message.includes('/join playername')) &&
    slashMessages.some(message => message.includes('/join all')) &&
    slashMessages.some(message => message.includes('/red playername')) &&
    slashMessages.some(message => message.includes('/red all')) &&
    slashMessages.some(message => message.includes('/blue playername')) &&
    slashMessages.some(message => message.includes('/blue all')) &&
    slashMessages.some(message => message.includes('playing')) &&
    slashMessages.some(message => message.includes('spectators')) &&
    slashMessages.some(message => message.includes('/switch')) &&
    slashMessages.some(message => message.includes('/lock')) &&
    slashMessages.some(message => message.includes('/unlock')) &&
    slashMessages.some(message => message.includes('/host playername')) &&
    slashMessages.some(message => message.includes('/start')) &&
    slashMessages.some(message => message.includes('/end')) &&
    slashMessages.some(message => message.includes('/restart')) &&
    slashMessages.some(message => message.includes('/r')) &&
    slashMessages.some(message => message.includes('/record')) &&
    slashMessages.some(message => message.includes('/rec')) &&
    slashMessages.some(message => message.includes('/settings -- view normal gameplay settings')) &&
    slashMessages.some(message => message.includes('/settings all -- view normal and hidden gameplay settings')) &&
    slashMessages.some(message => message.includes('Native /kick and /ban accept exact or unique partial player names.')) &&
    slashMessages.some(message => message.includes('/spec "all"'))
);
slashSession.JD.Pi[3].N = 2;
slashSession.CJ('/join');
check('slash /join directs team-mode players to a team command', slashMessages.at(-1) === '* Use /red or /blue to join in team modes.');
slashSession.JD.Pi[3].N = 1;
slashSession.KR.SL = true;
let nativeEndCalls = 0;
let nativeStartCalls = 0;
const handledCommandInput = { value: '/end' };
const previousQuerySelectorAll = context.document.querySelectorAll;
context.document.querySelectorAll = selector =>
  selector === '.inGameChat .input, .lobbyContainer .chatBox .input' ? [handledCommandInput] : previousQuerySelectorAll(selector);
slashSession.PJ = () => {
  nativeEndCalls += 1;
};
slashSession._J = () => {
  nativeStartCalls += 1;
};
slashSession.CJ('/end');
check('slash /end invokes the native end-game path during an active host game', nativeEndCalls === 1);
check('slash /end clears its draft before the native end-game teardown', handledCommandInput.value === '');
handledCommandInput.value = '/restart';
slashSession.CJ('/restart');
check(
  'slash /restart uses native end and native start paths during an active host game',
  nativeEndCalls === 2 && nativeStartCalls === 1
);
check('slash /restart clears its draft before the native match transition', handledCommandInput.value === '');
slashSession.KR.SL = false;
slashSession.CJ('/end');
check('slash /end fails cleanly outside an active game', slashMessages.at(-1) === '* There is no active game to end.');
slashSession.CJ('/restart');
check('slash /restart fails cleanly outside an active game', slashMessages.at(-1) === '* There is no active game to restart.');
context.document.querySelectorAll = previousQuerySelectorAll;
slashSession.CJ('/rec');
slashSession.CJ('/rec replay');
check(
  'slash /rec aliases through the native /record path without duplicating record behavior',
  slashSession.nativeMessages.at(-2) === '/record' && slashSession.nativeMessages.at(-1) === '/record replay'
);
check('record alias leaves the native /record command unchanged', q.expandNativeChatAlias('/record') === '/record');
q.setFeatureEnabled('lobbyCommands', false);
slashSession.CJ('/rec');
check(
  'turning off Lobby Commands leaves slash messages on the native path',
  slashSession.nativeMessages.at(-1) === '/rec'
);
q.setFeatureEnabled('lobbyCommands', true);
context.window.multiplayerSession = null;

const switchEmits = [];
const switchMessages = [];
const originalSwitchDateNow = context.Date.now;
let switchNow = 1000;
context.Date.now = () => switchNow;
const switchSession = {
  JD: {
    Pi: {
      1: { N: 2, name: 'Host' },
      2: { N: 3, name: 'Guest' },
      3: { N: 0, name: 'Spectator' },
      4: { N: 1, name: 'FFA' },
    },
    Qn: 1,
    ZD: {
      emit(eventName, payload) {
        switchEmits.push({ eventName, payload });
      },
    },
    vL: 1,
    XD() {
      return true;
    },
  },
  vG(message) {
    switchMessages.push(message);
  },
};
context.window.multiplayerSession = switchSession;
check('team SWITCH sends the local user through the native self team command', q.switchTeamPlayers());
check(
  'team SWITCH sends other players through the vanilla host player move command',
  switchEmits.some(entry => entry.payload?.[0] === 24 && entry.payload?.[1] === 3) &&
    switchEmits.some(entry => entry.payload?.[0] === 47 && String(entry.payload?.[1]?.i) === '2' && entry.payload?.[1]?.t === 2) &&
    !switchEmits.some(entry => String(entry.payload?.[1]?.i) === '3' || String(entry.payload?.[1]?.i) === '4') &&
    switchMessages.at(-1) === '* Switching 2 players between red and blue.',
  JSON.stringify({ switchEmits, switchMessages })
);
switchEmits.length = 0;
switchMessages.length = 0;
switchSession.JD.Pi[1].N = 2;
switchSession.JD.Pi[2].N = 3;
check('overlapping /switch is handled while the previous swap is still settling', q.handleQolboxSlashCommand('/switch'));
check(
  'overlapping /switch does not send duplicate native move commands',
  switchEmits.length === 0 && switchMessages.at(-1) === '* Team switch is still settling.',
  JSON.stringify({ switchEmits, switchMessages })
);
switchNow += 1000;
switchEmits.length = 0;
switchMessages.length = 0;
switchSession.JD.Pi[1].N = 2;
switchSession.JD.Pi[2].N = 3;
check('slash /switch uses the same red-blue team swap logic', q.handleQolboxSlashCommand('/switch'));
check(
  'slash /switch sends the same native host/self commands as the button',
  switchEmits.some(entry => entry.payload?.[0] === 24 && entry.payload?.[1] === 3) &&
    switchEmits.some(entry => entry.payload?.[0] === 47 && String(entry.payload?.[1]?.i) === '2' && entry.payload?.[1]?.t === 2) &&
    switchMessages.at(-1) === '* Switching 2 players between red and blue.',
  JSON.stringify({ switchEmits, switchMessages })
);
switchNow += 1000;

const originalSwitchQuerySelector = context.document.querySelector;
const originalSwitchQuerySelectorAll = context.document.querySelectorAll;
const teamButtonContainer = new context.Element();
teamButtonContainer.rect = { height: 24, left: 0, top: 0, width: 320 };
const redTeamButton = new context.Element();
redTeamButton.className = 'teamButton';
redTeamButton.textContent = 'JOIN RED';
const blueTeamButton = new context.Element();
blueTeamButton.className = 'teamButton';
blueTeamButton.textContent = 'JOIN BLUE';
teamButtonContainer.appendChild(redTeamButton);
teamButtonContainer.appendChild(blueTeamButton);
teamButtonContainer.querySelector = selector =>
  selector === '.qolboxSwitchTeamsButton'
    ? teamButtonContainer.children.find(child => child.className === 'teamButton qolboxSwitchTeamsButton') || null
    : null;
teamButtonContainer.querySelectorAll = selector =>
  selector === '.teamButton' ? teamButtonContainer.children.filter(child => String(child.className || '').includes('teamButton')) : [];
context.document.querySelector = selector =>
  selector === '.lobbyContainer .playerBox .teamsButtonContainer'
    ? teamButtonContainer
    : originalSwitchQuerySelector.call(context.document, selector);
context.document.querySelectorAll = selector =>
  selector === '.qolboxSwitchTeamsButton'
    ? teamButtonContainer.children.filter(child => String(child.className || '').includes('qolboxSwitchTeamsButton'))
    : originalSwitchQuerySelectorAll.call(context.document, selector);
check('team SWITCH button is inserted into the native team button row', q.patchSwitchTeamsButton());
check(
  'team SWITCH button fits between the vanilla red and blue team buttons',
  teamButtonContainer.children[1]?.textContent === 'SWITCH' &&
    teamButtonContainer.children[1]?.className === 'teamButton qolboxSwitchTeamsButton' &&
    teamButtonContainer.children[2]?.textContent === 'JOIN BLUE'
);
switchSession.JD.XD = () => false;
check('team SWITCH button is removed for non-hosts', !q.patchSwitchTeamsButton() && !teamButtonContainer.children.some(child => child.textContent === 'SWITCH'));
context.document.querySelector = originalSwitchQuerySelector;
context.document.querySelectorAll = originalSwitchQuerySelectorAll;
context.window.multiplayerSession = null;
context.Date.now = originalSwitchDateNow;

check(
  'remote team features use vanilla commands instead of local-only lobby mutations',
  source.includes('function movePlayerToTeam(') &&
    /getCommandId\(["']jE["'], 47\)/.test(source) &&
    source.includes('function switchTeamPlayers(') &&
    !source.includes('function applyLocalTeamState(') &&
    !source.includes('LL(playerId')
);

check(
  'render canvas focus outline is suppressed',
  Boolean(
    injectedStyle &&
      injectedStyle.textContent.includes('#pixiContainer canvas:focus') &&
      injectedStyle.textContent.includes('#pixiContainer canvas:focus-visible') &&
      injectedStyle.textContent.includes('outline-color: transparent !important') &&
      injectedStyle.textContent.includes('outline-style: none !important') &&
      injectedStyle.textContent.includes('outline-width: 0 !important')
  )
);
check(
  'jukebox knob stays in the browser Tab order with a focus animation patch',
  source.includes('function patchJukeboxKeyboardFocus(knob)') && source.includes('keepInBrowserTabOrder(knob)')
);
check(
  'gameplay Tab focuses the jukebox knob without browser scroll',
  source.includes('function handleGameplayTabFocus(event)') &&
    source.includes('event.preventDefault()') &&
    source.includes('focusElementWithoutScroll(knob)')
);
check(
  'chat inputs stay out of the browser Tab order',
  source.includes('function patchChatTabOrder()') &&
    source.includes('for (const input of document.querySelectorAll(options.chatInputSelector))') &&
    source.includes('chatInputSelector: CHAT_INPUT_SELECTOR')
);
const editorLayer = new context.Element();
const editorCanvas = new context.Element('CANVAS');
editorLayer.id = 'editorContainer';
editorCanvas.width = 920;
editorCanvas.height = 575;
editorLayer.querySelector = selector => (selector === 'canvas' ? editorCanvas : null);
editorLayer.appendChild(editorCanvas);
const editorFrame = q.fitEditorLayerToFrame(editorLayer, {
  left: 68,
  top: 0,
  width: 1229,
  height: 768,
  viewportWidth: 1366,
  viewportHeight: 768,
  mode: 'editor',
});
const expectedEditorScale = Math.min(1229 / 920, 768 / 575);
const editorScaleMatch = /^scale\(([^)]+)\)$/.exec(editorLayer.style.transform || '');
const actualEditorScale = Number(editorScaleMatch?.[1]);
check('editor layer keeps the native editor canvas width', editorLayer.style.width === '920px');
check('editor layer keeps the native editor canvas height with no reserved bottom lane', editorLayer.style.height === '575px');
check(
  'editor layer scales the native editor surface to the fullscreen frame like v1.5.1',
  Number.isFinite(actualEditorScale) && Math.abs(actualEditorScale - expectedEditorScale) < 0.0001,
  `got ${editorLayer.style.transform}`
);
check('editor layer allows menus and pickers to extend outside the canvas frame', editorLayer.style.overflow === 'visible');
check('editor canvas CSS stays aligned with the native editor canvas width', editorCanvas.style.width === '920px');
check('editor canvas CSS stays aligned with the native editor canvas height', editorCanvas.style.height === '575px');
check(
  'editor frame reports the native-to-fullscreen visual scale',
  Math.abs(editorFrame.scale - expectedEditorScale) < 0.0001,
  `got ${editorFrame.scale}`
);
check(
  'editor scaled frame fills the fullscreen editor render height',
  Math.abs(editorFrame.visualHeight - 768) <= 1,
  `got ${editorFrame.visualHeight}`
);

const fullscreenApp = new context.Element();
const fullscreenRelative = new context.Element();
const fullscreenBackground = new context.Element();
const fullscreenLayer = new context.Element();
const fullscreenCanvas = new context.Element('CANVAS');
const fullscreenOverlay = new context.Element();
const fullscreenScore = new context.Element();
const fullscreenScoreRow = new context.Element();
for (const element of [
  fullscreenApp,
  fullscreenRelative,
  fullscreenBackground,
  fullscreenLayer,
  fullscreenCanvas,
  fullscreenOverlay,
  fullscreenScore,
  fullscreenScoreRow,
]) {
  q.setImportantStyle(element, 'position', 'fixed');
  q.setImportantStyle(element, 'left', '10px');
  q.setImportantStyle(element, 'overflow', 'hidden');
  q.setImportantStyle(element, 'transform', 'none');
  q.setImportantStyle(element, 'zoom', '1');
}
fullscreenApp.style.setProperty('height', '538px');
fullscreenApp.style.setProperty('width', '862px');
fullscreenRelative.style.setProperty('height', '538px');
fullscreenRelative.style.setProperty('width', '862px');
fullscreenCanvas.style.setProperty('height', '538px');
fullscreenCanvas.style.setProperty('width', '862px');
q.setImportantStyle(fullscreenApp, 'width', '1280px');
q.setImportantStyle(fullscreenRelative, 'width', '1280px');
q.setImportantStyle(fullscreenCanvas, 'width', '1280px');
q.setImportantStyle(context.document.documentElement, 'overflow', 'hidden');
q.setImportantStyle(context.document.body, 'overflow', 'hidden');
q.setImportantStyle(context.document.body, 'margin', '0');
q.setImportantStyle(context.document.body, 'background-color', '#0a0a0a');
q.setImportantStyle(fullscreenScore, 'display', 'block');
q.setImportantStyle(fullscreenScoreRow, 'background-color', 'rgb(1, 2, 3)');
const fullscreenIdMap = {
  appContainer: fullscreenApp,
  relativeContainer: fullscreenRelative,
  backgroundImage: fullscreenBackground,
};
const originalGetElementById = context.document.getElementById;
const cleanupOriginalQuerySelectorAll = context.document.querySelectorAll;
context.document.getElementById = id => fullscreenIdMap[id] || originalGetElementById.call(context.document, id);
context.document.querySelectorAll = selector => {
  if (selector.includes('#pixiContainer') && selector.includes('#editorContainer') && !selector.includes('canvas')) {
    return [fullscreenLayer];
  }

  if (selector.includes('#pixiContainer canvas')) {
    return [fullscreenCanvas];
  }

  if (selector === '.inGameCSS') {
    return [fullscreenOverlay];
  }

  if (selector === '.scores') {
    return [fullscreenScore];
  }

  if (selector === '.scores .entryContainer') {
    return [fullscreenScoreRow];
  }

  return cleanupOriginalQuerySelectorAll.call(context.document, selector);
};
q.clearFullscreenLayoutStyles();
check('disabling fullscreen clears root overflow', context.document.documentElement.style.overflow === undefined);
check('disabling fullscreen clears app positioning', fullscreenApp.style.position === undefined);
check('disabling fullscreen restores app width', fullscreenApp.style.width === '862px');
check('disabling fullscreen restores relative width', fullscreenRelative.style.width === '862px');
check('disabling fullscreen restores render canvas sizing', fullscreenCanvas.style.width === '862px');
check('disabling fullscreen clears HUD zoom', fullscreenOverlay.style.zoom === undefined);
check('disabling fullscreen clears score display override', fullscreenScore.style.display === undefined);
check('disabling fullscreen clears score row color override', fullscreenScoreRow.style['background-color'] === undefined);
context.document.getElementById = originalGetElementById;
context.document.querySelectorAll = cleanupOriginalQuerySelectorAll;

const fallbackApp = new context.Element();
const fallbackRelative = new context.Element();
const fallbackLayer = new context.Element();
const fallbackCanvas = new context.Element('CANVAS');
fallbackLayer.rect = { height: 700, left: 0, top: 0, width: 1120 };
fallbackCanvas.width = 1724;
fallbackCanvas.height = 1076;
fallbackLayer.querySelector = selector => (selector === 'canvas' ? fallbackCanvas : null);
const fallbackIdMap = {
  appContainer: fallbackApp,
  relativeContainer: fallbackRelative,
};
context.devicePixelRatio = 2;
context.document.getElementById = id => fallbackIdMap[id] || originalGetElementById.call(context.document, id);
context.document.querySelectorAll = selector => {
  if (
    selector === '#pixiContainer, #singlePlayer, .singlePlayer, #editorContainer, .replayViewer' ||
    selector === '.replayViewer'
  ) {
    return [fallbackLayer];
  }

  return cleanupOriginalQuerySelectorAll.call(context.document, selector);
};
q.restoreNativeLayoutSizeFallback();
check('fullscreen fallback converts high-DPI canvas backing to CSS app width', fallbackApp.style.width === '862px');
check('fullscreen fallback converts high-DPI canvas backing to CSS app height', fallbackApp.style.height === '538px');
check('fullscreen fallback converts high-DPI canvas backing to CSS canvas width', fallbackCanvas.style.width === '862px');
check('fullscreen fallback converts high-DPI canvas backing to CSS canvas height', fallbackCanvas.style.height === '538px');
context.devicePixelRatio = 1;
context.document.getElementById = originalGetElementById;
context.document.querySelectorAll = cleanupOriginalQuerySelectorAll;

const tallGameplayFrame = q.getFullscreenDimensions({ width: 600, height: 1200 }, 'gameplay');
check('gameplay frame stays vertically centered in tall windows', tallGameplayFrame.top === 412, JSON.stringify(tallGameplayFrame));

const scorePanelForColorSync = new context.Element();
const blueScoreRow = new context.Element();
const blueScoreName = new context.Element();
blueScoreName.textContent = 'Blue Player';
blueScoreRow.textContent = '3 Blue Player';
blueScoreRow.querySelector = selector => (selector === '.name' ? blueScoreName : null);
scorePanelForColorSync.querySelectorAll = selector => (selector === '.entryContainer' ? [blueScoreRow] : []);
context.window.multiplayerSession = {
  KR: {
    uL: {
      Ho: [{ N: 3, name: 'Blue Player' }],
    },
  },
};
const originalGetComputedStyle = context.getComputedStyle;
context.getComputedStyle = element => ({
  backgroundColor: element === blueScoreRow ? 'rgba(225, 21, 0, 0.2)' : '',
  display: 'block',
  transform: 'none',
  visibility: 'visible',
});
check('score row color sync repairs fallback red pills from player state', q.syncScoreRowsFromPlayers(scorePanelForColorSync));
check('score row color sync applies the player team color immediately', blueScoreRow.style['background-color'] === 'rgb(0, 117, 225)');
const fallbackOnlyScorePanel = new context.Element();
const fallbackOnlyScoreRow = new context.Element();
fallbackOnlyScorePanel.querySelectorAll = selector => (selector === '.entryContainer' ? [fallbackOnlyScoreRow] : []);
context.getComputedStyle = element => ({
  backgroundColor: element === fallbackOnlyScoreRow ? 'rgba(225, 21, 0, 0.2)' : '',
  display: 'block',
  transform: 'none',
  visibility: 'visible',
});
q.makeScoreRowsOpaque(fallbackOnlyScorePanel);
check('score row opacity pass does not lock in the vanilla fallback red', fallbackOnlyScoreRow.style['background-color'] === undefined);
const contrastScorePanel = new context.Element();
const contrastRows = [
  { background: 'rgb(245, 240, 120)', expected: 'rgb(0, 0, 0)', label: 'light pill background' },
  { background: 'rgb(20, 40, 80)', expected: 'rgb(255, 255, 255)', label: 'dark pill background' },
  { background: 'rgb(225, 21, 0)', expected: 'rgb(255, 255, 255)', label: 'saturated pill background' },
  { background: 'rgb(120, 120, 120)', expected: 'rgb(0, 0, 0)', label: 'mid-tone pill background' },
].map(({ background, expected, label }) => {
  const row = new context.Element();
  row.textContent = label;
  row.parentElement = contrastScorePanel;
  return { row, background, expected, label };
});
contrastScorePanel.querySelectorAll = selector => (selector === '.entryContainer' ? contrastRows.map(entry => entry.row) : []);
context.getComputedStyle = element => {
  const match = contrastRows.find(entry => entry.row === element);
  return {
    backgroundColor: match ? match.background : '',
    color: 'rgb(120, 120, 120)',
    display: 'block',
    transform: 'none',
    visibility: 'visible',
  };
};
q.makeScoreRowsOpaque(contrastScorePanel);
for (const { row, expected, label } of contrastRows) {
  check(`score row text uses better WCAG contrast for ${label}`, row.style.color === expected, row.style.color);
}
context.getComputedStyle = originalGetComputedStyle;
context.window.multiplayerSession = null;

const typingPanel = new context.Element();
const typingRow = new context.Element();
const typingName = new context.Element();
typingName.textContent = 'Typing Player';
typingName.querySelector = selector =>
  selector === '.qolboxTypingIndicator'
    ? typingName.children.find(child => child.className === 'qolboxTypingIndicator') || null
    : null;
typingRow.textContent = 'Typing Player';
typingRow.querySelector = selector => (selector === '.name' ? typingName : null);
typingPanel.querySelectorAll = selector => (selector === '.entryContainer' ? [typingRow] : []);
const originalTypingDateNow = context.Date.now;
let typingNow = 1000;
context.Date.now = () => typingNow;
const typingSession = {
  JD: {
    Pi: { 1: { N: 2, name: 'Local Player' }, 2: { N: 3, name: 'Typing Player' } },
    vL: 1,
  },
  TJ: {
    $W(playerId) {
      this.nativeTypingPlayer = playerId;
    },
  },
};
context.window.multiplayerSession = typingSession;
q.patchTypingIndicatorHooks();
typingSession.TJ.$W(2);
check('typing indicator hook preserves the native typing pulse handler', typingSession.TJ.nativeTypingPlayer === 2);
q.syncTypingIndicators(typingPanel);
check('remote gameplay typing indicator appears beside the matching score name', typingName.children[0]?.className === 'qolboxTypingIndicator');
typingNow += 2000;
q.syncTypingIndicators(typingPanel);
check('remote gameplay typing indicator clears after the real typing pulse expires', typingName.children.length === 0);
typingNow = 3000;
q.notePlayerTyping(2);
const compactTypingRow = new context.Element();
compactTypingRow.textContent = '5Typing Player';
compactTypingRow.querySelector = selector =>
  selector === '.qolboxTypingIndicator'
    ? compactTypingRow.children.find(child => child.className === 'qolboxTypingIndicator') || null
    : null;
const compactTypingPanel = new context.Element();
compactTypingPanel.querySelectorAll = selector => (selector === '.entryContainer' ? [compactTypingRow] : []);
q.syncTypingIndicators(compactTypingPanel);
check(
  'remote gameplay typing indicator matches compact lives score rows that include the lives count',
  compactTypingRow.children[0]?.className === 'qolboxTypingIndicator'
);
typingNow = 5000;
const localTypingPanel = new context.Element();
const localTypingRow = new context.Element();
const localTypingName = new context.Element();
localTypingName.textContent = 'Local Player';
localTypingName.querySelector = selector =>
  selector === '.qolboxTypingIndicator'
    ? localTypingName.children.find(child => child.className === 'qolboxTypingIndicator') || null
    : null;
localTypingRow.textContent = 'Local Player';
localTypingRow.querySelector = selector => (selector === '.name' ? localTypingName : null);
localTypingPanel.querySelectorAll = selector => (selector === '.entryContainer' ? [localTypingRow] : []);
typingSession.TJ.$W(1);
q.syncTypingIndicators(localTypingPanel);
check('typing indicators are hidden for the local player', localTypingName.children.length === 0);
const originalWorldTypingQuerySelector = context.document.querySelector;
const originalWorldTypingQuerySelectorAll = context.document.querySelectorAll;
const worldTypingLayer = new context.Element();
const worldTypingCanvas = new context.Element('CANVAS');
worldTypingLayer.id = 'pixiContainer';
worldTypingLayer.rect = { height: 600, left: 100, top: 50, width: 900 };
worldTypingCanvas.parentElement = worldTypingLayer;
worldTypingCanvas.rect = { height: 600, left: 100, top: 50, width: 900 };
worldTypingLayer.querySelector = selector => (selector === 'canvas' ? worldTypingCanvas : null);
context.document.querySelector = selector => {
  if (selector === '.qolboxWorldTypingLayer') {
    return context.document.body.children.find(child => child.className === 'qolboxWorldTypingLayer') || null;
  }

  if (selector === '.inGameChat .input:focus, .lobbyContainer .chatBox .input:focus') {
    return null;
  }

  return originalWorldTypingQuerySelector.call(context.document, selector);
};
context.document.querySelectorAll = selector => {
  if (selector === '#pixiContainer, #singlePlayer, .singlePlayer') {
    return [worldTypingLayer];
  }

  if (selector === '.scores') {
    return [];
  }

  return originalWorldTypingQuerySelectorAll.call(context.document, selector);
};
typingSession.KR = {
  SL: true,
  ed: { fc: 30, gc: 20, yc: 0, vc: 0 },
  uL: { Ho: [{ id: 2, x: 15, y: 10 }] },
};
typingNow = 7000;
q.notePlayerTyping(2);
const worldTypingPosition = q.getWorldTypingPosition(2);
const worldTypingDomLayer = context.document.body.children.find(child => child.className === 'qolboxWorldTypingLayer');
check(
  'gameplay typing indicator can position from the live player world state',
  Math.round(worldTypingPosition.left) === 550 && Math.round(worldTypingPosition.top) === 308,
  JSON.stringify(worldTypingPosition)
);
check(
  'gameplay typing indicator is also rendered above the player in the playfield',
    worldTypingDomLayer?.children[0]?.className === 'qolboxWorldTypingIndicator' &&
    worldTypingDomLayer.children[0].style.left === '550px' &&
    worldTypingDomLayer.children[0].style.top === '308px'
);
const movingWorldIndicator = worldTypingDomLayer.children[0];
worldTypingDomLayer.querySelectorAll = selector =>
  selector === '.qolboxWorldTypingIndicator'
    ? worldTypingDomLayer.children.filter(child => child.className === 'qolboxWorldTypingIndicator')
    : [];
typingSession.KR.uL.Ho[0].x = 20;
typingSession.KR.uL.Ho[0].y = 12;
q.syncTypingIndicators();
check(
  'gameplay typing indicator follows the live position of a moving remote player',
  worldTypingDomLayer.children[0] === movingWorldIndicator &&
    movingWorldIndicator.style.left === '700px' &&
    movingWorldIndicator.style.top === '368px',
  JSON.stringify({ left: movingWorldIndicator.style.left, top: movingWorldIndicator.style.top })
);
typingSession.KR.SL = false;
q.syncTypingIndicators();
context.document.querySelector = originalWorldTypingQuerySelector;
context.document.querySelectorAll = originalWorldTypingQuerySelectorAll;
context.Date.now = originalTypingDateNow;
context.window.multiplayerSession = null;

const fullscreenSpectateControls = new context.Element();
const fullscreenJukebox = new context.Element();
const originalHudQuerySelectorAll = context.document.querySelectorAll;
const originalHudQuerySelector = context.document.querySelector;
context.document.querySelectorAll = selector => {
  if (selector === '.scores') {
    return [];
  }

  if (selector === '.spectateControls') {
    return [fullscreenSpectateControls];
  }

  return originalHudQuerySelectorAll.call(context.document, selector);
};
context.document.querySelector = selector => {
  if (selector === '.jukebox') {
    return fullscreenJukebox;
  }

  return originalHudQuerySelector.call(context.document, selector);
};
q.layoutRelativeHud({ left: 0, top: 0, width: 800, height: 500 }, { mode: 'gameplay' });
check('fullscreen spectator controls are moved inside the visible gameplay HUD', fullscreenSpectateControls.style.bottom === '12px');
check('fullscreen spectator controls stay horizontally centered', fullscreenSpectateControls.style.transform === 'translateX(-50%)');
fullscreenJukebox.rect = { height: 35, left: 200, top: 465, width: 400 };
fullscreenJukebox.style.bottom = '-25px';
q.layoutRelativeHud({ left: 0, top: 0, width: 800, height: 500 }, { mode: 'gameplay' });
check('spectator controls follow a partly animated jukebox position without a second delayed transition', fullscreenSpectateControls.style.bottom === '42px');
fullscreenJukebox.style.bottom = '0px';
q.layoutRelativeHud({ left: 0, top: 0, width: 800, height: 500 }, { mode: 'gameplay' });
check('spectator controls move above the open jukebox so both remain usable', fullscreenSpectateControls.style.bottom === '71px');
fullscreenSpectateControls.rect = { height: 30, left: 350, top: 450, width: 120 };
context.window.multiplayerSession = {
  JD: {
    Pi: { 1: { N: 0, name: 'Spectator' } },
    vL: 1,
  },
  KR: { SL: true },
};
q.layoutRelativeHud({ left: 0, top: 0, width: 800, height: 500 }, { mode: 'menu' });
check(
  'active spectator runtime still gets gameplay HUD positioning when rendered through the replay layer',
  fullscreenSpectateControls.style.bottom === '71px'
);
context.window.multiplayerSession = null;
q.layoutRelativeHud({ left: 0, top: 0, width: 800, height: 500 }, { mode: 'menu' });
check('non-gameplay layout clears spectator fullscreen positioning', fullscreenSpectateControls.style.bottom === undefined);
context.document.querySelector = originalHudQuerySelector;
context.document.querySelectorAll = originalHudQuerySelectorAll;

const gameplayLayer = new context.Element();
gameplayLayer.id = 'pixiContainer';
gameplayLayer.rect = { height: 500, left: 0, top: 0, width: 800 };
const spectateControls = new context.Element();
spectateControls.rect = { height: 30, left: 0, top: 0, width: 100 };
const visibleLobby = new context.Element();
visibleLobby.rect = { height: 300, left: 0, top: 0, width: 400 };
let spectatingForGameStartTest = false;
let gameplayForGameStartTest = true;
let lobbyForGameStartTest = false;
const originalDocumentQuerySelectorAll = context.document.querySelectorAll;
context.document.querySelectorAll = selector => {
  if (selector === '#pixiContainer, #singlePlayer, .singlePlayer') {
    return gameplayForGameStartTest ? [gameplayLayer] : [];
  }

  if (selector === '.spectateControls') {
    return spectatingForGameStartTest ? [spectateControls] : [];
  }

  if (selector === '.lobbyContainer') {
    return lobbyForGameStartTest ? [visibleLobby] : [];
  }

  return originalDocumentQuerySelectorAll.call(context.document, selector);
};
check('game-start detector treats visible gameplay as playing', q.isPlayingMatch());
spectatingForGameStartTest = true;
check('game-start detector excludes spectating', !q.isPlayingMatch());
spectatingForGameStartTest = false;
gameplayForGameStartTest = false;
lobbyForGameStartTest = true;
check('game-start detector arms from an active lobby', q.isPlayableLobby() && !q.isPlayingMatch());
gameplayForGameStartTest = true;
check('game-start detector still arms when the render layer exists under the lobby', q.isPlayableLobby());
lobbyForGameStartTest = false;
context.document.hidden = true;
context.document.title = 'hitbox.io';
gameplayForGameStartTest = true;
lobbyForGameStartTest = true;
q.updateGameStartIndicator();
check('game-start indicator waits while the hidden tab is still in lobby even with a render layer', context.document.title === 'hitbox.io', context.document.title);
lobbyForGameStartTest = false;
gameplayForGameStartTest = true;
q.updateGameStartIndicator();
check('game-start indicator marks lobby-to-match transition as game started', context.document.title === '[GAME STARTED] hitbox.io', context.document.title);
context.document.hidden = false;
q.clearGameStartIndicator();
check('game-start indicator restores the tab title', context.document.title === 'hitbox.io', context.document.title);

context.document.hidden = true;
context.document.title = 'hitbox.io';
q.setGameStartPageFocused(false);
q.setGameStartWasPlayingWhenUnfocused(false);
q.setGameStartWasInLobbyWhenUnfocused(false);
gameplayForGameStartTest = true;
lobbyForGameStartTest = false;
q.updateGameStartIndicator();
check('game-start indicator marks non-lobby away match entry as pulled in', context.document.title === '[PULLED INTO GAME] hitbox.io', context.document.title);
context.document.hidden = false;
q.clearGameStartIndicator();

const sessionPlayer = { N: 1 };
const session = {
  JD: { Pi: { 7: sessionPlayer }, vL: 7 },
  KR: { SL: false },
  TJ: { NS: true },
  KJ() {
    this.TJ.NS = false;
    this.KR.SL = true;
  },
  ZJ() {
    this.TJ.NS = false;
    this.KR.SL = true;
  },
  _J() {},
};
gameplayForGameStartTest = false;
lobbyForGameStartTest = false;
context.window.multiplayerSession = session;
q.updateGameStartIndicator();
check(
  'multiplayer session watch wraps native game-start handlers before the host starts',
  session.KJ.__qolboxWrapped && session.ZJ.__qolboxWrapped && session._J.__qolboxWrapped
);
check('game-start detector uses native lobby state while the player is not spectating', q.isPlayableLobby());
sessionPlayer.N = 0;
check('game-start detector does not arm for spectating lobby players', !q.isPlayableLobby());
sessionPlayer.N = 1;
session.TJ.NS = false;
session.KR.SL = true;
check('game-start detector uses native active-match state', q.isPlayingMatch());
spectatingForGameStartTest = true;
check('native player state overrides the spectate controls layer for active players', q.isPlayingMatch());
spectatingForGameStartTest = false;
delete session.JD.Pi[7];
check('missing native local-player data retains vanilla spectator-safe match behavior', !q.isPlayingMatch());
session.JD.Pi[7] = sessionPlayer;
sessionPlayer.N = 0;
check('game-start detector excludes spectating active-match players', !q.isPlayingMatch());
sessionPlayer.N = 1;
session.TJ.NS = true;
session.KR.SL = false;
const originalTop = context.window.top;
const topDocument = {
  createElement() {
    return new context.Element();
  },
  documentElement: new context.Element(),
  head: new context.Element(),
  querySelector() {
    return null;
  },
  title: 'hitbox.io - Official Site: Play Hitbox here!',
};
context.window.top = { document: topDocument };
context.document.hidden = true;
context.document.title = '???';
q.updateGameStartIndicator();
session.KJ();
check(
  'game-start indicator marks the top-level tab title from the native game-start transition',
  topDocument.title === '[GAME STARTED] hitbox.io - Official Site: Play Hitbox here!',
  topDocument.title
);
context.document.hidden = false;
q.clearGameStartIndicator();
context.window.top = originalTop;

context.document.title = 'hitbox.io';
context.document.hidden = true;
q.setGameStartPageFocused(false);
q.setGameStartWasPlayingWhenUnfocused(false);
q.setGameStartWasInLobbyWhenUnfocused(true);
session.TJ.NS = true;
session.KR.SL = false;
gameplayForGameStartTest = false;
session._J();
session.KJ();
check(
  'a locally requested native START transition does not create an away-tab alert',
  context.document.title === 'hitbox.io',
  context.document.title
);
context.document.hidden = false;
q.clearGameStartIndicator();

const staleActiveSession = {
  JD: { Pi: { 9: { N: 1, name: 'Synced Player' } }, vL: 9 },
  KR: { SL: true },
  TJ: { NS: false },
  KJ() {},
  ZJ() {},
  _J() {},
};
context.window.multiplayerSession = staleActiveSession;
context.document.title = 'hitbox.io';
context.document.hidden = true;
q.setGameStartPageFocused(false);
q.setGameStartWasPlayingWhenUnfocused(false);
q.setGameStartWasInLobbyWhenUnfocused(false);
q.updateGameStartIndicator();
check(
  'first observing an already-active hidden session is baselined instead of alerted as a new game',
  context.document.title === 'hitbox.io',
  context.document.title
);
context.document.hidden = false;
q.clearGameStartIndicator();
context.window.multiplayerSession = session;

context.document.title = 'hitbox.io';
context.document.hidden = true;
q.setGameStartWasPlayingWhenUnfocused(true);
sessionPlayer.N = 1;
session.TJ.NS = false;
session.KR.SL = true;
gameplayForGameStartTest = true;
lobbyForGameStartTest = true;
q.updateGameStartIndicator();
check('game-start detector does not treat the in-game lobby menu as a playable lobby', !q.isPlayableLobby());
check(
  'game-start indicator does not flash when an in-game lobby menu is hidden',
  context.document.title === 'hitbox.io',
  context.document.title
);
lobbyForGameStartTest = false;

context.document.hidden = false;
context.document.title = 'hitbox.io';
q.clearGameStartIndicator();
q.setGameStartPageFocused(false);
session.TJ.NS = true;
session.KR.SL = false;
gameplayForGameStartTest = false;
q.handleGameStartInteractionFocus();
session.KJ();
check(
  'game-start interaction focus prevents a focused start from flashing the tab',
  context.document.title === 'hitbox.io',
  context.document.title
);

context.document.hidden = true;
context.document.title = 'hitbox.io';
q.clearGameStartIndicator();
q.setGameStartPageFocused(false);
q.setGameStartWasPlayingWhenUnfocused(true);
session.TJ.NS = false;
session.KR.SL = true;
gameplayForGameStartTest = true;
q.updateGameStartIndicator();
check(
  'game-start indicator does not flash for a match that was already active before leaving',
  context.document.title === 'hitbox.io',
  context.document.title
);

context.window.multiplayerSession = null;
context.document.querySelectorAll = originalDocumentQuerySelectorAll;

const gameplayFocusLayer = new context.Element();
const gameplayFocusCanvas = new context.Element('CANVAS');
const gameplayFocusVoid = new context.Element();
const gameplayFocusUi = new context.Element();
gameplayFocusLayer.id = 'pixiContainer';
gameplayFocusLayer.rect = { height: 500, left: 100, top: 50, width: 800 };
gameplayFocusCanvas.parentElement = gameplayFocusLayer;
gameplayFocusCanvas.hasAttribute = () => false;
let gameplayCanvasFocused = false;
gameplayFocusCanvas.focus = options => {
  gameplayCanvasFocused = options?.preventScroll === true;
};
gameplayFocusLayer.querySelector = selector => (selector === 'canvas' ? gameplayFocusCanvas : null);
gameplayFocusUi.closest = () => gameplayFocusUi;
let activeGameplayChat = null;
const originalGameplayFocusQuerySelector = context.document.querySelector;
const originalGameplayFocusQuerySelectorAll = context.document.querySelectorAll;
context.document.querySelector = selector => {
  if (selector === '.inGameChat .input:focus, .lobbyContainer .chatBox .input:focus') {
    return activeGameplayChat;
  }

  return originalGameplayFocusQuerySelector.call(context.document, selector);
};
context.document.querySelectorAll = selector => {
  if (selector === '#pixiContainer, #singlePlayer, .singlePlayer') {
    return [gameplayFocusLayer];
  }

  if (selector === '.spectateControls') {
    return [];
  }

  return originalGameplayFocusQuerySelectorAll.call(context.document, selector);
};
context.window.multiplayerSession = {
  JD: {
    Pi: { 1: { N: 1, name: 'Player' } },
    vL: 1,
  },
  KR: { SL: true },
};
const gameplayFocusEvent = { button: 0, defaultPrevented: false, target: gameplayFocusVoid };
check('gameplay background focus captures clicks on the visible void', q.shouldCaptureGameplayBackgroundFocus(gameplayFocusEvent));
q.handleGameplayBackgroundFocus(gameplayFocusEvent);
check('gameplay background focus moves keyboard focus back to the render canvas', gameplayCanvasFocused);
gameplayFocusCanvas.matches = selector => selector.includes('canvas');
check(
  'gameplay background focus does not intercept direct gameplay canvas clicks',
  !q.shouldCaptureGameplayBackgroundFocus({ button: 0, defaultPrevented: false, target: gameplayFocusCanvas })
);
check(
  'gameplay background focus ignores existing UI targets',
  !q.shouldCaptureGameplayBackgroundFocus({ button: 0, defaultPrevented: false, target: gameplayFocusUi })
);
activeGameplayChat = new context.Element();
check(
  'gameplay background focus does not steal focus while chat is active',
  !q.shouldCaptureGameplayBackgroundFocus(gameplayFocusEvent)
);
context.window.multiplayerSession = null;
context.document.querySelector = originalGameplayFocusQuerySelector;
context.document.querySelectorAll = originalGameplayFocusQuerySelectorAll;

const lobbyChatBox = new context.Element();
const lobbyChatInput = new context.Element();
const lobbyInstruction = new context.Element();
lobbyInstruction.style.visibility = 'hidden';
lobbyInstruction.textContent = '';
lobbyChatInput.style.pointerEvents = 'auto';
lobbyChatInput.matches = selector => selector === '.lobbyContainer .chatBox .input';
lobbyChatInput.closest = selector => (selector === '.lobbyContainer .chatBox' ? lobbyChatBox : null);
lobbyChatBox.querySelector = selector => (selector === '.lowerInstruction' ? lobbyInstruction : null);
q.restoreLobbyChatPrompt(lobbyChatInput);
check('Esc lobby chat close restores the vanilla prompt', lobbyInstruction.style.visibility === 'inherit');
check('Esc lobby chat close restores desktop pointer behavior', lobbyChatInput.style.pointerEvents === 'none');
check(
  'Esc lobby chat close restores prompt text if the game leaves it empty',
  lobbyInstruction.textContent === 'Press enter to send a message',
  `got ${JSON.stringify(lobbyInstruction.textContent)}`
);
check('missing game volume uses the 100% default', q.loadGamePercent() === 100, `got ${q.loadGamePercent()}`);
check('null game volume clamps to fallback', q.clampPercent(null, 100) === 100, `got ${q.clampPercent(null, 100)}`);
check('zero string still clamps to 0', q.clampPercent('0', 100) === 0, `got ${q.clampPercent('0', 100)}`);
check('missing jukebox percent uses the 50% default', q.clampJukeboxPercent(null) === 50);
check('missing jukebox state applies 50% effective volume', q.getEffectiveJukeboxPercent() === 50);
check('nonzero low jukebox percent maps to audible volume instead of mute', q.percentToJukeboxVolume(5) === 1);
check('default jukebox angle maps to 50%', q.angleToJukeboxPercent(q.percentToJukeboxAngle(50)) === 50);
check(
  'rotate transform parses to 50%',
  q.angleToJukeboxPercent(q.parseJukeboxAngleFromTransform('rotate(90deg)')) === 50
);
check(
  'matrix transform parses to 50%',
  q.angleToJukeboxPercent(q.parseJukeboxAngleFromTransform('matrix(0, 1, -1, 0, 0, 0)')) === 50
);
check(
  'matrix rounding at 220 degrees stays at 100%',
  q.angleToJukeboxPercent(
    q.parseJukeboxAngleFromTransform(
      'matrix(-0.7660444431, -0.6427876097, 0.6427876097, -0.7660444431, 0, 0)'
    )
  ) === 100
);
check(
  'ArrowUp keyboard adjustment increases by one step',
  q.getKeyboardPercentTarget({ key: 'ArrowUp' }, 40, 5) === 45
);
check('Home keyboard adjustment jumps to 0', q.getKeyboardPercentTarget({ key: 'Home' }, 40, 5) === 0);
check('End keyboard adjustment jumps to 100', q.getKeyboardPercentTarget({ key: 'End' }, 40, 5) === 100);
check('modified keyboard shortcuts are ignored', q.getKeyboardPercentTarget({ ctrlKey: true, key: 'ArrowUp' }, 40, 5) === null);

q.setJukeboxState({ muted: false, percent: 40 });
let createdPlayer = null;
const visibleJukebox = new context.Element();
visibleJukebox.rect = { height: 100, left: 0, top: 0, width: 100 };
const originalQuerySelector = context.document.querySelector;
context.document.querySelector = selector => {
  if (selector === '.jukebox') {
    return visibleJukebox;
  }

  return originalQuerySelector.call(context.document, selector);
};

function OriginalPlayer(id, options) {
  this.id = id;
  this.options = options;
  this.volumeCalls = [];
  this.playbackRate = 2;
  this.volume = 100;
  this.muted = true;
  this.getPlaybackRate = () => this.playbackRate;
  this.setPlaybackRate = value => {
    this.playbackRate = value;
    this.volumeCalls.push(`rate:${value}`);
  };
  this.getVolume = () => this.volume;
  this.setVolume = value => {
    this.volume = value;
    this.volumeCalls.push(value);
  };
  this.isMuted = () => this.muted;
  this.unMute = () => {
    this.muted = false;
    this.volumeCalls.push('unMute');
  };
  this.mute = () => {
    this.muted = true;
    this.volumeCalls.push('mute');
  };
}

context.window.YT = { Player: OriginalPlayer };
context.window.onYouTubeIframeAPIReady = () => {
  createdPlayer = new context.window.YT.Player('ytGetsReplaced', {
    events: {
      onReady(event) {
        event.target.setVolume(99);
      },
    },
  });
  createdPlayer.options.events.onReady({ target: createdPlayer });
};
context.window.onYouTubeIframeAPIReady();

check('YouTube player constructor is wrapped before API callback creates the player', context.window.YT.Player.__qolboxWrapped);
check(
  'persisted jukebox volume is reapplied after native YouTube onReady',
  createdPlayer.volumeCalls.at(-1) === 16 &&
    createdPlayer.volumeCalls.filter(call => call === 'unMute').length === 1 &&
    createdPlayer.volumeCalls.includes('rate:1') &&
    createdPlayer.volume === 16 &&
    createdPlayer.muted === false,
  `calls ${JSON.stringify(createdPlayer.volumeCalls)}`
);
q.setJukeboxState({ muted: true, percent: 40 });
createdPlayer = new context.window.YT.Player('ytGetsReplacedMuted', {
  events: {
    onReady(event) {
      event.target.setVolume(99);
    },
  },
});
createdPlayer.options.events.onReady({ target: createdPlayer });
check(
  'muted jukebox state applies zero volume and mute without unmuting',
  createdPlayer.volumeCalls.at(-1) === 0 &&
    !createdPlayer.volumeCalls.includes('unMute') &&
    createdPlayer.volumeCalls.includes('rate:1') &&
    createdPlayer.volume === 0 &&
    createdPlayer.muted === true,
  `calls ${JSON.stringify(createdPlayer.volumeCalls)}`
);

if (failures.length) {
  console.error(JSON.stringify(failures, null, 2));
  process.exitCode = 1;
} else {
  console.log('All QOLbox regression checks passed.');
}
