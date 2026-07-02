// ==UserScript==
// @name         QOLBox
// @namespace    Violentmonkey Scripts
// @author       gpt-5.4 and gpt-5.5
// @version      2.1.4
// @description  Fullscreen hitbox.io, reserve spots, away-tab alerts, audio controls, mobile Grab, readable chat, lobby commands, map import/export, and first-start setup for hitbox.io.
// @license      ISC
// @match        https://hitbox.io/
// @match        https://www.hitbox.io/
// @match        https://hitbox.io/game2.html*
// @match        https://www.hitbox.io/game2.html*
// @run-at       document-start
// @inject-into  content
// @grant        GM_xmlhttpRequest
// @grant        GM.xmlHttpRequest
// @connect      api.github.com
// @connect      greasyfork.org
// @downloadURL https://update.greasyfork.org/scripts/568667/QOLbox.user.js
// @updateURL https://update.greasyfork.org/scripts/568667/QOLbox.meta.js
// ==/UserScript==
(() => {
  'use strict';

  const QOLBOX_BRIDGE_READY_SCRIPT = 'window.__qolboxReleaseHistoryBridgeReady = true;';
  const REQUEST_SOURCE = 'qolbox-release-history';
  const RESPONSE_SOURCE = 'qolbox-release-history-bridge';
  const REQUEST_TYPE = 'fetch';
  const RESPONSE_TYPE = 'fetch-result';
  const REQUEST_TIMEOUT_MS = 7000;
  const ALLOWED_HOSTS = new Set(['api.github.com', 'greasyfork.org']);

  function injectPageScript(source, sourceName) {
    const script = document.createElement('script');
    script.textContent = source + '\n//# sourceURL=' + sourceName;
    const host = document.documentElement || document.head || document.body;
    if (!host) {
      window.setTimeout(() => injectPageScript(source, sourceName), 0);
      return;
    }
    host.appendChild(script);
    script.remove();
  }

  function injectPageFunction(fn, sourceName) {
    injectPageScript('(' + fn.toString() + ')();', sourceName);
  }

  function getUserscriptRequest() {
    if (typeof GM_xmlhttpRequest === 'function') {
      return GM_xmlhttpRequest;
    }
    if (typeof GM === 'object' && GM && typeof GM.xmlHttpRequest === 'function') {
      return GM.xmlHttpRequest.bind(GM);
    }
    return null;
  }

  function isAllowedUrl(url) {
    try {
      const parsed = new URL(String(url));
      return parsed.protocol === 'https:' && ALLOWED_HOSTS.has(parsed.hostname);
    } catch {
      return false;
    }
  }

  function sanitizeHeaders(headers) {
    const sanitized = {};
    if (!headers || typeof headers !== 'object') {
      return sanitized;
    }
    for (const [name, value] of Object.entries(headers)) {
      if (typeof value === 'string' && /^accept$/i.test(name)) {
        sanitized[name] = value;
      }
    }
    return sanitized;
  }

  function postBridgeResponse(id, payload) {
    window.postMessage({
      source: RESPONSE_SOURCE,
      type: RESPONSE_TYPE,
      id,
      ...payload,
    }, window.location.origin);
  }

  function installReleaseHistoryBridge() {
    const request = getUserscriptRequest();
    if (!request) {
      return;
    }

    injectPageScript(QOLBOX_BRIDGE_READY_SCRIPT, 'QOLBox.bridge-ready.js');

    window.addEventListener('message', event => {
      if (event.source !== window || event.origin !== window.location.origin) {
        return;
      }

      const data = event.data;
      if (!data || typeof data !== 'object' || data.source !== REQUEST_SOURCE || data.type !== REQUEST_TYPE) {
        return;
      }

      const id = typeof data.id === 'string' ? data.id : '';
      const url = typeof data.url === 'string' ? data.url : '';
      if (!id || !isAllowedUrl(url)) {
        postBridgeResponse(id, { ok: false, error: 'Release-history request was not allowed.' });
        return;
      }

      let settled = false;
      const details = {
        method: 'GET',
        url,
        headers: sanitizeHeaders(data.headers),
        timeout: REQUEST_TIMEOUT_MS,
        onload(response) {
          if (settled) {
            return;
          }
          settled = true;
          const status = typeof response?.status === 'number' ? response.status : 0;
          if (status < 200 || status >= 300) {
            postBridgeResponse(id, {
              ok: false,
              status,
              error: 'HTTP ' + String(status || 0),
            });
            return;
          }
          postBridgeResponse(id, {
            ok: true,
            status,
            text: typeof response?.responseText === 'string' ? response.responseText : '',
          });
        },
        onerror(error) {
          if (settled) {
            return;
          }
          settled = true;
          postBridgeResponse(id, {
            ok: false,
            error: error instanceof Error ? error.message : 'GM_xmlhttpRequest failed.',
          });
        },
        ontimeout() {
          if (settled) {
            return;
          }
          settled = true;
          postBridgeResponse(id, {
            ok: false,
            error: 'GM_xmlhttpRequest timed out.',
          });
        },
      };

      try {
        const maybePromise = request(details);
        if (maybePromise && typeof maybePromise.then === 'function') {
          maybePromise.then(details.onload, details.onerror);
        }
      } catch (error) {
        details.onerror(error);
      }
    }, false);
  }

  function runQolboxPageApp() {
    "use strict";
    (() => {
      // src/config/qolbox-constants.ts
      var DESKTOP_LOBBY_CHAT_PROMPT = "Press Enter to send a message";
      var TOUCH_LOBBY_CHAT_PROMPT = "Tap here to send a message";
      var MENU_KEY_LABEL = "F8";
      var MENU_KEY = "F8";
      var QOLBOX_MENU_ID = "qolboxMenu";
      var QOLBOX_MENU_ROOT_CLASS = "qolbox-menu-open";
      var FALLBACK_BASE_WIDTH = 800;
      var FALLBACK_BASE_HEIGHT = 500;
      var SCORE_ROW_FALLBACK_RGB = { red: 225, green: 21, blue: 0, alpha: 1 };
      var TEAM_SCORE_COLORS = /* @__PURE__ */ new Map([
        [2, { red: 225, green: 21, blue: 0, alpha: 1 }],
        [3, { red: 0, green: 117, blue: 225, alpha: 1 }]
      ]);
      var FULLSCREEN_GAMEPLAY_LAYER_SELECTOR = "#pixiContainer, #singlePlayer, .singlePlayer";
      var FULLSCREEN_EDITOR_LAYER_SELECTOR = "#editorContainer";
      var FULLSCREEN_MENU_LAYER_SELECTOR = ".replayViewer";
      var CHAT_INPUT_SELECTOR = ".inGameChat .input, .lobbyContainer .chatBox .input";
      var FULLSCREEN_PLAY_LAYER_SELECTOR = [
        FULLSCREEN_GAMEPLAY_LAYER_SELECTOR,
        FULLSCREEN_EDITOR_LAYER_SELECTOR
      ].join(", ");
      var FULLSCREEN_RENDER_LAYER_SELECTOR = [
        FULLSCREEN_PLAY_LAYER_SELECTOR,
        FULLSCREEN_MENU_LAYER_SELECTOR
      ].join(", ");
      var FULLSCREEN_RENDER_CANVAS_SELECTORS = [
        "#pixiContainer canvas",
        "#singlePlayer canvas",
        ".singlePlayer canvas",
        "#editorContainer > canvas",
        ".replayViewer canvas"
      ];
      var FULLSCREEN_RENDER_CANVAS_SELECTOR = FULLSCREEN_RENDER_CANVAS_SELECTORS.join(", ");
      var FULLSCREEN_RENDER_CANVAS_FOCUS_SELECTOR = FULLSCREEN_RENDER_CANVAS_SELECTORS.flatMap((selector) => [`${selector}:focus`, `${selector}:focus-visible`]).join(", ");
      var FULLSCREEN_LAYOUT_TARGET_SELECTOR = [
        "#appContainer",
        "#relativeContainer",
        "#backgroundImage",
        FULLSCREEN_RENDER_LAYER_SELECTOR,
        FULLSCREEN_RENDER_CANVAS_SELECTOR,
        ".inGameCSS",
        ".scores",
        ".spectateControls"
      ].join(", ");
      var GAMEPLAY_FOCUS_EXCLUSION_SELECTOR = [
        CHAT_INPUT_SELECTOR,
        ".inGameChat",
        ".lobbyContainer",
        ".cornerButton",
        ".cornerButton .items",
        ".jukebox",
        ".scores",
        ".spectateControls",
        ".qolboxMenuOverlay",
        ".qolboxReserveWindowContainer",
        ".connectingWindowContainer",
        ".passwordWindowContainer",
        ".buttonArea",
        "button",
        "input",
        "select",
        "textarea",
        "a",
        ".button",
        ".bottomButton",
        ".item"
      ].join(", ");
      var FEATURE_PATCH_TARGET_SELECTOR = [
        CHAT_INPUT_SELECTOR,
        ".items.left",
        ".items.left .item",
        ".jukebox",
        ".jukebox .knob.volumeContainer",
        ".buttonArea",
        ".cornerButton .items",
        ".cornerButton .items .item",
        "#ytContainer",
        "#ytContainer iframe",
        ".roomListContainer",
        ".roomListContainer .scrollBox tr",
        ".roomListContainer .bottomButton.right",
        ".passwordWindowContainer",
        ".connectingWindowContainer",
        ".lobbyContainer",
        ".lobbyContainer .teamsButtonContainer",
        ".scores",
        ".scores .entryContainer",
        "#editorContainer",
        ".fileMenu",
        ".fileMenu .item"
      ].join(", ");
      var FULLSCREEN_SETTLE_PASSES = 4;
      var FULLSCREEN_NATIVE_LAYOUT_WAIT_MS = 2500;
      var RESIZE_SETTLE_PASSES = 2;
      var JUKEBOX_WHEEL_STEP = 5;
      var JUKEBOX_DRAG_SENSITIVITY = 1;
      var YOUTUBE_HOOK_RETRY_DELAY_MS = 250;
      var YOUTUBE_HOOK_MAX_RETRIES = 120;
      var RESERVE_BUTTON_TEXT = "RESERVE";
      var JOIN_BUTTON_TEXT = "JOIN";
      var RESERVE_WAIT_TITLE_TEXT = "Waiting for a Spot";
      var RESERVE_WAIT_TEXT = "Waiting for someone to leave...";
      var RESERVE_STATUS_FALLBACK_TEXT = "Connecting...";
      var RESERVE_UNAVAILABLE_TITLE_TEXT = "Lobby Not Available";
      var RESERVE_ONE_PERSON_TEXT = "This lobby only allows one person, so there is no spot to reserve.";
      var RESERVE_RETRY_DELAY_MS = 2500;
      var RESERVE_COUNTDOWN_UPDATE_MS = 100;
      var RESERVE_RETRY_AUDIO_SUPPRESS_MS = 900;
      var RESERVE_JOINED_ROOM_FULL_SUPPRESS_MS = 12e3;
      var RESERVE_ROOM_FULL_PATTERN = /room[_ ]?full|room is full/i;
      var RESERVE_ROOM_CLOSED_PATTERN = /room[_ ]?not[_ ]?found|room has just closed/i;
      var RESERVE_WRONG_PASSWORD_PATTERN = /wrong[_ ]?password|password incorrect|incorrect password/i;
      var GAME_START_INDICATOR_DELAY_MS = 1200;
      var GAME_START_WATCH_INTERVAL_MS = 750;
      var GAME_START_FLASH_INTERVAL_MS = 700;
      var GAME_START_END_WATCH_INTERVAL_MS = 1e3;
      var GAME_START_LOCAL_TRANSITION_TIMEOUT_MS = 5e3;
      var GAME_START_SESSION_ENTRY_GRACE_MS = 2e3;
      var TYPING_INDICATOR_TIMEOUT_MS = 1600;
      var IS_QOLBOX_GAME_PAGE = /\/game2\.html$/i.test(window.location.pathname);

      // src/utils/object-properties.ts
      function isReflectableObject(value) {
        return typeof value === "object" && value !== null || typeof value === "function";
      }
      function readObjectProperty(source, property) {
        return isReflectableObject(source) ? Reflect.get(source, property) : void 0;
      }
      function setObjectProperty(source, property, value) {
        if (!isReflectableObject(source)) {
          return false;
        }
        try {
          return Reflect.set(source, property, value);
        } catch {
          return false;
        }
      }

      // src/features/game-start-shared.ts
      var GAME_START_TITLE_PREFIX = "[GAME STARTED] ";
      var GAME_PULLED_TITLE_PREFIX = "[PULLED INTO GAME] ";
      var GAME_START_TITLE_PREFIXES = [GAME_START_TITLE_PREFIX, GAME_PULLED_TITLE_PREFIX];
      var GAME_START_FAVICON_HREF = "data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22%3E%3Crect width=%2264%22 height=%2264%22 rx=%2212%22 fill=%22%23f5c542%22/%3E%3Cpath d=%22M32 10 56 54H8Z%22 fill=%22%23111111%22/%3E%3Crect x=%2229%22 y=%2223%22 width=%226%22 height=%2217%22 rx=%223%22 fill=%22%23f5c542%22/%3E%3Ccircle cx=%2232%22 cy=%2247%22 r=%223%22 fill=%22%23f5c542%22/%3E%3C/svg%3E";
      function stripGameStartTitlePrefix(title) {
        const value = String(title);
        for (const prefix of GAME_START_TITLE_PREFIXES) {
          if (value.startsWith(prefix)) {
            return value.slice(prefix.length);
          }
        }
        return value;
      }

      // src/features/top-level-page.ts
      var TOP_LEVEL_INPUT_STYLE_ID = "qolbox-top-level-input-style";
      var HITBOX_ORIGIN_PATTERN = /^https:\/\/(www\.)?hitbox\.io$/i;
      function installTopLevelGameInputPassthrough() {
        const applyPassthroughStyle = () => {
          if (document.getElementById(TOP_LEVEL_INPUT_STYLE_ID)) {
            return true;
          }
          const root = document.head || document.documentElement;
          if (!root) {
            return false;
          }
          const style = document.createElement("style");
          style.id = TOP_LEVEL_INPUT_STYLE_ID;
          style.textContent = `
            #adboxverticalleft,
            #adboxverticalright {
              display: none !important;
              visibility: hidden !important;
              pointer-events: none !important;
            }
          `;
          root.appendChild(style);
          return true;
        };
        if (!applyPassthroughStyle()) {
          document.addEventListener("DOMContentLoaded", applyPassthroughStyle, { once: true });
        }
      }
      function installTopLevelGameStartRelay() {
        if (window.top !== window || window.__qolboxGameStartRelayInstalled) {
          return;
        }
        window.__qolboxGameStartRelayInstalled = true;
        let relayActive = false;
        let relayOriginalTitle = "";
        let relayOriginalFavicon = null;
        let relayFaviconLink = null;
        function saveRelayState() {
          if (relayActive) {
            return;
          }
          const link = document.querySelector('link[rel~="icon"]');
          relayOriginalTitle = stripGameStartTitlePrefix(document.title || "");
          relayOriginalFavicon = link ? {
            href: link.getAttribute("href"),
            link,
            type: link.getAttribute("type")
          } : { href: null, link: null, type: null };
          relayFaviconLink = link || document.createElement("link");
          if (!link) {
            relayFaviconLink.rel = "icon";
            (document.head || document.documentElement).appendChild(relayFaviconLink);
          }
          relayActive = true;
        }
        function setRelayFavicon(active) {
          saveRelayState();
          if (!relayFaviconLink) {
            return;
          }
          if (active) {
            relayFaviconLink.setAttribute("href", GAME_START_FAVICON_HREF);
            relayFaviconLink.setAttribute("type", "image/svg+xml");
            return;
          }
          if (relayOriginalFavicon && relayOriginalFavicon.href) {
            relayFaviconLink.setAttribute("href", relayOriginalFavicon.href);
          } else {
            relayFaviconLink.removeAttribute("href");
          }
          if (relayOriginalFavicon && relayOriginalFavicon.type) {
            relayFaviconLink.setAttribute("type", relayOriginalFavicon.type);
          } else {
            relayFaviconLink.removeAttribute("type");
          }
        }
        function clearRelayState() {
          if (!relayActive) {
            return;
          }
          document.title = relayOriginalTitle;
          if (relayOriginalFavicon && relayFaviconLink) {
            if (!relayOriginalFavicon.link) {
              relayFaviconLink.remove();
            } else {
              setRelayFavicon(false);
            }
          }
          relayActive = false;
          relayOriginalTitle = "";
          relayOriginalFavicon = null;
          relayFaviconLink = null;
        }
        window.addEventListener(
          "message",
          (event) => {
            if (!HITBOX_ORIGIN_PATTERN.test(event.origin)) {
              return;
            }
            const data = event.data;
            if (readObjectProperty(data, "source") !== "QOLBox" || readObjectProperty(data, "feature") !== "gameStartIndicator") {
              return;
            }
            const action = readObjectProperty(data, "action");
            if (action === "title") {
              saveRelayState();
              document.title = String(readObjectProperty(data, "title") || relayOriginalTitle);
            } else if (action === "favicon") {
              setRelayFavicon(Boolean(readObjectProperty(data, "active")));
            } else if (action === "clear") {
              clearRelayState();
            }
          },
          true
        );
      }

      // src/boot/page-entry.ts
      function shouldRunGamePageBootstrap() {
        if (IS_QOLBOX_GAME_PAGE) {
          if (window.__qolboxGamePageBootstrapInstalled) {
            return false;
          }
          window.__qolboxGamePageBootstrapInstalled = true;
          return true;
        }
        installTopLevelGameInputPassthrough();
        installTopLevelGameStartRelay();
        return false;
      }

      // src/boot/startup-sequence.ts
      function runQolboxStartupSequence(options) {
        const scheduleInitialSettle = () => {
          options.scheduleUiWork({
            force: true,
            features: true,
            passes: FULLSCREEN_SETTLE_PASSES
          });
        };
        options.applyFeatureRootClasses();
        options.ensureGlobalStyle();
        options.installQolboxMenuHooks();
        options.installPopupKeyboardHooks();
        if (options.isReserveEnabled()) {
          options.installReserveSocketCaptureHook();
        }
        if (options.isAudioEnabled()) {
          options.installYouTubeReadyCallbackHook();
        }
        options.installFullscreenHooks();
        options.scheduleFirstBootOnboarding();
        scheduleInitialSettle();
        if (document.readyState === "loading") {
          document.addEventListener("DOMContentLoaded", scheduleInitialSettle, { once: true });
        } else {
          scheduleInitialSettle();
        }
      }

      // src/settings/advanced-settings.ts
      var ADVANCED_RESERVE_RETRY_INTERVAL_MS = "reserveRetryIntervalMs";
      var ADVANCED_COMMAND_ALIASES = "commandAliases";
      var ADVANCED_BLACKLIST_ENFORCEMENT = "blacklistEnforcement";
      var ADVANCED_ALERT_DELAY_MS = "gameStartAlertDelayMs";
      var ADVANCED_ALERT_FLASH_INTERVAL_MS = "gameStartAlertFlashIntervalMs";
      var ADVANCED_TYPING_DURATION_MS = "typingIndicatorDurationMs";
      var ADVANCED_SETTINGS_KEY = "vm.hitbox.qolboxAdvancedSettings";
      var ADVANCED_SETTING_DEFINITIONS = [
        {
          key: ADVANCED_RESERVE_RETRY_INTERVAL_MS,
          kind: "number",
          title: "Reserve retry interval",
          description: "Milliseconds between reserve join attempts.",
          defaultValue: RESERVE_RETRY_DELAY_MS,
          min: 500,
          max: 1e4,
          step: 100,
          unit: "ms"
        },
        {
          key: ADVANCED_COMMAND_ALIASES,
          kind: "boolean",
          title: "Command aliases",
          description: "Enable shorthand commands such as /rec and /r.",
          defaultValue: true
        },
        {
          key: ADVANCED_BLACKLIST_ENFORCEMENT,
          kind: "boolean",
          title: "Automatic blacklist",
          description: "Ban exact-name blacklist matches while you are host.",
          defaultValue: true
        },
        {
          key: ADVANCED_ALERT_DELAY_MS,
          kind: "number",
          title: "Tab alert delay",
          description: "Delay before the away-tab title changes.",
          defaultValue: GAME_START_INDICATOR_DELAY_MS,
          min: 200,
          max: 5e3,
          step: 100,
          unit: "ms"
        },
        {
          key: ADVANCED_ALERT_FLASH_INTERVAL_MS,
          kind: "number",
          title: "Tab flash speed",
          description: "Milliseconds between title/favicon flashes.",
          defaultValue: GAME_START_FLASH_INTERVAL_MS,
          min: 250,
          max: 2e3,
          step: 50,
          unit: "ms"
        },
        {
          key: ADVANCED_TYPING_DURATION_MS,
          kind: "number",
          title: "Typing indicator duration",
          description: "How long typing indicators stay visible.",
          defaultValue: TYPING_INDICATOR_TIMEOUT_MS,
          min: 500,
          max: 5e3,
          step: 100,
          unit: "ms"
        }
      ];
      function isRecord(value) {
        return typeof value === "object" && value !== null;
      }
      function clampNumber(value, definition) {
        const stepped = Math.round(value / definition.step) * definition.step;
        return Math.min(definition.max, Math.max(definition.min, stepped));
      }
      function getDefaultAdvancedSettings() {
        const settings = {};
        for (const definition of ADVANCED_SETTING_DEFINITIONS) {
          settings[definition.key] = definition.defaultValue;
        }
        return settings;
      }
      function sanitizeAdvancedSetting(definition, value) {
        switch (definition.kind) {
          case "number": {
            const numericValue = Number(value);
            return Number.isFinite(numericValue) ? clampNumber(numericValue, definition) : definition.defaultValue;
          }
          case "boolean":
            return value === true || value === "true";
        }
      }
      function loadAdvancedSettings() {
        const settings = getDefaultAdvancedSettings();
        try {
          const rawSettings = localStorage.getItem(ADVANCED_SETTINGS_KEY);
          if (!rawSettings) {
            return settings;
          }
          const parsedSettings = JSON.parse(rawSettings);
          if (!isRecord(parsedSettings)) {
            return settings;
          }
          for (const definition of ADVANCED_SETTING_DEFINITIONS) {
            if (Object.prototype.hasOwnProperty.call(parsedSettings, definition.key)) {
              settings[definition.key] = sanitizeAdvancedSetting(definition, parsedSettings[definition.key]);
            }
          }
        } catch {
        }
        return settings;
      }
      function saveAdvancedSettings(settings) {
        try {
          localStorage.setItem(ADVANCED_SETTINGS_KEY, JSON.stringify(settings));
        } catch {
        }
      }
      function getAdvancedSettingDefinition(key) {
        return ADVANCED_SETTING_DEFINITIONS.find((definition) => definition.key === key) || null;
      }
      function getAdvancedReserveRetryIntervalMs(settings = loadAdvancedSettings()) {
        return settings[ADVANCED_RESERVE_RETRY_INTERVAL_MS];
      }
      function getAdvancedGameStartAlertDelayMs(settings = loadAdvancedSettings()) {
        return settings[ADVANCED_ALERT_DELAY_MS];
      }
      function getAdvancedGameStartFlashIntervalMs(settings = loadAdvancedSettings()) {
        return settings[ADVANCED_ALERT_FLASH_INTERVAL_MS];
      }
      function getAdvancedTypingIndicatorDurationMs(settings = loadAdvancedSettings()) {
        return settings[ADVANCED_TYPING_DURATION_MS];
      }
      function areAdvancedCommandAliasesEnabled(settings = loadAdvancedSettings()) {
        return settings[ADVANCED_COMMAND_ALIASES];
      }
      function isAdvancedBlacklistEnforcementEnabled(settings = loadAdvancedSettings()) {
        return settings[ADVANCED_BLACKLIST_ENFORCEMENT];
      }

      // src/settings/advanced-settings-controller.ts
      function createAdvancedSettingsController(options) {
        const settings = loadAdvancedSettings();
        function getAdvancedSettings() {
          return { ...settings };
        }
        function getAdvancedSetting(key) {
          return settings[key];
        }
        function setAdvancedSetting(key, value) {
          const definition = getAdvancedSettingDefinition(key);
          if (!definition) {
            return;
          }
          settings[definition.key] = sanitizeAdvancedSetting(definition, value);
          applyAdvancedSettingsChange();
        }
        function setAdvancedSettings(nextSettings) {
          for (const definition of ADVANCED_SETTING_DEFINITIONS) {
            settings[definition.key] = sanitizeAdvancedSetting(definition, nextSettings[definition.key]);
          }
          applyAdvancedSettingsChange();
        }
        function resetAdvancedSetting(key) {
          const definition = getAdvancedSettingDefinition(key);
          if (!definition) {
            return;
          }
          settings[definition.key] = definition.defaultValue;
          applyAdvancedSettingsChange();
        }
        function resetAdvancedSettings() {
          const defaults = getDefaultAdvancedSettings();
          for (const definition of ADVANCED_SETTING_DEFINITIONS) {
            settings[definition.key] = defaults[definition.key];
          }
          applyAdvancedSettingsChange();
        }
        function applyAdvancedSettingsChange() {
          saveAdvancedSettings(settings);
          options.onApplyPersistentFeatures();
          options.onScheduleLayoutRefresh();
          options.onRenderMenu();
        }
        return {
          getAdvancedSetting,
          getAdvancedSettings,
          resetAdvancedSetting,
          resetAdvancedSettings,
          setAdvancedSettings,
          setAdvancedSetting
        };
      }

      // src/settings/feature-settings.ts
      var FEATURE_FULLSCREEN = "fullscreen";
      var FEATURE_AUDIO = "audio";
      var FEATURE_RESERVE = "reserve";
      var FEATURE_CHAT = "chat";
      var FEATURE_GAME_START_ALERT = "gameStartAlert";
      var FEATURE_MOBILE_GRAB = "mobileGrab";
      var FEATURE_LOBBY_COMMANDS = "lobbyCommands";
      var FEATURE_EDITOR_MAP_TRANSFER = "editorMapTransfer";
      var FEATURE_SETTINGS_KEY = "vm.hitbox.qolboxFeatures";
      var FEATURE_DEFINITIONS = [
        {
          key: FEATURE_FULLSCREEN,
          title: "Fullscreen Layout",
          shortTitle: "Fullscreen",
          summary: "Center and scale hitbox.io so the play area uses the browser window cleanly."
        },
        {
          key: FEATURE_AUDIO,
          title: "Audio Controls",
          shortTitle: "Audio",
          summary: "Remember volume choices, make the sliders easier to adjust, and keep jukebox mute behavior stable."
        },
        {
          key: FEATURE_RESERVE,
          title: "Reserve Spots",
          shortTitle: "Reserve",
          summary: "Wait for a spot in full custom lobbies instead of stopping at the full-room message."
        },
        {
          key: FEATURE_CHAT,
          title: "Chat Improvements",
          shortTitle: "Chat",
          summary: "Press Esc to discard chat drafts, keep game chat readable, and show typing indicators."
        },
        {
          key: FEATURE_GAME_START_ALERT,
          title: "Away Game Alert",
          shortTitle: "Game Alert",
          summary: "Flash the tab title and favicon when you need to play while away from the tab."
        },
        {
          key: FEATURE_MOBILE_GRAB,
          title: "Mobile Grab Button",
          shortTitle: "Mobile Grab",
          summary: "Add the missing Grab control to the game's mobile ability buttons."
        },
        {
          key: FEATURE_LOBBY_COMMANDS,
          title: "Lobby Commands",
          shortTitle: "Commands",
          summary: "Add lobby controls, special player targets, and access to normal and hidden host settings.",
          onboardingText: "Use /spec, /join, /red, /blue, /switch, /lock, /unlock, /host, /start, /end, /restart, /settings all, and /blacklist. Special targets: /spec all|playing, /join all|spectators, and /red or /blue all|playing|spectators. Named targets for /spec, /join, /red, /blue, /host, /kick, and /ban accept exact or unique partial player names. /blacklist stores exact names only."
        },
        {
          key: FEATURE_EDITOR_MAP_TRANSFER,
          title: "Map Import and Export",
          shortTitle: "Map Files",
          summary: "Add Import and Export to the editor File menu for saving map files on your computer."
        }
      ];
      var DEFAULT_FEATURE_SETTINGS = {
        [FEATURE_FULLSCREEN]: true,
        [FEATURE_AUDIO]: true,
        [FEATURE_RESERVE]: true,
        [FEATURE_CHAT]: true,
        [FEATURE_GAME_START_ALERT]: true,
        [FEATURE_MOBILE_GRAB]: true,
        [FEATURE_LOBBY_COMMANDS]: true,
        [FEATURE_EDITOR_MAP_TRANSFER]: true
      };
      function isRecord2(value) {
        return typeof value === "object" && value !== null;
      }
      function getDefaultFeatureSettings() {
        return { ...DEFAULT_FEATURE_SETTINGS };
      }
      function loadFeatureSettings() {
        const defaults = getDefaultFeatureSettings();
        try {
          const rawSettings = localStorage.getItem(FEATURE_SETTINGS_KEY);
          if (!rawSettings) {
            return defaults;
          }
          const parsedSettings = JSON.parse(rawSettings);
          if (!isRecord2(parsedSettings)) {
            return defaults;
          }
          for (const feature of FEATURE_DEFINITIONS) {
            if (Object.prototype.hasOwnProperty.call(parsedSettings, feature.key)) {
              defaults[feature.key] = parsedSettings[feature.key] !== false;
            }
          }
        } catch {
        }
        return defaults;
      }
      function saveFeatureSettings(settings) {
        try {
          localStorage.setItem(FEATURE_SETTINGS_KEY, JSON.stringify(settings));
        } catch {
        }
      }
      function isKnownFeature(featureKey) {
        return FEATURE_DEFINITIONS.some((feature) => feature.key === featureKey);
      }

      // src/settings/feature-gates.ts
      function createFeatureGateSet(shouldRunFeature) {
        return {
          isAudioEnabled: () => shouldRunFeature(FEATURE_AUDIO),
          isChatEnabled: () => shouldRunFeature(FEATURE_CHAT),
          isEditorMapTransferEnabled: () => shouldRunFeature(FEATURE_EDITOR_MAP_TRANSFER),
          isFullscreenEnabled: () => shouldRunFeature(FEATURE_FULLSCREEN),
          isGameStartAlertEnabled: () => shouldRunFeature(FEATURE_GAME_START_ALERT),
          isLobbyCommandsEnabled: () => shouldRunFeature(FEATURE_LOBBY_COMMANDS),
          isMobileGrabEnabled: () => shouldRunFeature(FEATURE_MOBILE_GRAB),
          isReserveEnabled: () => shouldRunFeature(FEATURE_RESERVE),
          shouldRunFeature
        };
      }

      // src/settings/feature-settings-controller.ts
      function createFeatureSettingsController(options) {
        const featureSettings = loadFeatureSettings();
        function isFeatureEnabled(featureKey) {
          return isKnownFeature(featureKey) && featureSettings[featureKey] !== false;
        }
        function shouldRunFeature(featureKey) {
          return options.isOnboardingComplete() && isFeatureEnabled(featureKey);
        }
        function setFeatureEnabled(featureKey, enabled) {
          if (!isKnownFeature(featureKey)) {
            return;
          }
          featureSettings[featureKey] = Boolean(enabled);
          applySettingsChange([featureKey]);
        }
        function applySettingsChange(featuresToRefresh = []) {
          saveFeatureSettings(featureSettings);
          options.onApplyFeatureRootClasses();
          for (const featureKey of featuresToRefresh) {
            if (!shouldRunFeature(featureKey)) {
              options.onDisableFeatureSideEffects(featureKey);
            }
          }
          if (options.isOnboardingComplete()) {
            options.onApplyPersistentFeatures();
            options.onScheduleUiWork({ force: true, features: true, passes: options.resizeSettlePasses });
          }
          options.onRenderMenu();
        }
        function setAllFeatureSettings(nextSettings) {
          const changedFeatures = [];
          for (const { key } of FEATURE_DEFINITIONS) {
            if (featureSettings[key] !== nextSettings[key]) {
              changedFeatures.push(key);
            }
            featureSettings[key] = nextSettings[key];
          }
          applySettingsChange(changedFeatures);
        }
        function resetFeatureSettingsToDefaults() {
          setAllFeatureSettings(getDefaultFeatureSettings());
        }
        return {
          isFeatureEnabled,
          resetFeatureSettingsToDefaults,
          setAllFeatureSettings,
          setFeatureEnabled,
          shouldRunFeature
        };
      }

      // src/dom/settings-menu-dom.ts
      function findSettingsContainer() {
        return document.querySelector(".items.left");
      }
      function findChangeControlsItem(container) {
        if (!container) {
          return null;
        }
        for (const item of container.querySelectorAll(".item")) {
          if ((item.textContent || "").trim() === "Change Controls") {
            return item;
          }
        }
        return null;
      }

      // src/settings/audio-storage.ts
      var STEP_PERCENT = 5;
      var DEFAULT_GAME_PERCENT = 100;
      var DEFAULT_JUKEBOX_PERCENT = 50;
      var GAME_VOLUME_KEY = "vm.hitbox.volumePercent";
      var JUKEBOX_STATE_KEY = "vm.hitbox.jukeboxState";
      function isRecord3(value) {
        return typeof value === "object" && value !== null;
      }
      function clampPercent(value, fallback = 0) {
        if (value === null || value === void 0 || typeof value === "string" && value.trim() === "") {
          return fallback;
        }
        const numericValue = Number(value);
        if (!Number.isFinite(numericValue)) {
          return fallback;
        }
        return Math.max(0, Math.min(100, Math.round(numericValue / STEP_PERCENT) * STEP_PERCENT));
      }
      function clampJukeboxPercent(value) {
        if (value === null || value === void 0 || typeof value === "string" && value.trim() === "") {
          return DEFAULT_JUKEBOX_PERCENT;
        }
        const numericValue = Number(value);
        if (!Number.isFinite(numericValue)) {
          return DEFAULT_JUKEBOX_PERCENT;
        }
        return Math.max(0, Math.min(100, Math.round(numericValue)));
      }
      function loadGamePercent() {
        try {
          return clampPercent(localStorage.getItem(GAME_VOLUME_KEY), DEFAULT_GAME_PERCENT);
        } catch {
          return DEFAULT_GAME_PERCENT;
        }
      }
      function saveGamePercent(percent) {
        try {
          localStorage.setItem(GAME_VOLUME_KEY, String(percent));
        } catch {
        }
      }
      function loadJukeboxState() {
        const fallback = { percent: null, muted: false };
        try {
          const rawState = localStorage.getItem(JUKEBOX_STATE_KEY);
          if (!rawState) {
            return fallback;
          }
          const parsed = JSON.parse(rawState);
          if (!isRecord3(parsed)) {
            return fallback;
          }
          return {
            percent: parsed.percent !== null && parsed.percent !== void 0 ? clampJukeboxPercent(parsed.percent) : null,
            muted: Boolean(parsed.muted)
          };
        } catch {
          return fallback;
        }
      }
      function saveJukeboxState(state) {
        try {
          localStorage.setItem(JUKEBOX_STATE_KEY, JSON.stringify(state));
        } catch {
        }
      }

      // src/hitbox/native-access.ts
      function isNativeObject(value) {
        return typeof value === "object" && value !== null;
      }
      function isNativeReflectTarget(value) {
        return isNativeObject(value) || typeof value === "function";
      }
      function readNativeProperty(source, property) {
        return isNativeObject(source) ? Reflect.get(source, property) : void 0;
      }
      function readNativeReflectProperty(source, property) {
        return isNativeReflectTarget(source) ? Reflect.get(source, property) : void 0;
      }
      function setNativeReflectProperty(source, property, value) {
        return isNativeReflectTarget(source) && Reflect.set(source, property, value);
      }
      function readNativePath(source, path) {
        let current = source;
        for (const property of path) {
          current = readNativeProperty(current, property);
          if (current === void 0 || current === null) {
            return current;
          }
        }
        return current;
      }
      function hasNativeMethod(source, methodName) {
        return typeof readNativeProperty(source, methodName) === "function";
      }
      function callNativeMethod(source, methodName, args = []) {
        const method = readNativeProperty(source, methodName);
        if (!isNativeObject(source) || typeof method !== "function") {
          return { called: false, result: void 0 };
        }
        return { called: true, result: Reflect.apply(method, source, [...args]) };
      }

      // src/hitbox/howler-audio-adapter.ts
      function isNativeCallable(value) {
        return typeof value === "function";
      }
      function createHowlerGameAudioAdapter(options) {
        let originalHowlVolume = null;
        let settingGameVolumeInternally = false;
        function applyGameVolumeToHowls() {
          const howler = readNativeReflectProperty(window, "Howler");
          const howls = readNativeReflectProperty(howler, "_howls");
          if (!Array.isArray(howls) || !originalHowlVolume) {
            return;
          }
          settingGameVolumeInternally = true;
          try {
            for (const howl of howls) {
              if (!isNativeReflectTarget(howl)) {
                continue;
              }
              const storedBaseVolume = readNativeReflectProperty(howl, "__qolboxBaseVolume");
              let baseVolume = typeof storedBaseVolume === "number" ? storedBaseVolume : null;
              if (baseVolume === null) {
                const initialVolume = Number(readNativeReflectProperty(howl, "_volume"));
                baseVolume = Number.isFinite(initialVolume) ? initialVolume : 1;
                setNativeReflectProperty(howl, "__qolboxBaseVolume", baseVolume);
              }
              Reflect.apply(originalHowlVolume, howl, [baseVolume * options.getGameVolumeScalar()]);
            }
          } finally {
            settingGameVolumeInternally = false;
          }
        }
        function hookHowlPrototype() {
          if (!options.isAudioEnabled() && !originalHowlVolume) {
            return false;
          }
          const howlConstructor = readNativeReflectProperty(window, "Howl");
          const howlPrototype = readNativeReflectProperty(howlConstructor, "prototype");
          if (!isNativeReflectTarget(howlPrototype)) {
            return false;
          }
          const currentVolumeMethod = readNativeReflectProperty(howlPrototype, "volume");
          let volumePatched = Boolean(
            isNativeCallable(currentVolumeMethod) && readNativeReflectProperty(currentVolumeMethod, "__qolboxWrapped") === true
          );
          if (!volumePatched && isNativeCallable(currentVolumeMethod)) {
            let wrappedVolume2 = function(value, ...rest) {
              if (arguments.length === 0) {
                const baseVolume = readNativeReflectProperty(this, "__qolboxBaseVolume");
                if (typeof baseVolume === "number") {
                  return baseVolume;
                }
                return Reflect.apply(baseVolumeMethod, this, []);
              }
              if (typeof value === "number" && !settingGameVolumeInternally) {
                setNativeReflectProperty(this, "__qolboxBaseVolume", value);
                return Reflect.apply(baseVolumeMethod, this, [value * options.getGameVolumeScalar(), ...rest]);
              }
              return Reflect.apply(baseVolumeMethod, this, [value, ...rest]);
            };
            var wrappedVolume = wrappedVolume2;
            const baseVolumeMethod = currentVolumeMethod;
            originalHowlVolume = baseVolumeMethod;
            setNativeReflectProperty(wrappedVolume2, "__qolboxWrapped", true);
            setNativeReflectProperty(howlPrototype, "volume", wrappedVolume2);
            volumePatched = true;
          }
          const currentPlayMethod = readNativeReflectProperty(howlPrototype, "play");
          const playPatched = isNativeCallable(currentPlayMethod) && readNativeReflectProperty(currentPlayMethod, "__qolboxReserveAudioWrapped");
          if (isNativeCallable(currentPlayMethod) && !playPatched) {
            let wrappedPlay2 = function(...args) {
              if (options.shouldSuppressReserveRetryAudio()) {
                return void 0;
              }
              return Reflect.apply(basePlayMethod, this, args);
            };
            var wrappedPlay = wrappedPlay2;
            const basePlayMethod = currentPlayMethod;
            setNativeReflectProperty(wrappedPlay2, "__qolboxReserveAudioWrapped", true);
            setNativeReflectProperty(howlPrototype, "play", wrappedPlay2);
          }
          return volumePatched;
        }
        return {
          applyGameVolumeToHowls,
          hookHowlPrototype
        };
      }

      // src/features/audio-levels.ts
      var KEYBOARD_PAGE_STEP_MULTIPLIER = 4;
      var GAME_CURVE_EXPONENT = 2;
      var JUKEBOX_CURVE_EXPONENT = 2;
      var JUKEBOX_MIN_ANGLE = -40;
      var JUKEBOX_MAX_ANGLE = 220;
      var JUKEBOX_ARC_CENTER = 14;
      var JUKEBOX_ARC_RADIUS = 12;
      var JUKEBOX_ANGLE_EPSILON = 1e-6;
      function readBooleanProperty(source, property) {
        return readObjectProperty(source, property) === true;
      }
      function readStringProperty(source, property) {
        const value = readObjectProperty(source, property);
        return typeof value === "string" ? value : "";
      }
      function percentToGameScalar(percent) {
        return Math.pow(clampPercent(percent, DEFAULT_GAME_PERCENT) / 100, GAME_CURVE_EXPONENT);
      }
      function percentToJukeboxVolume(percent) {
        const clampedPercent = clampJukeboxPercent(percent);
        if (clampedPercent <= 0) {
          return 0;
        }
        return Math.max(1, Math.round(Math.pow(clampedPercent / 100, JUKEBOX_CURVE_EXPONENT) * 100));
      }
      function percentToJukeboxAngle(percent) {
        const normalized = clampJukeboxPercent(percent) / 100;
        return JUKEBOX_MIN_ANGLE + (JUKEBOX_MAX_ANGLE - JUKEBOX_MIN_ANGLE) * normalized;
      }
      function getKeyboardPercentTarget(event, currentPercent, stepPercent) {
        if (!event || readBooleanProperty(event, "altKey") || readBooleanProperty(event, "ctrlKey") || readBooleanProperty(event, "metaKey")) {
          return null;
        }
        const current = Number.isFinite(Number(currentPercent)) ? Number(currentPercent) : 0;
        const step = Math.max(1, Number(stepPercent) || 1);
        switch (readStringProperty(event, "key")) {
          case "ArrowUp":
          case "ArrowRight":
            return current + step;
          case "ArrowDown":
          case "ArrowLeft":
            return current - step;
          case "PageUp":
            return current + step * KEYBOARD_PAGE_STEP_MULTIPLIER;
          case "PageDown":
            return current - step * KEYBOARD_PAGE_STEP_MULTIPLIER;
          case "Home":
            return 0;
          case "End":
            return 100;
          default:
            return null;
        }
      }
      function angleToJukeboxPercent(angle) {
        const numericAngle = Number(angle);
        if (!Number.isFinite(numericAngle)) {
          return DEFAULT_JUKEBOX_PERCENT;
        }
        const normalizedAngle = normalizeJukeboxAngle(numericAngle);
        const normalized = (Math.min(JUKEBOX_MAX_ANGLE, Math.max(JUKEBOX_MIN_ANGLE, normalizedAngle)) - JUKEBOX_MIN_ANGLE) / (JUKEBOX_MAX_ANGLE - JUKEBOX_MIN_ANGLE);
        return clampJukeboxPercent(normalized * 100);
      }
      function normalizeJukeboxAngle(angle) {
        const numericAngle = Number(angle);
        if (!Number.isFinite(numericAngle)) {
          return percentToJukeboxAngle(DEFAULT_JUKEBOX_PERCENT);
        }
        const candidates = [numericAngle, numericAngle + 360, numericAngle - 360];
        for (const candidate of candidates) {
          if (candidate >= JUKEBOX_MIN_ANGLE - JUKEBOX_ANGLE_EPSILON && candidate <= JUKEBOX_MAX_ANGLE + JUKEBOX_ANGLE_EPSILON) {
            return Math.max(JUKEBOX_MIN_ANGLE, Math.min(JUKEBOX_MAX_ANGLE, candidate));
          }
        }
        return Math.max(JUKEBOX_MIN_ANGLE, Math.min(JUKEBOX_MAX_ANGLE, numericAngle));
      }
      function parseJukeboxAngleFromTransform(transform) {
        if (typeof transform !== "string" || transform === "" || transform === "none") {
          return null;
        }
        const rotateMatch = transform.match(/rotate\(\s*(-?\d+(?:\.\d+)?)deg\s*\)/i);
        if (rotateMatch) {
          return normalizeJukeboxAngle(Number(rotateMatch[1]));
        }
        const matrixMatch = transform.match(/^matrix\(([^)]+)\)$/i);
        if (matrixMatch) {
          const values = matrixMatch[1].split(",").map((value) => Number(value.trim()));
          if (values.length >= 4 && values.every(Number.isFinite)) {
            return normalizeJukeboxAngle(Math.atan2(values[1], values[0]) * 180 / Math.PI);
          }
        }
        const matrix3dMatch = transform.match(/^matrix3d\(([^)]+)\)$/i);
        if (matrix3dMatch) {
          const values = matrix3dMatch[1].split(",").map((value) => Number(value.trim()));
          if (values.length >= 16 && values.every(Number.isFinite)) {
            return normalizeJukeboxAngle(Math.atan2(values[1], values[0]) * 180 / Math.PI);
          }
        }
        return null;
      }
      function polarToArcPoint(angle) {
        const radians = (angle + 180) * Math.PI / 180;
        return {
          x: JUKEBOX_ARC_CENTER + JUKEBOX_ARC_RADIUS * Math.cos(radians),
          y: JUKEBOX_ARC_CENTER + JUKEBOX_ARC_RADIUS * Math.sin(radians)
        };
      }

      // src/dom/element-guards.ts
      function isObjectLike(value) {
        return typeof value === "object" && value !== null;
      }
      function hasDataset(value) {
        return value instanceof Element && "dataset" in value && isObjectLike(value.dataset);
      }
      function isFocusableElement(value) {
        return value instanceof Element && "focus" in value && typeof value.focus === "function";
      }
      function isStyleDeclaration(value) {
        return isObjectLike(value) && "getPropertyPriority" in value && typeof value.getPropertyPriority === "function" && "getPropertyValue" in value && typeof value.getPropertyValue === "function" && "removeProperty" in value && typeof value.removeProperty === "function" && "setProperty" in value && typeof value.setProperty === "function";
      }
      function isStyledElement(value) {
        return value instanceof Element && "style" in value && isStyleDeclaration(value.style);
      }
      function isTabbableElement(value) {
        return value instanceof Element && "tabIndex" in value && typeof value.tabIndex === "number";
      }
      function getCanvasBackingSize(value) {
        if (typeof value !== "object" || value === null || !("width" in value) || !("height" in value) || typeof value.width !== "number" || typeof value.height !== "number") {
          return null;
        }
        return {
          width: value.width,
          height: value.height
        };
      }

      // src/dom/dom-helpers.ts
      function isFocusableValue(value) {
        return isFocusableElement(value);
      }
      function isElementVisible(element) {
        if (!element || !element.isConnected) {
          return false;
        }
        const style = window.getComputedStyle(element);
        if (style.display === "none" || style.visibility === "hidden") {
          return false;
        }
        const rect = element.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0;
      }
      function hasVisibleLayer(selector) {
        for (const layer of document.querySelectorAll(selector)) {
          if (isElementVisible(layer)) {
            return true;
          }
        }
        return false;
      }
      function escapeMenuText(value) {
        return String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
      }
      function focusElementWithoutScroll(element) {
        if (!isFocusableValue(element)) {
          return;
        }
        try {
          element.focus({ preventScroll: true });
        } catch {
          element.focus();
        }
      }
      function keepOutOfBrowserTabOrder(element) {
        if (isTabbableElement(element)) {
          element.tabIndex = -1;
        }
      }
      function keepInBrowserTabOrder(element) {
        if (isTabbableElement(element)) {
          element.tabIndex = 0;
        }
      }
      function matchesElementOrDescendant(node, selector) {
        if (!(node instanceof Element)) {
          return false;
        }
        return node.matches(selector) || Boolean(node.closest(selector)) || Boolean(node.querySelector(selector));
      }
      function mutationTouchesSelector(record, selector) {
        const targetElement = record.target instanceof Element ? record.target : record.target.parentElement instanceof Element ? record.target.parentElement : null;
        if (matchesElementOrDescendant(targetElement, selector)) {
          return true;
        }
        for (const node of record.addedNodes) {
          if (matchesElementOrDescendant(node, selector)) {
            return true;
          }
        }
        for (const node of record.removedNodes) {
          if (matchesElementOrDescendant(node, selector)) {
            return true;
          }
        }
        return false;
      }

      // src/features/game-volume-menu-item.ts
      function isGameVolumeMenuItemElement(value) {
        return value instanceof Element && hasDataset(value) && isStyledElement(value) && "cursor" in value.style && "userSelect" in value.style;
      }
      function findGameVolumeItem() {
        const candidates = document.querySelectorAll(".items.left .item, .item");
        for (const candidate of candidates) {
          if (/^Volume:\s*\d+%$/.test(candidate.textContent?.trim() || "") && isGameVolumeMenuItemElement(candidate)) {
            return candidate;
          }
        }
        return null;
      }
      function updateGameVolumeItemView(item, gamePercent) {
        item.textContent = `Volume: ${gamePercent}%`;
        item.setAttribute("title", "Scroll or use arrow keys to adjust by 5%, left-click up, right-click down");
        item.style.cursor = "ns-resize";
        item.style.userSelect = "none";
        keepOutOfBrowserTabOrder(item);
        item.setAttribute("role", "slider");
        item.setAttribute("aria-label", "Game volume");
        item.setAttribute("aria-valuemin", "0");
        item.setAttribute("aria-valuemax", "100");
        item.setAttribute("aria-valuenow", String(gamePercent));
        item.setAttribute("aria-valuetext", `${gamePercent}%`);
      }

      // src/features/game-volume-menu-control.ts
      function readNumberProperty(source, property) {
        const value = readObjectProperty(source, property);
        return typeof value === "number" ? value : Number(value);
      }
      function createGameVolumeMenuController(options) {
        let currentGameMenuItem = null;
        function updateGameVolumeText() {
          if (!options.isAudioEnabled()) {
            return;
          }
          if (!currentGameMenuItem || !currentGameMenuItem.isConnected) {
            currentGameMenuItem = findGameVolumeItem();
          }
          if (!currentGameMenuItem) {
            return;
          }
          const gamePercent = options.getGamePercent();
          updateGameVolumeItemView(currentGameMenuItem, gamePercent);
        }
        function patchGameVolumeMenu() {
          if (!options.isAudioEnabled()) {
            return false;
          }
          const item = findGameVolumeItem();
          if (!item) {
            return false;
          }
          currentGameMenuItem = item;
          if (!item.dataset.qolboxGameVolumePatched) {
            item.dataset.qolboxGameVolumePatched = "true";
            item.addEventListener(
              "click",
              (event) => {
                if (!options.isAudioEnabled()) {
                  return;
                }
                event.preventDefault();
                event.stopImmediatePropagation();
                focusElementWithoutScroll(item);
                options.setGamePercent(options.getGamePercent() + options.stepPercent);
              },
              true
            );
            item.addEventListener(
              "contextmenu",
              (event) => {
                if (!options.isAudioEnabled()) {
                  return;
                }
                event.preventDefault();
                event.stopImmediatePropagation();
                focusElementWithoutScroll(item);
                options.setGamePercent(options.getGamePercent() - options.stepPercent);
              },
              true
            );
            item.addEventListener(
              "wheel",
              (event) => {
                if (!options.isAudioEnabled()) {
                  return;
                }
                event.preventDefault();
                event.stopImmediatePropagation();
                focusElementWithoutScroll(item);
                options.setGamePercent(
                  options.getGamePercent() + (readNumberProperty(event, "deltaY") < 0 ? options.stepPercent : -options.stepPercent)
                );
              },
              { passive: false, capture: true }
            );
            item.addEventListener(
              "keydown",
              (event) => {
                if (!options.isAudioEnabled()) {
                  return;
                }
                const nextPercent = getKeyboardPercentTarget(
                  event,
                  options.getGamePercent(),
                  options.stepPercent
                );
                if (nextPercent === null) {
                  return;
                }
                event.preventDefault();
                event.stopImmediatePropagation();
                options.setGamePercent(nextPercent);
              },
              true
            );
          }
          updateGameVolumeText();
          return true;
        }
        return {
          patchGameVolumeMenu,
          updateGameVolumeText
        };
      }

      // src/features/game-volume-control.ts
      function createGameVolumeController(options) {
        let gamePercent = loadGamePercent();
        const howlerAudio = createHowlerGameAudioAdapter({
          getGameVolumeScalar: () => options.isAudioEnabled() ? percentToGameScalar(gamePercent) : 1,
          isAudioEnabled: options.isAudioEnabled,
          shouldSuppressReserveRetryAudio: options.isReserveRetryAudioSuppressed
        });
        const menuController = createGameVolumeMenuController({
          stepPercent: STEP_PERCENT,
          getGamePercent: () => gamePercent,
          isAudioEnabled: options.isAudioEnabled,
          setGamePercent
        });
        function updateGameVolumeText() {
          menuController.updateGameVolumeText();
        }
        function applyGameVolume() {
          updateGameVolumeText();
          howlerAudio.applyGameVolumeToHowls();
        }
        function setGamePercent(nextPercent) {
          gamePercent = clampPercent(nextPercent, DEFAULT_GAME_PERCENT);
          saveGamePercent(gamePercent);
          applyGameVolume();
        }
        function patchGameVolumeMenu() {
          return menuController.patchGameVolumeMenu();
        }
        function shouldSuppressReserveRetryAudio() {
          return options.isReserveRetryAudioSuppressed();
        }
        function hookHowlPrototype() {
          const volumePatched = howlerAudio.hookHowlPrototype();
          if (volumePatched) {
            applyGameVolume();
          }
          return volumePatched;
        }
        return {
          applyGameVolume,
          hookHowlPrototype,
          patchGameVolumeMenu,
          setGamePercent,
          shouldSuppressReserveRetryAudio
        };
      }

      // src/hitbox/youtube-player-native.ts
      function isRecord4(value) {
        return typeof value === "object" && value !== null;
      }
      function isNativeCallable2(value) {
        return typeof value === "function";
      }
      function isConstructableCallable(value) {
        return typeof value === "function";
      }
      function readBooleanProperty2(source, property) {
        return readObjectProperty(source, property) === true;
      }

      // src/hitbox/youtube-player-options-wrapper.ts
      function wrapYouTubePlayerOptions(args, options) {
        const wrappedArgs = Array.from(args);
        const optionsArg = wrappedArgs[1];
        if (!isRecord4(optionsArg)) {
          return wrappedArgs;
        }
        const events = isRecord4(optionsArg.events) ? optionsArg.events : {};
        const originalOnReady = events.onReady;
        if (readBooleanProperty2(originalOnReady, "__qolboxWrapped")) {
          return wrappedArgs;
        }
        const wrappedEvents = {
          ...events,
          onReady(event, ...readyArgs) {
            const player = readObjectProperty(event, "target") || options.getPlayer();
            options.onPlayerReady(player);
            try {
              return isNativeCallable2(originalOnReady) ? Reflect.apply(originalOnReady, this, [event, ...readyArgs]) : void 0;
            } finally {
              window.setTimeout(() => {
                options.onPlayerStateNeeded(player || options.getPlayer());
              }, 0);
            }
          }
        };
        setObjectProperty(wrappedEvents.onReady, "__qolboxWrapped", true);
        setObjectProperty(wrappedEvents.onReady, "__qolboxOriginal", originalOnReady);
        wrappedArgs[1] = {
          ...optionsArg,
          events: wrappedEvents
        };
        return wrappedArgs;
      }

      // src/hitbox/youtube-player-adapter.ts
      function createYouTubeJukeboxAdapter(options) {
        let trackedPlayers = /* @__PURE__ */ new Set();
        let hookInstalled = false;
        let playerStateApplied = false;
        let retryTimer = 0;
        let retryCount = 0;
        let readyCallbackHookInstalled = false;
        function trackPlayer(player) {
          if (!player || !isNativeCallable2(readObjectProperty(player, "setVolume"))) {
            return;
          }
          trackedPlayers.add(player);
        }
        function discoverPlayers() {
          const yt = readObjectProperty(window, "YT");
          const getPlayer = readObjectProperty(yt, "get");
          if (!isNativeCallable2(getPlayer)) {
            return;
          }
          for (const candidate of document.querySelectorAll("#ytContainer [id], #ytContainer iframe[id]")) {
            if (!candidate.id) {
              continue;
            }
            try {
              const player = Reflect.apply(getPlayer, yt, [candidate.id]);
              trackPlayer(player);
            } catch {
            }
          }
        }
        function applyPlayerState(player) {
          if (!options.isEnabled()) {
            return;
          }
          const setVolume = readObjectProperty(player, "setVolume");
          if (!player || !isNativeCallable2(setVolume)) {
            trackedPlayers.delete(player);
            return;
          }
          try {
            const setPlaybackRate = readObjectProperty(player, "setPlaybackRate");
            const getPlaybackRate = readObjectProperty(player, "getPlaybackRate");
            const playbackRate = isNativeCallable2(getPlaybackRate) ? Reflect.apply(getPlaybackRate, player, []) : null;
            if (isNativeCallable2(setPlaybackRate) && playbackRate !== 1) {
              Reflect.apply(setPlaybackRate, player, [1]);
            }
            const getVolume = readObjectProperty(player, "getVolume");
            const getMuted = readObjectProperty(player, "isMuted");
            const currentVolume = isNativeCallable2(getVolume) ? Reflect.apply(getVolume, player, []) : null;
            const currentlyMuted = isNativeCallable2(getMuted) ? Reflect.apply(getMuted, player, []) : null;
            if (options.isMuted()) {
              if (currentVolume !== 0) {
                Reflect.apply(setVolume, player, [0]);
              }
              const mute = readObjectProperty(player, "mute");
              if (isNativeCallable2(mute) && currentlyMuted !== true) {
                Reflect.apply(mute, player, []);
              }
            } else {
              const targetVolume = options.getVolume();
              if (currentVolume !== targetVolume) {
                Reflect.apply(setVolume, player, [targetVolume]);
              }
              const unMute = readObjectProperty(player, "unMute");
              if (isNativeCallable2(unMute) && currentlyMuted === true) {
                Reflect.apply(unMute, player, []);
              }
            }
            playerStateApplied = true;
          } catch {
            trackedPlayers.delete(player);
          }
        }
        function applyToTrackedPlayers() {
          if (!options.isEnabled()) {
            return;
          }
          discoverPlayers();
          for (const player of Array.from(trackedPlayers)) {
            applyPlayerState(player);
          }
        }
        function restoreTrackedPlayers(volume) {
          if (!playerStateApplied) {
            return;
          }
          for (const player of Array.from(trackedPlayers)) {
            const setVolume = readObjectProperty(player, "setVolume");
            if (!player || !isNativeCallable2(setVolume)) {
              trackedPlayers.delete(player);
              continue;
            }
            try {
              Reflect.apply(setVolume, player, [volume]);
              const unMute = readObjectProperty(player, "unMute");
              if (isNativeCallable2(unMute)) {
                Reflect.apply(unMute, player, []);
              }
            } catch {
              trackedPlayers.delete(player);
            }
          }
          playerStateApplied = false;
        }
        function scheduleRetry() {
          if (!options.isEnabled() || hookInstalled || retryTimer || retryCount >= options.maxRetries) {
            return;
          }
          retryCount += 1;
          retryTimer = window.setTimeout(() => {
            retryTimer = 0;
            hookPlayerConstructor();
            options.onPlayerStateNeeded();
          }, options.retryDelayMs);
        }
        function wrapReadyCallback(callback) {
          if (!isNativeCallable2(callback) || readBooleanProperty2(callback, "__qolboxWrapped")) {
            return callback;
          }
          const nativeCallback = callback;
          function wrappedYouTubeReadyCallback(...args) {
            if (options.isEnabled()) {
              hookPlayerConstructor();
              options.onPlayerStateNeeded();
            }
            try {
              return Reflect.apply(nativeCallback, this, args);
            } finally {
              if (options.isEnabled()) {
                hookPlayerConstructor();
                window.setTimeout(options.onPlayerStateNeeded, 0);
              }
            }
          }
          setObjectProperty(wrappedYouTubeReadyCallback, "__qolboxWrapped", true);
          setObjectProperty(wrappedYouTubeReadyCallback, "__qolboxOriginal", callback);
          return wrappedYouTubeReadyCallback;
        }
        function installReadyCallbackHook() {
          if (!options.isEnabled() || readyCallbackHookInstalled) {
            return;
          }
          const descriptor = Object.getOwnPropertyDescriptor(window, "onYouTubeIframeAPIReady");
          if (descriptor && (!descriptor.configurable || descriptor.get || descriptor.set)) {
            return;
          }
          readyCallbackHookInstalled = true;
          let readyCallback = wrapReadyCallback(
            descriptor ? descriptor.value : readObjectProperty(window, "onYouTubeIframeAPIReady")
          );
          try {
            Object.defineProperty(window, "onYouTubeIframeAPIReady", {
              configurable: true,
              enumerable: true,
              get() {
                return readyCallback;
              },
              set(value) {
                readyCallback = wrapReadyCallback(value);
              }
            });
          } catch {
            readyCallbackHookInstalled = false;
          }
        }
        function hookPlayerConstructor() {
          if (!options.isEnabled()) {
            return false;
          }
          installReadyCallbackHook();
          const yt = readObjectProperty(window, "YT");
          const playerConstructor = readObjectProperty(yt, "Player");
          if (!isConstructableCallable(playerConstructor)) {
            scheduleRetry();
            return false;
          }
          if (retryTimer) {
            window.clearTimeout(retryTimer);
            retryTimer = 0;
          }
          retryCount = 0;
          if (hookInstalled || readBooleanProperty2(playerConstructor, "__qolboxWrapped")) {
            hookInstalled = true;
            discoverPlayers();
            return true;
          }
          const OriginalPlayer = playerConstructor;
          function WrappedPlayer(...args) {
            let instance = null;
            const wrappedArgs = wrapYouTubePlayerOptions(args, {
              getPlayer: () => instance,
              onPlayerReady: trackPlayer,
              onPlayerStateNeeded: applyPlayerState
            });
            instance = new OriginalPlayer(...wrappedArgs);
            return instance;
          }
          Object.setPrototypeOf(WrappedPlayer, OriginalPlayer);
          setObjectProperty(WrappedPlayer, "prototype", readObjectProperty(OriginalPlayer, "prototype"));
          setObjectProperty(WrappedPlayer, "__qolboxWrapped", true);
          setObjectProperty(yt, "Player", WrappedPlayer);
          hookInstalled = true;
          discoverPlayers();
          return true;
        }
        return {
          applyToTrackedPlayers,
          hookPlayerConstructor,
          installReadyCallbackHook,
          restoreTrackedPlayers
        };
      }

      // src/features/jukebox-dom-helpers.ts
      function readJukeboxProperty(source, property) {
        return readObjectProperty(source, property);
      }
      function setJukeboxProperty(source, property, value) {
        return setObjectProperty(source, property, value);
      }
      function readJukeboxNumberProperty(source, property) {
        const value = readJukeboxProperty(source, property);
        return typeof value === "number" ? value : Number(value);
      }
      function readJukeboxBooleanProperty(source, property) {
        return readJukeboxProperty(source, property) === true;
      }
      function isNativeCallable3(value) {
        return typeof value === "function";
      }
      function isJukeboxStyleDatasetElement(value) {
        return value instanceof Element && typeof readJukeboxProperty(value, "dataset") === "object" && typeof readJukeboxProperty(value, "style") === "object";
      }
      function requestJukeboxPointerCapture(knob, event) {
        const setPointerCapture = readJukeboxProperty(knob, "setPointerCapture");
        const pointerId = readJukeboxProperty(event, "pointerId");
        if (!isNativeCallable3(setPointerCapture) || pointerId === void 0) {
          return;
        }
        try {
          Reflect.apply(setPointerCapture, knob, [pointerId]);
        } catch {
        }
      }

      // src/features/chat-input-elements.ts
      function hasEditableChatValue(value) {
        return value instanceof Element && "value" in value && typeof value.value === "string";
      }
      function canBlur(value) {
        return typeof value === "object" && value !== null && "blur" in value && typeof value.blur === "function";
      }
      function isChatInputElement(element, selector) {
        return element instanceof Element && element.matches(selector);
      }
      function isLobbyChatInputElement(element, selector) {
        return element instanceof Element && element.matches(selector);
      }
      function getActiveChatInputElement(target, selector) {
        if (isChatInputElement(target, selector)) {
          return target;
        }
        if (target instanceof Element) {
          const closestChatInput = target.closest(selector);
          if (isChatInputElement(closestChatInput, selector)) {
            return closestChatInput;
          }
        }
        return document.querySelector(".inGameChat .input:focus, .lobbyContainer .chatBox .input:focus");
      }

      // src/features/chat-keyboard-events.ts
      function readTextProperty(source, property) {
        const value = readObjectProperty(source, property);
        return typeof value === "string" ? value : void 0;
      }
      function isEscapeKey(event) {
        const key = readTextProperty(event, "key");
        const code = readTextProperty(event, "code");
        return key === "Escape" || key === "Esc" || code === "Escape";
      }
      function isTabKey(event) {
        const key = readTextProperty(event, "key");
        const code = readTextProperty(event, "code");
        return key === "Tab" || code === "Tab";
      }
      function isEnterKey(event) {
        return readTextProperty(event, "key") === "Enter";
      }
      function isArrowLeftKey(event) {
        return readTextProperty(event, "key") === "ArrowLeft" || readTextProperty(event, "code") === "ArrowLeft";
      }
      function isArrowRightKey(event) {
        return readTextProperty(event, "key") === "ArrowRight" || readTextProperty(event, "code") === "ArrowRight";
      }

      // src/features/chat-input-controls.ts
      function createChatInputController(options) {
        let escapeHooksInstalled = false;
        let commandAliasHooksInstalled = false;
        let suppressEscapeKeyUntil = 0;
        const originalTabIndexByInput = /* @__PURE__ */ new Map();
        function isChatInput(element) {
          return isChatInputElement(element, options.chatInputSelector);
        }
        function isLobbyChatInput(element) {
          return isLobbyChatInputElement(element, options.lobbyChatInputSelector);
        }
        function getActiveChatInput(target = document.activeElement) {
          return getActiveChatInputElement(target, options.chatInputSelector);
        }
        function restoreLobbyChatPrompt(input) {
          if (!isLobbyChatInput(input)) {
            return;
          }
          const chatBox = input.closest(".lobbyContainer .chatBox");
          const instruction = chatBox ? chatBox.querySelector(".lowerInstruction") : null;
          if (instruction) {
            instruction.style.visibility = "inherit";
            if (!(instruction.textContent || "").trim()) {
              instruction.textContent = options.isTouchLobbyChatPrompt() ? options.touchLobbyChatPrompt : options.desktopLobbyChatPrompt;
            }
          }
          if (!options.isTouchLobbyChatPrompt() && isStyledElement(input)) {
            input.style.pointerEvents = "none";
          }
        }
        function closeChatInput(input) {
          if (!options.isChatFeatureEnabled() || !isChatInput(input) || !hasEditableChatValue(input) || !canBlur(input)) {
            return false;
          }
          const closingLobbyChat = isLobbyChatInput(input);
          input.value = "";
          input.dispatchEvent(new Event("input", { bubbles: true }));
          input.blur();
          input.classList.remove("bgActive");
          if (closingLobbyChat) {
            restoreLobbyChatPrompt(input);
          } else {
            options.focusActiveRenderCanvas();
          }
          return true;
        }
        function handleChatEscape(event) {
          if (!options.isChatFeatureEnabled() || !isEscapeKey(event)) {
            return;
          }
          const input = getActiveChatInput(event.target);
          const suppressingKeyup = event.type === "keyup" && Date.now() < suppressEscapeKeyUntil;
          if (!input && !suppressingKeyup) {
            return;
          }
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          if (event.type === "keydown" && input) {
            suppressEscapeKeyUntil = Date.now() + 500;
            closeChatInput(input);
          }
        }
        function installChatEscapeHooks() {
          if (escapeHooksInstalled) {
            return;
          }
          escapeHooksInstalled = true;
          window.addEventListener("keydown", handleChatEscape, true);
          window.addEventListener("keyup", handleChatEscape, true);
          document.addEventListener("keydown", handleChatEscape, true);
          document.addEventListener("keyup", handleChatEscape, true);
        }
        function handleChatCommandAliasKeydown(event) {
          if (!options.areLobbyCommandsEnabled() || !isEnterKey(event)) {
            return;
          }
          const input = event.target;
          if (!isChatInput(input)) {
            return;
          }
          if (hasEditableChatValue(input)) {
            input.value = options.expandNativeChatAlias(input.value);
          }
        }
        function installChatCommandAliasHooks() {
          if (commandAliasHooksInstalled) {
            return;
          }
          commandAliasHooksInstalled = true;
          document.addEventListener("keydown", handleChatCommandAliasKeydown, true);
        }
        function patchChatTabOrder() {
          if (!options.isChatFeatureEnabled()) {
            return;
          }
          if (!document.querySelector(".inGameChat, .lobbyContainer")) {
            return;
          }
          for (const input of document.querySelectorAll(options.chatInputSelector)) {
            if (!originalTabIndexByInput.has(input)) {
              originalTabIndexByInput.set(input, input.getAttribute("tabindex"));
            }
            keepOutOfBrowserTabOrder(input);
          }
        }
        function restoreChatTabOrder() {
          for (const [input, originalTabIndex] of originalTabIndexByInput) {
            if (originalTabIndex === null) {
              input.removeAttribute("tabindex");
            } else {
              input.setAttribute("tabindex", originalTabIndex);
            }
          }
          originalTabIndexByInput.clear();
        }
        return {
          closeChatInput,
          getActiveChatInput,
          installChatCommandAliasHooks,
          installChatEscapeHooks,
          isChatInput,
          patchChatTabOrder,
          restoreChatTabOrder,
          restoreLobbyChatPrompt
        };
      }

      // src/features/jukebox-keyboard-focus.ts
      function readProperty(source, property) {
        return readObjectProperty(source, property);
      }
      function isNativeCallable4(value) {
        return typeof value === "function";
      }
      function isStyleElement(value) {
        return value instanceof Element && typeof readProperty(value, "style") === "object";
      }
      function isStyleDatasetElement(value) {
        return value instanceof Element && typeof readProperty(value, "dataset") === "object" && typeof readProperty(value, "style") === "object";
      }
      function createJukeboxKeyboardFocusController(options) {
        let tabFocusHooksInstalled = false;
        function setJukeboxBottom(jukebox, bottom) {
          if (isStyleElement(jukebox)) {
            jukebox.style.bottom = bottom;
          }
        }
        function openJukeboxFromKeyboardFocus(jukebox) {
          if (!options.isAudioEnabled() || !jukebox) {
            return;
          }
          options.resetBrowserScroll();
          setJukeboxBottom(jukebox, "0px");
          const onMouseEnter = readProperty(jukebox, "onmouseenter");
          if (isNativeCallable4(onMouseEnter)) {
            Reflect.apply(onMouseEnter, jukebox, []);
          } else {
            setJukeboxBottom(jukebox, "0px");
          }
          options.scheduleUiWork({ force: true, passes: options.resizeSettlePasses });
        }
        function closeJukeboxFromKeyboardFocus(jukebox, nextFocusTarget) {
          if (!options.isAudioEnabled() || !jukebox || nextFocusTarget instanceof Element && jukebox.contains(nextFocusTarget) || jukebox.matches(":hover")) {
            return;
          }
          const onMouseLeave = readProperty(jukebox, "onmouseleave");
          if (isNativeCallable4(onMouseLeave)) {
            Reflect.apply(onMouseLeave, jukebox, []);
          } else {
            setJukeboxBottom(jukebox, "-50px");
          }
        }
        function focusJukeboxKnobFromTab(knob) {
          if (!options.isAudioEnabled()) {
            return false;
          }
          const jukebox = knob?.closest(".jukebox") || null;
          if (!jukebox) {
            return false;
          }
          openJukeboxFromKeyboardFocus(jukebox);
          focusElementWithoutScroll(knob);
          options.resetBrowserScroll();
          return true;
        }
        function isGameplayTabFocusContext(target, knob) {
          const activeCanvas = options.getActiveRenderCanvas();
          return target === window || target === document || target === document.body || target === document.documentElement || target === activeCanvas || target === knob;
        }
        function handleGameplayTabFocus(event) {
          if (!options.isAudioEnabled() || !isTabKey(event) || event.altKey || event.ctrlKey || event.metaKey || options.isChatInput(event.target) || options.getActiveRenderMode() !== "gameplay") {
            return;
          }
          const knob = options.findJukeboxKnob();
          const jukebox = knob?.closest(".jukebox") || null;
          if (!knob || !jukebox || !isElementVisible(jukebox) || !isGameplayTabFocusContext(event.target, knob)) {
            return;
          }
          event.preventDefault();
          if (document.activeElement === knob) {
            options.focusActiveRenderCanvas();
            closeJukeboxFromKeyboardFocus(jukebox, document.activeElement);
            return;
          }
          focusJukeboxKnobFromTab(knob);
        }
        function installTabFocusHooks() {
          if (tabFocusHooksInstalled) {
            return;
          }
          tabFocusHooksInstalled = true;
          window.addEventListener("keydown", handleGameplayTabFocus, true);
        }
        function patchJukeboxKeyboardFocus(knob) {
          if (!options.isAudioEnabled()) {
            return;
          }
          const jukebox = knob?.closest(".jukebox") || null;
          if (!isStyleDatasetElement(jukebox) || jukebox.dataset.qolboxKeyboardFocusPatched) {
            return;
          }
          jukebox.dataset.qolboxKeyboardFocusPatched = "true";
          jukebox.addEventListener("focusin", () => openJukeboxFromKeyboardFocus(jukebox), true);
          jukebox.addEventListener(
            "focusout",
            (event) => closeJukeboxFromKeyboardFocus(jukebox, readProperty(event, "relatedTarget")),
            true
          );
        }
        return {
          handleGameplayTabFocus,
          installTabFocusHooks,
          patchJukeboxKeyboardFocus
        };
      }

      // src/features/jukebox-knob-interaction.ts
      function createJukeboxKnobInteractionController(options) {
        let activeKnobDrag = null;
        function isKnobDragActive() {
          return Boolean(activeKnobDrag);
        }
        function getKnobPercentFromPointer(event) {
          if (!activeKnobDrag) {
            return DEFAULT_JUKEBOX_PERCENT;
          }
          const deltaY = activeKnobDrag.startY - readJukeboxNumberProperty(event, "clientY");
          return clampJukeboxPercent(activeKnobDrag.startPercent + deltaY * options.dragSensitivity);
        }
        function onKnobPointerMove(event) {
          if (!options.isAudioEnabled() || !activeKnobDrag) {
            return;
          }
          event.preventDefault();
          options.setJukeboxPercent(getKnobPercentFromPointer(event));
        }
        function endKnobDrag() {
          activeKnobDrag = null;
        }
        function patchGlobalKnobListeners() {
          if (readJukeboxBooleanProperty(window, "__qolboxJukeboxGlobalsPatched")) {
            return;
          }
          setJukeboxProperty(window, "__qolboxJukeboxGlobalsPatched", true);
          window.addEventListener("pointermove", onKnobPointerMove, true);
          window.addEventListener("mousemove", onKnobPointerMove, true);
          window.addEventListener("pointerup", endKnobDrag, true);
          window.addEventListener("mouseup", endKnobDrag, true);
          window.addEventListener("blur", endKnobDrag, true);
        }
        function patchJukeboxKnobInteraction(knob) {
          patchGlobalKnobListeners();
          if (knob.dataset.qolboxJukeboxPatched) {
            return;
          }
          knob.dataset.qolboxJukeboxPatched = "true";
          knob.setAttribute("title", "Scroll, drag, or use arrow keys to adjust the jukebox volume");
          knob.style.touchAction = "none";
          knob.addEventListener(
            "pointerdown",
            (event) => {
              if (!options.isAudioEnabled()) {
                return;
              }
              event.preventDefault();
              event.stopPropagation();
              focusElementWithoutScroll(knob);
              requestJukeboxPointerCapture(knob, event);
              if (options.unmuteJukeboxIfMuted()) {
                options.updateJukeboxMenuItem();
                options.applyJukeboxState();
              }
              activeKnobDrag = {
                startY: readJukeboxNumberProperty(event, "clientY"),
                startPercent: options.getJukeboxPercent() ?? DEFAULT_JUKEBOX_PERCENT
              };
              onKnobPointerMove(event);
            },
            true
          );
          knob.addEventListener(
            "wheel",
            (event) => {
              if (!options.isAudioEnabled()) {
                return;
              }
              event.preventDefault();
              event.stopPropagation();
              focusElementWithoutScroll(knob);
              options.ensureJukeboxPercent(knob);
              const currentPercent = options.isJukeboxMuted() ? 0 : options.getJukeboxPercent();
              options.setJukeboxPercent(
                (currentPercent ?? DEFAULT_JUKEBOX_PERCENT) + (readJukeboxNumberProperty(event, "deltaY") < 0 ? options.wheelStep : -options.wheelStep)
              );
            },
            { passive: false }
          );
          knob.addEventListener(
            "keydown",
            (event) => {
              if (!options.isAudioEnabled()) {
                return;
              }
              const currentPercent = options.isJukeboxMuted() ? 0 : options.getEffectiveJukeboxPercent();
              const nextPercent = getKeyboardPercentTarget(event, currentPercent, options.wheelStep);
              if (nextPercent === null) {
                return;
              }
              event.preventDefault();
              event.stopPropagation();
              options.ensureJukeboxPercent(knob);
              options.setJukeboxPercent(nextPercent);
            },
            true
          );
        }
        return {
          isKnobDragActive,
          patchJukeboxKnobInteraction
        };
      }

      // src/features/jukebox-menu-control.ts
      function createJukeboxMenuController(options) {
        let currentJukeboxMenuItem = null;
        function updateJukeboxMenuItem() {
          if (!currentJukeboxMenuItem || !currentJukeboxMenuItem.isConnected) {
            return;
          }
          currentJukeboxMenuItem.textContent = options.getLabel();
          currentJukeboxMenuItem.setAttribute("title", "Remember the lobby radio mute state");
        }
        function patchJukeboxMenu() {
          if (!options.isAudioEnabled()) {
            return false;
          }
          const container = options.findSettingsContainer();
          if (!container) {
            return false;
          }
          let item = container.querySelector('.item[data-qolbox-jukebox-menu="true"]');
          if (!item) {
            const createdItem = document.createElement("div");
            createdItem.className = "item";
            createdItem.dataset.qolboxJukeboxMenu = "true";
            createdItem.addEventListener(
              "click",
              (event) => {
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
        function removeJukeboxMenuItem() {
          if (currentJukeboxMenuItem && currentJukeboxMenuItem.isConnected) {
            currentJukeboxMenuItem.remove();
          }
          currentJukeboxMenuItem = null;
        }
        return {
          patchJukeboxMenu,
          removeJukeboxMenuItem,
          updateJukeboxMenuItem
        };
      }

      // src/features/jukebox-knob-view.ts
      function isStyleElement2(value) {
        return value instanceof Element && typeof readObjectProperty(value, "style") === "object";
      }
      function findJukeboxKnob() {
        return document.querySelector(".jukebox .knob.volumeContainer");
      }
      function readJukeboxPercentFromKnob(knob) {
        const bar = knob ? knob.querySelector(".barSVG") : null;
        if (!isStyleElement2(bar)) {
          return null;
        }
        const inlineAngle = parseJukeboxAngleFromTransform(bar.style.transform);
        if (inlineAngle !== null) {
          return angleToJukeboxPercent(inlineAngle);
        }
        const computedAngle = parseJukeboxAngleFromTransform(window.getComputedStyle(bar).transform);
        if (computedAngle !== null) {
          return angleToJukeboxPercent(computedAngle);
        }
        return null;
      }
      function updateJukeboxKnobAccessibility(knob, visualPercent, state) {
        if (!knob) {
          return;
        }
        const effectivePercent = state.muted ? 0 : clampJukeboxPercent(visualPercent ?? state.percent ?? DEFAULT_JUKEBOX_PERCENT);
        knob.setAttribute("aria-label", "Jukebox volume");
        knob.setAttribute("aria-orientation", "vertical");
        knob.setAttribute("aria-valuemin", "0");
        knob.setAttribute("aria-valuemax", "100");
        knob.setAttribute("aria-valuenow", String(effectivePercent));
        knob.setAttribute("aria-valuetext", state.muted ? `Muted (${effectivePercent}%)` : `${effectivePercent}%`);
        knob.setAttribute("role", "slider");
        keepInBrowserTabOrder(knob);
      }
      function setJukeboxKnobVisual(knob, visualPercent, state) {
        if (!knob) {
          return;
        }
        const angle = percentToJukeboxAngle(visualPercent ?? DEFAULT_JUKEBOX_PERCENT);
        const bar = knob.querySelector(".barSVG");
        const arcPath = knob.querySelector(".arcSVG path");
        if (isStyleElement2(bar)) {
          bar.style.transform = `rotate(${angle}deg)`;
        }
        if (arcPath) {
          const startPoint = polarToArcPoint(JUKEBOX_MIN_ANGLE);
          const endPoint = polarToArcPoint(angle);
          const sweepDegrees = Math.max(0, angle - JUKEBOX_MIN_ANGLE);
          const largeArcFlag = sweepDegrees > 180 ? 1 : 0;
          arcPath.setAttribute(
            "d",
            `M ${startPoint.x} ${startPoint.y} A ${JUKEBOX_ARC_RADIUS} ${JUKEBOX_ARC_RADIUS} 0 ${largeArcFlag} 1 ${endPoint.x} ${endPoint.y}`
          );
        }
        updateJukeboxKnobAccessibility(knob, visualPercent, state);
      }
      function clearJukeboxKnobAccessibility(knob) {
        if (!knob) {
          return;
        }
        knob.removeAttribute("aria-label");
        knob.removeAttribute("aria-orientation");
        knob.removeAttribute("aria-valuemin");
        knob.removeAttribute("aria-valuemax");
        knob.removeAttribute("aria-valuenow");
        knob.removeAttribute("aria-valuetext");
        knob.removeAttribute("role");
        if (knob.getAttribute("tabindex") === "0") {
          knob.removeAttribute("tabindex");
        }
      }

      // src/features/jukebox-state.ts
      function createJukeboxStateController() {
        let state = loadJukeboxState();
        function persistState() {
          saveJukeboxState(state);
        }
        function getEffectivePercent() {
          return clampJukeboxPercent(state.percent ?? DEFAULT_JUKEBOX_PERCENT);
        }
        function ensurePercent(readPercent) {
          if (state.percent !== null) {
            return;
          }
          state.percent = readPercent() ?? DEFAULT_JUKEBOX_PERCENT;
          persistState();
        }
        function setPercent(nextPercent) {
          state.percent = clampJukeboxPercent(nextPercent);
          state.muted = false;
          persistState();
        }
        function toggleMuted() {
          state.muted = !state.muted;
          persistState();
        }
        function unmuteIfMuted() {
          if (!state.muted) {
            return false;
          }
          state.muted = false;
          persistState();
          return true;
        }
        function setState(nextState) {
          state = {
            muted: Boolean(nextState.muted),
            percent: nextState.percent ?? null
          };
        }
        function getState() {
          return state;
        }
        function getPercent() {
          return state.percent;
        }
        function isMuted() {
          return state.muted;
        }
        function getMenuLabel() {
          return state.muted ? "Unmute Jukebox" : "Mute Jukebox";
        }
        return {
          ensurePercent,
          getEffectivePercent,
          getMenuLabel,
          getPercent,
          getState,
          isMuted,
          setPercent,
          setState,
          toggleMuted,
          unmuteIfMuted
        };
      }

      // src/features/jukebox-control.ts
      function createJukeboxController(options) {
        const jukeboxState = createJukeboxStateController();
        const youTubeAdapter = createYouTubeJukeboxAdapter({
          getVolume: () => percentToJukeboxVolume(getEffectiveJukeboxPercent()),
          isEnabled: options.isAudioEnabled,
          isMuted: () => jukeboxState.isMuted(),
          maxRetries: options.youTubeHookMaxRetries,
          onPlayerStateNeeded: () => applyJukeboxState(),
          retryDelayMs: options.youTubeHookRetryDelayMs
        });
        const keyboardFocus = createJukeboxKeyboardFocusController({
          resizeSettlePasses: options.resizeSettlePasses,
          findJukeboxKnob,
          focusActiveRenderCanvas: options.focusActiveRenderCanvas,
          getActiveRenderCanvas: options.getActiveRenderCanvas,
          getActiveRenderMode: options.getActiveRenderMode,
          isAudioEnabled: options.isAudioEnabled,
          isChatInput: options.isChatInput,
          resetBrowserScroll: options.resetBrowserScroll,
          scheduleUiWork: options.scheduleUiWork
        });
        const menuController = createJukeboxMenuController({
          findChangeControlsItem: options.findChangeControlsItem,
          findSettingsContainer: options.findSettingsContainer,
          getLabel: getJukeboxMenuLabel,
          isAudioEnabled: options.isAudioEnabled,
          onToggleMute: toggleJukeboxMute
        });
        const knobInteraction = createJukeboxKnobInteractionController({
          dragSensitivity: options.jukeboxDragSensitivity,
          wheelStep: options.jukeboxWheelStep,
          applyJukeboxState,
          ensureJukeboxPercent,
          getEffectiveJukeboxPercent,
          getJukeboxPercent: () => jukeboxState.getPercent(),
          isAudioEnabled: options.isAudioEnabled,
          isJukeboxMuted: () => jukeboxState.isMuted(),
          setJukeboxPercent,
          unmuteJukeboxIfMuted: () => jukeboxState.unmuteIfMuted(),
          updateJukeboxMenuItem
        });
        function installTabFocusHooks() {
          keyboardFocus.installTabFocusHooks();
        }
        function patchJukeboxKeyboardFocus(knob) {
          keyboardFocus.patchJukeboxKeyboardFocus(knob);
        }
        function getJukeboxMenuLabel() {
          return jukeboxState.getMenuLabel();
        }
        function updateJukeboxMenuItem() {
          menuController.updateJukeboxMenuItem();
        }
        function patchJukeboxMenu() {
          return menuController.patchJukeboxMenu();
        }
        function getEffectiveJukeboxPercent() {
          return jukeboxState.getEffectivePercent();
        }
        function ensureJukeboxPercent(knob) {
          if (!knob) {
            return;
          }
          jukeboxState.ensurePercent(() => readJukeboxPercentFromKnob(knob));
        }
        function applyJukeboxStateToKnob(knob) {
          if (!options.isAudioEnabled() || !knob || knobInteraction.isKnobDragActive()) {
            return;
          }
          ensureJukeboxPercent(knob);
          setJukeboxKnobVisual(knob, jukeboxState.isMuted() ? 0 : jukeboxState.getPercent(), jukeboxState.getState());
        }
        function applyJukeboxState() {
          if (!options.isAudioEnabled()) {
            return;
          }
          const knob = findJukeboxKnob();
          applyJukeboxStateToKnob(knob);
          ensureJukeboxPercent(knob);
          youTubeAdapter.applyToTrackedPlayers();
        }
        function installYouTubeReadyCallbackHook() {
          youTubeAdapter.installReadyCallbackHook();
        }
        function hookYouTubePlayer() {
          return youTubeAdapter.hookPlayerConstructor();
        }
        function setJukeboxPercent(nextPercent) {
          if (!options.isAudioEnabled()) {
            return;
          }
          jukeboxState.setPercent(nextPercent);
          updateJukeboxMenuItem();
          setJukeboxKnobVisual(findJukeboxKnob(), jukeboxState.getPercent(), jukeboxState.getState());
          applyJukeboxState();
        }
        function toggleJukeboxMute() {
          if (!options.isAudioEnabled()) {
            return;
          }
          ensureJukeboxPercent(findJukeboxKnob());
          jukeboxState.toggleMuted();
          updateJukeboxMenuItem();
          applyJukeboxState();
        }
        function patchJukeboxKnob() {
          if (!options.isAudioEnabled()) {
            return false;
          }
          const knob = findJukeboxKnob();
          if (!isJukeboxStyleDatasetElement(knob)) {
            return false;
          }
          ensureJukeboxPercent(knob);
          applyJukeboxStateToKnob(knob);
          patchJukeboxKeyboardFocus(knob);
          knobInteraction.patchJukeboxKnobInteraction(knob);
          return true;
        }
        function removeJukeboxMenuItem() {
          menuController.removeJukeboxMenuItem();
        }
        function restoreJukeboxState() {
          const knob = findJukeboxKnob();
          const nativePercent = readJukeboxPercentFromKnob(knob);
          const restorePercent = jukeboxState.isMuted() && nativePercent === 0 ? getEffectiveJukeboxPercent() : nativePercent ?? getEffectiveJukeboxPercent();
          clearJukeboxKnobAccessibility(knob);
          youTubeAdapter.restoreTrackedPlayers(percentToJukeboxVolume(restorePercent));
        }
        function setJukeboxState(nextState) {
          jukeboxState.setState(nextState);
        }
        return {
          applyJukeboxState,
          findJukeboxKnob,
          getEffectiveJukeboxPercent,
          handleGameplayTabFocus: keyboardFocus.handleGameplayTabFocus,
          hookYouTubePlayer,
          installTabFocusHooks,
          installYouTubeReadyCallbackHook,
          patchJukeboxKeyboardFocus,
          patchJukeboxKnob,
          patchJukeboxMenu,
          removeJukeboxMenuItem,
          restoreJukeboxState,
          setJukeboxState
        };
      }

      // src/hitbox/lobby-music-adapter.ts
      function isNativeCallable5(value) {
        return typeof value === "function";
      }
      function getNativeLobbyMusicController() {
        const game = readNativeReflectProperty(window, "a8");
        const controller = readNativeReflectProperty(game, "cR");
        return isNativeReflectTarget(controller) ? controller : null;
      }
      function stopNativeLobbyMusic(controller = getNativeLobbyMusicController()) {
        const stop = readNativeReflectProperty(controller, "stop");
        if (!isNativeCallable5(stop)) {
          return false;
        }
        try {
          Reflect.apply(stop, controller, []);
          return true;
        } catch {
          return false;
        }
      }
      function patchNativeLobbyMusicStart(shouldAllowStart, forcePatch = false) {
        const controller = getNativeLobbyMusicController();
        const start = readNativeReflectProperty(controller, "start");
        if (!isNativeCallable5(start)) {
          return false;
        }
        if (!forcePatch && readNativeReflectProperty(start, "__qolboxWrapped") === true) {
          return true;
        }
        const originalStart = start;
        const wrappedStart = function wrappedLobbyMusicStart(...args) {
          if (shouldAllowStart()) {
            return Reflect.apply(originalStart, this, args);
          }
          stopNativeLobbyMusic(this);
          return void 0;
        };
        setNativeReflectProperty(wrappedStart, "__qolboxWrapped", true);
        setNativeReflectProperty(wrappedStart, "__qolboxOriginal", originalStart);
        return setNativeReflectProperty(controller, "start", wrappedStart);
      }

      // src/features/lobby-music-control.ts
      function createLobbyMusicController(options) {
        let lobbyMusicPatchInstalled = false;
        function isLobbyMusicAllowed() {
          return !options.isAudioEnabled() || !hasVisibleLayer(options.playLayerSelector);
        }
        function stopLobbyMusicIfNeeded() {
          if (!options.isAudioEnabled() || isLobbyMusicAllowed()) {
            return;
          }
          stopNativeLobbyMusic();
        }
        function patchLobbyMusicController() {
          if (!options.isAudioEnabled() && !lobbyMusicPatchInstalled) {
            return false;
          }
          if (!patchNativeLobbyMusicStart(isLobbyMusicAllowed, !lobbyMusicPatchInstalled)) {
            return false;
          }
          lobbyMusicPatchInstalled = true;
          stopLobbyMusicIfNeeded();
          return true;
        }
        return {
          patchLobbyMusicController,
          stopLobbyMusicIfNeeded
        };
      }

      // src/features/audio-feature-bundle.ts
      function createAudioFeatureBundle(options) {
        const gameVolume = createGameVolumeController({
          isAudioEnabled: options.isAudioEnabled,
          isReserveRetryAudioSuppressed: options.isReserveRetryAudioSuppressed
        });
        const jukebox = createJukeboxController({
          jukeboxDragSensitivity: JUKEBOX_DRAG_SENSITIVITY,
          jukeboxWheelStep: JUKEBOX_WHEEL_STEP,
          resizeSettlePasses: RESIZE_SETTLE_PASSES,
          youTubeHookMaxRetries: YOUTUBE_HOOK_MAX_RETRIES,
          youTubeHookRetryDelayMs: YOUTUBE_HOOK_RETRY_DELAY_MS,
          findChangeControlsItem,
          findSettingsContainer,
          focusActiveRenderCanvas: options.focusActiveRenderCanvas,
          getActiveRenderCanvas: options.getActiveRenderCanvas,
          getActiveRenderMode: options.getActiveRenderMode,
          isAudioEnabled: options.isAudioEnabled,
          isChatInput: options.isChatInput,
          resetBrowserScroll: options.resetBrowserScroll,
          scheduleUiWork: options.scheduleUiWork
        });
        const lobbyMusic = createLobbyMusicController({
          playLayerSelector: FULLSCREEN_PLAY_LAYER_SELECTOR,
          isAudioEnabled: options.isAudioEnabled
        });
        return {
          ...gameVolume,
          ...jukebox,
          ...lobbyMusic
        };
      }

      // src/hitbox/editor-map-adapter.ts
      var EDITOR_MAP_STATE_PATH = ["multiplayerSession", "TJ", "JD", "tP"];
      var EDITOR_FILE_MENU_SELECTOR = "#editorContainer .fileMenu";
      var EDITOR_MENU_ITEM_SELECTOR = ".item";
      function getEditorMapState() {
        const maps = readNativePath(window, EDITOR_MAP_STATE_PATH);
        if (!Array.isArray(maps)) {
          return null;
        }
        return readNativeProperty(maps[0], "state") || null;
      }
      function isNativeFunction(value) {
        return typeof value === "function";
      }
      function callMapExport(mapState) {
        try {
          const { called, result } = callNativeMethod(mapState, "rc");
          if (!called || typeof result !== "string") {
            return null;
          }
          const mapData = result.trim();
          return mapData ? mapData : null;
        } catch {
          return null;
        }
      }
      function getNativeEditorFileItem(label) {
        const fileMenu = document.querySelector(EDITOR_FILE_MENU_SELECTOR);
        if (!(fileMenu instanceof HTMLElement)) {
          return null;
        }
        return Array.from(fileMenu.querySelectorAll(EDITOR_MENU_ITEM_SELECTOR)).find((item) => item instanceof HTMLElement && item.textContent?.trim() === label) || null;
      }
      function replaceNativeMethod(target, methodName, replacement) {
        if (!isNativeReflectTarget(target)) {
          return null;
        }
        const original = readNativeProperty(target, methodName);
        if (!isNativeFunction(original) || !setNativeReflectProperty(target, methodName, replacement)) {
          return null;
        }
        return () => {
          setNativeReflectProperty(target, methodName, original);
        };
      }
      function getCapturedMapState(candidate) {
        if (!isNativeObject(candidate)) {
          return null;
        }
        const state = readNativeProperty(candidate, "state");
        return isNativeObject(state) ? state : null;
      }
      function exportCurrentEditorMapViaNativePlayClone() {
        const playItem = getNativeEditorFileItem("Play");
        const session = readNativeProperty(window, "multiplayerSession");
        const lobbyState = readNativePath(window, ["multiplayerSession", "JD"]);
        if (!(playItem instanceof HTMLElement) || !isNativeReflectTarget(session) || !isNativeReflectTarget(lobbyState)) {
          return null;
        }
        let capturedMapState = null;
        const captureMap = (candidate) => {
          capturedMapState = getCapturedMapState(candidate) || capturedMapState;
        };
        const restores = [
          replaceNativeMethod(lobbyState, "tU", (maps) => {
            if (Array.isArray(maps)) {
              captureMap(maps[0]);
            }
          }),
          replaceNativeMethod(lobbyState, "sU", (map) => {
            captureMap(map);
          }),
          replaceNativeMethod(session, "_J", () => void 0)
        ].filter((restore) => typeof restore === "function");
        if (!restores.length) {
          return null;
        }
        try {
          playItem.click();
          return callMapExport(capturedMapState);
        } catch {
          return null;
        } finally {
          for (const restore of restores.reverse()) {
            try {
              restore();
            } catch {
            }
          }
        }
      }
      function refreshEditorAfterMapImport() {
        try {
          const editorController = readNativePath(window, ["multiplayerSession", "TJ"]);
          callNativeMethod(editorController, "gW");
        } catch {
        }
        try {
          window.dispatchEvent(new Event("resize"));
        } catch {
        }
      }
      function exportEditorMapData() {
        return exportCurrentEditorMapViaNativePlayClone() || callMapExport(getEditorMapState());
      }
      function importEditorMapData(mapData) {
        const trimmedMapData = mapData.trim();
        if (!trimmedMapData) {
          return false;
        }
        try {
          const { called } = callNativeMethod(getEditorMapState(), "ac", [trimmedMapData]);
          if (!called) {
            return false;
          }
          refreshEditorAfterMapImport();
          return true;
        } catch {
          return false;
        }
      }

      // src/features/editor-map-file-transfer.ts
      var EDITOR_FILE_MENU_SELECTOR2 = ".fileMenu";
      var EDITOR_MENU_ITEM_SELECTOR2 = ".item";
      var EDITOR_TRANSFER_ITEM_SELECTOR = "[data-qolbox-editor-map-transfer]";
      var EDITOR_MAP_FILE_INPUT_ID = "qolboxEditorMapFileInput";
      var EDITOR_MAP_STATUS_ID = "qolboxEditorMapStatus";
      var EDITOR_MAP_FILE_EXTENSION = "hitboxmap";
      var STATUS_HIDE_DELAY_MS = 2400;
      function getMenuItems(fileMenu) {
        return Array.from(fileMenu.querySelectorAll(EDITOR_MENU_ITEM_SELECTOR2)).filter(
          (child) => child instanceof HTMLElement
        );
      }
      function findMenuItem(fileMenu, label) {
        return getMenuItems(fileMenu).find((item) => item.textContent?.trim() === label) || null;
      }
      function getDownloadTimestamp() {
        const now = /* @__PURE__ */ new Date();
        const pad = (value) => String(value).padStart(2, "0");
        return [
          now.getFullYear(),
          pad(now.getMonth() + 1),
          pad(now.getDate()),
          "-",
          pad(now.getHours()),
          pad(now.getMinutes()),
          pad(now.getSeconds())
        ].join("");
      }
      function createEditorMapMenuItem(label, action, handler) {
        const item = document.createElement("div");
        item.className = "item";
        item.textContent = label;
        item.setAttribute("data-qolbox-editor-map-transfer", action);
        item.addEventListener(
          "click",
          (event) => {
            event.preventDefault();
            event.stopPropagation();
            handler();
          },
          true
        );
        return item;
      }
      function isStringRecord(value) {
        return typeof value === "object" && value !== null;
      }
      function extractMapDataFromParsedJson(value) {
        if (typeof value === "string") {
          return value.trim() || null;
        }
        if (!isStringRecord(value)) {
          return null;
        }
        for (const key of ["leveldata", "levelData", "map", "mapData", "data"]) {
          const mapData = value[key];
          if (typeof mapData === "string" && mapData.trim()) {
            return mapData.trim();
          }
        }
        return null;
      }
      function extractMapDataFromFileText(fileText) {
        const trimmedText = fileText.trim();
        if (!trimmedText) {
          return null;
        }
        try {
          const jsonMapData = extractMapDataFromParsedJson(JSON.parse(trimmedText));
          if (jsonMapData) {
            return jsonMapData;
          }
        } catch {
        }
        return trimmedText;
      }
      function createEditorMapFileTransferController(options) {
        let statusHideTimer = 0;
        let documentHooksInstalled = false;
        function getStatusElement() {
          let status = document.getElementById(EDITOR_MAP_STATUS_ID);
          if (status instanceof HTMLElement) {
            return status;
          }
          const host = document.body || document.documentElement;
          if (!host) {
            return null;
          }
          status = document.createElement("div");
          status.id = EDITOR_MAP_STATUS_ID;
          status.className = "qolboxEditorMapStatus";
          host.appendChild(status);
          return status;
        }
        function showStatus(message, kind = "success") {
          const status = getStatusElement();
          if (!status) {
            return;
          }
          window.clearTimeout(statusHideTimer);
          status.textContent = message;
          status.classList.toggle("error", kind === "error");
          status.classList.add("visible");
          statusHideTimer = window.setTimeout(() => {
            status.classList.remove("visible");
          }, STATUS_HIDE_DELAY_MS);
        }
        function getFileInput() {
          const existingInput = document.getElementById(EDITOR_MAP_FILE_INPUT_ID);
          if (existingInput instanceof HTMLInputElement) {
            return existingInput;
          }
          const host = document.body || document.documentElement;
          if (!host) {
            return null;
          }
          const input = document.createElement("input");
          input.id = EDITOR_MAP_FILE_INPUT_ID;
          input.type = "file";
          input.accept = `.${EDITOR_MAP_FILE_EXTENSION},.txt,.json,application/json,text/plain`;
          input.style.display = "none";
          input.addEventListener("change", () => {
            const file = input.files?.[0] || null;
            input.value = "";
            if (file) {
              void importMapFile(file);
            }
          });
          host.appendChild(input);
          return input;
        }
        function exportCurrentEditorMap() {
          const mapData = exportEditorMapData();
          if (!mapData) {
            showStatus("No editor map is available to export.", "error");
            return;
          }
          try {
            const blob = new Blob([mapData], { type: "text/plain;charset=utf-8" });
            const objectUrl = URL.createObjectURL(blob);
            const anchor = document.createElement("a");
            anchor.href = objectUrl;
            anchor.download = `hitbox-map-${getDownloadTimestamp()}.${EDITOR_MAP_FILE_EXTENSION}`;
            anchor.style.display = "none";
            (document.body || document.documentElement).appendChild(anchor);
            anchor.click();
            anchor.remove();
            window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
            showStatus("Map export started.");
          } catch {
            showStatus("Could not export this map.", "error");
          }
        }
        function requestMapImport() {
          const input = getFileInput();
          if (!input) {
            showStatus("Could not open the file picker.", "error");
            return;
          }
          input.click();
        }
        async function importMapFile(file) {
          try {
            const mapData = extractMapDataFromFileText(await file.text());
            if (!mapData || !importEditorMapData(mapData)) {
              showStatus("Could not import this map file.", "error");
              return;
            }
            showStatus("Map imported.");
          } catch {
            showStatus("Could not import this map file.", "error");
          }
        }
        function removeTransferItems(fileMenu = document.documentElement) {
          fileMenu.querySelectorAll(EDITOR_TRANSFER_ITEM_SELECTOR).forEach((item) => item.remove());
        }
        function syncOpenFileMenu(fileMenu) {
          if (!options.isEditorMapTransferEnabled()) {
            removeTransferItems(fileMenu);
            return false;
          }
          const loadItem = findMenuItem(fileMenu, "Load");
          const dropdownContainer = loadItem?.parentElement || null;
          if (!loadItem || !dropdownContainer) {
            return false;
          }
          if (dropdownContainer.querySelector(EDITOR_TRANSFER_ITEM_SELECTOR)) {
            return false;
          }
          const exportItem = createEditorMapMenuItem("Export", "export", exportCurrentEditorMap);
          const importItem = createEditorMapMenuItem("Import", "import", requestMapImport);
          dropdownContainer.insertBefore(exportItem, loadItem);
          dropdownContainer.insertBefore(importItem, loadItem);
          return true;
        }
        function getEventFileMenu(event) {
          return event.target instanceof Element ? event.target.closest(EDITOR_FILE_MENU_SELECTOR2) : null;
        }
        function installDocumentHooks() {
          if (documentHooksInstalled) {
            return false;
          }
          documentHooksInstalled = true;
          document.addEventListener(
            "click",
            (event) => {
              const clickedFileMenu = getEventFileMenu(event);
              const hadTransferItems = Boolean(clickedFileMenu?.querySelector(EDITOR_TRANSFER_ITEM_SELECTOR));
              window.setTimeout(() => {
                if (!clickedFileMenu) {
                  removeTransferItems();
                  return;
                }
                if (hadTransferItems) {
                  removeTransferItems(clickedFileMenu);
                  return;
                }
                syncOpenFileMenu(clickedFileMenu);
              }, 0);
            },
            true
          );
          document.addEventListener("keydown", (event) => {
            if (event.key === "Escape") {
              removeTransferItems();
            }
          }, true);
          return true;
        }
        function removeEditorMapFileTransfer() {
          window.clearTimeout(statusHideTimer);
          removeTransferItems();
          document.getElementById(EDITOR_MAP_FILE_INPUT_ID)?.remove();
          document.getElementById(EDITOR_MAP_STATUS_ID)?.remove();
        }
        function patchEditorMapFileTransfer() {
          if (!options.isEditorMapTransferEnabled()) {
            removeEditorMapFileTransfer();
            return false;
          }
          return installDocumentHooks();
        }
        return {
          patchEditorMapFileTransfer,
          removeEditorMapFileTransfer
        };
      }

      // src/features/feature-side-effects.ts
      function createFeatureSideEffectsController(options) {
        function disableFeatureSideEffects(featureKey) {
          switch (featureKey) {
            case FEATURE_RESERVE:
              options.stopReserveSpot({ hideNative: false });
              options.clearReservePasswordPromptPending();
              options.syncReserveJoinButtonLabel();
              break;
            case FEATURE_GAME_START_ALERT:
              options.disableGameStartAlerts();
              break;
            case FEATURE_AUDIO:
              options.removeJukeboxMenuItem();
              options.restoreJukeboxState();
              options.applyGameVolume();
              break;
            case FEATURE_FULLSCREEN:
              options.clearFullscreenLayoutStyles();
              if (options.featureGates.isChatEnabled()) {
                options.syncScoreRows();
                options.syncTypingIndicators();
              }
              break;
            case FEATURE_EDITOR_MAP_TRANSFER:
              options.removeEditorMapFileTransfer();
              break;
            case FEATURE_MOBILE_GRAB:
              options.removeMobileGrabButton();
              break;
            case FEATURE_CHAT:
              options.cleanupInGameChatScroll();
              options.clearTypingIndicators();
              options.restoreChatTabOrder();
              break;
            case FEATURE_LOBBY_COMMANDS:
              options.removeSwitchTeamsButton();
              break;
            default:
              break;
          }
        }
        function applyPersistentFeatures() {
          options.applyFeatureRootClasses();
          options.installPlayerPopupDismissal();
          options.patchSlashCommands();
          options.patchLobbyBlacklist();
          options.patchSwitchTeamsButton();
          options.patchMobileQolboxHamburgerEntry();
          if (options.featureGates.isReserveEnabled()) {
            options.patchReserveSpotFeature();
          } else {
            options.syncReserveJoinButtonLabel();
          }
          if (options.featureGates.isGameStartAlertEnabled()) {
            options.installGameStartIndicatorHooks();
            options.updateGameStartIndicator();
          } else {
            disableFeatureSideEffects(FEATURE_GAME_START_ALERT);
          }
          if (options.featureGates.isChatEnabled()) {
            options.patchChatTabOrder();
            options.patchInGameChatScroll();
            options.patchTypingIndicatorHooks();
            options.syncScoreRows();
            options.syncTypingIndicators();
          } else {
            disableFeatureSideEffects(FEATURE_CHAT);
          }
          if (options.featureGates.isMobileGrabEnabled()) {
            options.patchMobileGrabButton();
          } else {
            disableFeatureSideEffects(FEATURE_MOBILE_GRAB);
          }
          if (options.featureGates.isEditorMapTransferEnabled()) {
            options.patchEditorMapFileTransfer();
          } else {
            disableFeatureSideEffects(FEATURE_EDITOR_MAP_TRANSFER);
          }
          if (options.featureGates.isAudioEnabled()) {
            options.installTabFocusHooks();
            options.hookHowlPrototype();
            options.patchLobbyMusicController();
            options.patchGameVolumeMenu();
            options.installYouTubeReadyCallbackHook();
            options.hookYouTubePlayer();
            options.patchJukeboxMenu();
            options.patchJukeboxKnob();
            options.applyJukeboxState();
          } else {
            disableFeatureSideEffects(FEATURE_AUDIO);
          }
        }
        return {
          applyPersistentFeatures,
          disableFeatureSideEffects
        };
      }

      // src/hitbox/fullscreen-metric-overrides.ts
      var METRIC_NAMES = ["_P", "Qp", "lg", "ug"];
      function isFullscreenDimensions(value) {
        return isNativeObject(value) && typeof readNativeProperty(value, "scale") === "number" && typeof readNativeProperty(value, "width") === "number" && typeof readNativeProperty(value, "height") === "number";
      }
      function createMetricOriginals(game) {
        return {
          _P: { descriptor: Object.getOwnPropertyDescriptor(game, "_P") || null },
          Qp: { descriptor: Object.getOwnPropertyDescriptor(game, "Qp") || null },
          lg: { descriptor: Object.getOwnPropertyDescriptor(game, "lg") || null },
          ug: { descriptor: Object.getOwnPropertyDescriptor(game, "ug") || null }
        };
      }
      function makeMetricAccessor(getter) {
        return {
          configurable: true,
          enumerable: true,
          get: getter,
          set: () => {
          }
        };
      }
      function createFullscreenMetricOverrideController(options) {
        function getPinnedFullscreenDimensions(game) {
          const pinned = readNativeProperty(game, "__qolboxPinnedDimensions");
          return isFullscreenDimensions(pinned) ? pinned : options.getFallbackDimensions();
        }
        function installNativeMetricOverride(game) {
          if (!isNativeObject(game)) {
            return false;
          }
          if (readNativeProperty(game, "__qolboxMetricOverrideInstalled")) {
            return true;
          }
          setNativeReflectProperty(game, "__qolboxMetricOriginals", createMetricOriginals(game));
          try {
            Object.defineProperty(game, "_P", makeMetricAccessor(() => getPinnedFullscreenDimensions(game).scale));
            Object.defineProperty(
              game,
              "Qp",
              makeMetricAccessor(() => options.getNativeUiZoom(getPinnedFullscreenDimensions(game)))
            );
            Object.defineProperty(game, "lg", makeMetricAccessor(() => getPinnedFullscreenDimensions(game).width));
            Object.defineProperty(game, "ug", makeMetricAccessor(() => getPinnedFullscreenDimensions(game).height));
            setNativeReflectProperty(game, "__qolboxMetricOverrideInstalled", true);
            return true;
          } catch {
            return false;
          }
        }
        function restoreNativeMetricOverride(game) {
          if (!isNativeObject(game) || !readNativeProperty(game, "__qolboxMetricOverrideInstalled")) {
            return false;
          }
          const originals = readNativeProperty(game, "__qolboxMetricOriginals");
          for (const metricName of METRIC_NAMES) {
            const original = isNativeObject(originals) ? readNativeProperty(originals, metricName) : void 0;
            const descriptor = isNativeObject(original) ? readNativeProperty(original, "descriptor") : void 0;
            try {
              if (descriptor && typeof descriptor === "object") {
                Object.defineProperty(game, metricName, descriptor);
              } else {
                Reflect.deleteProperty(game, metricName);
              }
            } catch {
            }
          }
          Reflect.deleteProperty(game, "__qolboxPinnedDimensions");
          Reflect.deleteProperty(game, "__qolboxMetricOriginals");
          Reflect.deleteProperty(game, "__qolboxMetricOverrideInstalled");
          return true;
        }
        return {
          getPinnedFullscreenDimensions,
          installNativeMetricOverride,
          restoreNativeMetricOverride
        };
      }

      // src/hitbox/fullscreen-metrics-adapter.ts
      function createFullscreenMetricsAdapter(options) {
        const getWindowObject = () => options.windowObject || window;
        const getGame = () => readNativeProperty(getWindowObject(), "a8");
        const metricOverrides = createFullscreenMetricOverrideController({
          getFallbackDimensions: options.getFullscreenDimensions,
          getNativeUiZoom: options.getNativeUiZoom
        });
        function installNativeMetricOverride(game = getGame()) {
          return metricOverrides.installNativeMetricOverride(game);
        }
        function restoreNativeMetricOverride(game = getGame()) {
          return metricOverrides.restoreNativeMetricOverride(game);
        }
        function setNativeFullscreenSize(dimensions = options.getFullscreenDimensions()) {
          const game = getGame();
          if (!isNativeObject(game)) {
            return false;
          }
          setNativeReflectProperty(game, "__qolboxPinnedDimensions", dimensions);
          installNativeMetricOverride(game);
          setNativeReflectProperty(game, "_P", dimensions.scale);
          setNativeReflectProperty(game, "lg", dimensions.width);
          setNativeReflectProperty(game, "ug", dimensions.height);
          if ("Qp" in game) {
            setNativeReflectProperty(game, "Qp", options.getNativeUiZoom(dimensions));
          }
          const layoutMethod = readNativeProperty(game, "PP");
          if (typeof layoutMethod === "function") {
            try {
              Reflect.apply(layoutMethod, game, []);
            } catch {
            }
          }
          return true;
        }
        function restoreNativeFullscreenPatch(game = getGame()) {
          if (!isNativeObject(game)) {
            return false;
          }
          const resizeMethod = readNativeProperty(game, "ag");
          const originalResize = readNativeProperty(resizeMethod, "__qolboxOriginal");
          if (typeof resizeMethod === "function" && readNativeProperty(resizeMethod, "__qolboxWrapped") && typeof originalResize === "function") {
            setNativeReflectProperty(game, "ag", originalResize);
          }
          restoreNativeMetricOverride(game);
          const restoredResize = readNativeProperty(game, "ag");
          if (typeof restoredResize === "function") {
            try {
              Reflect.apply(restoredResize, game, []);
            } catch {
            }
          }
          return true;
        }
        function installNativeFullscreenPatch() {
          const game = getGame();
          if (!isNativeObject(game)) {
            return false;
          }
          installNativeMetricOverride(game);
          const originalResize = readNativeProperty(game, "ag");
          if (typeof originalResize !== "function" || readNativeProperty(originalResize, "__qolboxWrapped")) {
            return true;
          }
          const wrappedResize = function wrappedResize2(...args) {
            setNativeFullscreenSize(options.getFullscreenDimensions());
            if (readNativeProperty(game, "__qolboxRunningNativeResize")) {
              return Reflect.apply(originalResize, this, args);
            }
            setNativeReflectProperty(game, "__qolboxRunningNativeResize", true);
            try {
              const result = Reflect.apply(originalResize, this, args);
              setNativeFullscreenSize(options.getFullscreenDimensions());
              return result;
            } finally {
              setNativeReflectProperty(game, "__qolboxRunningNativeResize", false);
            }
          };
          setNativeReflectProperty(wrappedResize, "__qolboxWrapped", true);
          setNativeReflectProperty(wrappedResize, "__qolboxOriginal", originalResize);
          setNativeReflectProperty(game, "ag", wrappedResize);
          return true;
        }
        function runNativeResize(dimensions = options.getFullscreenDimensions()) {
          const game = getGame();
          const resizeMethod = readNativeProperty(game, "ag");
          if (!isNativeObject(game) || typeof resizeMethod !== "function") {
            return false;
          }
          setNativeFullscreenSize(dimensions);
          try {
            Reflect.apply(resizeMethod, game, [dimensions]);
            return true;
          } catch {
            return false;
          }
        }
        return {
          installNativeFullscreenPatch,
          restoreNativeFullscreenPatch,
          runNativeResize,
          setNativeFullscreenSize
        };
      }

      // src/hitbox/native-game-adapter.ts
      function getNativeGameObject() {
        const game = readNativeProperty(window, "a8");
        return isNativeObject(game) ? game : null;
      }
      function getNativeGameSlot() {
        return readNativeProperty(window, "a8");
      }
      function readFinitePositiveNumber(source, property) {
        const value = Number(readNativeProperty(source, property));
        return Number.isFinite(value) && value > 0 ? value : null;
      }
      function hasNativeGameObject() {
        return getNativeGameObject() !== null;
      }
      function installNativeGameReadyHook(onReady) {
        if (getNativeGameSlot()) {
          onReady();
          return;
        }
        try {
          let pendingGame = null;
          Object.defineProperty(window, "a8", {
            configurable: true,
            enumerable: true,
            get() {
              return pendingGame;
            },
            set(value) {
              pendingGame = value;
              Object.defineProperty(window, "a8", {
                configurable: true,
                enumerable: true,
                writable: true,
                value
              });
              onReady();
            }
          });
        } catch {
        }
      }
      function getNativeBaseGameSize(fallback) {
        const game = getNativeGameObject();
        return {
          width: readFinitePositiveNumber(game, "Xg") ?? fallback.width,
          height: readFinitePositiveNumber(game, "Zg") ?? fallback.height
        };
      }
      function getNativeFullscreenLayoutSize() {
        const game = getNativeGameObject();
        return {
          width: Number(readNativeProperty(game, "lg")) || 0,
          height: Number(readNativeProperty(game, "ug")) || 0
        };
      }

      // src/features/fullscreen-probe-alignment.ts
      function isFullscreenRenderProbeAligned(probe, dimensions) {
        if (probe.renderWidth <= 0 || probe.renderHeight <= 0) {
          return false;
        }
        return Math.abs(probe.renderWidth - dimensions.width) <= 2 && Math.abs(probe.renderHeight - dimensions.height) <= 2 && Math.abs(probe.renderLeft - dimensions.left) <= 2 && Math.abs(probe.renderTop - dimensions.top) <= 2 && probe.backingWidth > 0 && probe.backingHeight > 0;
      }
      function isFullscreenNativeProbeAligned(probe, dimensions) {
        if (probe.nativeWidth <= 0 || probe.nativeHeight <= 0) {
          return false;
        }
        return Math.abs(probe.nativeWidth - dimensions.width) <= 2 && Math.abs(probe.nativeHeight - dimensions.height) <= 2;
      }
      function buildFullscreenProbeSignature(dimensions, probe, hasNativeGame) {
        return [
          dimensions.mode,
          dimensions.viewportWidth,
          dimensions.viewportHeight,
          dimensions.width,
          dimensions.height,
          dimensions.left,
          dimensions.top,
          probe.appWidth,
          probe.appHeight,
          probe.relativeWidth,
          probe.relativeHeight,
          probe.renderWidth,
          probe.renderHeight,
          probe.renderLeft,
          probe.renderTop,
          probe.backingWidth,
          probe.backingHeight,
          probe.rendererCount,
          probe.nativeWidth,
          probe.nativeHeight,
          hasNativeGame
        ].join(":");
      }

      // src/features/fullscreen-geometry.ts
      var MENU_FRAME_PADDING_PX = 0;
      var GAMEPLAY_SAFE_TOP_PX = 0;
      var GAMEPLAY_SAFE_BOTTOM_PX = 0;
      var GAMEPLAY_SAFE_SIDE_PX = 0;
      function createFullscreenGeometry(options) {
        function getModeInsets(mode) {
          if (mode === "gameplay" || mode === "editor") {
            return {
              left: GAMEPLAY_SAFE_SIDE_PX,
              right: GAMEPLAY_SAFE_SIDE_PX,
              top: GAMEPLAY_SAFE_TOP_PX,
              bottom: GAMEPLAY_SAFE_BOTTOM_PX
            };
          }
          return {
            left: MENU_FRAME_PADDING_PX,
            right: MENU_FRAME_PADDING_PX,
            top: MENU_FRAME_PADDING_PX,
            bottom: MENU_FRAME_PADDING_PX
          };
        }
        function getFullscreenDimensions(viewport = options.getViewportSize(), mode = options.getActiveRenderMode()) {
          const base = options.getBaseGameSize();
          const insets = getModeInsets(mode);
          const availableWidth = Math.max(1, viewport.width - insets.left - insets.right);
          const availableHeight = Math.max(1, viewport.height - insets.top - insets.bottom);
          const scale = Math.max(0.01, Math.min(availableWidth / base.width, availableHeight / base.height));
          const width = Math.max(1, Math.round(base.width * scale));
          const height = Math.max(1, Math.round(base.height * scale));
          const left = insets.left + Math.max(0, Math.floor((availableWidth - width) / 2));
          const top = insets.top + Math.max(0, Math.floor((availableHeight - height) / 2));
          return {
            viewportWidth: viewport.width,
            viewportHeight: viewport.height,
            baseWidth: base.width,
            baseHeight: base.height,
            width,
            height,
            scale,
            left,
            top,
            shellLeft: 0,
            shellTop: 0,
            shellWidth: viewport.width,
            shellHeight: viewport.height,
            insets,
            mode
          };
        }
        function getNativeUiZoom(dimensions = getFullscreenDimensions()) {
          return Math.min(1, dimensions.width / 1400);
        }
        function getRelativeContainerBounds(dimensions = getFullscreenDimensions()) {
          return {
            left: dimensions.left,
            top: dimensions.top,
            width: dimensions.width,
            height: dimensions.height
          };
        }
        function isRenderProbeAligned(probe, dimensions) {
          return isFullscreenRenderProbeAligned(probe, dimensions);
        }
        function isNativeProbeAligned(probe, dimensions) {
          return isFullscreenNativeProbeAligned(probe, dimensions);
        }
        function buildFullscreenSignature(dimensions, probe) {
          return buildFullscreenProbeSignature(dimensions, probe, options.hasNativeGame());
        }
        return {
          buildFullscreenSignature,
          getFullscreenDimensions,
          getModeInsets,
          getNativeUiZoom,
          getRelativeContainerBounds,
          isNativeProbeAligned,
          isRenderProbeAligned
        };
      }

      // src/features/fullscreen-native-layout-fallback.ts
      function getStyleDeclaration(element) {
        if (isStyledElement(element)) {
          return element.style;
        }
        return null;
      }
      function hasStyleSize(element) {
        const style = getStyleDeclaration(element);
        return Boolean(style?.width && style.height);
      }
      function setStyleSizeIfEmpty(element, width, height) {
        const style = getStyleDeclaration(element);
        if (!style || style.width || style.height) {
          return;
        }
        style.width = width;
        style.height = height;
      }
      function createFullscreenNativeLayoutFallback(options) {
        let waitStartedAt = 0;
        function hasNativeLayoutSeed() {
          const appContainer = document.getElementById("appContainer");
          const relativeContainer = document.getElementById("relativeContainer");
          return Boolean(appContainer && relativeContainer && hasStyleSize(appContainer) && hasStyleSize(relativeContainer));
        }
        function shouldWaitForNativeLayoutSeed() {
          if (hasNativeLayoutSeed()) {
            waitStartedAt = 0;
            return false;
          }
          if (!document.getElementById("appContainer") || !document.getElementById("relativeContainer")) {
            return false;
          }
          if (!waitStartedAt) {
            waitStartedAt = Date.now();
          }
          return Date.now() - waitStartedAt < options.waitMs;
        }
        function restoreNativeLayoutSizeFallback() {
          const canvas = options.getActiveRenderCanvas();
          const canvasSize = getCanvasBackingSize(canvas);
          const backingWidth = canvasSize?.width ?? Number.NaN;
          const backingHeight = canvasSize?.height ?? Number.NaN;
          const pixelRatio = Math.max(1, Number(window.devicePixelRatio) || 1);
          const width = backingWidth / pixelRatio;
          const height = backingHeight / pixelRatio;
          if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0 || width >= window.innerWidth * 0.98 || height >= window.innerHeight * 0.98) {
            return;
          }
          const containerWidthPx = `${Math.floor(width)}px`;
          const containerHeightPx = `${Math.floor(height)}px`;
          const canvasWidthPx = `${Math.round(width * 10) / 10}px`;
          const canvasHeightPx = `${Math.round(height * 10) / 10}px`;
          for (const element of [
            document.getElementById("appContainer"),
            document.getElementById("relativeContainer")
          ]) {
            setStyleSizeIfEmpty(element, containerWidthPx, containerHeightPx);
          }
          setStyleSizeIfEmpty(canvas, canvasWidthPx, canvasHeightPx);
        }
        return {
          restoreNativeLayoutSizeFallback,
          shouldWaitForNativeLayoutSeed
        };
      }

      // src/hitbox/renderer-discovery.ts
      function isRendererCandidate(value) {
        return isNativeObject(value) && isNativeObject(readNativeProperty(value, "Bc")) && (isNativeObject(readNativeProperty(value, "Ag")) || typeof readNativeProperty(value, "cg") === "function");
      }
      function getRendererView(renderer) {
        const view = readNativePath(renderer, ["Ag", "view"]);
        return view instanceof Element ? view : null;
      }
      function getRendererHost(renderer) {
        const directHost = readNativeProperty(renderer, "Tg") || readNativeProperty(renderer, "dg");
        if (directHost instanceof Element) {
          return directHost;
        }
        return getRendererView(renderer)?.parentElement || null;
      }
      function getKnownFullscreenRenderers(windowObject = window) {
        const renderers = [];
        const seen = /* @__PURE__ */ new Set();
        function addRenderer(candidate) {
          if (!isRendererCandidate(candidate) || seen.has(candidate)) {
            return;
          }
          seen.add(candidate);
          renderers.push(candidate);
        }
        function collect(candidate) {
          if (!candidate) {
            return;
          }
          if (Array.isArray(candidate)) {
            candidate.forEach(collect);
            return;
          }
          addRenderer(candidate);
          const nested = readNativeProperty(candidate, "hb");
          addRenderer(nested);
          if (Array.isArray(nested)) {
            nested.forEach(addRenderer);
          }
        }
        const multiplayerSession = readNativeProperty(windowObject, "multiplayerSession");
        collect(multiplayerSession);
        collect(readNativeProperty(windowObject, "A4"));
        collect(readNativePath(windowObject, ["a8", "II"]));
        return renderers;
      }

      // src/hitbox/renderer-adapter.ts
      function resizeKnownRenderer(renderer, width, height) {
        const backing = readNativeProperty(renderer, "Bc");
        if (isNativeObject(backing)) {
          setNativeReflectProperty(backing, "wc", width);
          setNativeReflectProperty(backing, "mc", height);
        }
        const pixelRatio = Math.max(1, Number(window.devicePixelRatio) || 1);
        const pixiRenderer = readNativeProperty(renderer, "Ag");
        if (isNativeObject(pixiRenderer)) {
          if ("autoDensity" in pixiRenderer) {
            setNativeReflectProperty(pixiRenderer, "autoDensity", true);
          }
          if (typeof readNativeProperty(pixiRenderer, "resolution") === "number") {
            setNativeReflectProperty(pixiRenderer, "resolution", pixelRatio);
          }
          const options = readNativeProperty(pixiRenderer, "options");
          if (isNativeObject(options)) {
            setNativeReflectProperty(options, "autoDensity", true);
            setNativeReflectProperty(options, "resolution", pixelRatio);
          }
        }
        try {
          const nativeResize = readNativeProperty(renderer, "cg");
          if (typeof nativeResize === "function") {
            Reflect.apply(nativeResize, renderer, [width, height]);
          } else {
            const pixiResize = readNativeProperty(pixiRenderer, "resize");
            if (typeof pixiResize === "function") {
              Reflect.apply(pixiResize, pixiRenderer, [width, height]);
            }
          }
        } catch {
        }
      }
      function resizeKnownFullscreenRenderers(options) {
        const { dimensions, fitElementToFrame, setImportantStyle, windowObject = window } = options;
        const frameWidth = Math.max(1, Math.round(dimensions.width));
        const frameHeight = Math.max(1, Math.round(dimensions.height));
        for (const renderer of getKnownFullscreenRenderers(windowObject)) {
          resizeKnownRenderer(renderer, frameWidth, frameHeight);
          fitElementToFrame(getRendererHost(renderer), dimensions, dimensions.left, dimensions.top);
          const view = getRendererView(renderer);
          if (!view) {
            continue;
          }
          setImportantStyle(view, "position", "absolute");
          setImportantStyle(view, "left", "0");
          setImportantStyle(view, "top", "0");
          setImportantStyle(view, "right", "auto");
          setImportantStyle(view, "bottom", "auto");
          setImportantStyle(view, "width", `${frameWidth}px`);
          setImportantStyle(view, "height", `${frameHeight}px`);
          setImportantStyle(view, "max-width", "none");
          setImportantStyle(view, "max-height", "none");
          setImportantStyle(view, "transform", "none");
          fitElementToFrame(view.parentElement, dimensions, dimensions.left, dimensions.top);
        }
      }

      // src/features/fullscreen-render-state.ts
      function createFullscreenRenderState(options) {
        function getViewportSize() {
          return {
            width: Math.max(window.innerWidth, document.documentElement.clientWidth || 0),
            height: Math.max(window.innerHeight, document.documentElement.clientHeight || 0)
          };
        }
        function getBaseGameSize() {
          return getNativeBaseGameSize({
            width: options.fallbackBaseWidth,
            height: options.fallbackBaseHeight
          });
        }
        function isEditorLayer(element) {
          return element instanceof Element && element.id === "editorContainer";
        }
        function isCanvasElement(element) {
          return element instanceof Element && element.tagName === "CANVAS";
        }
        function isEditorCanvas(element) {
          return isCanvasElement(element) && element.parentElement instanceof Element && element.parentElement.id === "editorContainer";
        }
        function getActiveRenderMode() {
          if (options.hasVisibleLayer(options.menuLayerSelector)) {
            return "menu";
          }
          if (options.hasVisibleLayer(options.editorLayerSelector)) {
            return "editor";
          }
          if (options.hasVisibleLayer(options.gameplayLayerSelector)) {
            return "gameplay";
          }
          return "menu";
        }
        function getActiveRenderCanvas(mode = getActiveRenderMode()) {
          const selector = mode === "gameplay" ? options.gameplayLayerSelector : mode === "editor" ? options.editorLayerSelector : options.menuLayerSelector;
          for (const layer of document.querySelectorAll(selector)) {
            if (!options.isElementVisible(layer)) {
              continue;
            }
            const canvas = layer.querySelector("canvas");
            if (isCanvasElement(canvas)) {
              return canvas;
            }
          }
          const fallback = document.querySelector(options.renderCanvasSelector);
          return isCanvasElement(fallback) ? fallback : null;
        }
        function getLayoutProbe() {
          const appContainer = document.getElementById("appContainer");
          const relativeContainer = document.getElementById("relativeContainer");
          const renderLayer = getActiveRenderCanvas();
          const appRect = appContainer ? appContainer.getBoundingClientRect() : null;
          const relativeRect = relativeContainer ? relativeContainer.getBoundingClientRect() : null;
          const renderRect = renderLayer ? renderLayer.getBoundingClientRect() : null;
          const renderers = getKnownFullscreenRenderers();
          const backingSize = getCanvasBackingSize(renderLayer);
          const nativeLayoutSize = getNativeFullscreenLayoutSize();
          return {
            appWidth: appRect ? Math.round(appRect.width) : 0,
            appHeight: appRect ? Math.round(appRect.height) : 0,
            relativeWidth: relativeRect ? Math.round(relativeRect.width) : 0,
            relativeHeight: relativeRect ? Math.round(relativeRect.height) : 0,
            renderWidth: renderRect ? Math.round(renderRect.width) : 0,
            renderHeight: renderRect ? Math.round(renderRect.height) : 0,
            renderLeft: renderRect ? Math.round(renderRect.left) : 0,
            renderTop: renderRect ? Math.round(renderRect.top) : 0,
            backingWidth: backingSize ? Math.round(backingSize.width) : 0,
            backingHeight: backingSize ? Math.round(backingSize.height) : 0,
            rendererCount: renderers.length,
            nativeWidth: nativeLayoutSize.width,
            nativeHeight: nativeLayoutSize.height
          };
        }
        return {
          getActiveRenderCanvas,
          getActiveRenderMode,
          getBaseGameSize,
          getLayoutProbe,
          getViewportSize,
          isEditorCanvas,
          isEditorLayer
        };
      }

      // src/features/fullscreen-style-manager.ts
      function createFullscreenStyleManager() {
        let fullscreenStyleSnapshots = /* @__PURE__ */ new WeakMap();
        function rememberFullscreenStyle(element, property) {
          if (!isStyledElement(element)) {
            return;
          }
          let snapshot = fullscreenStyleSnapshots.get(element);
          if (!snapshot) {
            snapshot = /* @__PURE__ */ new Map();
            fullscreenStyleSnapshots.set(element, snapshot);
          }
          if (snapshot.has(property)) {
            return;
          }
          const value = element.style.getPropertyValue(property);
          const priority = element.style.getPropertyPriority(property);
          snapshot.set(property, {
            priority,
            value,
            hadValue: value !== "" || priority !== ""
          });
        }
        function setImportantStyle(element, property, value) {
          if (!isStyledElement(element)) {
            return;
          }
          rememberFullscreenStyle(element, property);
          element.style.setProperty(property, value, "important");
        }
        function restoreFullscreenStyles(element, properties) {
          if (!isStyledElement(element)) {
            return;
          }
          const snapshot = fullscreenStyleSnapshots.get(element);
          for (const property of properties) {
            const original = snapshot?.get(property);
            if (original?.hadValue) {
              element.style.setProperty(property, original.value, original.priority);
            } else {
              element.style.removeProperty(property);
            }
          }
        }
        function clearFullscreenStyleSnapshots() {
          fullscreenStyleSnapshots = /* @__PURE__ */ new WeakMap();
        }
        return {
          clearFullscreenStyleSnapshots,
          restoreFullscreenStyles,
          setImportantStyle
        };
      }

      // src/features/fullscreen-foundation-bundle.ts
      function createFullscreenFoundationBundle() {
        const renderState = createFullscreenRenderState({
          editorLayerSelector: FULLSCREEN_EDITOR_LAYER_SELECTOR,
          fallbackBaseHeight: FALLBACK_BASE_HEIGHT,
          fallbackBaseWidth: FALLBACK_BASE_WIDTH,
          gameplayLayerSelector: FULLSCREEN_GAMEPLAY_LAYER_SELECTOR,
          hasVisibleLayer,
          isElementVisible,
          menuLayerSelector: FULLSCREEN_MENU_LAYER_SELECTOR,
          renderCanvasSelector: FULLSCREEN_RENDER_CANVAS_SELECTOR
        });
        const nativeLayoutFallback = createFullscreenNativeLayoutFallback({
          getActiveRenderCanvas: renderState.getActiveRenderCanvas,
          waitMs: FULLSCREEN_NATIVE_LAYOUT_WAIT_MS
        });
        const styleManager = createFullscreenStyleManager();
        const geometry = createFullscreenGeometry({
          getActiveRenderMode: renderState.getActiveRenderMode,
          getBaseGameSize: renderState.getBaseGameSize,
          getViewportSize: renderState.getViewportSize,
          hasNativeGame: hasNativeGameObject
        });
        const metricsAdapter = createFullscreenMetricsAdapter({
          getFullscreenDimensions: geometry.getFullscreenDimensions,
          getNativeUiZoom: geometry.getNativeUiZoom
        });
        return {
          ...renderState,
          ...nativeLayoutFallback,
          ...styleManager,
          ...geometry,
          ...metricsAdapter
        };
      }

      // src/hitbox/session-adapter.ts
      function readNativeCollectionValue(collection, key) {
        if (!isNativeObject(collection) || key === null || key === void 0) {
          return null;
        }
        const propertyValue = readNativeProperty(collection, String(key));
        if (propertyValue) {
          return propertyValue;
        }
        const getter = readNativeProperty(collection, "get");
        if (typeof getter === "function") {
          const value = Reflect.apply(getter, collection, [key]);
          return value ?? null;
        }
        return propertyValue ?? null;
      }
      function getMultiplayerSession() {
        return isNativeObject(window.multiplayerSession) ? window.multiplayerSession : null;
      }
      function getNativeLobbyState(session) {
        return readNativeProperty(session, "JD");
      }
      function getSessionPlayer(session = getMultiplayerSession()) {
        const lobbyState = getNativeLobbyState(session);
        return readNativeCollectionValue(readNativeProperty(lobbyState, "Pi"), readNativeProperty(lobbyState, "vL"));
      }
      function getSessionPlayers(session = getMultiplayerSession()) {
        const players = readNativeProperty(getNativeLobbyState(session), "Pi");
        if (!isNativeObject(players)) {
          return [];
        }
        if (Array.isArray(players)) {
          return players.map((player, id) => ({ id, player })).filter((entry) => Boolean(entry.player));
        }
        const forEach = readNativeProperty(players, "forEach");
        if (typeof forEach === "function") {
          const entries = [];
          Reflect.apply(forEach, players, [
            (player, id) => {
              if (player) {
                entries.push({ id, player });
              }
            }
          ]);
          return entries;
        }
        return Object.keys(players).map((id) => ({ id, player: readNativeProperty(players, id) })).filter((entry) => Boolean(entry.player));
      }
      function getSessionPlayerById(session, playerId) {
        const players = readNativeProperty(getNativeLobbyState(session), "Pi");
        return readNativeCollectionValue(players, playerId);
      }
      function getLocalPlayerId(session = getMultiplayerSession()) {
        const playerId = readNativeProperty(getNativeLobbyState(session), "vL");
        return playerId === null || playerId === void 0 ? null : playerId;
      }
      function hasLobbyPlayerState(session = getMultiplayerSession()) {
        return isNativeObject(getNativeLobbyState(session));
      }
      function getPlayerTeamState(player) {
        return Number(player ? readNativeProperty(player, "N") : player);
      }
      function getPlayerName(player) {
        return readNativeProperty(player, "name");
      }
      function isSamePlayerId(left, right) {
        return left !== null && left !== void 0 && right !== null && right !== void 0 && String(left) === String(right);
      }
      function isNativeTeamMode(session = getMultiplayerSession()) {
        const nativeTeamMode = readNativeProperty(getNativeLobbyState(session), "Qn");
        return nativeTeamMode === true || nativeTeamMode === 1;
      }
      function isTeamsLocked(session = getMultiplayerSession()) {
        const locked = readNativeProperty(getNativeLobbyState(session), "VL");
        return locked === true || locked === 1;
      }
      function isHostSession(session = getMultiplayerSession()) {
        const lobbyState = getNativeLobbyState(session);
        const hostCheck = readNativeProperty(lobbyState, "XD");
        return typeof hostCheck === "function" && Boolean(Reflect.apply(hostCheck, lobbyState, []));
      }
      function isSessionLobbyActive(session = getMultiplayerSession()) {
        const lobbyUi = readNativeProperty(session, "TJ");
        const match = readNativeProperty(session, "KR");
        return Boolean(readNativeProperty(lobbyUi, "NS") && !readNativeProperty(match, "SL"));
      }
      function isSessionMatchActive(session = getMultiplayerSession()) {
        return Boolean(readNativeProperty(readNativeProperty(session, "KR"), "SL"));
      }

      // src/features/fullscreen-cleanup.ts
      var APP_CONTAINER_PROPERTIES = [
        "position",
        "left",
        "top",
        "right",
        "bottom",
        "margin",
        "width",
        "height",
        "max-width",
        "max-height",
        "border",
        "overflow"
      ];
      var BACKGROUND_IMAGE_PROPERTIES = ["position", "left", "top", "right", "bottom", "width", "height"];
      var FRAME_PROPERTIES = [
        "position",
        "left",
        "top",
        "right",
        "bottom",
        "margin",
        "width",
        "height",
        "max-width",
        "max-height",
        "overflow",
        "transform",
        "transform-origin",
        "zoom"
      ];
      var RELATIVE_CONTAINER_PROPERTIES = [
        "position",
        "left",
        "top",
        "right",
        "bottom",
        "margin",
        "width",
        "height",
        "overflow"
      ];
      function deleteDatasetValue(element, key) {
        if (hasDataset(element)) {
          delete element.dataset[key];
        }
      }
      function shouldDispatchNativeResizeAfterCleanup() {
        const appContainer = document.getElementById("appContainer");
        const relativeContainer = document.getElementById("relativeContainer");
        return appContainer?.style.position === "fixed" || relativeContainer?.style.position === "fixed" || document.documentElement.style.overflow === "hidden";
      }
      function dispatchNativeResizeAfterCleanup() {
        try {
          window.dispatchEvent(new Event("resize"));
        } catch {
        }
      }
      function createFullscreenCleanup(options) {
        function clearFullscreenLayoutStyles() {
          const needsNativeResize = shouldDispatchNativeResizeAfterCleanup();
          options.clearFullscreenSignature();
          options.restoreFullscreenStyles(document.documentElement, ["overflow"]);
          options.restoreFullscreenStyles(document.body, ["overflow", "margin", "background-color"]);
          options.restoreFullscreenStyles(document.getElementById("appContainer"), APP_CONTAINER_PROPERTIES);
          options.restoreFullscreenStyles(document.getElementById("relativeContainer"), RELATIVE_CONTAINER_PROPERTIES);
          options.restoreFullscreenStyles(document.getElementById("backgroundImage"), BACKGROUND_IMAGE_PROPERTIES);
          for (const element of document.querySelectorAll(options.renderLayerSelector)) {
            options.restoreFullscreenStyles(element, FRAME_PROPERTIES);
            deleteDatasetValue(element, "qolboxEditorNativeWidth");
            deleteDatasetValue(element, "qolboxEditorNativeHeight");
            deleteDatasetValue(element, "qolboxEditorScale");
          }
          for (const canvas of document.querySelectorAll(options.renderCanvasSelector)) {
            options.restoreFullscreenStyles(canvas, FRAME_PROPERTIES);
          }
          for (const overlay of document.querySelectorAll(".inGameCSS")) {
            options.restoreFullscreenStyles(overlay, ["zoom", "transform-origin"]);
          }
          for (const scorePanel of document.querySelectorAll(".scores")) {
            options.resetScorePanelLayout(scorePanel);
            options.restoreFullscreenStyles(scorePanel, ["display"]);
          }
          for (const scoreRow of document.querySelectorAll(".scores .entryContainer")) {
            options.restoreFullscreenStyles(scoreRow, ["background-color"]);
          }
          for (const spectateControls of document.querySelectorAll(".spectateControls")) {
            options.resetSpectateControlsLayout(spectateControls);
          }
          for (const editorStatusWindow of document.querySelectorAll(".physicsCountWindow")) {
            options.restoreFullscreenStyles(editorStatusWindow, [
              "position",
              "left",
              "top",
              "right",
              "bottom",
              "margin",
              "transform",
              "z-index"
            ]);
          }
          options.restoreNativeFullscreenPatch();
          options.restoreNativeLayoutSizeFallback();
          options.clearFullscreenStyleSnapshots();
          if (needsNativeResize) {
            dispatchNativeResizeAfterCleanup();
          }
        }
        return {
          clearFullscreenLayoutStyles
        };
      }

      // src/features/fullscreen-container-layout.ts
      function applyFullscreenContainerLayout(options, dimensions, activeDimensions, relativeBounds) {
        options.setImportantStyle(document.documentElement, "overflow", "hidden");
        options.setImportantStyle(document.body, "overflow", "hidden");
        options.setImportantStyle(document.body, "margin", "0");
        options.setImportantStyle(document.body, "background-color", "#0a0a0a");
        const appContainer = document.getElementById("appContainer");
        if (appContainer) {
          options.setImportantStyle(appContainer, "position", "fixed");
          options.setImportantStyle(appContainer, "left", `${activeDimensions.shellLeft}px`);
          options.setImportantStyle(appContainer, "top", `${activeDimensions.shellTop}px`);
          options.setImportantStyle(appContainer, "right", "auto");
          options.setImportantStyle(appContainer, "bottom", "auto");
          options.setImportantStyle(appContainer, "margin", "0");
          options.setImportantStyle(appContainer, "width", `${activeDimensions.shellWidth}px`);
          options.setImportantStyle(appContainer, "height", `${activeDimensions.shellHeight}px`);
          options.setImportantStyle(appContainer, "max-width", "none");
          options.setImportantStyle(appContainer, "max-height", "none");
          options.setImportantStyle(appContainer, "border", "0");
          options.setImportantStyle(appContainer, "overflow", "hidden");
        }
        const relativeContainer = document.getElementById("relativeContainer");
        if (relativeContainer) {
          options.setImportantStyle(relativeContainer, "position", "fixed");
          options.setImportantStyle(relativeContainer, "left", `${relativeBounds.left}px`);
          options.setImportantStyle(relativeContainer, "top", `${relativeBounds.top}px`);
          options.setImportantStyle(relativeContainer, "right", "auto");
          options.setImportantStyle(relativeContainer, "bottom", "auto");
          options.setImportantStyle(relativeContainer, "margin", "0");
          options.setImportantStyle(relativeContainer, "width", `${relativeBounds.width}px`);
          options.setImportantStyle(relativeContainer, "height", `${relativeBounds.height}px`);
          options.setImportantStyle(relativeContainer, "overflow", "visible");
        }
        const backgroundImage = document.getElementById("backgroundImage");
        if (backgroundImage) {
          options.setImportantStyle(backgroundImage, "position", "fixed");
          options.setImportantStyle(backgroundImage, "left", "0");
          options.setImportantStyle(backgroundImage, "top", "0");
          options.setImportantStyle(backgroundImage, "right", "auto");
          options.setImportantStyle(backgroundImage, "bottom", "auto");
          options.setImportantStyle(backgroundImage, "width", `${dimensions.viewportWidth}px`);
          options.setImportantStyle(backgroundImage, "height", `${dimensions.viewportHeight}px`);
        }
      }

      // src/features/fullscreen-editor-frame-layout.ts
      var EDITOR_STATUS_BLOCKER_MARGIN_PX = 8;
      var EDITOR_STATUS_VIEWPORT_MARGIN_PX = 5;
      var EDITOR_STATUS_RADIO_TRACKING_FRAMES = 60;
      function createFullscreenEditorFrameLayout(options) {
        let latestEditorFrame = null;
        let observedJukebox = null;
        let jukeboxStatusObserver = null;
        let statusLayoutFrame = 0;
        let statusLayoutFramesRemaining = 0;
        function getEditorNativeSize(editorLayer, dimensions) {
          const canvas = editorLayer instanceof Element ? editorLayer.querySelector("canvas") : null;
          const canvasSize = getCanvasBackingSize(canvas);
          const canvasWidth = Number(canvasSize?.width);
          const canvasHeight = Number(canvasSize?.height);
          return {
            width: Number.isFinite(canvasWidth) && canvasWidth > 0 ? canvasWidth : dimensions.baseWidth,
            height: Number.isFinite(canvasHeight) && canvasHeight > 0 ? canvasHeight : dimensions.baseHeight
          };
        }
        function getScaledEditorFrame(editorLayer, dimensions) {
          const nativeSize = getEditorNativeSize(editorLayer, dimensions);
          const scale = Math.max(
            0.01,
            Math.min(dimensions.width / nativeSize.width, dimensions.height / nativeSize.height)
          );
          const visualWidth = Math.max(1, Math.round(nativeSize.width * scale));
          const visualHeight = Math.max(1, Math.round(nativeSize.height * scale));
          return {
            left: dimensions.left + Math.max(0, Math.floor((dimensions.width - visualWidth) / 2)),
            top: dimensions.top + Math.max(0, Math.floor((dimensions.height - visualHeight) / 2)),
            width: nativeSize.width,
            height: nativeSize.height,
            scale,
            visualWidth,
            visualHeight
          };
        }
        function getVisibleRect(element) {
          const rect = element.getBoundingClientRect();
          const style = window.getComputedStyle(element);
          if (style.display === "none" || style.visibility === "hidden" || rect.width <= 0 || rect.height <= 0) {
            return null;
          }
          return rect;
        }
        function intersectsHorizontally(rect, left, right) {
          return rect.right > left && rect.left < right;
        }
        function getJukeboxTop(left, right) {
          const jukebox = document.querySelector(".jukebox");
          if (!(jukebox instanceof Element)) {
            return null;
          }
          const candidates = [jukebox, ...Array.from(jukebox.querySelectorAll("*"))];
          let top = null;
          for (const candidate of candidates) {
            const rect = getVisibleRect(candidate);
            if (!rect || !intersectsHorizontally(rect, left, right)) {
              continue;
            }
            if (rect.top > window.innerHeight + EDITOR_STATUS_BLOCKER_MARGIN_PX || rect.bottom < 0) {
              continue;
            }
            top = top === null ? rect.top : Math.min(top, rect.top);
          }
          return top;
        }
        function getSpectatorControlsTop(left, right) {
          let top = null;
          for (const controls of document.querySelectorAll(".spectateControls")) {
            const rect = getVisibleRect(controls);
            if (!rect || !intersectsHorizontally(rect, left, right)) {
              continue;
            }
            top = top === null ? rect.top : Math.min(top, rect.top);
          }
          return top;
        }
        function getEditorStatusMaxTop(left, right, height) {
          const viewportMaxTop = window.innerHeight - Math.ceil(height) - EDITOR_STATUS_VIEWPORT_MARGIN_PX;
          const blockerTops = [getJukeboxTop(left, right), getSpectatorControlsTop(left, right)].filter(
            (top) => top !== null
          );
          if (!blockerTops.length) {
            return viewportMaxTop;
          }
          const blockerMaxTop = Math.min(...blockerTops) - Math.ceil(height) - EDITOR_STATUS_BLOCKER_MARGIN_PX;
          return Math.min(viewportMaxTop, blockerMaxTop);
        }
        function hasActiveFullscreenEditorFrame() {
          const editorLayer = document.querySelector("#editorContainer");
          return hasDataset(editorLayer) && Boolean(editorLayer.dataset.qolboxEditorScale);
        }
        function runScheduledEditorStatusLayout() {
          statusLayoutFrame = 0;
          if (!latestEditorFrame || !hasActiveFullscreenEditorFrame()) {
            statusLayoutFramesRemaining = 0;
            return;
          }
          layoutEditorStatusWindow(latestEditorFrame);
          statusLayoutFramesRemaining -= 1;
          if (statusLayoutFramesRemaining > 0) {
            statusLayoutFrame = window.requestAnimationFrame(runScheduledEditorStatusLayout);
          }
        }
        function scheduleEditorStatusLayout(frames = 1) {
          statusLayoutFramesRemaining = Math.max(statusLayoutFramesRemaining, frames);
          if (!statusLayoutFrame) {
            statusLayoutFrame = window.requestAnimationFrame(runScheduledEditorStatusLayout);
          }
        }
        function observeJukeboxForEditorStatusLayout() {
          const jukebox = document.querySelector(".jukebox");
          if (jukebox === observedJukebox) {
            return;
          }
          jukeboxStatusObserver?.disconnect();
          observedJukebox = jukebox instanceof Element ? jukebox : null;
          if (!observedJukebox) {
            jukeboxStatusObserver = null;
            return;
          }
          jukeboxStatusObserver = new MutationObserver(() => {
            scheduleEditorStatusLayout(EDITOR_STATUS_RADIO_TRACKING_FRAMES);
          });
          jukeboxStatusObserver.observe(observedJukebox, {
            attributes: true,
            attributeFilter: ["class", "style"],
            subtree: true
          });
        }
        function fitEditorCanvasToNative(canvas, frame) {
          if (!canvas || !frame) {
            return;
          }
          options.setImportantStyle(canvas, "position", "absolute");
          options.setImportantStyle(canvas, "left", "0");
          options.setImportantStyle(canvas, "top", "0");
          options.setImportantStyle(canvas, "right", "auto");
          options.setImportantStyle(canvas, "bottom", "auto");
          options.setImportantStyle(canvas, "width", `${frame.width}px`);
          options.setImportantStyle(canvas, "height", `${frame.height}px`);
          options.setImportantStyle(canvas, "max-width", "none");
          options.setImportantStyle(canvas, "max-height", "none");
          options.setImportantStyle(canvas, "transform", "none");
        }
        function layoutEditorStatusWindow(frame) {
          const statusWindow = document.querySelector(".physicsCountWindow");
          if (!(statusWindow instanceof Element)) {
            return;
          }
          const rect = statusWindow.getBoundingClientRect();
          const width = rect.width || 186;
          const height = rect.height || 22;
          const left = Math.max(0, Math.round(frame.left + (frame.visualWidth - width) / 2));
          const preferredTop = frame.top + frame.visualHeight + 12;
          const maxTop = getEditorStatusMaxTop(left, left + width, height);
          const top = Math.max(0, Math.min(Math.round(preferredTop), Math.round(maxTop)));
          options.setImportantStyle(statusWindow, "position", "fixed");
          options.setImportantStyle(statusWindow, "left", `${left}px`);
          options.setImportantStyle(statusWindow, "top", `${top}px`);
          options.setImportantStyle(statusWindow, "right", "auto");
          options.setImportantStyle(statusWindow, "bottom", "auto");
          options.setImportantStyle(statusWindow, "margin", "0");
          options.setImportantStyle(statusWindow, "transform", "none");
          options.setImportantStyle(statusWindow, "z-index", "2147483001");
        }
        function fitEditorLayerToFrame(layer, dimensions) {
          if (!(layer instanceof Element)) {
            return null;
          }
          const frame = getScaledEditorFrame(layer, dimensions);
          latestEditorFrame = frame;
          options.setImportantStyle(layer, "position", "absolute");
          options.setImportantStyle(layer, "left", `${frame.left}px`);
          options.setImportantStyle(layer, "top", `${frame.top}px`);
          options.setImportantStyle(layer, "right", "auto");
          options.setImportantStyle(layer, "bottom", "auto");
          options.setImportantStyle(layer, "width", `${frame.width}px`);
          options.setImportantStyle(layer, "height", `${frame.height}px`);
          options.setImportantStyle(layer, "max-width", "none");
          options.setImportantStyle(layer, "max-height", "none");
          options.setImportantStyle(layer, "overflow", "visible");
          options.setImportantStyle(layer, "transform", `scale(${frame.scale})`);
          options.setImportantStyle(layer, "transform-origin", "top left");
          options.setImportantStyle(layer, "zoom", "1");
          if (hasDataset(layer)) {
            layer.dataset.qolboxEditorNativeWidth = String(frame.width);
            layer.dataset.qolboxEditorNativeHeight = String(frame.height);
            layer.dataset.qolboxEditorScale = String(frame.scale);
          }
          const canvas = layer.querySelector("canvas");
          if (canvas) {
            fitEditorCanvasToNative(canvas, frame);
          }
          observeJukeboxForEditorStatusLayout();
          layoutEditorStatusWindow(frame);
          return frame;
        }
        return {
          fitEditorCanvasToNative,
          fitEditorLayerToFrame,
          getScaledEditorFrame
        };
      }

      // src/features/fullscreen-render-frame-layout.ts
      function createFullscreenRenderFrameLayout(options) {
        function fitElementToFrame(element, dimensions, left = 0, top = 0) {
          if (!(element instanceof Element)) {
            return;
          }
          if (options.isEditorLayer(element)) {
            options.fitEditorLayerToFrame(element, dimensions);
            return;
          }
          options.setImportantStyle(element, "position", "absolute");
          options.setImportantStyle(element, "left", `${left}px`);
          options.setImportantStyle(element, "top", `${top}px`);
          options.setImportantStyle(element, "right", "auto");
          options.setImportantStyle(element, "bottom", "auto");
          options.setImportantStyle(element, "margin", "0");
          options.setImportantStyle(element, "width", `${dimensions.width}px`);
          options.setImportantStyle(element, "height", `${dimensions.height}px`);
          options.setImportantStyle(element, "max-width", "none");
          options.setImportantStyle(element, "max-height", "none");
          options.setImportantStyle(element, "overflow", "hidden");
          options.setImportantStyle(element, "transform", "none");
        }
        function fitRenderLayersToFrame(dimensions) {
          for (const layer of document.querySelectorAll(options.renderLayerSelector)) {
            if (options.isEditorLayer(layer)) {
              options.fitEditorLayerToFrame(layer, dimensions);
              continue;
            }
            options.setImportantStyle(layer, "position", "absolute");
            options.setImportantStyle(layer, "left", `${dimensions.left}px`);
            options.setImportantStyle(layer, "top", `${dimensions.top}px`);
            options.setImportantStyle(layer, "right", "auto");
            options.setImportantStyle(layer, "bottom", "auto");
            options.setImportantStyle(layer, "width", `${dimensions.width}px`);
            options.setImportantStyle(layer, "height", `${dimensions.height}px`);
            options.setImportantStyle(layer, "max-width", "none");
            options.setImportantStyle(layer, "max-height", "none");
            options.setImportantStyle(layer, "overflow", "hidden");
            options.setImportantStyle(layer, "transform", "none");
            options.setImportantStyle(layer, "zoom", "1");
          }
        }
        function fitRenderCanvasesToFrame(dimensions) {
          for (const canvas of document.querySelectorAll(options.renderCanvasSelector)) {
            if (options.isEditorCanvas(canvas)) {
              const editorLayer = canvas.parentElement;
              const frame = options.getScaledEditorFrame(editorLayer, dimensions);
              options.fitEditorCanvasToNative(canvas, frame);
              continue;
            }
            options.setImportantStyle(canvas, "position", "absolute");
            options.setImportantStyle(canvas, "left", "0");
            options.setImportantStyle(canvas, "top", "0");
            options.setImportantStyle(canvas, "right", "auto");
            options.setImportantStyle(canvas, "bottom", "auto");
            options.setImportantStyle(canvas, "width", `${dimensions.width}px`);
            options.setImportantStyle(canvas, "height", `${dimensions.height}px`);
            options.setImportantStyle(canvas, "max-width", "none");
            options.setImportantStyle(canvas, "max-height", "none");
            options.setImportantStyle(canvas, "transform", "none");
          }
        }
        return {
          fitElementToFrame,
          fitRenderCanvasesToFrame,
          fitRenderLayersToFrame
        };
      }

      // src/features/fullscreen-frame-layout.ts
      function createFullscreenFrameLayout(options) {
        const editorFrameLayout = createFullscreenEditorFrameLayout({
          setImportantStyle: options.setImportantStyle
        });
        function getScaledEditorFrame(editorLayer, dimensions = options.getFullscreenDimensions(void 0, "editor")) {
          return editorFrameLayout.getScaledEditorFrame(editorLayer, dimensions);
        }
        function fitEditorCanvasToNative(canvas, frame) {
          editorFrameLayout.fitEditorCanvasToNative(canvas, frame);
        }
        function fitEditorLayerToFrame(layer, dimensions = options.getFullscreenDimensions(void 0, "editor")) {
          return editorFrameLayout.fitEditorLayerToFrame(layer, dimensions);
        }
        const renderFrameLayout = createFullscreenRenderFrameLayout({
          fitEditorCanvasToNative,
          fitEditorLayerToFrame,
          getScaledEditorFrame,
          isEditorCanvas: options.isEditorCanvas,
          isEditorLayer: options.isEditorLayer,
          renderCanvasSelector: options.renderCanvasSelector,
          renderLayerSelector: options.renderLayerSelector,
          setImportantStyle: options.setImportantStyle
        });
        function fitElementToFrame(element, dimensions = options.getFullscreenDimensions(), left = 0, top = 0) {
          renderFrameLayout.fitElementToFrame(element, dimensions, left, top);
        }
        function enforceFullscreenLayout(dimensions = options.getFullscreenDimensions()) {
          options.ensureGlobalStyle();
          const menuDimensions = dimensions.mode === "menu" ? dimensions : options.getFullscreenDimensions(void 0, "menu");
          const playDimensions = dimensions.mode === "gameplay" || dimensions.mode === "editor" ? dimensions : options.getFullscreenDimensions(void 0, "gameplay");
          const activeDimensions = dimensions.mode === "gameplay" || dimensions.mode === "editor" ? playDimensions : menuDimensions;
          const relativeBounds = options.getRelativeContainerBounds(activeDimensions);
          applyFullscreenContainerLayout(options, dimensions, activeDimensions, relativeBounds);
          renderFrameLayout.fitRenderLayersToFrame(activeDimensions);
          renderFrameLayout.fitRenderCanvasesToFrame(activeDimensions);
          const uiZoom = String(options.getNativeUiZoom(activeDimensions));
          for (const overlay of document.querySelectorAll(".inGameCSS")) {
            options.setImportantStyle(overlay, "zoom", uiZoom);
            options.setImportantStyle(overlay, "transform-origin", "top left");
          }
          options.layoutRelativeHud(relativeBounds, activeDimensions);
          return true;
        }
        return {
          enforceFullscreenLayout,
          fitEditorCanvasToNative,
          fitEditorLayerToFrame,
          fitElementToFrame,
          getScaledEditorFrame
        };
      }

      // src/features/fullscreen-game-ready-hook.ts
      function createFullscreenGameReadyHook(options) {
        let installed = false;
        function scheduleFullscreenSettle() {
          options.scheduleUiWork({ force: true, passes: options.settlePasses });
        }
        function installGameReadyHook() {
          if (installed) {
            return;
          }
          installed = true;
          installNativeGameReadyHook(scheduleFullscreenSettle);
        }
        return {
          installGameReadyHook
        };
      }

      // src/features/fullscreen-inline-style.ts
      function getFullscreenInlineStyle(element) {
        if (isStyledElement(element)) {
          return element.style;
        }
        return null;
      }
      function removeFullscreenInlineProperties(element, properties) {
        const style = getFullscreenInlineStyle(element);
        if (!style) {
          return;
        }
        for (const property of properties) {
          style.removeProperty(property);
        }
      }
      function getFullscreenInlineStyleProperty(element, property) {
        return getFullscreenInlineStyle(element)?.getPropertyValue(property) ?? "";
      }

      // src/features/fullscreen-spectate-controls-layout.ts
      var CLOSED_CONTROLS_BOTTOM_OFFSET_PX = 12;
      var HELD_OPEN_CONTROLS_MARGIN_PX = 3;
      var RADIO_NEAR_OPEN_BOTTOM_PX = -2;
      var RADIO_CLOSING_REENTER_DELTA_PX = 0.5;
      var isPointerTrackingInstalled = false;
      var lastPointerPosition = null;
      function rememberPointerPosition(event) {
        lastPointerPosition = {
          x: event.clientX,
          y: event.clientY
        };
      }
      function clearPointerPosition() {
        lastPointerPosition = null;
      }
      function ensurePointerTracking() {
        if (isPointerTrackingInstalled) {
          return;
        }
        isPointerTrackingInstalled = true;
        window.addEventListener("pointermove", rememberPointerPosition, true);
        window.addEventListener("pointerdown", rememberPointerPosition, true);
        window.addEventListener("blur", clearPointerPosition, true);
        document.addEventListener(
          "pointerleave",
          (event) => {
            if (!event.relatedTarget) {
              clearPointerPosition();
            }
          },
          true
        );
      }
      function isPointerOverElement(element) {
        if (!lastPointerPosition) {
          return false;
        }
        const { x, y } = lastPointerPosition;
        if (x < 0 || y < 0 || x > window.innerWidth || y > window.innerHeight) {
          return false;
        }
        const hitElement = document.elementFromPoint(x, y);
        if (hitElement && (hitElement === element || element.contains(hitElement))) {
          return true;
        }
        const rect = element.getBoundingClientRect();
        return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
      }
      function isPointerInControlsTravelCorridor(controls, jukebox) {
        if (!lastPointerPosition) {
          return false;
        }
        const { x, y } = lastPointerPosition;
        const controlsRect = controls.getBoundingClientRect();
        const jukeboxRect = jukebox.getBoundingClientRect();
        if (controlsRect.width <= 0 || controlsRect.height <= 0 || jukeboxRect.width <= 0 || jukeboxRect.height <= 0) {
          return false;
        }
        const corridorLeft = controlsRect.left;
        const corridorRight = controlsRect.right;
        const corridorTop = Math.min(controlsRect.bottom, jukeboxRect.top);
        const corridorBottom = Math.max(controlsRect.bottom, jukeboxRect.top);
        return x >= corridorLeft && x <= corridorRight && y >= corridorTop && y <= corridorBottom;
      }
      function parseBottomPx(value) {
        const parsed = Number.parseFloat(typeof value === "string" ? value : "");
        return Number.isFinite(parsed) ? parsed : null;
      }
      function hasFocusedDescendant(element) {
        return document.activeElement instanceof Element && element.contains(document.activeElement);
      }
      function getElementBottomPx(element) {
        return parseBottomPx(getFullscreenInlineStyleProperty(element, "bottom")) ?? parseBottomPx(window.getComputedStyle(element).bottom);
      }
      function wantsToHoldSpectateControls(controls, jukebox) {
        return controls.matches(":hover") || isPointerOverElement(controls) || isPointerInControlsTravelCorridor(controls, jukebox) || hasFocusedDescendant(controls);
      }
      function isSpectateControlsAlreadyExpanded(controls, openOffset) {
        const bottom = getElementBottomPx(controls);
        return bottom !== null && bottom >= openOffset - HELD_OPEN_CONTROLS_MARGIN_PX;
      }
      function isNativeCallable6(value) {
        return typeof value === "function";
      }
      function callNativeJukeboxHandler(jukebox, handlerName, fallbackBottom) {
        const handler = readObjectProperty(jukebox, handlerName);
        if (isNativeCallable6(handler)) {
          Reflect.apply(handler, jukebox, []);
          return;
        }
        const style = readObjectProperty(jukebox, "style");
        if (style instanceof CSSStyleDeclaration) {
          style.bottom = fallbackBottom;
        }
      }
      function getSpectatorRadioLayoutState(options, spectatorRadioHoldActive, keepControlsOpenUntilRadioCloses) {
        const baseOffset = CLOSED_CONTROLS_BOTTOM_OFFSET_PX;
        const jukebox = document.querySelector(".jukebox");
        if (!(jukebox instanceof Element) || !options.isElementVisible(jukebox)) {
          return {
            controlsBottomOffset: baseOffset,
            jukebox: null,
            jukeboxDirectlyActive: false,
            jukeboxBottom: null,
            openOffset: baseOffset,
            shouldHoldRadioOpen: false
          };
        }
        const style = window.getComputedStyle(jukebox);
        const inlineBottom = getFullscreenInlineStyleProperty(jukebox, "bottom");
        const bottom = Number.parseFloat(typeof inlineBottom === "string" ? inlineBottom : style.bottom);
        const rect = jukebox.getBoundingClientRect();
        const height = rect.height || Number.parseFloat(style.height) || 35;
        const openOffset = Math.ceil(height + 36);
        const openProgress = Number.isFinite(bottom) ? Math.max(0, Math.min(1, (bottom + 50) / 50)) : 0;
        const jukeboxDirectlyActive = jukebox.matches(":hover") || hasFocusedDescendant(jukebox);
        const jukeboxIsActive = jukeboxDirectlyActive || openProgress > 0.05 || spectatorRadioHoldActive;
        const spectateControls = Array.from(document.querySelectorAll(options.spectateControlsSelector));
        const controlsAlreadyExpanded = spectateControls.some(
          (controls) => isSpectateControlsAlreadyExpanded(controls, openOffset)
        );
        const controlsWantHold = spectateControls.some((controls) => wantsToHoldSpectateControls(controls, jukebox));
        const holdControlsOpen = controlsAlreadyExpanded && controlsWantHold && jukeboxIsActive;
        const holdReleasedNearOpen = keepControlsOpenUntilRadioCloses && !controlsWantHold && !jukeboxDirectlyActive && Number.isFinite(bottom) && bottom > RADIO_NEAR_OPEN_BOTTOM_PX;
        const shouldHoldRadioOpen = holdControlsOpen && !jukeboxDirectlyActive;
        if (!Number.isFinite(bottom)) {
          const open = holdControlsOpen || holdReleasedNearOpen || jukeboxDirectlyActive;
          return {
            controlsBottomOffset: open ? openOffset : baseOffset,
            jukebox,
            jukeboxDirectlyActive,
            jukeboxBottom: null,
            openOffset,
            shouldHoldRadioOpen
          };
        }
        const liveOffset = Math.round(baseOffset + (openOffset - baseOffset) * openProgress);
        return {
          controlsBottomOffset: holdControlsOpen || holdReleasedNearOpen ? openOffset : liveOffset,
          jukebox,
          jukeboxDirectlyActive,
          jukeboxBottom: bottom,
          openOffset,
          shouldHoldRadioOpen
        };
      }
      function createFullscreenSpectateControlsLayout(options) {
        ensurePointerTracking();
        let pointerSyncFrame = 0;
        let keepControlsOpenUntilRadioCloses = false;
        let lastHeldJukeboxBottom = null;
        let spectatorRadioHoldActive = false;
        function schedulePointerSync() {
          if (pointerSyncFrame) {
            return;
          }
          pointerSyncFrame = window.requestAnimationFrame(() => {
            pointerSyncFrame = 0;
            syncSpectateControlsBottomWithJukebox();
          });
        }
        window.addEventListener("pointermove", schedulePointerSync, true);
        window.addEventListener("pointerdown", schedulePointerSync, true);
        function setSpectateControlsBottom(spectateControls, bottom) {
          if (getFullscreenInlineStyleProperty(spectateControls, "bottom") === bottom) {
            return false;
          }
          options.setImportantStyle(spectateControls, "bottom", bottom);
          return true;
        }
        function releaseSpectatorRadioHold() {
          keepControlsOpenUntilRadioCloses = false;
          lastHeldJukeboxBottom = null;
          if (!spectatorRadioHoldActive) {
            return;
          }
          spectatorRadioHoldActive = false;
          const jukebox = document.querySelector(".jukebox");
          if (jukebox instanceof Element && !jukebox.matches(":hover") && !hasFocusedDescendant(jukebox)) {
            callNativeJukeboxHandler(jukebox, "onmouseleave", "-50px");
          }
        }
        function syncJukeboxSpectatorHold(state) {
          if (!state.jukebox) {
            releaseSpectatorRadioHold();
            return false;
          }
          if (state.shouldHoldRadioOpen) {
            keepControlsOpenUntilRadioCloses = false;
            const radioAppearsToBeClosing = lastHeldJukeboxBottom !== null && state.jukeboxBottom !== null && state.jukeboxBottom < lastHeldJukeboxBottom - RADIO_CLOSING_REENTER_DELTA_PX;
            if (!spectatorRadioHoldActive || radioAppearsToBeClosing) {
              callNativeJukeboxHandler(state.jukebox, "onmouseenter", "0px");
            }
            spectatorRadioHoldActive = true;
            if (state.jukeboxBottom !== null) {
              lastHeldJukeboxBottom = state.jukeboxBottom;
            }
            return false;
          }
          if (keepControlsOpenUntilRadioCloses && (state.jukeboxDirectlyActive || state.jukeboxBottom === null || state.jukeboxBottom <= RADIO_NEAR_OPEN_BOTTOM_PX)) {
            keepControlsOpenUntilRadioCloses = false;
          }
          if (spectatorRadioHoldActive) {
            spectatorRadioHoldActive = false;
            lastHeldJukeboxBottom = null;
            if (!state.jukeboxDirectlyActive && state.jukeboxBottom !== null && state.jukeboxBottom > RADIO_NEAR_OPEN_BOTTOM_PX) {
              keepControlsOpenUntilRadioCloses = true;
            }
            if (!state.jukeboxDirectlyActive) {
              callNativeJukeboxHandler(state.jukebox, "onmouseleave", "-50px");
            }
            return keepControlsOpenUntilRadioCloses;
          }
          return false;
        }
        function resetSpectateControlsLayout(spectateControls) {
          releaseSpectatorRadioHold();
          removeFullscreenInlineProperties(spectateControls, [
            "position",
            "left",
            "right",
            "top",
            "bottom",
            "transform",
            "transition",
            "margin",
            "z-index"
          ]);
        }
        function syncSpectateControlsBottomWithJukebox() {
          if (!options.isFullscreenEnabled() || !options.isSessionMatchActive()) {
            releaseSpectatorRadioHold();
            return false;
          }
          const state = getSpectatorRadioLayoutState(
            options,
            spectatorRadioHoldActive,
            keepControlsOpenUntilRadioCloses
          );
          const forceOpenControls = syncJukeboxSpectatorHold(state);
          const bottom = `${forceOpenControls ? state.openOffset : state.controlsBottomOffset}px`;
          let changed = false;
          for (const controls of document.querySelectorAll(options.spectateControlsSelector)) {
            changed = setSpectateControlsBottom(controls, bottom) || changed;
          }
          return changed;
        }
        function layoutSpectateControls(useGameplayHudLayout) {
          if (!useGameplayHudLayout) {
            releaseSpectatorRadioHold();
          } else {
            const state = getSpectatorRadioLayoutState(
              options,
              spectatorRadioHoldActive,
              keepControlsOpenUntilRadioCloses
            );
            const forceOpenControls = syncJukeboxSpectatorHold(state);
            const controlsBottomOffset = forceOpenControls ? state.openOffset : state.controlsBottomOffset;
            for (const spectateControls of document.querySelectorAll(options.spectateControlsSelector)) {
              options.setImportantStyle(spectateControls, "position", "absolute");
              options.setImportantStyle(spectateControls, "left", "50%");
              options.setImportantStyle(spectateControls, "right", "auto");
              options.setImportantStyle(spectateControls, "top", "auto");
              setSpectateControlsBottom(spectateControls, `${controlsBottomOffset}px`);
              options.setImportantStyle(spectateControls, "transform", "translateX(-50%)");
              options.setImportantStyle(spectateControls, "margin", "0");
              options.setImportantStyle(spectateControls, "z-index", "2147483002");
            }
            return;
          }
          for (const spectateControls of document.querySelectorAll(options.spectateControlsSelector)) {
            resetSpectateControlsLayout(spectateControls);
          }
        }
        return {
          layoutSpectateControls,
          resetSpectateControlsLayout,
          syncSpectateControlsBottomWithJukebox
        };
      }

      // src/features/fullscreen-hud-layout.ts
      function isLoadingScreenVisible() {
        const loading = document.getElementById("ccLoading");
        if (!loading || !loading.isConnected) {
          return false;
        }
        const style = window.getComputedStyle(loading);
        return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
      }
      function createFullscreenHudLayout(options) {
        const spectateControlsLayout = createFullscreenSpectateControlsLayout({
          isElementVisible: options.isElementVisible,
          isFullscreenEnabled: options.isFullscreenEnabled,
          isSessionMatchActive: options.isSessionMatchActive,
          setImportantStyle: options.setImportantStyle,
          spectateControlsSelector: options.spectateControlsSelector
        });
        function resetScorePanelLayout(scorePanel) {
          removeFullscreenInlineProperties(scorePanel, [
            "position",
            "left",
            "top",
            "right",
            "bottom",
            "transform",
            "text-align",
            "margin-top",
            "z-index"
          ]);
        }
        function resetSpectateControlsLayout(spectateControls) {
          spectateControlsLayout.resetSpectateControlsLayout(spectateControls);
        }
        function syncSpectateControlsBottomWithJukebox() {
          return spectateControlsLayout.syncSpectateControlsBottomWithJukebox();
        }
        function layoutRelativeHud(_relativeBounds, dimensions) {
          const isLoading = isLoadingScreenVisible();
          const useGameplayHudLayout = !isLoading && (dimensions.mode === "gameplay" || options.isSessionMatchActive() && options.hasVisibleLayer(options.spectateControlsSelector));
          for (const scorePanel of document.querySelectorAll(options.scoresSelector)) {
            if (!useGameplayHudLayout) {
              resetScorePanelLayout(scorePanel);
              options.setImportantStyle(scorePanel, "display", "none");
              continue;
            }
            options.syncScoreRowsFromPlayers(scorePanel);
            options.makeScoreRowsOpaque(scorePanel);
            options.syncTypingIndicators(scorePanel);
            options.setImportantStyle(scorePanel, "display", "block");
            options.setImportantStyle(scorePanel, "position", "absolute");
            options.setImportantStyle(scorePanel, "left", "50%");
            options.setImportantStyle(scorePanel, "top", "12px");
            options.setImportantStyle(scorePanel, "right", "auto");
            options.setImportantStyle(scorePanel, "bottom", "auto");
            options.setImportantStyle(scorePanel, "transform", "translateX(-50%)");
            options.setImportantStyle(scorePanel, "text-align", "center");
            options.setImportantStyle(scorePanel, "margin-top", "0");
            options.setImportantStyle(scorePanel, "z-index", "10");
          }
          spectateControlsLayout.layoutSpectateControls(useGameplayHudLayout);
        }
        return {
          layoutRelativeHud,
          resetScorePanelLayout,
          resetSpectateControlsLayout,
          syncSpectateControlsBottomWithJukebox
        };
      }

      // src/features/fullscreen-resize-target-observer.ts
      function createFullscreenResizeTargetObserver(options) {
        let resizeObserver = null;
        let observedResizeTargets = /* @__PURE__ */ new WeakSet();
        function setFullscreenResizeObserver(observer) {
          resizeObserver = observer;
          if (!observer) {
            observedResizeTargets = /* @__PURE__ */ new WeakSet();
          }
        }
        function observeResizeTarget(element) {
          if (!resizeObserver || !(element instanceof Element) || observedResizeTargets.has(element)) {
            return;
          }
          observedResizeTargets.add(element);
          resizeObserver.observe(element);
        }
        function refreshObservedResizeTargets() {
          observeResizeTarget(document.documentElement);
          observeResizeTarget(document.body);
          observeResizeTarget(document.getElementById("appContainer"));
          observeResizeTarget(document.getElementById("relativeContainer"));
          observeResizeTarget(document.getElementById("backgroundImage"));
          for (const element of document.querySelectorAll(options.renderLayerSelector)) {
            observeResizeTarget(element);
          }
          for (const element of document.querySelectorAll(options.renderCanvasSelector)) {
            observeResizeTarget(element);
          }
        }
        return {
          refreshObservedResizeTargets,
          setFullscreenResizeObserver
        };
      }

      // src/features/fullscreen-layout-feature-bundle.ts
      function createFullscreenLayoutFeatureBundle(options) {
        const hudLayout = createFullscreenHudLayout({
          scoresSelector: ".scores",
          spectateControlsSelector: ".spectateControls",
          hasVisibleLayer,
          isElementVisible,
          isFullscreenEnabled: options.isFullscreenEnabled,
          isSessionMatchActive,
          makeScoreRowsOpaque: options.makeScoreRowsOpaque,
          setImportantStyle: options.setImportantStyle,
          syncScoreRowsFromPlayers: options.syncScoreRowsFromPlayers,
          syncTypingIndicators: options.syncTypingIndicators
        });
        const frameLayout = createFullscreenFrameLayout({
          renderCanvasSelector: FULLSCREEN_RENDER_CANVAS_SELECTOR,
          renderLayerSelector: FULLSCREEN_RENDER_LAYER_SELECTOR,
          ensureGlobalStyle: options.ensureGlobalStyle,
          getFullscreenDimensions: options.getFullscreenDimensions,
          getNativeUiZoom: options.getNativeUiZoom,
          getRelativeContainerBounds: options.getRelativeContainerBounds,
          isEditorCanvas: options.isEditorCanvas,
          isEditorLayer: options.isEditorLayer,
          layoutRelativeHud: hudLayout.layoutRelativeHud,
          setImportantStyle: options.setImportantStyle
        });
        const cleanup = createFullscreenCleanup({
          renderCanvasSelector: FULLSCREEN_RENDER_CANVAS_SELECTOR,
          renderLayerSelector: FULLSCREEN_RENDER_LAYER_SELECTOR,
          clearFullscreenSignature: options.clearFullscreenSignature,
          clearFullscreenStyleSnapshots: options.clearFullscreenStyleSnapshots,
          resetScorePanelLayout: hudLayout.resetScorePanelLayout,
          resetSpectateControlsLayout: hudLayout.resetSpectateControlsLayout,
          restoreFullscreenStyles: options.restoreFullscreenStyles,
          restoreNativeFullscreenPatch: options.restoreNativeFullscreenPatch,
          restoreNativeLayoutSizeFallback: options.restoreNativeLayoutSizeFallback
        });
        const gameReadyHook = createFullscreenGameReadyHook({
          scheduleUiWork: options.scheduleUiWork,
          settlePasses: FULLSCREEN_SETTLE_PASSES
        });
        const resizeTargets = createFullscreenResizeTargetObserver({
          renderCanvasSelector: FULLSCREEN_RENDER_CANVAS_SELECTOR,
          renderLayerSelector: FULLSCREEN_RENDER_LAYER_SELECTOR
        });
        function resizeFullscreenRenderers(dimensions) {
          resizeKnownFullscreenRenderers({
            dimensions,
            fitElementToFrame: frameLayout.fitElementToFrame,
            setImportantStyle: options.setImportantStyle
          });
        }
        return {
          ...hudLayout,
          ...frameLayout,
          ...cleanup,
          ...gameReadyHook,
          ...resizeTargets,
          resizeKnownFullscreenRenderers: resizeFullscreenRenderers
        };
      }

      // src/features/fullscreen-hook-installer.ts
      function createFullscreenHookInstaller(options) {
        let installed = false;
        function scheduleResizeSettle() {
          options.scheduleUiWork({ force: true, passes: options.resizeSettlePasses });
        }
        function installFullscreenHooks() {
          if (installed) {
            return;
          }
          if (!document.documentElement) {
            options.scheduleUiWork({ force: true, features: true, passes: options.fullscreenSettlePasses });
            return;
          }
          installed = true;
          options.installGameReadyHook();
          options.installQolboxMenuHooks();
          options.installChatEscapeHooks();
          options.installChatCommandAliasHooks();
          options.installGameplayBackgroundFocusHooks();
          if (options.isAudioEnabled()) {
            options.installTabFocusHooks();
          }
          if (options.isGameStartAlertEnabled()) {
            options.installGameStartIndicatorHooks();
          }
          if (options.isReserveEnabled()) {
            options.installReserveSocketCaptureHook();
          }
          window.addEventListener("resize", scheduleResizeSettle, true);
          window.addEventListener("orientationchange", scheduleResizeSettle, true);
          window.addEventListener(
            "load",
            () => options.scheduleUiWork({ force: true, features: true, passes: options.fullscreenSettlePasses }),
            true
          );
          window.addEventListener(
            "pageshow",
            () => options.scheduleUiWork({ force: true, features: true, passes: options.resizeSettlePasses }),
            true
          );
          document.addEventListener(
            "visibilitychange",
            () => {
              if (!document.hidden) {
                options.scheduleUiWork({ force: true, features: true, passes: options.resizeSettlePasses });
              }
            },
            true
          );
          document.addEventListener("fullscreenchange", scheduleResizeSettle, true);
          options.installFullscreenMutationObserver(document.documentElement);
          const ResizeObserverConstructor = window.ResizeObserver;
          if (typeof ResizeObserverConstructor === "function") {
            options.setFullscreenResizeObserver(
              new ResizeObserverConstructor(() => {
                options.scheduleUiWork({ force: true, passes: 1 });
              })
            );
            options.refreshObservedResizeTargets();
          }
        }
        return {
          installFullscreenHooks
        };
      }

      // src/features/fullscreen-mutation-observer.ts
      var FULLSCREEN_OBSERVER_OPTIONS = {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
        attributeFilter: ["class", "style", "id"]
      };
      function createFullscreenMutationObserver(options) {
        let fullscreenMutationObserver = null;
        function handleMutationRecords(records) {
          let needsLayout = false;
          let needsFeatures = false;
          let needsSpectateSync = false;
          for (const record of records) {
            if (!needsLayout && mutationTouchesSelector(record, options.layoutTargetSelector)) {
              needsLayout = true;
            }
            if (!needsFeatures && mutationTouchesSelector(record, options.featurePatchTargetSelector)) {
              needsFeatures = true;
            }
            if (!needsSpectateSync && mutationTouchesSelector(record, ".jukebox")) {
              needsSpectateSync = true;
            }
            if (needsLayout && needsFeatures && needsSpectateSync) {
              break;
            }
          }
          if (needsSpectateSync) {
            options.syncSpectateControlsBottomWithJukebox();
          }
          if (needsLayout || needsFeatures) {
            options.updateGameStartIndicator();
            options.scheduleUiWork({
              force: needsLayout,
              features: needsFeatures,
              passes: needsLayout ? options.settlePasses : 1
            });
          }
        }
        function installFullscreenMutationObserver(target = document.documentElement) {
          if (!target) {
            return;
          }
          fullscreenMutationObserver = new MutationObserver(handleMutationRecords);
          fullscreenMutationObserver.observe(target, FULLSCREEN_OBSERVER_OPTIONS);
        }
        return {
          installFullscreenMutationObserver
        };
      }

      // src/features/fullscreen-refresh-controller.ts
      function createFullscreenRefreshController(options) {
        let lastFullscreenSignature = "";
        function clearFullscreenSignature() {
          lastFullscreenSignature = "";
        }
        function refreshFullscreen(force = false) {
          if (!options.isFullscreenEnabled()) {
            options.clearFullscreenLayoutStyles();
            options.syncNonFullscreenHud();
            return false;
          }
          if (options.shouldWaitForNativeLayoutSeed()) {
            window.setTimeout(() => options.scheduleUiWork({ force: true, passes: 1 }), 100);
            return false;
          }
          const dimensions = options.getFullscreenDimensions();
          const probe = options.getLayoutProbe();
          const signature = options.buildFullscreenSignature(dimensions, probe);
          const transitionOverlap = options.isMenuGameplayOverlap();
          options.patchLobbyMusicController();
          options.stopLobbyMusicIfNeeded();
          options.updateGameStartIndicator();
          options.enforceFullscreenLayout(dimensions);
          options.installNativeFullscreenPatch();
          options.setNativeFullscreenSize(dimensions);
          if (!force && signature === lastFullscreenSignature && options.isRenderProbeAligned(probe, dimensions) && options.isNativeProbeAligned(probe, dimensions)) {
            return false;
          }
          lastFullscreenSignature = signature;
          const resizedNatively = options.runNativeResize(dimensions);
          const postNativeProbe = options.getLayoutProbe();
          if (!transitionOverlap && (!resizedNatively || !options.isRenderProbeAligned(postNativeProbe, dimensions))) {
            options.resizeKnownFullscreenRenderers(dimensions);
          }
          options.enforceFullscreenLayout(dimensions);
          lastFullscreenSignature = options.buildFullscreenSignature(dimensions, options.getLayoutProbe());
          return true;
        }
        return {
          clearFullscreenSignature,
          refreshFullscreen
        };
      }

      // src/features/fullscreen-work-scheduler.ts
      function createFullscreenWorkScheduler(options) {
        let scheduledWorkRaf = 0;
        let scheduledWorkForce = false;
        let scheduledWorkFeatures = false;
        let scheduledWorkPasses = 0;
        function scheduleUiWork({ force = false, features = false, passes = 1 } = {}) {
          scheduledWorkForce = scheduledWorkForce || force;
          scheduledWorkFeatures = scheduledWorkFeatures || features;
          scheduledWorkPasses = Math.max(scheduledWorkPasses, Math.max(1, passes));
          if (scheduledWorkRaf) {
            return;
          }
          const runScheduledWork = () => {
            scheduledWorkRaf = 0;
            const shouldForce = scheduledWorkForce;
            const shouldPatchFeatures = scheduledWorkFeatures;
            const remainingPasses = scheduledWorkPasses;
            scheduledWorkForce = false;
            scheduledWorkFeatures = false;
            scheduledWorkPasses = 0;
            options.ensureGlobalStyle();
            options.applyFeatureRootClasses();
            options.installFullscreenHooks();
            if (shouldPatchFeatures) {
              options.applyPersistentFeatures();
            }
            options.refreshFullscreen(shouldForce);
            options.refreshObservedResizeTargets();
            if (remainingPasses > 1) {
              scheduleUiWork({ force: true, passes: remainingPasses - 1 });
            }
          };
          scheduledWorkRaf = document.hidden ? window.setTimeout(runScheduledWork, 0) : window.requestAnimationFrame(runScheduledWork);
        }
        return {
          scheduleUiWork
        };
      }

      // src/features/fullscreen-orchestration-bundle.ts
      function createFullscreenOrchestrationBundle(options) {
        const { clearFullscreenSignature, refreshFullscreen } = createFullscreenRefreshController({
          buildFullscreenSignature: options.buildFullscreenSignature,
          clearFullscreenLayoutStyles: options.clearFullscreenLayoutStyles,
          enforceFullscreenLayout: options.enforceFullscreenLayout,
          getFullscreenDimensions: options.getFullscreenDimensions,
          getLayoutProbe: options.getLayoutProbe,
          installNativeFullscreenPatch: options.installNativeFullscreenPatch,
          isFullscreenEnabled: options.isFullscreenEnabled,
          isMenuGameplayOverlap: options.isMenuGameplayOverlap,
          isNativeProbeAligned: options.isNativeProbeAligned,
          isRenderProbeAligned: options.isRenderProbeAligned,
          patchLobbyMusicController: options.patchLobbyMusicController,
          resizeKnownFullscreenRenderers: options.resizeKnownFullscreenRenderers,
          runNativeResize: options.runNativeResize,
          scheduleUiWork: (request) => scheduleUiWork(request),
          setNativeFullscreenSize: options.setNativeFullscreenSize,
          shouldWaitForNativeLayoutSeed: options.shouldWaitForNativeLayoutSeed,
          stopLobbyMusicIfNeeded: options.stopLobbyMusicIfNeeded,
          syncNonFullscreenHud: options.syncNonFullscreenHud,
          updateGameStartIndicator: options.updateGameStartIndicator
        });
        const { scheduleUiWork } = createFullscreenWorkScheduler({
          applyFeatureRootClasses: options.applyFeatureRootClasses,
          applyPersistentFeatures: options.applyPersistentFeatures,
          ensureGlobalStyle: options.ensureGlobalStyle,
          installFullscreenHooks: () => installFullscreenHooks(),
          refreshFullscreen,
          refreshObservedResizeTargets: options.refreshObservedResizeTargets
        });
        const { installFullscreenMutationObserver } = createFullscreenMutationObserver({
          featurePatchTargetSelector: FEATURE_PATCH_TARGET_SELECTOR,
          layoutTargetSelector: FULLSCREEN_LAYOUT_TARGET_SELECTOR,
          scheduleUiWork,
          settlePasses: FULLSCREEN_SETTLE_PASSES,
          syncSpectateControlsBottomWithJukebox: options.syncSpectateControlsBottomWithJukebox,
          updateGameStartIndicator: options.updateGameStartIndicator
        });
        const { installFullscreenHooks } = createFullscreenHookInstaller({
          fullscreenSettlePasses: FULLSCREEN_SETTLE_PASSES,
          installChatCommandAliasHooks: options.installChatCommandAliasHooks,
          installChatEscapeHooks: options.installChatEscapeHooks,
          installFullscreenMutationObserver,
          installGameReadyHook: options.installGameReadyHook,
          installGameStartIndicatorHooks: options.installGameStartIndicatorHooks,
          installGameplayBackgroundFocusHooks: options.installGameplayBackgroundFocusHooks,
          installQolboxMenuHooks: options.installQolboxMenuHooks,
          installReserveSocketCaptureHook: options.installReserveSocketCaptureHook,
          installTabFocusHooks: options.installTabFocusHooks,
          isAudioEnabled: options.isAudioEnabled,
          isGameStartAlertEnabled: options.isGameStartAlertEnabled,
          isReserveEnabled: options.isReserveEnabled,
          refreshObservedResizeTargets: options.refreshObservedResizeTargets,
          resizeSettlePasses: RESIZE_SETTLE_PASSES,
          scheduleUiWork,
          setFullscreenResizeObserver: options.setFullscreenResizeObserver
        });
        return {
          clearFullscreenSignature,
          installFullscreenHooks,
          installFullscreenMutationObserver,
          refreshFullscreen,
          scheduleUiWork: (request) => scheduleUiWork(request)
        };
      }

      // src/hitbox/game-start-hooks.ts
      var REMOTE_START_METHODS = ["KJ", "ZJ"];
      var LOCAL_START_METHOD = "_J";
      function isNativeCallable7(value) {
        return typeof value === "function";
      }
      function isWrappedGameStartMethod(method) {
        return isNativeCallable7(method) && readNativeReflectProperty(method, "__qolboxWrapped") === true;
      }
      function markWrappedGameStartMethod(method, originalMethod) {
        setNativeReflectProperty(method, "__qolboxWrapped", true);
        setNativeReflectProperty(method, "__qolboxOriginal", originalMethod);
      }
      function areGameStartSessionHooksInstalled(session) {
        return [...REMOTE_START_METHODS, LOCAL_START_METHOD].every((methodName) => {
          const method = readNativeProperty(session, methodName);
          return !isNativeCallable7(method) || isWrappedGameStartMethod(method);
        });
      }
      function installGameStartSessionHooks(session, callbacks) {
        if (!isNativeObject(session)) {
          return false;
        }
        let foundRemoteStartHandler = false;
        for (const methodName of REMOTE_START_METHODS) {
          const originalMethod = readNativeProperty(session, methodName);
          if (!isNativeCallable7(originalMethod)) {
            continue;
          }
          foundRemoteStartHandler = true;
          if (isWrappedGameStartMethod(originalMethod)) {
            continue;
          }
          const wrappedMethod = function wrappedGameStartSessionMethod(...args) {
            const snapshot = callbacks.captureStartState();
            let result;
            try {
              result = Reflect.apply(originalMethod, this, args);
            } finally {
              callbacks.handleStartAfterNativeEvent(snapshot, this);
            }
            return result;
          };
          markWrappedGameStartMethod(wrappedMethod, originalMethod);
          setNativeReflectProperty(session, methodName, wrappedMethod);
        }
        const originalStartRequest = readNativeProperty(session, LOCAL_START_METHOD);
        if (isNativeCallable7(originalStartRequest) && !isWrappedGameStartMethod(originalStartRequest)) {
          const wrappedStartRequest = function wrappedLocalGameStartRequest(...args) {
            callbacks.noteLocalStartRequest(this);
            return Reflect.apply(originalStartRequest, this, args);
          };
          markWrappedGameStartMethod(wrappedStartRequest, originalStartRequest);
          setNativeReflectProperty(session, LOCAL_START_METHOD, wrappedStartRequest);
        }
        const startRequest = readNativeProperty(session, LOCAL_START_METHOD);
        return foundRemoteStartHandler || isNativeCallable7(startRequest) && isWrappedGameStartMethod(startRequest);
      }

      // src/features/game-start-display.ts
      function createGameStartDisplayController() {
        let faviconLink = null;
        let originalFavicon = null;
        function getIndicatorDocument() {
          try {
            const targetWindow = window.top;
            if (targetWindow && targetWindow.document) {
              return targetWindow.document;
            }
          } catch {
          }
          return document;
        }
        function getFaviconLink() {
          return getIndicatorDocument().querySelector('link[rel~="icon"]');
        }
        function shouldPostToTop() {
          const targetWindow = window.top;
          if (!targetWindow || targetWindow === window) {
            return false;
          }
          try {
            return !targetWindow.document;
          } catch {
            return true;
          }
        }
        function postToTop(payload) {
          if (!shouldPostToTop()) {
            return;
          }
          try {
            window.top?.postMessage(
              {
                ...payload,
                feature: "gameStartIndicator",
                source: "QOLBox"
              },
              "*"
            );
          } catch {
          }
        }
        function saveFavicon() {
          if (originalFavicon) {
            return;
          }
          const targetDocument = getIndicatorDocument();
          const link = getFaviconLink();
          originalFavicon = link ? {
            href: link.getAttribute("href"),
            link,
            type: link.getAttribute("type")
          } : { href: null, link: null, type: null };
          faviconLink = link || targetDocument.createElement("link");
          if (!link) {
            faviconLink.rel = "icon";
            (targetDocument.head || targetDocument.documentElement).appendChild(faviconLink);
          }
        }
        function setFavicon(active) {
          saveFavicon();
          if (!faviconLink) {
            return;
          }
          if (active) {
            faviconLink.setAttribute("href", GAME_START_FAVICON_HREF);
            faviconLink.setAttribute("type", "image/svg+xml");
            postToTop({ action: "favicon", active: true });
            return;
          }
          if (originalFavicon?.href) {
            faviconLink.setAttribute("href", originalFavicon.href);
          } else {
            faviconLink.removeAttribute("href");
          }
          if (originalFavicon?.type) {
            faviconLink.setAttribute("type", originalFavicon.type);
          } else {
            faviconLink.removeAttribute("type");
          }
          postToTop({ action: "favicon", active: false });
        }
        function restoreFavicon() {
          if (!originalFavicon || !faviconLink) {
            return;
          }
          if (!originalFavicon.link) {
            faviconLink.remove();
          } else {
            setFavicon(false);
          }
          faviconLink = null;
          originalFavicon = null;
        }
        function getTitle() {
          return getIndicatorDocument().title || "";
        }
        function setTitle(title) {
          getIndicatorDocument().title = title;
          postToTop({ action: "title", title });
        }
        function postClear() {
          postToTop({ action: "clear" });
        }
        return {
          getTitle,
          postClear,
          restoreFavicon,
          setFavicon,
          setTitle
        };
      }

      // src/features/game-start-focus-hooks.ts
      function createGameStartFocusHookInstaller({
        handleAway,
        handleInteractionFocus,
        handleReturn,
        handleVisibilityChange,
        initializeFocusState
      }) {
        let hooksInstalled = false;
        function installGameStartIndicatorHooks() {
          if (hooksInstalled) {
            return;
          }
          hooksInstalled = true;
          initializeFocusState();
          document.addEventListener("pointerdown", handleInteractionFocus, true);
          document.addEventListener("mousedown", handleInteractionFocus, true);
          document.addEventListener("click", handleInteractionFocus, true);
          document.addEventListener("keydown", handleInteractionFocus, true);
          window.addEventListener("focus", handleReturn, true);
          window.addEventListener("blur", handleAway, true);
          document.addEventListener("visibilitychange", handleVisibilityChange, true);
        }
        return {
          installGameStartIndicatorHooks
        };
      }

      // src/features/game-start-local-transition.ts
      function createLocalPlayTransitionTracker(options) {
        let localTransitionSession = null;
        let localTransitionUntil = 0;
        function clear() {
          localTransitionSession = null;
          localTransitionUntil = 0;
        }
        function note(session = options.getSession()) {
          if (!session) {
            return false;
          }
          localTransitionSession = session;
          localTransitionUntil = Date.now() + options.timeoutMs;
          return true;
        }
        function has(session = options.getSession()) {
          if (!localTransitionSession || Date.now() > localTransitionUntil) {
            clear();
            return false;
          }
          return localTransitionSession === session;
        }
        function consume(session = options.getSession()) {
          if (!has(session)) {
            return false;
          }
          clear();
          return true;
        }
        return {
          clear,
          consume,
          has,
          note
        };
      }

      // src/features/game-start-timers.ts
      function createGameStartTimerController() {
        let indicatorTimer = 0;
        let watchTimer = 0;
        let endWatchTimer = 0;
        let flashTimer = 0;
        function clearIndicatorTimer() {
          if (indicatorTimer) {
            window.clearTimeout(indicatorTimer);
            indicatorTimer = 0;
          }
        }
        function clearWatchTimer() {
          if (watchTimer) {
            window.clearTimeout(watchTimer);
            watchTimer = 0;
          }
        }
        function clearEndWatchTimer() {
          if (endWatchTimer) {
            window.clearTimeout(endWatchTimer);
            endWatchTimer = 0;
          }
        }
        function clearFlashTimer() {
          if (flashTimer) {
            window.clearTimeout(flashTimer);
            flashTimer = 0;
          }
        }
        function setIndicatorTimer(callback, delayMs) {
          indicatorTimer = window.setTimeout(() => {
            indicatorTimer = 0;
            callback();
          }, delayMs);
        }
        function setWatchTimer(callback, delayMs) {
          watchTimer = window.setTimeout(() => {
            watchTimer = 0;
            callback();
          }, delayMs);
        }
        function setEndWatchTimer(callback, delayMs) {
          endWatchTimer = window.setTimeout(() => {
            endWatchTimer = 0;
            callback();
          }, delayMs);
        }
        function setFlashTimer(callback, delayMs) {
          flashTimer = window.setTimeout(callback, delayMs);
        }
        function hasIndicatorTimer() {
          return Boolean(indicatorTimer);
        }
        function hasWatchTimer() {
          return Boolean(watchTimer);
        }
        function hasEndWatchTimer() {
          return Boolean(endWatchTimer);
        }
        return {
          clearEndWatchTimer,
          clearFlashTimer,
          clearIndicatorTimer,
          clearWatchTimer,
          hasEndWatchTimer,
          hasIndicatorTimer,
          hasWatchTimer,
          setEndWatchTimer,
          setFlashTimer,
          setIndicatorTimer,
          setWatchTimer
        };
      }

      // src/features/game-start-indicator.ts
      function getTitlePrefix(reason) {
        return reason === "pulled" ? GAME_PULLED_TITLE_PREFIX : GAME_START_TITLE_PREFIX;
      }
      function createGameStartIndicatorController(options) {
        const display = createGameStartDisplayController();
        const localPlayTransition = createLocalPlayTransitionTracker({
          getSession: options.getSession,
          timeoutMs: options.localTransitionTimeoutMs
        });
        let sessionHookTarget = null;
        let indicatorActive = false;
        const timers = createGameStartTimerController();
        let flashOn = false;
        let originalTitle = "";
        let wasPlayingWhenUnfocused = false;
        let wasInLobbyWhenUnfocused = false;
        let observedSession = null;
        let wasSessionActive = false;
        let sessionEntryGraceSession = null;
        let sessionEntryGraceUntil = 0;
        let indicatorReason = "started";
        let pageFocused = true;
        const focusHooks = createGameStartFocusHookInstaller({
          handleAway,
          handleInteractionFocus,
          handleReturn,
          handleVisibilityChange,
          initializeFocusState
        });
        function isIndicatorPageFocused() {
          return pageFocused && options.isPageFocused();
        }
        function getPolledReason() {
          return wasInLobbyWhenUnfocused ? "started" : "pulled";
        }
        function clearIndicatorTimer() {
          timers.clearIndicatorTimer();
        }
        function clearWatchTimer() {
          timers.clearWatchTimer();
        }
        function clearEndWatchTimer() {
          timers.clearEndWatchTimer();
        }
        function clearFlashTimer() {
          timers.clearFlashTimer();
        }
        function flashIndicator() {
          if (!indicatorActive) {
            return;
          }
          flashOn = !flashOn;
          display.setTitle(`${getTitlePrefix(indicatorReason)}${originalTitle}`);
          display.setFavicon(flashOn);
          timers.setFlashTimer(flashIndicator, options.getFlashIntervalMs());
        }
        function scheduleEndWatch() {
          if (!indicatorActive || timers.hasEndWatchTimer()) {
            return;
          }
          timers.setEndWatchTimer(() => {
            if (!indicatorActive) {
              return;
            }
            if (!options.isPlayingMatch()) {
              wasPlayingWhenUnfocused = false;
              wasInLobbyWhenUnfocused = options.isPlayableLobby();
              clearIndicator();
              if (!isIndicatorPageFocused()) {
                scheduleWatch();
              }
              return;
            }
            scheduleEndWatch();
          }, options.endWatchIntervalMs);
        }
        function showIndicator(reason = "started") {
          if (!options.isEnabled()) {
            return;
          }
          if (indicatorActive) {
            scheduleEndWatch();
            return;
          }
          indicatorReason = reason;
          originalTitle = stripGameStartTitlePrefix(display.getTitle());
          indicatorActive = true;
          flashOn = false;
          clearFlashTimer();
          flashIndicator();
          scheduleEndWatch();
        }
        function clearIndicator() {
          clearIndicatorTimer();
          clearEndWatchTimer();
          clearFlashTimer();
          if (!indicatorActive) {
            return;
          }
          display.setTitle(originalTitle);
          display.restoreFavicon();
          display.postClear();
          originalTitle = "";
          flashOn = false;
          indicatorReason = "started";
          indicatorActive = false;
        }
        function noteLocallyInitiatedPlayTransition(session = options.getSession()) {
          if (!options.isEnabled()) {
            return;
          }
          if (localPlayTransition.note(session)) {
            clearIndicatorTimer();
          }
        }
        function hasPendingLocalPlayTransition(session = options.getSession()) {
          return localPlayTransition.has(session);
        }
        function consumePendingLocalPlayTransition(session = options.getSession()) {
          return localPlayTransition.consume(session);
        }
        function clearSessionEntryGrace() {
          sessionEntryGraceSession = null;
          sessionEntryGraceUntil = 0;
        }
        function noteSessionEntryGrace(session) {
          if (!session) {
            clearSessionEntryGrace();
            return;
          }
          sessionEntryGraceSession = session;
          sessionEntryGraceUntil = Date.now() + options.sessionEntryGraceMs;
        }
        function consumeSessionEntryGrace(session = options.getSession()) {
          if (!sessionEntryGraceSession || sessionEntryGraceSession !== session || Date.now() > sessionEntryGraceUntil) {
            clearSessionEntryGrace();
            return false;
          }
          clearSessionEntryGrace();
          return true;
        }
        function observeSessionEntry(session) {
          if (!session) {
            return;
          }
          if (session !== observedSession) {
            observedSession = session;
            wasSessionActive = false;
          }
          const sessionActive = options.isSessionActive();
          if (!sessionActive) {
            wasSessionActive = false;
            clearSessionEntryGrace();
            return;
          }
          if (!wasSessionActive) {
            if (options.isMatchActive()) {
              noteSessionEntryGrace(session);
            } else {
              clearSessionEntryGrace();
            }
          }
          wasSessionActive = true;
        }
        function scheduleIndicator(reason = "pulled") {
          if (!options.isEnabled() || timers.hasIndicatorTimer() || isIndicatorPageFocused()) {
            return;
          }
          clearWatchTimer();
          indicatorReason = reason;
          timers.setIndicatorTimer(() => {
            if (!isIndicatorPageFocused() && !wasPlayingWhenUnfocused && !hasPendingLocalPlayTransition() && options.isPlayingMatch() && !options.isPlayableLobby()) {
              showIndicator(indicatorReason);
            }
          }, options.getIndicatorDelayMs());
        }
        function scheduleWatch() {
          if (!options.isEnabled() || timers.hasWatchTimer() || isIndicatorPageFocused() || indicatorActive) {
            return;
          }
          timers.setWatchTimer(() => {
            updateGameStartIndicator();
            if (!indicatorActive && !isIndicatorPageFocused()) {
              scheduleWatch();
            }
          }, options.watchIntervalMs);
        }
        function handleStartAfterNativeEvent(wasPlayingMatch, wasPlayableLobby, session = options.getSession()) {
          const startedPlaying = !wasPlayingMatch && options.isPlayingMatch();
          if (startedPlaying && consumePendingLocalPlayTransition(session)) {
            wasPlayingWhenUnfocused = true;
            wasInLobbyWhenUnfocused = false;
            clearWatchTimer();
            clearIndicatorTimer();
            return;
          }
          if (startedPlaying && wasPlayableLobby && !isIndicatorPageFocused()) {
            clearWatchTimer();
            clearIndicatorTimer();
            showIndicator("started");
            return;
          }
          updateGameStartIndicator();
        }
        function patchMultiplayerSessionGameStartHooks(session = options.getSession()) {
          if (!options.isEnabled() || !session) {
            return;
          }
          observeSessionEntry(session);
          if (session === sessionHookTarget && areGameStartSessionHooksInstalled(session)) {
            return;
          }
          if (session !== sessionHookTarget && !isIndicatorPageFocused() && options.isPlayingMatch()) {
            wasPlayingWhenUnfocused = true;
            wasInLobbyWhenUnfocused = false;
            clearIndicatorTimer();
          }
          if (installGameStartSessionHooks(session, {
            captureStartState: () => ({
              wasPlayingMatch: options.isPlayingMatch(),
              wasPlayableLobby: options.isPlayableLobby()
            }),
            handleStartAfterNativeEvent: ({ wasPlayingMatch, wasPlayableLobby }, eventSession) => {
              handleStartAfterNativeEvent(wasPlayingMatch, wasPlayableLobby, eventSession);
            },
            noteLocalStartRequest: noteLocallyInitiatedPlayTransition
          })) {
            sessionHookTarget = session;
          }
        }
        function updateGameStartIndicator() {
          if (!options.isEnabled()) {
            wasPlayingWhenUnfocused = false;
            clearWatchTimer();
            clearIndicator();
            return;
          }
          const playingMatch = options.isPlayingMatch();
          const playableLobby = options.isPlayableLobby();
          patchMultiplayerSessionGameStartHooks();
          if (isIndicatorPageFocused()) {
            wasPlayingWhenUnfocused = playingMatch;
            wasInLobbyWhenUnfocused = false;
            return;
          }
          if (playableLobby) {
            wasPlayingWhenUnfocused = false;
            wasInLobbyWhenUnfocused = true;
            scheduleWatch();
            return;
          }
          if (!wasPlayingWhenUnfocused && playingMatch) {
            if (consumeSessionEntryGrace()) {
              wasPlayingWhenUnfocused = true;
              wasInLobbyWhenUnfocused = false;
              clearWatchTimer();
              clearIndicatorTimer();
              return;
            }
            scheduleIndicator(getPolledReason());
            return;
          }
          if (!playingMatch) {
            wasPlayingWhenUnfocused = false;
            wasInLobbyWhenUnfocused = false;
            clearSessionEntryGrace();
            clearWatchTimer();
            clearIndicator();
            scheduleWatch();
          }
        }
        function handleReturn() {
          if (!options.isEnabled()) {
            clearIndicator();
            return;
          }
          pageFocused = true;
          clearWatchTimer();
          clearIndicator();
          wasPlayingWhenUnfocused = options.isPlayingMatch();
          wasInLobbyWhenUnfocused = false;
        }
        function handleInteractionFocus() {
          if (options.isEnabled() && !document.hidden) {
            pageFocused = true;
            wasPlayingWhenUnfocused = options.isPlayingMatch();
            wasInLobbyWhenUnfocused = false;
          }
        }
        function setGameStartPageFocused(value) {
          pageFocused = Boolean(value);
        }
        function setGameStartWasPlayingWhenUnfocused(value) {
          wasPlayingWhenUnfocused = Boolean(value);
        }
        function setGameStartWasInLobbyWhenUnfocused(value) {
          wasInLobbyWhenUnfocused = Boolean(value);
        }
        function handleAway() {
          if (!options.isEnabled()) {
            return;
          }
          pageFocused = false;
          patchMultiplayerSessionGameStartHooks();
          wasPlayingWhenUnfocused = options.isPlayingMatch();
          wasInLobbyWhenUnfocused = !wasPlayingWhenUnfocused && options.isPlayableLobby();
          scheduleWatch();
        }
        function handleVisibilityChange() {
          if (!options.isEnabled()) {
            return;
          }
          if (document.hidden) {
            handleAway();
          } else {
            handleReturn();
          }
        }
        function initializeFocusState() {
          pageFocused = options.isPageFocused();
          if (!pageFocused) {
            wasPlayingWhenUnfocused = options.isPlayingMatch();
            wasInLobbyWhenUnfocused = !wasPlayingWhenUnfocused && options.isPlayableLobby();
          }
        }
        function installGameStartIndicatorHooks() {
          focusHooks.installGameStartIndicatorHooks();
        }
        function disableGameStartAlerts() {
          wasPlayingWhenUnfocused = false;
          wasInLobbyWhenUnfocused = false;
          observedSession = null;
          wasSessionActive = false;
          clearSessionEntryGrace();
          localPlayTransition.clear();
          clearWatchTimer();
          clearIndicator();
        }
        return {
          clearGameStartIndicator: clearIndicator,
          disableGameStartAlerts,
          handleGameStartInteractionFocus: handleInteractionFocus,
          hasPendingLocalPlayTransition,
          installGameStartIndicatorHooks,
          noteLocallyInitiatedPlayTransition,
          patchMultiplayerSessionGameStartHooks,
          setGameStartPageFocused,
          setGameStartWasInLobbyWhenUnfocused,
          setGameStartWasPlayingWhenUnfocused,
          updateGameStartIndicator
        };
      }

      // src/features/gameplay-state.ts
      function createGameplayStateController(options) {
        function hasReserveSuccessfulJoinLayer() {
          return options.hasVisibleLayer(options.lobbyLayerSelector) || options.hasVisibleLayer(options.gameplayLayerSelector);
        }
        function isMenuGameplayOverlap() {
          return options.hasVisibleLayer(options.menuLayerSelector) && options.hasVisibleLayer(options.playLayerSelector);
        }
        function isPageFocused() {
          return !document.hidden && (!document.hasFocus || document.hasFocus());
        }
        function isCurrentPlayerSpectating(session = options.getSession()) {
          const player = options.getSessionPlayer(session);
          const team = options.getPlayerTeamState(player);
          if (Number.isFinite(team)) {
            return team === 0;
          }
          return options.hasVisibleLayer(options.spectateControlsSelector);
        }
        function isPlayableLobby() {
          const session = options.getSession();
          if (options.isSessionMatchActive(session)) {
            return false;
          }
          if (options.isSessionLobbyActive(session)) {
            return !isCurrentPlayerSpectating(session);
          }
          return options.hasVisibleLayer(options.lobbyLayerSelector) && !options.hasVisibleLayer(options.spectateControlsSelector);
        }
        function isPlayingMatch() {
          const session = options.getSession();
          if (options.isSessionMatchActive(session)) {
            return !isCurrentPlayerSpectating(session);
          }
          return options.hasVisibleLayer(options.gameplayLayerSelector) && !options.hasVisibleLayer(options.spectateControlsSelector);
        }
        return {
          hasReserveSuccessfulJoinLayer,
          isCurrentPlayerSpectating,
          isMenuGameplayOverlap,
          isPageFocused,
          isPlayableLobby,
          isPlayingMatch
        };
      }

      // src/features/gameplay-alert-feature-bundle.ts
      function createGameplayAlertFeatureBundle(options) {
        const gameplayState = createGameplayStateController({
          gameplayLayerSelector: FULLSCREEN_GAMEPLAY_LAYER_SELECTOR,
          lobbyLayerSelector: ".lobbyContainer",
          menuLayerSelector: FULLSCREEN_MENU_LAYER_SELECTOR,
          playLayerSelector: FULLSCREEN_PLAY_LAYER_SELECTOR,
          spectateControlsSelector: ".spectateControls",
          getPlayerTeamState,
          getSession: getMultiplayerSession,
          getSessionPlayer,
          hasVisibleLayer,
          isSessionLobbyActive,
          isSessionMatchActive
        });
        const gameStartIndicator = createGameStartIndicatorController({
          endWatchIntervalMs: GAME_START_END_WATCH_INTERVAL_MS,
          getFlashIntervalMs: getAdvancedGameStartFlashIntervalMs,
          getIndicatorDelayMs: getAdvancedGameStartAlertDelayMs,
          localTransitionTimeoutMs: GAME_START_LOCAL_TRANSITION_TIMEOUT_MS,
          sessionEntryGraceMs: GAME_START_SESSION_ENTRY_GRACE_MS,
          watchIntervalMs: GAME_START_WATCH_INTERVAL_MS,
          getSession: getMultiplayerSession,
          isEnabled: options.isGameStartAlertEnabled,
          isMatchActive: () => isSessionMatchActive(getMultiplayerSession()),
          isPageFocused: gameplayState.isPageFocused,
          isPlayableLobby: gameplayState.isPlayableLobby,
          isPlayingMatch: gameplayState.isPlayingMatch,
          isSessionActive: () => {
            const session = getMultiplayerSession();
            return isSessionLobbyActive(session) || isSessionMatchActive(session);
          }
        });
        return {
          ...gameplayState,
          ...gameStartIndicator
        };
      }

      // src/features/in-game-chat-scroll.ts
      var CHAT_READING_CLASS = "qolboxChatReading";
      var CHAT_INTERACTIVE_CLASS = "qolboxChatInteractive";
      var RESTORED_CHAT_MESSAGE_ATTR = "data-qolbox-restored-chat-message";
      var MAX_RETAINED_MESSAGES = 1e3;
      var RESTORED_HISTORY_DISPLAY_MS = 6500;
      function getChatContent(chat) {
        return chat.querySelector(".content");
      }
      function hasVisibleGameplayCanvas() {
        const canvas = document.querySelector("#pixiContainer canvas");
        if (!canvas || typeof canvas.getBoundingClientRect !== "function") {
          return false;
        }
        const rect = canvas.getBoundingClientRect();
        const style = typeof window.getComputedStyle === "function" ? getComputedStyle(canvas) : null;
        if (!style) {
          return false;
        }
        return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
      }
      function getChatMessageViewportHeight(chat) {
        const input = chat.querySelector(".input");
        if (!input) {
          return chat.clientHeight;
        }
        const chatRect = chat.getBoundingClientRect();
        const inputRect = input.getBoundingClientRect();
        return Math.max(20, inputRect.top - chatRect.top);
      }
      function getMaxChatOffset(chat, content) {
        return Math.max(0, content.scrollHeight - getChatMessageViewportHeight(chat));
      }
      function getChatOpacity(chat) {
        const opacity = Number(getComputedStyle(chat).opacity);
        return Number.isFinite(opacity) ? opacity : 1;
      }
      function isChatShellVisible(chat) {
        const rect = chat.getBoundingClientRect();
        const style = getComputedStyle(chat);
        return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0 && getChatOpacity(chat) > 0.04;
      }
      function isChatVisible(chat) {
        const hasFocusedInput = Boolean(chat.querySelector(".input:focus"));
        const hasMessageText = Boolean((getChatContent(chat)?.textContent || "").trim());
        return isChatShellVisible(chat) && (hasFocusedInput || hasMessageText);
      }
      function hasLostRetainedHistory(content, state) {
        const messages = getContentMessages(content);
        return messages.signatures.length > 0 && messages.signatures.length < state.historySignatures.length;
      }
      function shouldRestoreRetainedHistory(chat, content, state) {
        return state.historyInteractionActive || state.offsetPx > 0 || chat.classList.contains(CHAT_READING_CLASS) || chat.matches(":hover") || Boolean(chat.querySelector(".input:focus")) || hasLostRetainedHistory(content, state);
      }
      function hasFocusedChatInput(chat) {
        return Boolean(chat.querySelector(".input:focus"));
      }
      function getMessageNodes(content) {
        const nodes = Array.from(content.childNodes).filter((node) => (node.textContent || "").trim());
        return nodes;
      }
      function getMessageHtml(node) {
        if (node instanceof Element) {
          return node.outerHTML;
        }
        const container = document.createElement("span");
        container.textContent = node.textContent || "";
        return container.outerHTML;
      }
      function getContentMessages(content) {
        const nodes = getMessageNodes(content);
        const html = nodes.map(getMessageHtml);
        return {
          html,
          nodes,
          signatures: html.map((value) => `${value.length}:${value}`)
        };
      }
      function getMessageSignatures(html) {
        return html.map((value) => `${value.length}:${value}`);
      }
      function getOverlapLength(left, right) {
        const maxOverlap = Math.min(left.length, right.length);
        for (let overlap = maxOverlap; overlap > 0; overlap -= 1) {
          let matches = true;
          for (let index = 0; index < overlap; index += 1) {
            if (left[left.length - overlap + index] !== right[index]) {
              matches = false;
              break;
            }
          }
          if (matches) {
            return overlap;
          }
        }
        return 0;
      }
      function rememberMessageRecords(messages, state) {
        if (state.restoring) {
          return false;
        }
        const html = messages.html;
        const signatures = getMessageSignatures(html);
        if (!signatures.length) {
          return false;
        }
        const overlap = getOverlapLength(state.historySignatures, signatures);
        const newHtml = html.slice(overlap);
        const newNodes = messages.nodes?.slice(overlap) || [];
        const newSignatures = signatures.slice(overlap);
        state.historyHtml.push(...newHtml);
        state.historyNodes.push(...newHtml.map((_, index) => newNodes[index] || null));
        state.historySignatures.push(...newSignatures);
        if (state.historyHtml.length > MAX_RETAINED_MESSAGES) {
          const excess = state.historyHtml.length - MAX_RETAINED_MESSAGES;
          state.historyHtml.splice(0, excess);
          state.historyNodes.splice(0, excess);
          state.historySignatures.splice(0, excess);
        }
        return newHtml.length > 0;
      }
      function rememberChatMessages(content, state) {
        if (state.restoredDomActive) {
          return;
        }
        rememberMessageRecords(getContentMessages(content), state);
      }
      function rememberAddedChatNodes(nodes, state) {
        const retainedNodes = nodes.filter((node) => !isRestoredChatMessageNode(node, state) && (node.textContent || "").trim());
        const html = retainedNodes.map(getMessageHtml);
        if (rememberMessageRecords({ html, nodes: retainedNodes }, state)) {
          state.historyVisibleUntil = performance.now() + RESTORED_HISTORY_DISPLAY_MS;
        }
      }
      function appendRetainedHtmlFallback(content, html) {
        const template = document.createElement("template");
        template.innerHTML = html;
        if (template.content) {
          content.appendChild(template.content.cloneNode(true));
          return;
        }
        const fallback = document.createElement("span");
        fallback.innerHTML = html;
        content.appendChild(fallback);
      }
      function getNodePath(root, target) {
        const path = [];
        let current = target;
        while (current && current !== root) {
          const parent = current.parentNode;
          if (!parent) {
            return null;
          }
          path.unshift(Array.prototype.indexOf.call(parent.childNodes, current));
          current = parent;
        }
        return current === root ? path : null;
      }
      function getNodeByPath(root, path) {
        let current = root;
        for (const index of path) {
          current = current.childNodes[index] || null;
          if (!current) {
            return null;
          }
        }
        return current;
      }
      function markRestoredChatMessageNode(node, state) {
        state.restoredNodes.add(node);
        if (node instanceof Element) {
          node.setAttribute(RESTORED_CHAT_MESSAGE_ATTR, "true");
        }
      }
      function cloneRetainedMessageNode(retainedNode, state) {
        const restoredNode = retainedNode.cloneNode(true);
        markRestoredChatMessageNode(restoredNode, state);
        if (!(retainedNode instanceof Element) || !(restoredNode instanceof Element)) {
          return restoredNode;
        }
        restoredNode.addEventListener(
          "click",
          (event) => {
            const target = event.target instanceof Node ? event.target : restoredNode;
            const path = getNodePath(restoredNode, target);
            const retainedTarget = path ? getNodeByPath(retainedNode, path) : retainedNode;
            const clickTarget = retainedTarget instanceof HTMLElement ? retainedTarget : retainedNode instanceof HTMLElement ? retainedNode : null;
            if (!clickTarget) {
              return;
            }
            event.preventDefault();
            event.stopPropagation();
            clickTarget.click();
          },
          true
        );
        return restoredNode;
      }
      function isRestoredChatMessageNode(node, state) {
        return state.restoredNodes.has(node) || node instanceof Element && (node.hasAttribute(RESTORED_CHAT_MESSAGE_ATTR) || Boolean(node.closest(`[${RESTORED_CHAT_MESSAGE_ATTR}]`)));
      }
      function restoreRetainedChatMessages(content, state) {
        if (!state.historyHtml.length) {
          return;
        }
        const messages = getContentMessages(content);
        if (messages.signatures.length >= state.historySignatures.length) {
          return;
        }
        state.restoring = true;
        content.innerHTML = "";
        for (let index = 0; index < state.historyHtml.length; index += 1) {
          const retainedNode = state.historyNodes[index];
          if (retainedNode) {
            content.appendChild(cloneRetainedMessageNode(retainedNode, state));
          } else {
            const childCountBeforeAppend = content.childNodes.length;
            appendRetainedHtmlFallback(content, state.historyHtml[index]);
            for (const node of Array.from(content.childNodes).slice(childCountBeforeAppend)) {
              markRestoredChatMessageNode(node, state);
            }
          }
        }
        state.restoring = false;
        state.restoredDomActive = true;
      }
      function clearRestoredChatDom(content, state, force = false) {
        if (!force && !state.historyInteractionActive) {
          return;
        }
        if (state.restoredDomActive || state.historyInteractionActive) {
          state.restoring = true;
          content.innerHTML = "";
          state.restoring = false;
        }
        state.restoredDomActive = false;
        state.historyInteractionActive = false;
        state.historyVisibleUntil = 0;
        if (state.fadeSyncTimerId) {
          window.clearTimeout(state.fadeSyncTimerId);
          state.fadeSyncTimerId = 0;
        }
        state.offsetPx = 0;
        content.style.transform = "";
        content.style.willChange = "";
      }
      function applyChatOffset(chat, content, state) {
        const maxOffset = getMaxChatOffset(chat, content);
        state.offsetPx = Math.max(0, Math.min(maxOffset, state.offsetPx));
        if (state.offsetPx > 0) {
          content.style.transform = `translateY(${Math.round(state.offsetPx)}px)`;
          content.style.willChange = "transform";
          chat.classList.add(CHAT_READING_CLASS);
          chat.dataset.qolboxChatOffset = String(Math.round(state.offsetPx));
        } else {
          content.style.transform = "";
          content.style.willChange = "";
          delete chat.dataset.qolboxChatOffset;
          if (!chat.matches(":hover")) {
            chat.classList.remove(CHAT_READING_CLASS);
          }
        }
      }
      function createInGameChatScrollController(options) {
        const patchedChats = /* @__PURE__ */ new Set();
        const chatStates = /* @__PURE__ */ new WeakMap();
        const chatObservers = /* @__PURE__ */ new WeakMap();
        let keyHooksInstalled = false;
        let patchScheduled = false;
        function removeContentWheelListener(state) {
          if (!state.wheelListenerTarget || !state.wheelListener) {
            state.wheelListenerTarget = null;
            return;
          }
          state.wheelListenerTarget.removeEventListener("wheel", state.wheelListener, true);
          state.wheelListenerTarget = null;
        }
        function handleChatWheel(chat, state, event) {
          if (!options.isChatFeatureEnabled()) {
            cleanupInGameChatScroll();
            return;
          }
          const target = event.target instanceof Element ? event.target : null;
          if (target?.closest("input, textarea, select, button, .qolboxMenuOverlay")) {
            return;
          }
          const content = getChatContent(chat);
          if (!content || getMaxChatOffset(chat, content) <= 0) {
            removeContentWheelListener(state);
            return;
          }
          state.offsetPx -= event.deltaY;
          applyChatOffset(chat, content, state);
          syncContentWheelListener(chat, content, state);
          event.preventDefault();
          event.stopPropagation();
        }
        function syncContentWheelListener(chat, content, state) {
          const shouldListen = options.isChatFeatureEnabled() && isChatShellVisible(chat) && getMaxChatOffset(chat, content) > 0;
          if (!shouldListen) {
            removeContentWheelListener(state);
            return;
          }
          if (!state.wheelListener) {
            state.wheelListener = (event) => handleChatWheel(chat, state, event);
          }
          if (state.wheelListenerTarget === content) {
            return;
          }
          removeContentWheelListener(state);
          content.addEventListener("wheel", state.wheelListener, { capture: true, passive: false });
          state.wheelListenerTarget = content;
        }
        function cleanupChatScroll(chat) {
          if (!(chat instanceof HTMLElement)) {
            return;
          }
          const content = getChatContent(chat);
          const state = chatStates.get(chat);
          if (state) {
            removeContentWheelListener(state);
            if (state.fadeSyncTimerId) {
              window.clearTimeout(state.fadeSyncTimerId);
              state.fadeSyncTimerId = 0;
            }
            if (content) {
              clearRestoredChatDom(content, state, true);
              content.style.transform = "";
              content.style.willChange = "";
            }
            state.offsetPx = 0;
            state.historyVisibleUntil = 0;
            state.syncScheduled = false;
          }
          chat.classList.remove(CHAT_INTERACTIVE_CLASS);
          chat.classList.remove(CHAT_READING_CLASS);
          delete chat.dataset.qolboxChatOffset;
        }
        function clearRetainedChatState(state) {
          state.historyHtml = [];
          state.historyNodes = [];
          state.historySignatures = [];
          state.historyVisibleUntil = 0;
          state.restoredNodes = /* @__PURE__ */ new WeakSet();
          state.restoredDomActive = false;
          state.historyInteractionActive = false;
          state.restoring = false;
          state.syncScheduled = false;
        }
        function unpatchChatScroll(chat) {
          cleanupChatScroll(chat);
          const state = chatStates.get(chat);
          if (state) {
            chat.removeEventListener("pointerenter", state.pointerEnterListener);
            chat.removeEventListener("pointerleave", state.pointerLeaveListener);
            chat.removeEventListener("focusin", state.focusInListener, true);
            chat.removeEventListener("focusout", state.focusOutListener, true);
            clearRetainedChatState(state);
          }
          chatObservers.get(chat)?.disconnect();
          chatObservers.delete(chat);
          chatStates.delete(chat);
          patchedChats.delete(chat);
          if (chat instanceof HTMLElement) {
            delete chat.dataset.qolboxChatScrollPatched;
          }
        }
        function isUserReadingChat(chat, state) {
          return hasFocusedChatInput(chat) || state.offsetPx > 0 || chat.matches(":hover") || chat.classList.contains(CHAT_READING_CLASS);
        }
        function scheduleFadeSync(chat, state, delayMs) {
          if (state.fadeSyncTimerId) {
            return;
          }
          state.fadeSyncTimerId = window.setTimeout(() => {
            state.fadeSyncTimerId = 0;
            syncChat(chat);
          }, Math.max(50, delayMs));
        }
        function syncChat(chat) {
          if (!(chat instanceof HTMLElement)) {
            return;
          }
          const content = getChatContent(chat);
          const state = chatStates.get(chat);
          if (!content || !state) {
            return;
          }
          if (!options.isChatFeatureEnabled()) {
            cleanupInGameChatScroll();
            return;
          }
          rememberChatMessages(content, state);
          const visible = isChatVisible(chat) || isChatShellVisible(chat) && state.historyInteractionActive && state.historyHtml.length > 0;
          if (visible) {
            const now = performance.now();
            const userReading = isUserReadingChat(chat, state);
            if (userReading) {
              state.historyVisibleUntil = 0;
              if (state.fadeSyncTimerId) {
                window.clearTimeout(state.fadeSyncTimerId);
                state.fadeSyncTimerId = 0;
              }
            } else if (state.historyInteractionActive && state.historyVisibleUntil <= 0) {
              state.historyVisibleUntil = now + RESTORED_HISTORY_DISPLAY_MS;
            }
            if (!userReading && state.historyVisibleUntil > 0 && now >= state.historyVisibleUntil) {
              clearRestoredChatDom(content, state);
              chat.classList.remove(CHAT_INTERACTIVE_CLASS);
              chat.classList.remove(CHAT_READING_CLASS);
              syncContentWheelListener(chat, content, state);
              return;
            }
            chat.classList.add(CHAT_INTERACTIVE_CLASS);
            if (shouldRestoreRetainedHistory(chat, content, state)) {
              if (hasFocusedChatInput(chat) || state.offsetPx > 0) {
                state.historyInteractionActive = true;
              }
              restoreRetainedChatMessages(content, state);
            } else {
              clearRestoredChatDom(content, state);
            }
            applyChatOffset(chat, content, state);
            syncContentWheelListener(chat, content, state);
            if (!userReading && state.historyVisibleUntil > 0) {
              scheduleFadeSync(chat, state, state.historyVisibleUntil - now + 50);
            }
            return;
          }
          clearRestoredChatDom(content, state, true);
          chat.classList.remove(CHAT_INTERACTIVE_CLASS);
          if (state.offsetPx <= 0) {
            chat.classList.remove(CHAT_READING_CLASS);
          }
          syncContentWheelListener(chat, content, state);
        }
        function scheduleChatSync(chat) {
          const state = chatStates.get(chat);
          if (state?.syncScheduled) {
            return;
          }
          if (state) {
            state.syncScheduled = true;
          }
          window.setTimeout(() => {
            if (state) {
              state.syncScheduled = false;
            }
            syncChat(chat);
            window.requestAnimationFrame(() => syncChat(chat));
          }, 0);
        }
        function schedulePatchInGameChatScroll(delayMs = 100) {
          if (!options.isChatFeatureEnabled()) {
            cleanupInGameChatScroll();
            return;
          }
          if (patchScheduled) {
            return;
          }
          patchScheduled = true;
          window.setTimeout(() => {
            patchScheduled = false;
            patchInGameChatScroll();
          }, delayMs);
        }
        function patchChat(chat) {
          if (patchedChats.has(chat)) {
            return;
          }
          patchedChats.add(chat);
          if (chat instanceof HTMLElement) {
            chat.dataset.qolboxChatScrollPatched = "true";
          }
          let state;
          const focusInListener = () => scheduleChatSync(chat);
          const focusOutListener = () => scheduleChatSync(chat);
          const pointerEnterListener = () => {
            if (!options.isChatFeatureEnabled()) {
              return;
            }
            if (chat instanceof HTMLElement && isChatVisible(chat)) {
              chat.classList.add(CHAT_READING_CLASS);
            }
          };
          const pointerLeaveListener = () => {
            if (!options.isChatFeatureEnabled()) {
              cleanupInGameChatScroll();
              return;
            }
            if (state.offsetPx <= 0) {
              chat.classList.remove(CHAT_READING_CLASS);
            }
            scheduleChatSync(chat);
          };
          state = {
            historyInteractionActive: false,
            historyHtml: [],
            historyNodes: [],
            historySignatures: [],
            historyVisibleUntil: 0,
            fadeSyncTimerId: 0,
            focusInListener,
            focusOutListener,
            offsetPx: 0,
            pointerEnterListener,
            pointerLeaveListener,
            restoredDomActive: false,
            restoredNodes: /* @__PURE__ */ new WeakSet(),
            restoring: false,
            syncScheduled: false,
            wheelListener: null,
            wheelListenerTarget: null
          };
          chatStates.set(chat, state);
          chat.addEventListener("pointerenter", state.pointerEnterListener);
          chat.addEventListener("pointerleave", state.pointerLeaveListener);
          chat.addEventListener("focusin", state.focusInListener, true);
          chat.addEventListener("focusout", state.focusOutListener, true);
          const chatObserver = new MutationObserver((records) => {
            if (!options.isChatFeatureEnabled()) {
              cleanupInGameChatScroll();
              return;
            }
            const content2 = getChatContent(chat);
            const currentState = chatStates.get(chat);
            if (content2 && currentState) {
              for (const record of records) {
                if (record.type === "childList" && record.target === content2 && record.addedNodes.length) {
                  rememberAddedChatNodes(Array.from(record.addedNodes), currentState);
                }
              }
            }
            scheduleChatSync(chat);
          });
          chatObserver.observe(chat, {
            attributes: true,
            attributeFilter: ["class", "style"]
          });
          const content = getChatContent(chat);
          if (content) {
            chatObserver.observe(content, { childList: true });
          }
          chatObservers.set(chat, chatObserver);
          syncChat(chat);
        }
        function installKeyHooks() {
          if (keyHooksInstalled) {
            return;
          }
          keyHooksInstalled = true;
          document.addEventListener("keydown", () => schedulePatchInGameChatScroll(0), true);
          document.addEventListener("keyup", () => schedulePatchInGameChatScroll(0), true);
        }
        function patchInGameChatScroll() {
          installKeyHooks();
          if (!options.isChatFeatureEnabled()) {
            cleanupInGameChatScroll();
            return;
          }
          if (!hasVisibleGameplayCanvas()) {
            return;
          }
          for (const chat of document.querySelectorAll(".inGameChat")) {
            patchChat(chat);
            syncChat(chat);
          }
        }
        function cleanupInGameChatScroll() {
          for (const chat of Array.from(patchedChats)) {
            unpatchChatScroll(chat);
          }
        }
        return {
          cleanupInGameChatScroll,
          patchInGameChatScroll
        };
      }

      // src/hitbox/mobile-controls-adapter.ts
      function isNativeMobileMode() {
        const game = window.a8;
        return Boolean(readNativeProperty(game, "xm") || readNativeProperty(game, "PD"));
      }
      function isNativeTouchLobbyChatPrompt() {
        return Boolean(readNativeProperty(window.a8, "xm"));
      }
      function getNativeMobileControls() {
        return readNativeProperty(window.a8, "PD") ?? null;
      }
      function getControlSlot(controls, key) {
        return readNativeProperty(controls, key);
      }
      function getControlInputState(control) {
        const inputState = readNativeProperty(control, "hg");
        return isNativeObject(inputState) ? inputState : null;
      }
      function getNativeMobileControlInputState(controls = getNativeMobileControls()) {
        for (const key of ["oz", "rz", "az", "nz"]) {
          const inputState = getControlInputState(getControlSlot(controls, key));
          if (inputState) {
            return inputState;
          }
        }
        return null;
      }
      function getLiveMultiplayerInputState() {
        const inputState = readNativePath(window.multiplayerSession, ["KR", "hg"]);
        return isNativeObject(inputState) ? inputState : null;
      }
      function getNativeMobileAbilityButtonElements() {
        const controls = getNativeMobileControls();
        if (!controls) {
          return [];
        }
        const buttons = [];
        for (const key of ["oz", "rz", "az"]) {
          const element = readNativeProperty(getControlSlot(controls, key), "hf");
          if (element instanceof Element) {
            buttons.push(element);
          }
        }
        return buttons;
      }
      function setGrabInputPressed(inputState, pressed) {
        if (!isNativeObject(inputState)) {
          return false;
        }
        setNativeReflectProperty(inputState, "Fn", pressed);
        return true;
      }
      function installNativeMobileControlHooks(hooks) {
        const controls = getNativeMobileControls();
        if (!isNativeObject(controls)) {
          return false;
        }
        if (readNativeProperty(controls, "__qolboxMobileGrabPatched")) {
          return true;
        }
        setNativeReflectProperty(controls, "__qolboxMobileGrabPatched", true);
        const setInputState = readNativeProperty(controls, "ED");
        if (typeof setInputState === "function") {
          const originalSetInputState = setInputState;
          setNativeReflectProperty(
            controls,
            "ED",
            function wrappedMobileControlInputState(inputState, ...rest) {
              hooks.onInputStateObserved(inputState);
              const result = Reflect.apply(originalSetInputState, this, [inputState, ...rest]);
              hooks.afterInputStateSet(inputState);
              hooks.onControlsShown();
              return result;
            }
          );
        }
        const showControls = readNativeProperty(controls, "NL");
        if (typeof showControls === "function") {
          const originalShowControls = showControls;
          setNativeReflectProperty(controls, "NL", function wrappedMobileControlsShow(...args) {
            const result = Reflect.apply(originalShowControls, this, args);
            hooks.onControlsShown();
            return result;
          });
        }
        const hideControls = readNativeProperty(controls, "_L");
        if (typeof hideControls === "function") {
          const originalHideControls = hideControls;
          setNativeReflectProperty(controls, "_L", function wrappedMobileControlsHide(...args) {
            const result = Reflect.apply(originalHideControls, this, args);
            hooks.onControlsHidden();
            return result;
          });
        }
        return true;
      }

      // src/features/gameplay-background-focus-events.ts
      function readGameplayFocusProperty(source, property) {
        return readObjectProperty(source, property);
      }
      function readStringProperty2(source, property) {
        const value = readGameplayFocusProperty(source, property);
        return typeof value === "string" ? value : "";
      }
      function readNumberProperty2(source, property) {
        const value = readGameplayFocusProperty(source, property);
        return typeof value === "number" ? value : Number(value);
      }
      function readGameplayFocusBooleanProperty(source, property) {
        return readGameplayFocusProperty(source, property) === true;
      }
      function canPreventGameplayDefault(event) {
        return typeof event === "object" && event !== null && typeof readGameplayFocusProperty(event, "preventDefault") === "function";
      }
      function canDispatchEvents(element) {
        return element instanceof Element && typeof readGameplayFocusProperty(element, "dispatchEvent") === "function";
      }
      function canBlurGameplayFocusTarget(element) {
        return typeof element === "object" && element !== null && typeof readGameplayFocusProperty(element, "blur") === "function";
      }
      function hasTabIndexApi(element) {
        return element instanceof Element && typeof readGameplayFocusProperty(element, "hasAttribute") === "function" && typeof readGameplayFocusProperty(element, "tabIndex") === "number";
      }
      function ensureGameplayFocusTargetFocusable(element) {
        if (hasTabIndexApi(element) && !element.hasAttribute("tabindex")) {
          element.tabIndex = -1;
        }
      }
      function getPointerEventType(event) {
        return readStringProperty2(event, "type");
      }
      function isPrimaryGameplayMouseButton(event) {
        const button = readGameplayFocusProperty(event, "button");
        return button === void 0 || button === 0;
      }
      function clampPointerToRect(value, min, max) {
        if (!Number.isFinite(value)) {
          return (min + max) / 2;
        }
        return Math.max(min, Math.min(max, value));
      }
      function createForwardedPointerEvent(event, clientX, clientY) {
        const eventType = getPointerEventType(event);
        const commonInit = {
          bubbles: true,
          cancelable: true,
          button: 0,
          buttons: eventType === "click" ? 0 : 1,
          clientX,
          clientY,
          ctrlKey: readGameplayFocusBooleanProperty(event, "ctrlKey"),
          shiftKey: readGameplayFocusBooleanProperty(event, "shiftKey"),
          altKey: readGameplayFocusBooleanProperty(event, "altKey"),
          metaKey: readGameplayFocusBooleanProperty(event, "metaKey")
        };
        if (/^pointer/i.test(eventType) && typeof PointerEvent === "function") {
          return new PointerEvent(eventType, {
            ...commonInit,
            pointerId: readNumberProperty2(event, "pointerId") || 1,
            pointerType: readStringProperty2(event, "pointerType") || "mouse",
            isPrimary: readGameplayFocusProperty(event, "isPrimary") !== false
          });
        }
        return new MouseEvent(eventType, commonInit);
      }
      function forwardGameplayPointerToCanvas(event, canvas) {
        const eventType = getPointerEventType(event);
        if (!canDispatchEvents(canvas) || !/^(?:pointerdown|mousedown|click)$/i.test(eventType)) {
          return false;
        }
        const rect = canvas.getBoundingClientRect();
        if (!rect.width || !rect.height) {
          return false;
        }
        const rectRight = Number.isFinite(rect.right) ? rect.right : rect.left + rect.width;
        const rectBottom = Number.isFinite(rect.bottom) ? rect.bottom : rect.top + rect.height;
        const clientX = clampPointerToRect(readNumberProperty2(event, "clientX"), rect.left + 1, rectRight - 1);
        const clientY = clampPointerToRect(readNumberProperty2(event, "clientY"), rect.top + 1, rectBottom - 1);
        const forwardedEvent = createForwardedPointerEvent(event, clientX, clientY);
        setObjectProperty(forwardedEvent, "__qolboxForwardedGameplayPointer", true);
        canvas.dispatchEvent(forwardedEvent);
        return true;
      }

      // src/features/gameplay-background-focus.ts
      function createGameplayBackgroundFocusController(options) {
        let hooksInstalled = false;
        function focusActiveRenderCanvas() {
          const canvas = options.getActiveRenderCanvas();
          if (!canvas) {
            return;
          }
          ensureGameplayFocusTargetFocusable(canvas);
          focusElementWithoutScroll(canvas);
        }
        function captureGameplayInputFocus() {
          if (typeof window.focus === "function") {
            try {
              window.focus();
            } catch {
            }
          }
          focusActiveRenderCanvas();
          const activeElement = document.activeElement;
          if (options.getActiveChatInput() === activeElement && canBlurGameplayFocusTarget(activeElement)) {
            activeElement.blur();
          }
          const canvasConstructor = typeof HTMLCanvasElement === "function" ? HTMLCanvasElement : null;
          if (!(canvasConstructor && document.activeElement instanceof canvasConstructor) && document.body) {
            if (typeof document.body.hasAttribute !== "function" || !document.body.hasAttribute("tabindex")) {
              document.body.tabIndex = -1;
            }
            focusElementWithoutScroll(document.body);
            focusActiveRenderCanvas();
          }
        }
        function forwardGameplayBackgroundPointer(event) {
          return forwardGameplayPointerToCanvas(event, options.getActiveRenderCanvas());
        }
        function isGameplayRenderTarget(target) {
          return Boolean(
            target instanceof Element && (target.matches(options.renderCanvasSelector) || target.closest(options.renderLayerSelector))
          );
        }
        function shouldCaptureGameplayBackgroundFocus(event) {
          if (!options.isPlayingMatch() || !options.isQolboxMenuClosed() || options.getActiveChatInput() || readGameplayFocusBooleanProperty(event, "__qolboxForwardedGameplayPointer") || readGameplayFocusBooleanProperty(event, "defaultPrevented")) {
            return false;
          }
          if (!isPrimaryGameplayMouseButton(event)) {
            return false;
          }
          const target = readGameplayFocusProperty(event, "target");
          if (!(target instanceof Element)) {
            return false;
          }
          if (target.closest(options.exclusionSelector)) {
            return false;
          }
          return !isGameplayRenderTarget(target);
        }
        function handleGameplayBackgroundFocus(event) {
          if (!shouldCaptureGameplayBackgroundFocus(event)) {
            return;
          }
          if (readGameplayFocusBooleanProperty(event, "cancelable") && canPreventGameplayDefault(event)) {
            event.preventDefault();
          }
          captureGameplayInputFocus();
          forwardGameplayBackgroundPointer(event);
          window.setTimeout(() => {
            if (shouldCaptureGameplayBackgroundFocus(event)) {
              captureGameplayInputFocus();
            }
          }, 0);
        }
        function installGameplayBackgroundFocusHooks() {
          if (hooksInstalled) {
            return;
          }
          hooksInstalled = true;
          document.addEventListener("pointerdown", handleGameplayBackgroundFocus, true);
          document.addEventListener("mousedown", handleGameplayBackgroundFocus, true);
          document.addEventListener("click", handleGameplayBackgroundFocus, true);
        }
        return {
          captureGameplayInputFocus,
          forwardGameplayBackgroundPointer,
          handleGameplayBackgroundFocus,
          installGameplayBackgroundFocusHooks,
          shouldCaptureGameplayBackgroundFocus
        };
      }

      // src/features/render-canvas-focus.ts
      function createRenderCanvasFocusController(options) {
        function resetBrowserScroll() {
          try {
            window.scrollTo(0, 0);
          } catch {
          }
          document.documentElement.scrollTop = 0;
          document.body.scrollTop = 0;
        }
        function focusActiveRenderCanvas() {
          const canvas = options.getActiveRenderCanvas();
          if (!canvas) {
            return;
          }
          if (isTabbableElement(canvas) && !canvas.hasAttribute("tabindex")) {
            canvas.tabIndex = -1;
          }
          options.focusElementWithoutScroll(canvas);
        }
        return {
          focusActiveRenderCanvas,
          resetBrowserScroll
        };
      }

      // src/hitbox/chat-send-adapter.ts
      function isNativeCallable8(value) {
        return typeof value === "function";
      }
      function getAccurateNativeHelpText(text) {
        return text === "/settings -- view all gameplay commands" ? "/settings -- view normal gameplay settings" : text;
      }
      function callNativeChatSend(nativeSendChat, session, message, rest) {
        return Reflect.apply(nativeSendChat, session, [message, ...rest]);
      }
      function callNativeChatSendWithSettingsHelpCorrection(nativeSendChat, session, message, rest) {
        const nativeShowStatus = readNativeProperty(session, "vG");
        if (!isNativeObject(session) || !isNativeCallable8(nativeShowStatus)) {
          return callNativeChatSend(nativeSendChat, session, message, rest);
        }
        const accurateShowStatus = function showAccurateNativeSettingsHelp(text, ...statusRest) {
          return Reflect.apply(nativeShowStatus, this, [getAccurateNativeHelpText(text), ...statusRest]);
        };
        setNativeReflectProperty(session, "vG", accurateShowStatus);
        try {
          return callNativeChatSend(nativeSendChat, session, message, rest);
        } finally {
          setNativeReflectProperty(session, "vG", nativeShowStatus);
        }
      }
      function installNativeChatSendInterceptor(session, options) {
        if (!isNativeObject(session)) {
          return false;
        }
        const nativeSendChat = readNativeProperty(session, "CJ");
        if (!isNativeCallable8(nativeSendChat) || readNativeProperty(session, "__qolboxSlashCommandsPatched")) {
          return false;
        }
        const wrappedSendChat = function wrappedQolboxSlashCommand(message, ...rest) {
          return options.handleSend({
            message,
            rest,
            session: this,
            sendNativeChat: (nextMessage) => callNativeChatSend(nativeSendChat, this, nextMessage, rest),
            sendNativeChatWithSettingsHelpCorrection: (nextMessage) => callNativeChatSendWithSettingsHelpCorrection(nativeSendChat, this, nextMessage, rest)
          });
        };
        setNativeReflectProperty(session, "CJ", wrappedSendChat);
        setNativeReflectProperty(session, "__qolboxSlashCommandsPatched", true);
        setNativeReflectProperty(session, "__qolboxSlashCommandsOriginalCJ", nativeSendChat);
        return true;
      }

      // src/features/slash-command-interceptor.ts
      function expandNativeChatAlias(message) {
        if (typeof message !== "string" || !areAdvancedCommandAliasesEnabled()) {
          return message;
        }
        return message.replace(/^(\s*)\/rec(?=\s|$)/i, "$1/record");
      }
      function installSlashCommandInterceptor(session, dependencies) {
        return installNativeChatSendInterceptor(session, {
          handleSend(nativeChat) {
            if (dependencies.areCommandsEnabled() && dependencies.handleCommand(nativeChat.message)) {
              return void 0;
            }
            const commandsEnabled = dependencies.areCommandsEnabled();
            let nextMessage = commandsEnabled ? expandNativeChatAlias(nativeChat.message) : nativeChat.message;
            if (commandsEnabled && dependencies.prepareNativeCommand) {
              const preparedMessage = dependencies.prepareNativeCommand(nextMessage);
              if (preparedMessage === null) {
                return void 0;
              }
              nextMessage = preparedMessage;
            }
            const isNativeHelp = commandsEnabled && /^\/help\s*$/.test(String(nextMessage || "").trim());
            const result = isNativeHelp ? nativeChat.sendNativeChatWithSettingsHelpCorrection(nextMessage) : nativeChat.sendNativeChat(nextMessage);
            if (isNativeHelp) {
              dependencies.showHelp(nativeChat.session);
            }
            return result;
          }
        });
      }

      // src/features/input-focus-feature-bundle.ts
      function createInputFocusFeatureBundle(options) {
        const { focusActiveRenderCanvas, resetBrowserScroll } = createRenderCanvasFocusController({
          focusElementWithoutScroll,
          getActiveRenderCanvas: options.getActiveRenderCanvas
        });
        const chatInput = createChatInputController({
          chatInputSelector: CHAT_INPUT_SELECTOR,
          lobbyChatInputSelector: ".lobbyContainer .chatBox .input",
          desktopLobbyChatPrompt: DESKTOP_LOBBY_CHAT_PROMPT,
          touchLobbyChatPrompt: TOUCH_LOBBY_CHAT_PROMPT,
          isChatFeatureEnabled: options.isChatFeatureEnabled,
          areLobbyCommandsEnabled: options.areLobbyCommandsEnabled,
          isTouchLobbyChatPrompt: isNativeTouchLobbyChatPrompt,
          focusActiveRenderCanvas,
          expandNativeChatAlias
        });
        const gameplayBackgroundFocus = createGameplayBackgroundFocusController({
          exclusionSelector: GAMEPLAY_FOCUS_EXCLUSION_SELECTOR,
          renderCanvasSelector: FULLSCREEN_RENDER_CANVAS_SELECTOR,
          renderLayerSelector: FULLSCREEN_RENDER_LAYER_SELECTOR,
          getActiveChatInput: chatInput.getActiveChatInput,
          getActiveRenderCanvas: options.getActiveRenderCanvas,
          isPlayingMatch: options.isPlayingMatch,
          isQolboxMenuClosed: options.isQolboxMenuClosed
        });
        return {
          ...chatInput,
          ...gameplayBackgroundFocus,
          focusActiveRenderCanvas,
          resetBrowserScroll
        };
      }

      // src/hitbox/player-appearance-adapter.ts
      var PLAYER_NAME_FIELDS = ["name", "Nm", "username", "playerName"];
      function getPlayerDisplayName(player) {
        if (!isNativeObject(player)) {
          return "";
        }
        for (const key of PLAYER_NAME_FIELDS) {
          const value = readNativeProperty(player, key);
          if (typeof value === "string" && value.trim()) {
            return value.trim();
          }
        }
        return "";
      }
      function getPlayerColorCandidates(player) {
        if (!isNativeObject(player)) {
          return [];
        }
        return Object.entries(player).filter(([key]) => /(colou?r|color|fill|tint)/i.test(key)).map(([, value]) => value);
      }

      // src/features/lobby-command-player-targets.ts
      var GROUP_TARGETS = /* @__PURE__ */ new Set(["all", "playing", "spectators"]);
      function normalizePlayerName(name) {
        return String(name || "").replace(/\s+/g, " ").trim().toLowerCase();
      }
      function formatCommandPlayerName(player) {
        const name = getPlayerName(player);
        return name ? String(name) : "Player";
      }
      function findPlayerByName(name, session = getMultiplayerSession()) {
        const query = normalizePlayerName(name);
        if (!query) {
          return { status: "missing", matches: [] };
        }
        const players = getSessionPlayers(session);
        const tiers = [
          players.filter(({ player }) => normalizePlayerName(getPlayerName(player)) === query),
          players.filter(({ player }) => normalizePlayerName(getPlayerName(player)).startsWith(query)),
          players.filter(({ player }) => normalizePlayerName(getPlayerName(player)).includes(query))
        ];
        for (const matches of tiers) {
          const uniqueMatches = [];
          const seenIds = /* @__PURE__ */ new Set();
          for (const match of matches) {
            const id = String(match.id);
            if (!seenIds.has(id)) {
              seenIds.add(id);
              uniqueMatches.push(match);
            }
          }
          if (uniqueMatches.length === 1) {
            return { status: "found", match: uniqueMatches[0], matches: uniqueMatches };
          }
          if (uniqueMatches.length > 1) {
            return { status: "ambiguous", matches: uniqueMatches };
          }
        }
        return { status: "missing", matches: [] };
      }
      function parseCommandTarget(argument) {
        const value = String(argument || "").trim();
        const quotedMatch = value.match(/^(["'])(.*)\1$/);
        const normalizedValue = normalizePlayerName(value);
        if (!quotedMatch && GROUP_TARGETS.has(normalizedValue)) {
          return { group: normalizedValue, type: "group", value };
        }
        return { type: "player", value: quotedMatch ? quotedMatch[2] : value };
      }

      // src/hitbox/team-state.ts
      var TEAM_STATE_SPECTATE = 0;
      var TEAM_STATE_FFA = 1;
      var TEAM_STATE_RED = 2;
      var TEAM_STATE_BLUE = 3;

      // src/hitbox/lobby-actions.ts
      function getLobbySocket(session) {
        return readNativePath(session, ["JD", "ZD"]);
      }
      function getCommandEventId() {
        const eventId = readNativeProperty(window.a8, "VP");
        return eventId === void 0 ? 1 : eventId;
      }
      function getCommandId(property, fallback) {
        const commandId = readNativeProperty(window.a8, property);
        return commandId === void 0 ? fallback : commandId;
      }
      function emitLobbyCommand(session, payload) {
        const socket = getLobbySocket(session);
        const emit = readNativeProperty(socket, "emit");
        if (!isNativeObject(socket) || typeof emit !== "function") {
          return false;
        }
        Reflect.apply(emit, socket, [getCommandEventId(), [...payload]]);
        return true;
      }
      function requestOwnTeamChange(session, team) {
        return emitLobbyCommand(session, [getCommandId("gE", 24), team]);
      }
      function movePlayerToTeam(session, playerId, team) {
        return emitLobbyCommand(session, [getCommandId("jE", 47), { i: playerId, t: team }]);
      }
      function setTeamsLocked(session, locked) {
        return emitLobbyCommand(session, [getCommandId("HE", 52), Boolean(locked)]);
      }
      function giveHostToPlayer(session, playerId) {
        return emitLobbyCommand(session, [getCommandId("qolboxGiveHost", 44), playerId]);
      }
      function banPlayer(session, playerId) {
        return emitLobbyCommand(session, [getCommandId("CE", 32), { id: playerId, ban: 1 }]);
      }

      // src/features/lobby-command-team-targets.ts
      function getBulkTeamTargets(team, session = getMultiplayerSession(), targetGroup = "all") {
        return getSessionPlayers(session).filter(({ player }) => {
          const currentTeam = getPlayerTeamState(player);
          if (currentTeam === Number(team)) {
            return false;
          }
          if (targetGroup === "playing" && currentTeam === TEAM_STATE_SPECTATE) {
            return false;
          }
          if (targetGroup === "spectators" && currentTeam !== TEAM_STATE_SPECTATE) {
            return false;
          }
          if (team === TEAM_STATE_SPECTATE) {
            return currentTeam !== TEAM_STATE_SPECTATE;
          }
          if (team === TEAM_STATE_FFA) {
            return currentTeam === TEAM_STATE_SPECTATE;
          }
          return currentTeam === TEAM_STATE_SPECTATE || currentTeam === TEAM_STATE_RED || currentTeam === TEAM_STATE_BLUE;
        });
      }
      function getSwitchableTeamPlayers(session = getMultiplayerSession()) {
        return getSessionPlayers(session).filter(({ player }) => {
          const team = getPlayerTeamState(player);
          return team === TEAM_STATE_RED || team === TEAM_STATE_BLUE;
        });
      }

      // src/features/lobby-command-team-state-text.ts
      function getTeamStateName(team) {
        switch (Number(team)) {
          case TEAM_STATE_SPECTATE:
            return "spectator";
          case TEAM_STATE_RED:
            return "red";
          case TEAM_STATE_BLUE:
            return "blue";
          case TEAM_STATE_FFA:
          default:
            return "playing";
        }
      }
      function getBulkTeamActionName(team) {
        if (team === TEAM_STATE_SPECTATE) {
          return "spectate";
        }
        if (team === TEAM_STATE_FFA) {
          return "join";
        }
        return `move to ${getTeamStateName(team)}`;
      }
      function formatBulkTeamMoveMessage(moved, team) {
        if (team === TEAM_STATE_FFA) {
          return `Moving ${moved} eligible player${moved === 1 ? "" : "s"} into play.`;
        }
        return `Moving ${moved} eligible player${moved === 1 ? "" : "s"} to ${getTeamStateName(team)}.`;
      }

      // src/features/lobby-command-team-state-request.ts
      function requestPlayerTeamState(session, playerId, team, localPlayerId = getLocalPlayerId(session)) {
        return isSamePlayerId(playerId, localPlayerId) ? requestOwnTeamChange(session, team) : movePlayerToTeam(session, playerId, team);
      }

      // src/features/lobby-command-team-actions.ts
      var SWITCH_SETTLE_MS = 900;
      function createLobbyCommandTeamActions(dependencies) {
        let switchLockedUntil = 0;
        let switchUnlockTimer = 0;
        function isSwitchingTeams() {
          return Date.now() < switchLockedUntil;
        }
        function lockSwitchOperation() {
          switchLockedUntil = Date.now() + SWITCH_SETTLE_MS;
          if (switchUnlockTimer) {
            window.clearTimeout(switchUnlockTimer);
          }
          switchUnlockTimer = window.setTimeout(() => {
            switchUnlockTimer = 0;
            if (Date.now() >= switchLockedUntil) {
              switchLockedUntil = 0;
            }
          }, SWITCH_SETTLE_MS + 50);
        }
        function requestTeamState(playerId, team, { requireTeamMode = false } = {}) {
          const session = getMultiplayerSession();
          if (!hasLobbyPlayerState(session)) {
            dependencies.showStatus("No active lobby or game session.");
            return false;
          }
          if (requireTeamMode && !dependencies.isTeamMode(session)) {
            dependencies.showStatus(`${getTeamStateName(team)} is only available in team modes.`);
            return false;
          }
          const player = getSessionPlayerById(session, playerId);
          if (!player) {
            dependencies.showStatus("Could not find that player.");
            return false;
          }
          if (getPlayerTeamState(player) === team) {
            dependencies.showStatus(`${formatCommandPlayerName(player)} is already ${getTeamStateName(team)}.`);
            return true;
          }
          const localPlayerId = getLocalPlayerId(session);
          if (isSamePlayerId(playerId, localPlayerId)) {
            if (team !== TEAM_STATE_SPECTATE && isSessionMatchActive(session) && dependencies.isCurrentPlayerSpectating(session)) {
              dependencies.noteLocallyInitiatedPlayTransition(session);
            }
            if (!requestPlayerTeamState(session, playerId, team, localPlayerId)) {
              dependencies.showStatus("Could not send the team change command.");
              return false;
            }
            return true;
          }
          if (!isHostSession(session)) {
            dependencies.showStatus("Only the host can move other players between teams.");
            return false;
          }
          if (!requestPlayerTeamState(session, playerId, team, localPlayerId)) {
            dependencies.showStatus("Could not send the team move command.");
            return false;
          }
          return true;
        }
        function requestBulkTeamState(team, { requireTeamMode = false, targetGroup = "all" } = {}) {
          const session = getMultiplayerSession();
          if (!hasLobbyPlayerState(session)) {
            dependencies.showStatus("No active lobby or game session.");
            return false;
          }
          if (requireTeamMode && !dependencies.isTeamMode(session)) {
            dependencies.showStatus(`${getTeamStateName(team)} is only available in team modes.`);
            return false;
          }
          const players = getBulkTeamTargets(team, session, targetGroup);
          if (!players.length) {
            dependencies.showStatus(`No eligible players need to ${getBulkTeamActionName(team)}.`);
            return true;
          }
          const localPlayerId = getLocalPlayerId(session);
          if (!isHostSession(session) && players.some(({ id }) => !isSamePlayerId(id, localPlayerId))) {
            dependencies.showStatus("Only the host can move other players.");
            return false;
          }
          let moved = 0;
          for (const { id } of players) {
            if (isSamePlayerId(id, localPlayerId) && team !== TEAM_STATE_SPECTATE && isSessionMatchActive(session) && dependencies.isCurrentPlayerSpectating(session)) {
              dependencies.noteLocallyInitiatedPlayTransition(session);
            }
            if (requestPlayerTeamState(session, id, team, localPlayerId)) {
              moved += 1;
            }
          }
          if (moved !== players.length) {
            dependencies.showStatus("Could not move every eligible player.");
            return false;
          }
          dependencies.showStatus(formatBulkTeamMoveMessage(moved, team));
          return true;
        }
        function switchTeamPlayers() {
          const session = getMultiplayerSession();
          if (!hasLobbyPlayerState(session)) {
            dependencies.showStatus("No active lobby or game session.");
            return false;
          }
          if (!dependencies.isTeamMode(session)) {
            dependencies.showStatus("SWITCH is only available in team modes.");
            return false;
          }
          if (!isHostSession(session)) {
            dependencies.showStatus("Only the host can switch teams.");
            return false;
          }
          if (isSwitchingTeams()) {
            dependencies.showStatus("Team switch is still settling.");
            return false;
          }
          const localPlayerId = getLocalPlayerId(session);
          const players = getSwitchableTeamPlayers(session);
          if (!players.length) {
            dependencies.showStatus("There are no red or blue players to switch.");
            return false;
          }
          let moved = 0;
          let failed = 0;
          const switchTargets = players.map(({ id, player }) => ({
            id,
            nextTeam: getPlayerTeamState(player) === TEAM_STATE_RED ? TEAM_STATE_BLUE : TEAM_STATE_RED
          }));
          lockSwitchOperation();
          for (const { id, nextTeam } of switchTargets) {
            if (requestPlayerTeamState(session, id, nextTeam, localPlayerId)) {
              moved += 1;
            } else {
              failed += 1;
            }
          }
          if (failed) {
            dependencies.showStatus("Could not switch every player.");
            return false;
          }
          dependencies.showStatus(`Switching ${moved} player${moved === 1 ? "" : "s"} between red and blue.`);
          return true;
        }
        function setTeamsLocked2(locked) {
          const session = getMultiplayerSession();
          if (!hasLobbyPlayerState(session)) {
            dependencies.showStatus("No active lobby or game session.");
            return false;
          }
          if (!isHostSession(session)) {
            dependencies.showStatus(`Only the host can ${locked ? "lock" : "unlock"} teams.`);
            return false;
          }
          if (isTeamsLocked(session) === locked) {
            dependencies.showStatus(`Teams are already ${locked ? "locked" : "unlocked"}.`);
            return true;
          }
          if (!setTeamsLocked(session, locked)) {
            dependencies.showStatus("Could not send the team lock/unlock command.");
            return false;
          }
          return true;
        }
        return {
          isSwitchingTeams,
          requestBulkTeamState,
          requestTeamState,
          setTeamsLocked: setTeamsLocked2,
          switchTeamPlayers
        };
      }

      // src/features/lobby-command-player-resolver.ts
      function formatPlayerNameMatches(matches, getPlayerDisplayName2) {
        return matches.map(({ player }) => getPlayerDisplayName2(player) || "Unnamed Player").filter(Boolean).slice(0, 4).join(", ");
      }
      function createCommandPlayerResolver(options) {
        function resolveNamedCommandPlayer(argument, session = getMultiplayerSession()) {
          const result = findPlayerByName(argument, session);
          if (result.status === "missing") {
            options.showStatus(`Couldn't find player '${argument}'.`);
            return null;
          }
          if (result.status === "ambiguous") {
            const matches = formatPlayerNameMatches(result.matches, options.getPlayerDisplayName);
            options.showStatus(`Player name '${argument}' is ambiguous${matches ? `: ${matches}` : ""}.`);
            return null;
          }
          return result.match;
        }
        return {
          resolveNamedCommandPlayer
        };
      }

      // src/features/lobby-command-host-actions.ts
      function createLobbyCommandHostActions(dependencies) {
        function handleHostSlashCommand(argument) {
          const session = getMultiplayerSession();
          if (!hasLobbyPlayerState(session)) {
            dependencies.showStatus("No active lobby or game session.");
            return false;
          }
          if (!argument) {
            dependencies.showStatus("Usage: /host playername");
            return false;
          }
          if (!isHostSession(session)) {
            dependencies.showStatus("Only the host can transfer host to another player.");
            return false;
          }
          const target = dependencies.resolveNamedCommandPlayer(argument, session);
          if (!target) {
            return false;
          }
          if (isSamePlayerId(target.id, getLocalPlayerId(session))) {
            dependencies.showStatus("You are already host.");
            return true;
          }
          if (!giveHostToPlayer(session, target.id)) {
            dependencies.showStatus("Could not send the host transfer command.");
            return false;
          }
          dependencies.showStatus(`Giving host to ${formatCommandPlayerName(target.player)}.`);
          return true;
        }
        return {
          handleHostSlashCommand
        };
      }

      // src/hitbox/chat-adapter.ts
      function canWriteChatLine(session) {
        return hasNativeMethod(session, "vG");
      }
      function writeChatLine(session, line) {
        return callNativeMethod(session, "vG", [line]).called;
      }

      // src/hitbox/host-settings-adapter.ts
      var EXTRA_HOST_SETTINGS = [
        ["bbPower", "it"],
        ["bbRange", "st"],
        ["bbAngleVariance", "ht"],
        ["bbFireOn", "nt"],
        ["bbFireFramesLength", "at"],
        ["bbHideAfterFireFrames", "lt"],
        ["bbResetOn", "ut"],
        ["bbInitAmmoCost", "ot"],
        ["bbHoldAmmoCost", "rt"],
        ["egEnabled", "Ot"],
        ["egSize", "Rt"],
        ["egAge", "Dt"],
        ["egGravityScale", "Lt"],
        ["egRestitution", "Ut"],
        ["egExplodeRadius", "jt"],
        ["egStartSpin", "Wt"],
        ["egMaxThrowPower", "Jt"],
        ["egAmmoNeeded", "Gt"],
        ["egDelay1", "Ht"],
        ["egDelay2", "zt"],
        ["egDelayBeforeAmmoUse", "Yt"],
        ["egAimRate", "qt"],
        ["egShape", "Vt"]
      ];
      function getHostSettingsObject(session) {
        return readNativePath(session, ["JD", "$L"]) || readNativePath(session, ["KR", "uL", "settings", 0]) || readNativePath(session, ["TJ", "JD", "tP", 0, "state", "settings", 0]) || readNativePath(session, ["JD", "tP", 0, "state", "settings", 0]) || null;
      }
      function readAllHostSettingLines(session) {
        const settings = getHostSettingsObject(session);
        if (!isNativeObject(settings)) {
          return null;
        }
        const nativeResult = callNativeMethod(settings, "pi");
        if (!nativeResult.called || !Array.isArray(nativeResult.result) || !nativeResult.result.every((line) => typeof line === "string")) {
          return null;
        }
        const lines = nativeResult.result.slice();
        if (lines[lines.length - 1] === "===") {
          lines.pop();
        }
        for (const [name, field] of EXTRA_HOST_SETTINGS) {
          const value = readNativeProperty(settings, field);
          if (value !== void 0) {
            lines.push(`${name}: ${String(value)}`);
          }
        }
        lines.push("===");
        return lines;
      }

      // src/features/lobby-command-help.ts
      function getQolboxCommandHelpLines() {
        return [
          "QOLBox commands:",
          "/spec -- move yourself to spectators",
          "/spec playername -- move a player to spectators",
          "/spec all|playing -- move active players to spectators",
          "/join -- move yourself into play (non-team modes)",
          "/join playername -- move a player into play (non-team modes)",
          "/join all|spectators -- move spectators into play (non-team modes)",
          "/red -- move yourself to red (team modes)",
          "/red playername -- move a player to red (team modes)",
          "/red all|playing|spectators -- move players to red (team modes)",
          "/blue -- move yourself to blue (team modes)",
          "/blue playername -- move a player to blue (team modes)",
          "/blue all|playing|spectators -- move players to blue (team modes)",
          "/switch -- swap red and blue teams",
          "/lock -- lock team switching",
          "/unlock -- unlock team switching",
          "/host playername -- give host to a player",
          "/blacklist playername -- add an exact name to automatic host bans",
          "/blacklist -- show blacklisted names",
          "/blacklist remove playername -- remove a blacklisted name",
          "/blacklist clear|on|off -- manage the blacklist",
          "/start -- start the game",
          "/end -- end the current game",
          "/restart -- end and start a new game",
          ...areAdvancedCommandAliasesEnabled() ? ["/r -- same as /restart"] : [],
          "/record -- record the current replay",
          ...areAdvancedCommandAliasesEnabled() ? ["/rec -- same as /record"] : [],
          "/settings -- view normal gameplay settings",
          "/settings all -- view normal and hidden gameplay settings",
          "Named targets for /spec, /join, /red, /blue, /host, /kick, and /ban accept exact or unique partial player names.",
          'Tip: all, playing, and spectators are special targets where shown above. Quote them to use them as player names: /spec "all".',
          'Tip: quote blacklist names like "clear", "on", or "off" to add those exact names.'
        ];
      }
      function writeQolboxCommandHelp(session) {
        for (const line of getQolboxCommandHelpLines()) {
          writeChatLine(session, line);
        }
      }

      // src/features/lobby-command-output-actions.ts
      function createLobbyCommandOutputActions(dependencies) {
        function showAllHostSettings() {
          const session = getMultiplayerSession();
          const lines = readAllHostSettingLines(session);
          if (!lines || !canWriteChatLine(session)) {
            dependencies.showStatus("Could not read the current host settings.", session);
            return false;
          }
          lines.forEach((line) => writeChatLine(session, line));
          return true;
        }
        function showQolboxCommandHelp(session = getMultiplayerSession()) {
          writeQolboxCommandHelp(session);
        }
        return { showAllHostSettings, showQolboxCommandHelp };
      }

      // src/features/lobby-command-play-actions.ts
      function createLobbyCommandPlayActions(dependencies) {
        function handleJoinSlashCommand(argument) {
          const session = getMultiplayerSession();
          if (!hasLobbyPlayerState(session)) {
            dependencies.showStatus("No active lobby or game session.");
            return false;
          }
          if (dependencies.isTeamMode(session)) {
            dependencies.showStatus("Use /red or /blue to join in team modes.");
            return false;
          }
          const targetArgument = parseCommandTarget(argument);
          if (targetArgument.type === "group") {
            return dependencies.requestBulkTeamState(TEAM_STATE_FFA, { targetGroup: targetArgument.group });
          }
          const target = argument ? dependencies.resolveNamedCommandPlayer(targetArgument.value, session) : { id: getLocalPlayerId(session), player: null };
          if (!target) {
            return false;
          }
          const player = getSessionPlayerById(session, target.id);
          if (player && getPlayerTeamState(player) === TEAM_STATE_FFA) {
            dependencies.showStatus(`${formatCommandPlayerName(player)} is already playing.`);
            return true;
          }
          return dependencies.requestTeamState(target.id, TEAM_STATE_FFA);
        }
        function handleSpecSlashCommand(argument) {
          const session = getMultiplayerSession();
          const targetArgument = parseCommandTarget(argument);
          if (targetArgument.type === "group") {
            return dependencies.requestBulkTeamState(TEAM_STATE_SPECTATE, { targetGroup: targetArgument.group });
          }
          const target = argument ? dependencies.resolveNamedCommandPlayer(targetArgument.value, session) : { id: getLocalPlayerId(session), player: null };
          return target ? dependencies.requestTeamState(target.id, TEAM_STATE_SPECTATE) : false;
        }
        return {
          handleJoinSlashCommand,
          handleSpecSlashCommand
        };
      }

      // src/features/lobby-command-actions.ts
      function createLobbyCommandActions(dependencies) {
        const teamActions = createLobbyCommandTeamActions({
          isCurrentPlayerSpectating: dependencies.isCurrentPlayerSpectating,
          isTeamMode: dependencies.isTeamMode,
          noteLocallyInitiatedPlayTransition: dependencies.noteLocallyInitiatedPlayTransition,
          showStatus: dependencies.showStatus
        });
        const playerResolver = createCommandPlayerResolver({
          getPlayerDisplayName: dependencies.getPlayerDisplayName,
          showStatus: dependencies.showStatus
        });
        const outputActions = createLobbyCommandOutputActions({
          showStatus: dependencies.showStatus
        });
        const hostActions = createLobbyCommandHostActions({
          resolveNamedCommandPlayer: playerResolver.resolveNamedCommandPlayer,
          showStatus: dependencies.showStatus
        });
        const playActions = createLobbyCommandPlayActions({
          isTeamMode: dependencies.isTeamMode,
          requestBulkTeamState,
          requestTeamState,
          resolveNamedCommandPlayer: playerResolver.resolveNamedCommandPlayer,
          showStatus: dependencies.showStatus
        });
        function requestTeamState(playerId, team, options = {}) {
          return teamActions.requestTeamState(playerId, team, options);
        }
        function requestBulkTeamState(team, options = {}) {
          return teamActions.requestBulkTeamState(team, options);
        }
        function switchTeamPlayers() {
          return teamActions.switchTeamPlayers();
        }
        function setTeamsLocked2(locked) {
          return teamActions.setTeamsLocked(locked);
        }
        function isSwitchingTeams() {
          return teamActions.isSwitchingTeams();
        }
        function handleTeamSlashCommand(commandName, argument) {
          const session = getMultiplayerSession();
          const targetTeam = commandName === "/blue" ? TEAM_STATE_BLUE : TEAM_STATE_RED;
          if (!argument) {
            return requestTeamState(getLocalPlayerId(session), targetTeam, { requireTeamMode: true });
          }
          const targetArgument = parseCommandTarget(argument);
          if (targetArgument.type === "group") {
            return requestBulkTeamState(targetTeam, { requireTeamMode: true, targetGroup: targetArgument.group });
          }
          if (!dependencies.isTeamMode(session)) {
            dependencies.showStatus(`${getTeamStateName(targetTeam)} is only available in team modes.`);
            return false;
          }
          const target = playerResolver.resolveNamedCommandPlayer(targetArgument.value, session);
          return target ? requestTeamState(target.id, targetTeam, { requireTeamMode: true }) : false;
        }
        function handleJoinSlashCommand(argument) {
          return playActions.handleJoinSlashCommand(argument);
        }
        function handleSpecSlashCommand(argument) {
          return playActions.handleSpecSlashCommand(argument);
        }
        return {
          findPlayerByName,
          handleHostSlashCommand: hostActions.handleHostSlashCommand,
          handleJoinSlashCommand,
          handleSpecSlashCommand,
          handleTeamSlashCommand,
          normalizePlayerName,
          requestBulkTeamState,
          requestTeamState,
          setTeamsLocked: setTeamsLocked2,
          showAllHostSettings: outputActions.showAllHostSettings,
          showQolboxCommandHelp: outputActions.showQolboxCommandHelp,
          isSwitchingTeams,
          switchTeamPlayers
        };
      }

      // src/hitbox/match-actions.ts
      function canEndMatch(session) {
        return hasNativeMethod(session, "PJ");
      }
      function endMatch(session) {
        return callNativeMethod(session, "PJ").called;
      }
      function canStartMatch(session) {
        return hasNativeMethod(session, "_J");
      }
      function startMatch(session) {
        return callNativeMethod(session, "_J").called;
      }

      // src/features/lobby-command-dispatcher.ts
      function hasTextValue(value) {
        return typeof value === "object" && value !== null && "value" in value && typeof value.value === "string";
      }
      function clearHandledChatDraft() {
        for (const input of document.querySelectorAll(".inGameChat .input, .lobbyContainer .chatBox .input")) {
          if (hasTextValue(input)) {
            input.value = "";
          }
        }
      }
      function createLobbyCommandDispatcher(dependencies) {
        function endCurrentGame() {
          const session = getMultiplayerSession();
          if (!isSessionMatchActive(session)) {
            dependencies.showStatus("There is no active game to end.");
            return false;
          }
          if (!isHostSession(session)) {
            dependencies.showStatus("Only the host can end the current game.");
            return false;
          }
          if (!canEndMatch(session)) {
            dependencies.showStatus("The game's end-game action is unavailable.");
            return false;
          }
          clearHandledChatDraft();
          endMatch(session);
          return true;
        }
        function restartCurrentGame() {
          const session = getMultiplayerSession();
          if (!isSessionMatchActive(session)) {
            dependencies.showStatus("There is no active game to restart.");
            return false;
          }
          if (!isHostSession(session)) {
            dependencies.showStatus("Only the host can restart the current game.");
            return false;
          }
          if (!canEndMatch(session) || !canStartMatch(session)) {
            dependencies.showStatus("The game's restart actions are unavailable.");
            return false;
          }
          if (dependencies.areGameStartAlertsEnabled()) {
            dependencies.installStartAlertHooks(session);
          }
          clearHandledChatDraft();
          endMatch(session);
          dependencies.noteLocallyInitiatedPlayTransition(session);
          startMatch(session);
          return true;
        }
        function startCurrentGame() {
          const session = getMultiplayerSession();
          if (isSessionMatchActive(session)) {
            dependencies.showStatus("There is already an active game.");
            return false;
          }
          if (!isHostSession(session)) {
            dependencies.showStatus("Only the host can start the game.");
            return false;
          }
          if (!canStartMatch(session)) {
            dependencies.showStatus("The game's start-game action is unavailable.");
            return false;
          }
          if (dependencies.areGameStartAlertsEnabled()) {
            dependencies.installStartAlertHooks(session);
          }
          clearHandledChatDraft();
          dependencies.noteLocallyInitiatedPlayTransition(session);
          startMatch(session);
          return true;
        }
        function handleQolboxSlashCommand(message) {
          const text = String(message || "").trim();
          const match = text.match(/^\/(switch|lock|unlock|spec|red|blue|join|host|start|end|restart|r|settings|blacklist)(?:\s+(.+))?$/i);
          if (!match) {
            return false;
          }
          const commandName = `/${match[1].toLowerCase()}`;
          const argument = (match[2] || "").trim();
          if (commandName === "/r" && !areAdvancedCommandAliasesEnabled()) {
            return false;
          }
          if (commandName === "/switch") {
            if (argument) {
              dependencies.showStatus("/switch does not take a player name.");
              return true;
            }
            dependencies.actions.switchTeamPlayers();
            return true;
          }
          if (commandName === "/lock" || commandName === "/unlock") {
            if (argument) {
              dependencies.showStatus(`${commandName} does not take an argument.`);
              return true;
            }
            dependencies.actions.setTeamsLocked(commandName === "/lock");
            return true;
          }
          if (commandName === "/spec") {
            dependencies.actions.handleSpecSlashCommand(argument);
            return true;
          }
          if (commandName === "/join") {
            dependencies.actions.handleJoinSlashCommand(argument);
            return true;
          }
          if (commandName === "/host") {
            dependencies.actions.handleHostSlashCommand(argument);
            return true;
          }
          if (commandName === "/blacklist") {
            dependencies.handleBlacklistSlashCommand(argument);
            return true;
          }
          if (commandName === "/end") {
            if (argument) {
              dependencies.showStatus("/end does not take an argument.");
              return true;
            }
            endCurrentGame();
            return true;
          }
          if (commandName === "/start") {
            if (argument) {
              dependencies.showStatus("/start does not take an argument.");
              return true;
            }
            startCurrentGame();
            return true;
          }
          if (commandName === "/restart" || commandName === "/r") {
            if (argument) {
              dependencies.showStatus(`${commandName} does not take an argument.`);
              return true;
            }
            restartCurrentGame();
            return true;
          }
          if (commandName === "/settings") {
            if (dependencies.actions.normalizePlayerName(argument) !== "all") {
              return false;
            }
            dependencies.actions.showAllHostSettings();
            return true;
          }
          dependencies.actions.handleTeamSlashCommand(commandName, argument);
          return true;
        }
        return { endCurrentGame, handleQolboxSlashCommand, restartCurrentGame, startCurrentGame };
      }

      // src/features/qolbox-chat-status.ts
      function createQolboxChatStatusWriter(options) {
        function showQolboxChatStatus(message, session = options.getSession()) {
          writeChatLine(session, `* ${message}`);
        }
        return {
          showQolboxChatStatus
        };
      }

      // src/hitbox/active-match-removal.ts
      var ACTIVE_MATCH_BLACKLIST_CLEANUP_DELAYS_MS = [0, 250, 750, 1500, 3e3, 5e3];
      function getActiveMatchRuntime(session) {
        const runtime = readNativePath(session, ["KR"]);
        return readNativeProperty(runtime, "SL") ? runtime : null;
      }
      function getRuntimeFrame(runtime) {
        const frame = Number(readNativeProperty(runtime, "hD") ?? readNativeProperty(runtime, "AI"));
        return Number.isFinite(frame) && frame >= 0 ? frame : 0;
      }
      function removeActiveMatchPlayer(session, playerId) {
        const runtime = getActiveMatchRuntime(session);
        if (!runtime || playerId === null || playerId === void 0) {
          return false;
        }
        const numericId = Number(playerId);
        const id = Number.isFinite(numericId) ? numericId : playerId;
        return callNativeMethod(runtime, "OL", [id, getRuntimeFrame(runtime)]).called;
      }
      function scheduleActiveMatchPlayerRemoval(session, playerId) {
        if (!getActiveMatchRuntime(session) || playerId === null || playerId === void 0) {
          return;
        }
        for (const delay of ACTIVE_MATCH_BLACKLIST_CLEANUP_DELAYS_MS) {
          window.setTimeout(() => {
            removeActiveMatchPlayer(session, playerId);
          }, delay);
        }
      }

      // src/hitbox/player-join-hooks.ts
      var PLAYER_JOIN_HOOK_MARKER = "__qolboxPlayerJoinHookInstalled";
      function installPlayerJoinHook(session, onPlayerJoined) {
        if (!isNativeObject(session) || readNativeProperty(session, PLAYER_JOIN_HOOK_MARKER)) {
          return false;
        }
        const nativePlayerJoined = readNativeProperty(session, "VW");
        if (typeof nativePlayerJoined !== "function") {
          return false;
        }
        const wrappedPlayerJoined = function wrappedQolboxPlayerJoined(...args) {
          const result = Reflect.apply(nativePlayerJoined, this, args);
          window.setTimeout(() => onPlayerJoined(this), 0);
          return result;
        };
        setNativeReflectProperty(session, "VW", wrappedPlayerJoined);
        setNativeReflectProperty(session, PLAYER_JOIN_HOOK_MARKER, true);
        return true;
      }

      // src/settings/blacklist-storage.ts
      var BLACKLIST_STORAGE_KEY = "vm.hitbox.qolboxBlacklist.v1";
      var MAX_BLACKLIST_ENTRIES = 200;
      function normalizeStoredName(name) {
        return String(name || "").replace(/\s+/g, " ").trim().toLowerCase();
      }
      function sanitizeBlacklistNames(value) {
        if (!Array.isArray(value)) {
          return [];
        }
        const names = [];
        const seen = /* @__PURE__ */ new Set();
        for (const rawName of value) {
          const name = String(rawName || "").replace(/\s+/g, " ").trim();
          const normalizedName = normalizeStoredName(name);
          if (!normalizedName || seen.has(normalizedName)) {
            continue;
          }
          seen.add(normalizedName);
          names.push(name);
          if (names.length >= MAX_BLACKLIST_ENTRIES) {
            break;
          }
        }
        return names;
      }
      function loadBlacklistNames() {
        try {
          return sanitizeBlacklistNames(JSON.parse(localStorage.getItem(BLACKLIST_STORAGE_KEY) || "[]"));
        } catch {
          return [];
        }
      }
      function saveBlacklistNames(names) {
        const sanitizedNames = sanitizeBlacklistNames(names);
        try {
          localStorage.setItem(BLACKLIST_STORAGE_KEY, JSON.stringify(sanitizedNames));
        } catch {
        }
        return sanitizedNames;
      }

      // src/features/lobby-blacklist.ts
      var BLACKLIST_CHAT_FILTER_FLAG = "__qolboxBlacklistChatFilterInstalled";
      function parseQuotedName(value) {
        const trimmed = value.trim();
        const match = trimmed.match(/^(["'])(.*)\1$/);
        return {
          quoted: Boolean(match),
          value: (match ? match[2] : trimmed).replace(/\s+/g, " ").trim()
        };
      }
      function findStoredName(names, query) {
        const normalizedQuery = normalizePlayerName(query);
        if (!normalizedQuery) {
          return { matches: [], status: "missing" };
        }
        const tiers = [
          names.filter((name) => normalizePlayerName(name) === normalizedQuery),
          names.filter((name) => normalizePlayerName(name).startsWith(normalizedQuery)),
          names.filter((name) => normalizePlayerName(name).includes(normalizedQuery))
        ];
        for (const matches of tiers) {
          if (matches.length === 1) {
            return { matches, status: "found" };
          }
          if (matches.length > 1) {
            return { matches, status: "ambiguous" };
          }
        }
        return { matches: [], status: "missing" };
      }
      function getUniqueCurrentPlayerNames() {
        const names = [];
        const seen = /* @__PURE__ */ new Set();
        for (const { player } of getSessionPlayers()) {
          const name = String(getPlayerName(player) || "").replace(/\s+/g, " ").trim();
          const normalizedName = normalizePlayerName(name);
          if (!normalizedName || seen.has(normalizedName)) {
            continue;
          }
          seen.add(normalizedName);
          names.push(name);
        }
        return names;
      }
      function findCurrentPlayerName(requestedName) {
        const normalizedRequest = normalizePlayerName(requestedName);
        if (!normalizedRequest) {
          return { match: null, partialMatches: [] };
        }
        const names = getUniqueCurrentPlayerNames();
        const exactMatch = names.find((name) => normalizePlayerName(name) === normalizedRequest) || null;
        if (exactMatch) {
          return { match: exactMatch, partialMatches: [] };
        }
        const partialMatches = names.filter((name) => normalizePlayerName(name).includes(normalizedRequest)).slice(0, 4);
        return { match: null, partialMatches };
      }
      function getQuotedCommandExample(name) {
        return name.includes('"') ? `/blacklist '${name}'` : `/blacklist "${name}"`;
      }
      function getPartialCurrentPlayerMessage(requestedName, matches) {
        const matchText = matches.join(", ");
        return `Blacklist uses exact names. '${requestedName}' partially matches ${matchText}. Type the full player name or use ${getQuotedCommandExample(requestedName)} to add exactly '${requestedName}'.`;
      }
      function getNativeBlacklistStatusName(line) {
        const text = String(line || "").replace(/^\s*\*\s*/, "").replace(/\s+/g, " ").trim();
        const match = text.match(/^(.+?) has (?:joined the game|been banned from this room|left the game)\.?$/i);
        return match?.[1].trim() || null;
      }
      function createLobbyBlacklistController(options) {
        let blacklistNames = loadBlacklistNames();
        let hookTarget = null;
        let attemptedSession = null;
        let attemptedPlayers = /* @__PURE__ */ new Set();
        function saveNames(nextNames) {
          blacklistNames = saveBlacklistNames(nextNames);
        }
        function getBlacklistNameMap() {
          return new Map(blacklistNames.map((name) => [normalizePlayerName(name), name]));
        }
        function shouldSuppressNativeBlacklistStatus(line) {
          if (!options.areLobbyCommandsEnabled() || !options.isEnforcementEnabled()) {
            return false;
          }
          const playerName = getNativeBlacklistStatusName(line);
          return Boolean(playerName && getBlacklistNameMap().has(normalizePlayerName(playerName)));
        }
        function installBlacklistChatFilter(session) {
          if (!isNativeObject(session) || readNativeProperty(session, BLACKLIST_CHAT_FILTER_FLAG) === true) {
            return;
          }
          const nativeWriteChatLine = readNativeProperty(session, "vG");
          if (typeof nativeWriteChatLine !== "function") {
            return;
          }
          const nativeWriteChat = nativeWriteChatLine;
          function wrappedBlacklistChatLineFilter(line, ...rest) {
            if (shouldSuppressNativeBlacklistStatus(line)) {
              return void 0;
            }
            return Reflect.apply(nativeWriteChat, this, [line, ...rest]);
          }
          setNativeReflectProperty(wrappedBlacklistChatLineFilter, "__qolboxOriginal", nativeWriteChat);
          setNativeReflectProperty(session, "vG", wrappedBlacklistChatLineFilter);
          setNativeReflectProperty(session, BLACKLIST_CHAT_FILTER_FLAG, true);
        }
        function resetAttemptsForSession(session) {
          if (attemptedSession === session) {
            return;
          }
          attemptedSession = session;
          attemptedPlayers = /* @__PURE__ */ new Set();
        }
        function enforceBlacklist(session = getMultiplayerSession()) {
          if (!options.areLobbyCommandsEnabled() || !options.isEnforcementEnabled() || !hasLobbyPlayerState(session) || !isHostSession(session)) {
            return 0;
          }
          resetAttemptsForSession(session);
          const namesByNormalizedName = getBlacklistNameMap();
          if (!namesByNormalizedName.size) {
            return 0;
          }
          const localPlayerId = getLocalPlayerId(session);
          let banned = 0;
          for (const { id, player } of getSessionPlayers(session)) {
            if (isSamePlayerId(id, localPlayerId)) {
              continue;
            }
            const playerName = String(getPlayerName(player) || "").trim();
            const normalizedName = normalizePlayerName(playerName);
            const attemptKey = `${String(id)}\0${normalizedName}`;
            if (!namesByNormalizedName.has(normalizedName) || attemptedPlayers.has(attemptKey)) {
              continue;
            }
            attemptedPlayers.add(attemptKey);
            if (banPlayer(session, id)) {
              banned += 1;
              scheduleActiveMatchPlayerRemoval(session, id);
              options.showStatus(`Banned blacklisted player ${playerName || "Player"}.`, session);
            } else {
              attemptedPlayers.delete(attemptKey);
              options.showStatus(`Could not ban blacklisted player ${playerName || "Player"}.`, session);
            }
          }
          return banned;
        }
        function installBlacklistHook(session = getMultiplayerSession()) {
          if (!session || session === hookTarget) {
            return false;
          }
          if (installPlayerJoinHook(session, (joinedSession) => enforceBlacklist(joinedSession))) {
            hookTarget = session;
            return true;
          }
          return false;
        }
        function patchLobbyBlacklist() {
          const session = getMultiplayerSession();
          installBlacklistChatFilter(session);
          installBlacklistHook(session);
          enforceBlacklist(session);
        }
        function showBlacklist() {
          if (!blacklistNames.length) {
            options.showStatus("The blacklist is empty. Usage: /blacklist playername");
            return true;
          }
          options.showStatus(`Blacklisted names (${blacklistNames.length}):`);
          blacklistNames.forEach((name) => options.showStatus(`- ${name}`));
          return true;
        }
        function addBlacklistName(rawName) {
          const parsedName = parseQuotedName(rawName);
          const requestedName = parsedName.value;
          if (!requestedName) {
            options.showStatus("Usage: /blacklist playername");
            return false;
          }
          const currentPlayerName = parsedName.quoted ? { match: null, partialMatches: [] } : findCurrentPlayerName(requestedName);
          if (currentPlayerName.partialMatches.length) {
            options.showStatus(getPartialCurrentPlayerMessage(requestedName, currentPlayerName.partialMatches));
            return false;
          }
          const exactName = currentPlayerName.match || requestedName;
          if (blacklistNames.some((name) => normalizePlayerName(name) === normalizePlayerName(exactName))) {
            options.showStatus(`${exactName} is already blacklisted.`);
            return true;
          }
          if (blacklistNames.length >= MAX_BLACKLIST_ENTRIES) {
            options.showStatus(`The blacklist is full (${MAX_BLACKLIST_ENTRIES} names). Remove a name before adding another.`);
            return false;
          }
          saveNames([...blacklistNames, exactName]);
          options.showStatus(`Added ${exactName} to the blacklist.`);
          if (!options.isEnforcementEnabled()) {
            options.showStatus("Automatic blacklist is off.");
          } else if (!isHostSession()) {
            options.showStatus("Automatic bans will apply when you are host.");
          }
          patchLobbyBlacklist();
          return true;
        }
        function removeBlacklistName(rawName) {
          const requestedName = parseQuotedName(rawName).value;
          if (!requestedName) {
            options.showStatus("Usage: /blacklist remove playername");
            return false;
          }
          const result = findStoredName(blacklistNames, requestedName);
          if (result.status === "missing") {
            options.showStatus(`Couldn't find '${requestedName}' in the blacklist.`);
            return false;
          }
          if (result.status === "ambiguous") {
            options.showStatus(`Blacklist name '${requestedName}' is ambiguous: ${result.matches.slice(0, 4).join(", ")}.`);
            return false;
          }
          const removedName = result.matches[0];
          saveNames(blacklistNames.filter((name) => normalizePlayerName(name) !== normalizePlayerName(removedName)));
          options.showStatus(`Removed ${removedName} from the blacklist.`);
          return true;
        }
        function clearBlacklist() {
          const removedCount = blacklistNames.length;
          saveNames([]);
          options.showStatus(
            removedCount ? `Cleared ${removedCount} ${removedCount === 1 ? "name" : "names"} from the blacklist.` : "The blacklist is already empty."
          );
          return true;
        }
        function setBlacklistEnforcement(enabled) {
          if (options.isEnforcementEnabled() === enabled) {
            options.showStatus(`Automatic blacklist is already ${enabled ? "on" : "off"}.`);
            return true;
          }
          options.setEnforcementEnabled(enabled);
          options.showStatus(`Automatic blacklist is now ${enabled ? "on" : "off"}.`);
          if (enabled) {
            patchLobbyBlacklist();
          }
          return true;
        }
        function handleBlacklistSlashCommand(argument) {
          const trimmed = argument.trim();
          if (!trimmed) {
            return showBlacklist();
          }
          const parsedName = parseQuotedName(trimmed);
          if (parsedName.quoted) {
            return addBlacklistName(trimmed);
          }
          const commandMatch = trimmed.match(/^(clear|on|off)$/i);
          if (commandMatch?.[1].toLowerCase() === "clear") {
            return clearBlacklist();
          }
          if (commandMatch?.[1].toLowerCase() === "on") {
            return setBlacklistEnforcement(true);
          }
          if (commandMatch?.[1].toLowerCase() === "off") {
            return setBlacklistEnforcement(false);
          }
          const removeMatch = trimmed.match(/^(?:remove|delete|rm)(?:\s+(.+))?$/i);
          if (removeMatch) {
            return removeBlacklistName(removeMatch[1] || "");
          }
          return addBlacklistName(trimmed);
        }
        return {
          enforceBlacklist,
          handleBlacklistSlashCommand,
          patchLobbyBlacklist
        };
      }

      // src/features/player-popup-dismissal.ts
      var dismissalListenersInstalled = false;
      function getRightClickMenus() {
        return Array.from(document.querySelectorAll(".rightClickMenu"));
      }
      function removePlayerPopups() {
        const menus = getRightClickMenus();
        for (const menu of menus) {
          menu.remove();
        }
        return menus.length > 0;
      }
      function isInsidePopupActionList(target) {
        return target instanceof Element && Boolean(target.closest(".rightClickMenu .container"));
      }
      function handlePointerOutsidePlayerPopup(event) {
        if (!getRightClickMenus().length || isInsidePopupActionList(event.target)) {
          return;
        }
        removePlayerPopups();
      }
      function installPlayerPopupDismissal() {
        if (dismissalListenersInstalled) {
          return;
        }
        dismissalListenersInstalled = true;
        document.addEventListener("pointerdown", handlePointerOutsidePlayerPopup, true);
        document.addEventListener("mousedown", handlePointerOutsidePlayerPopup, true);
      }

      // src/features/switch-teams-button.ts
      function createSwitchTeamsButtonController(dependencies) {
        function removeSwitchTeamsButton() {
          for (const button of document.querySelectorAll(".qolboxSwitchTeamsButton")) {
            button.remove();
          }
        }
        function handleSwitchTeamsButtonClick(event) {
          event.preventDefault();
          event.stopPropagation();
          if (dependencies.isSwitching()) {
            return;
          }
          dependencies.switchTeams();
        }
        function patchSwitchTeamsButton() {
          const session = getMultiplayerSession();
          const container = document.querySelector(".lobbyContainer .playerBox .teamsButtonContainer");
          if (!dependencies.isEnabled() || !container || !isHostSession(session) || !dependencies.isTeamMode(session) || !isElementVisible(container)) {
            removeSwitchTeamsButton();
            return false;
          }
          let button = container.querySelector(".qolboxSwitchTeamsButton");
          if (!button) {
            button = document.createElement("div");
            button.className = "teamButton qolboxSwitchTeamsButton";
            button.dataset.qolboxSwitchTeams = "true";
          }
          const switching = dependencies.isSwitching();
          button.onclick = handleSwitchTeamsButtonClick;
          button.classList.toggle("qolboxSwitchTeamsButtonBusy", switching);
          button.setAttribute("aria-disabled", switching ? "true" : "false");
          button.setAttribute("title", switching ? "Switching teams..." : "Switch red and blue teams");
          const label = switching ? "SWITCHING" : "SWITCH";
          if (button.textContent !== label) {
            button.textContent = label;
          }
          const blueButton = Array.from(container.querySelectorAll(".teamButton")).find(
            (element) => /^\s*JOIN\s+BLUE\s*$/i.test(element.textContent || "")
          );
          if (blueButton && blueButton !== button && button.nextElementSibling !== blueButton) {
            container.insertBefore(button, blueButton);
          } else if (button.parentElement !== container) {
            container.appendChild(button);
          }
          return true;
        }
        return { patchSwitchTeamsButton, removeSwitchTeamsButton };
      }

      // src/features/team-mode-detector.ts
      var TEAM_MODE_VALUES = /* @__PURE__ */ new Set([3, 4, 5]);
      function getSelectedLobbyModeValue() {
        const modeSelect = document.querySelector("select.modeDropdown.left, select.modeDropdown");
        if (!modeSelect) {
          return null;
        }
        const mode = Number(modeSelect.value);
        return Number.isFinite(mode) ? mode : null;
      }
      function hasVisibleTeamModeControls() {
        for (const element of document.querySelectorAll("button, .button, .bottomButton, .item, div")) {
          if (!isElementVisible(element)) {
            continue;
          }
          if (/^\s*JOIN\s+(RED|BLUE)\s*$/i.test(element.textContent || "")) {
            return true;
          }
        }
        return false;
      }
      function isTeamMode(session = getMultiplayerSession()) {
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

      // src/features/lobby-commands-feature-bundle.ts
      function createLobbyCommandsFeatureBundle(options) {
        const { showQolboxChatStatus } = createQolboxChatStatusWriter({
          getSession: getMultiplayerSession
        });
        const lobbyCommandActions = createLobbyCommandActions({
          getPlayerDisplayName,
          isCurrentPlayerSpectating: options.isCurrentPlayerSpectating,
          isTeamMode,
          noteLocallyInitiatedPlayTransition: options.noteLocallyInitiatedPlayTransition,
          showStatus: showQolboxChatStatus
        });
        const blacklist = createLobbyBlacklistController({
          areLobbyCommandsEnabled: options.areLobbyCommandsEnabled,
          isEnforcementEnabled: options.isBlacklistEnforcementEnabled,
          setEnforcementEnabled: options.setBlacklistEnforcementEnabled,
          showStatus: showQolboxChatStatus
        });
        const dispatcher = createLobbyCommandDispatcher({
          actions: lobbyCommandActions,
          areGameStartAlertsEnabled: options.areGameStartAlertsEnabled,
          handleBlacklistSlashCommand: blacklist.handleBlacklistSlashCommand,
          installStartAlertHooks: options.installStartAlertHooks,
          noteLocallyInitiatedPlayTransition: options.noteLocallyInitiatedPlayTransition,
          showStatus: showQolboxChatStatus
        });
        const switchTeamsButton = createSwitchTeamsButtonController({
          isEnabled: options.areLobbyCommandsEnabled,
          isSwitching: lobbyCommandActions.isSwitchingTeams,
          isTeamMode,
          switchTeams: lobbyCommandActions.switchTeamPlayers
        });
        function prepareNativePlayerCommand(message) {
          if (typeof message !== "string") {
            return message;
          }
          const match = message.match(/^(\s*)\/(kick|ban)\s+(.+?)\s*$/i);
          if (!match) {
            return message;
          }
          const [, leadingSpace, commandName, rawTarget] = match;
          const quotedTarget = rawTarget.match(/^(["'])(.*)\1$/);
          const targetName = quotedTarget ? quotedTarget[2] : rawTarget;
          const result = lobbyCommandActions.findPlayerByName(targetName);
          if (result.status === "found") {
            return `${leadingSpace}/${commandName.toLowerCase()} ${formatCommandPlayerName(result.match.player)}`;
          }
          if (result.status === "ambiguous") {
            const matches = result.matches.map(({ player }) => getPlayerDisplayName(player) || "Unnamed Player").slice(0, 4).join(", ");
            showQolboxChatStatus(`Player name '${targetName}' is ambiguous${matches ? `: ${matches}` : ""}.`);
            return null;
          }
          showQolboxChatStatus(`Couldn't find player '${targetName}'.`);
          return null;
        }
        function patchSlashCommands() {
          return installSlashCommandInterceptor(getMultiplayerSession(), {
            areCommandsEnabled: options.areLobbyCommandsEnabled,
            handleCommand: dispatcher.handleQolboxSlashCommand,
            prepareNativeCommand: prepareNativePlayerCommand,
            showHelp: lobbyCommandActions.showQolboxCommandHelp
          });
        }
        return {
          ...lobbyCommandActions,
          ...dispatcher,
          ...blacklist,
          ...switchTeamsButton,
          installPlayerPopupDismissal,
          patchSlashCommands,
          showQolboxChatStatus
        };
      }

      // src/features/mobile-grab-context.ts
      function getMobileAbilityButtons() {
        const nativeButtons = getNativeMobileAbilityButtonElements();
        if (nativeButtons.length) {
          return nativeButtons;
        }
        return Array.from(document.querySelectorAll(".buttonArea.bat, .buttonArea.push, .buttonArea.rocket"));
      }
      function areNativeMobileAbilityButtonsVisible() {
        const buttons = getMobileAbilityButtons();
        return buttons.length > 0 && buttons.every(isElementVisible);
      }
      function isMobileGameModeContext() {
        return isNativeMobileMode() || areNativeMobileAbilityButtonsVisible();
      }
      function isMobileQolboxMenuContextValue() {
        if (isNativeMobileMode()) {
          return true;
        }
        const nav = window.navigator || (typeof navigator !== "undefined" ? navigator : null);
        const touchPoints = Number(
          nav && (readObjectProperty(nav, "maxTouchPoints") || readObjectProperty(nav, "msMaxTouchPoints") || 0)
        );
        if (!touchPoints || typeof window.matchMedia !== "function") {
          return false;
        }
        try {
          return window.matchMedia("(hover: none) and (pointer: coarse)").matches;
        } catch {
          return false;
        }
      }

      // src/features/mobile-grab-button-element.ts
      function createMobileGrabButtonElement(container, handlers) {
        const button = document.createElement("div");
        button.className = "buttonArea qolboxMobileGrabButton";
        button.setAttribute("aria-label", "Grab");
        button.setAttribute("role", "button");
        button.dataset.qolboxMobileGrab = "true";
        button.addEventListener("touchstart", handlers.onTouchStart, {
          passive: false,
          capture: true
        });
        button.addEventListener("pointerdown", handlers.onPointerStart, true);
        container.appendChild(button);
        return button;
      }
      function hideMobileGrabButtonElement(button) {
        if (button && button.style) {
          button.style.display = "none";
        }
      }
      function removeMobileGrabButtonElement(button) {
        hideMobileGrabButtonElement(button);
        if (button && button.isConnected) {
          button.remove();
        }
        return null;
      }

      // src/features/mobile-grab-input.ts
      var MOBILE_GRAB_FALLBACK_KEY = "v";
      var MOBILE_GRAB_FALLBACK_CODE = "KeyV";
      var MOBILE_GRAB_FALLBACK_KEY_CODE = 86;
      function createMobileGrabInputController() {
        let mobileGrabPointerDown = false;
        let mobileGrabInputState = null;
        let mobileGrabControlledInputState = null;
        let mobileGrabKeyboardFallbackActive = false;
        function getMobileGrabInputState() {
          const controlInputState = getNativeMobileControlInputState(getNativeMobileControls());
          if (controlInputState) {
            return controlInputState;
          }
          const sessionInputState = getLiveMultiplayerInputState();
          if (sessionInputState) {
            return sessionInputState;
          }
          return mobileGrabInputState;
        }
        function dispatchMobileGrabKeyboardFallback(pressed) {
          if (pressed === mobileGrabKeyboardFallbackActive) {
            return;
          }
          mobileGrabKeyboardFallbackActive = pressed;
          const event = new KeyboardEvent(pressed ? "keydown" : "keyup", {
            bubbles: true,
            cancelable: true,
            code: MOBILE_GRAB_FALLBACK_CODE,
            composed: true,
            key: MOBILE_GRAB_FALLBACK_KEY
          });
          const legacyKeyProperties = [
            ["keyCode", MOBILE_GRAB_FALLBACK_KEY_CODE],
            ["which", MOBILE_GRAB_FALLBACK_KEY_CODE]
          ];
          for (const [property, value] of legacyKeyProperties) {
            try {
              Object.defineProperty(event, property, { get: () => value });
            } catch {
            }
          }
          window.dispatchEvent(event);
        }
        function setMobileGrabPressed(pressed) {
          const nextPressed = Boolean(pressed);
          if (!nextPressed && !mobileGrabPointerDown && !mobileGrabControlledInputState && !mobileGrabKeyboardFallbackActive) {
            return;
          }
          mobileGrabPointerDown = nextPressed;
          if (!mobileGrabPointerDown) {
            if (mobileGrabControlledInputState) {
              setGrabInputPressed(mobileGrabControlledInputState, false);
              mobileGrabControlledInputState = null;
            }
            if (mobileGrabKeyboardFallbackActive) {
              dispatchMobileGrabKeyboardFallback(false);
            }
            return;
          }
          const inputState = getMobileGrabInputState();
          if (inputState && setGrabInputPressed(inputState, true)) {
            mobileGrabInputState = inputState;
            mobileGrabControlledInputState = inputState;
            if (mobileGrabKeyboardFallbackActive) {
              dispatchMobileGrabKeyboardFallback(false);
            }
            return;
          }
          dispatchMobileGrabKeyboardFallback(true);
        }
        function observeMobileGrabInputState(inputState) {
          mobileGrabInputState = inputState;
        }
        function restoreMobileGrabPressedOnInputState(inputState) {
          if (mobileGrabPointerDown && setGrabInputPressed(inputState, true)) {
            mobileGrabControlledInputState = inputState;
          }
        }
        function isMobileGrabPressed() {
          return mobileGrabPointerDown;
        }
        return {
          isMobileGrabPressed,
          observeMobileGrabInputState,
          restoreMobileGrabPressedOnInputState,
          setMobileGrabPressed
        };
      }

      // src/features/mobile-grab-layout.ts
      function getCssScale(element, options) {
        const rect = element.getBoundingClientRect();
        const cssWidth = element.clientWidth || Number.parseFloat(window.getComputedStyle(element).width) || rect.width;
        const cssHeight = element.clientHeight || Number.parseFloat(window.getComputedStyle(element).height) || rect.height;
        return {
          x: cssWidth > 0 && rect.width > 0 ? rect.width / cssWidth : 1,
          y: cssHeight > 0 && rect.height > 0 ? rect.height / cssHeight : 1,
          width: cssWidth || options.fallbackBaseWidth,
          height: cssHeight || options.fallbackBaseHeight
        };
      }
      function getMobileAbilityGapCss(buttons, scaleY) {
        const rects = buttons.map((button) => button.getBoundingClientRect()).filter((rect) => rect.width > 0 && rect.height > 0).sort((left, right) => left.top - right.top);
        let gap = Infinity;
        for (let index = 1; index < rects.length; index += 1) {
          const currentGap = rects[index].top - rects[index - 1].bottom;
          if (currentGap > 0) {
            gap = Math.min(gap, currentGap);
          }
        }
        return Number.isFinite(gap) ? Math.round(gap / Math.max(0.01, scaleY)) : 10;
      }
      function positionMobileGrabButton(button, options) {
        const container = document.getElementById("relativeContainer");
        const abilityButtons = options.getAbilityButtons();
        const referenceButton = document.querySelector(".buttonArea.bat") || abilityButtons[0];
        if (!container || !referenceButton || !isElementVisible(referenceButton)) {
          button.style.left = "auto";
          button.style.top = "auto";
          button.style.right = "40px";
          button.style.bottom = "0px";
          button.style.width = "90px";
          button.style.height = "90px";
          return;
        }
        const containerRect = container.getBoundingClientRect();
        const referenceRect = referenceButton.getBoundingClientRect();
        const scale = getCssScale(container, options);
        const gap = getMobileAbilityGapCss(abilityButtons, scale.y);
        const width = Math.round(referenceRect.width / Math.max(0.01, scale.x)) || 90;
        const height = Math.round(referenceRect.height / Math.max(0.01, scale.y)) || 90;
        const desiredLeft = (referenceRect.left - containerRect.left) / Math.max(0.01, scale.x) - width - gap;
        const desiredTop = (referenceRect.top - containerRect.top) / Math.max(0.01, scale.y);
        const containerRight = Number.isFinite(containerRect.right) ? containerRect.right : containerRect.left + containerRect.width;
        const containerBottom = Number.isFinite(containerRect.bottom) ? containerRect.bottom : containerRect.top + containerRect.height;
        const viewportWidth = window.innerWidth || containerRight;
        const viewportHeight = window.innerHeight || containerBottom;
        const visibleLeft = Math.max(0, containerRect.left);
        const visibleTop = Math.max(0, containerRect.top);
        const visibleRight = Math.min(viewportWidth, containerRight);
        const visibleBottom = Math.min(viewportHeight, containerBottom);
        const minLeft = Math.max(0, Math.round((visibleLeft - containerRect.left) / Math.max(0.01, scale.x)));
        const minTop = Math.max(0, Math.round((visibleTop - containerRect.top) / Math.max(0.01, scale.y)));
        const maxLeft = Math.max(
          minLeft,
          Math.min(scale.width - width, Math.round((visibleRight - containerRect.left) / Math.max(0.01, scale.x) - width))
        );
        const maxTop = Math.max(
          minTop,
          Math.min(scale.height - height, Math.round((visibleBottom - containerRect.top) / Math.max(0.01, scale.y) - height))
        );
        const left = Math.max(minLeft, Math.min(maxLeft, Math.round(desiredLeft)));
        const top = Math.max(minTop, Math.min(maxTop, Math.round(desiredTop)));
        button.style.width = `${width}px`;
        button.style.height = `${height}px`;
        button.style.left = `${left}px`;
        button.style.top = `${top}px`;
        button.style.right = "auto";
        button.style.bottom = "auto";
      }

      // src/features/mobile-grab-events.ts
      function getChangedTouches(event) {
        const changedTouches = readObjectProperty(event, "changedTouches");
        const length = Number(readObjectProperty(changedTouches, "length"));
        if (!Number.isFinite(length) || length <= 0) {
          return [];
        }
        const touches = [];
        for (let index = 0; index < length; index += 1) {
          const touch = readObjectProperty(changedTouches, index);
          if (touch) {
            touches.push(touch);
          }
        }
        return touches;
      }
      function getTouchIdentifier(touch) {
        return readObjectProperty(touch, "identifier");
      }
      function getPointerIdentifier(event) {
        return readObjectProperty(event, "pointerId");
      }
      function isPrimaryPointerStart(event) {
        const button = readObjectProperty(event, "button");
        return button === void 0 || button === 0;
      }
      function callEventMethod(event, methodName) {
        const method = readObjectProperty(event, methodName);
        if (isReflectableObject(event) && typeof method === "function") {
          Reflect.apply(method, event, []);
        }
      }
      function stopMobileGrabEvent(event) {
        if (readObjectProperty(event, "cancelable") !== false) {
          callEventMethod(event, "preventDefault");
        }
        callEventMethod(event, "stopImmediatePropagation");
      }

      // src/features/mobile-grab-press.ts
      var UNKNOWN_POINTER_ID = /* @__PURE__ */ Symbol("qolbox-unknown-pointer");
      function createMobileGrabPressController(options) {
        let activeTouchId = null;
        let activePointerId = null;
        let releaseHooksInstalled = false;
        function resetMobileGrabPress() {
          activeTouchId = null;
          activePointerId = null;
          options.setPressed(false);
        }
        function getPointerKey(event) {
          const pointerId = getPointerIdentifier(event);
          return pointerId === void 0 || pointerId === null ? UNKNOWN_POINTER_ID : pointerId;
        }
        function handleMobileGrabTouchStart(event) {
          if (!options.getButton() || !options.shouldShow()) {
            return;
          }
          const touch = getChangedTouches(event)[0];
          if (!touch) {
            return;
          }
          stopMobileGrabEvent(event);
          activeTouchId = getTouchIdentifier(touch);
          options.setPressed(true);
        }
        function handleMobileGrabTouchEnd(event) {
          if (activeTouchId === null) {
            return;
          }
          for (const touch of getChangedTouches(event)) {
            if (getTouchIdentifier(touch) === activeTouchId) {
              activeTouchId = null;
              options.setPressed(false);
              return;
            }
          }
        }
        function handleMobileGrabPointerStart(event) {
          if (!options.getButton() || !options.shouldShow()) {
            return;
          }
          if (!isPrimaryPointerStart(event)) {
            return;
          }
          stopMobileGrabEvent(event);
          activePointerId = getPointerKey(event);
          options.setPressed(true);
        }
        function handleMobileGrabPointerEnd(event) {
          if (activePointerId === null) {
            return;
          }
          if (getPointerKey(event) !== activePointerId) {
            return;
          }
          stopMobileGrabEvent(event);
          activePointerId = null;
          options.setPressed(false);
        }
        function installMobileGrabReleaseHooks() {
          if (releaseHooksInstalled) {
            return;
          }
          releaseHooksInstalled = true;
          document.addEventListener("touchend", handleMobileGrabTouchEnd, true);
          document.addEventListener("touchcancel", handleMobileGrabTouchEnd, true);
          document.addEventListener("pointerup", handleMobileGrabPointerEnd, true);
          document.addEventListener("pointercancel", handleMobileGrabPointerEnd, true);
          window.addEventListener("touchend", handleMobileGrabTouchEnd, true);
          window.addEventListener("touchcancel", handleMobileGrabTouchEnd, true);
          window.addEventListener("pointerup", handleMobileGrabPointerEnd, true);
          window.addEventListener("pointercancel", handleMobileGrabPointerEnd, true);
          window.addEventListener("blur", resetMobileGrabPress, true);
        }
        return {
          handleMobileGrabPointerStart,
          handleMobileGrabTouchStart,
          installMobileGrabReleaseHooks,
          resetMobileGrabPress
        };
      }

      // src/features/mobile-grab-button.ts
      var MOBILE_GRAB_ICON_HREF = "data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 64 64%22 fill=%22none%22%3E%3Cpath d=%22M22 36V13a5 5 0 0 1 10 0v20V9a5 5 0 0 1 10 0v25V13a5 5 0 0 1 10 0v23V22a4 4 0 0 1 8 0v18c0 13-9 21-23 21h-7c-7 0-11-4-15-10l-6-9a5 5 0 0 1 8-6l8 9%22 stroke=%22%23f4f4f4%22 stroke-width=%226%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22/%3E%3C/svg%3E";
      function createMobileGrabController(dependencies) {
        let mobileGrabButton = null;
        const mobileGrabInput = createMobileGrabInputController();
        const mobileGrabPress = createMobileGrabPressController({
          getButton: () => mobileGrabButton,
          isPressed: () => mobileGrabInput.isMobileGrabPressed(),
          setPressed: (pressed) => setMobileGrabPressed(pressed),
          shouldShow: () => shouldShowMobileGrabButton()
        });
        function isMobileGameMode() {
          return isMobileGameModeContext();
        }
        function isMobileQolboxMenuContext() {
          return isMobileQolboxMenuContextValue();
        }
        function setMobileGrabPressed(pressed) {
          mobileGrabInput.setMobileGrabPressed(pressed);
        }
        function hideMobileGrabButton() {
          mobileGrabPress.resetMobileGrabPress();
          hideMobileGrabButtonElement(mobileGrabButton);
        }
        function removeMobileGrabButton() {
          hideMobileGrabButton();
          mobileGrabButton = removeMobileGrabButtonElement(mobileGrabButton);
        }
        function handleMobileGrabPointerStart(event) {
          mobileGrabPress.handleMobileGrabPointerStart(event);
        }
        function ensureMobileGrabButton() {
          if (mobileGrabButton && mobileGrabButton.isConnected) {
            return mobileGrabButton;
          }
          const container = document.getElementById("relativeContainer");
          if (!container) {
            return null;
          }
          const button = createMobileGrabButtonElement(container, {
            onPointerStart: handleMobileGrabPointerStart,
            onTouchStart: mobileGrabPress.handleMobileGrabTouchStart
          });
          mobileGrabButton = button;
          mobileGrabPress.installMobileGrabReleaseHooks();
          return button;
        }
        function layoutMobileGrabButton(button) {
          positionMobileGrabButton(button, {
            fallbackBaseHeight: dependencies.fallbackBaseHeight,
            fallbackBaseWidth: dependencies.fallbackBaseWidth,
            getAbilityButtons: getMobileAbilityButtons
          });
        }
        function shouldShowMobileGrabButton() {
          return Boolean(dependencies.isEnabled() && isMobileGameMode() && areNativeMobileAbilityButtonsVisible());
        }
        function syncMobileGrabButton() {
          if (!dependencies.isEnabled() || !isMobileGameMode()) {
            removeMobileGrabButton();
            return false;
          }
          const button = ensureMobileGrabButton();
          if (!button) {
            return false;
          }
          if (!shouldShowMobileGrabButton()) {
            hideMobileGrabButton();
            return false;
          }
          layoutMobileGrabButton(button);
          button.style.display = "block";
          return true;
        }
        function installMobileGrabControlHooks() {
          return installNativeMobileControlHooks({
            onInputStateObserved(inputState) {
              mobileGrabInput.observeMobileGrabInputState(inputState);
            },
            afterInputStateSet(inputState) {
              mobileGrabInput.restoreMobileGrabPressedOnInputState(inputState);
            },
            onControlsShown() {
              syncMobileGrabButton();
            },
            onControlsHidden() {
              hideMobileGrabButton();
            }
          });
        }
        function patchMobileGrabButton() {
          if (!dependencies.isEnabled()) {
            removeMobileGrabButton();
            return false;
          }
          installMobileGrabControlHooks();
          return syncMobileGrabButton();
        }
        return {
          handleMobileGrabPointerStart,
          hideMobileGrabButton,
          isMobileGameMode,
          isMobileQolboxMenuContext,
          layoutMobileGrabButton,
          patchMobileGrabButton,
          removeMobileGrabButton,
          setMobileGrabPressed,
          shouldShowMobileGrabButton,
          syncMobileGrabButton
        };
      }

      // src/features/mobile-qolbox-menu-entry.ts
      function createMobileQolboxMenuEntryController({
        findChangeControlsItem: findChangeControlsItem2,
        getSettingsContainer,
        isMobileQolboxMenuContext,
        openMenu
      }) {
        function removeMobileQolboxHamburgerEntry() {
          for (const item of document.querySelectorAll('.item[data-qolbox-mobile-menu="true"]')) {
            item.remove();
          }
        }
        function patchMobileQolboxHamburgerEntry() {
          const container = getSettingsContainer();
          if (!container) {
            return false;
          }
          if (!isMobileQolboxMenuContext()) {
            removeMobileQolboxHamburgerEntry();
            return false;
          }
          let item = container.querySelector('.item[data-qolbox-mobile-menu="true"]');
          if (!item) {
            item = document.createElement("div");
            item.className = "item";
            item.dataset.qolboxMobileMenu = "true";
            item.addEventListener(
              "click",
              (event) => {
                event.preventDefault();
                event.stopImmediatePropagation();
                openMenu();
              },
              true
            );
          }
          const beforeItem = findChangeControlsItem2(container);
          if (beforeItem && beforeItem !== item) {
            container.insertBefore(item, beforeItem);
          } else if (item.parentElement !== container) {
            container.appendChild(item);
          }
          item.textContent = "QOLBox";
          return true;
        }
        return { patchMobileQolboxHamburgerEntry, removeMobileQolboxHamburgerEntry };
      }

      // src/features/mobile-feature-bundle.ts
      function createMobileFeatureBundle(options) {
        const mobileGrabController = createMobileGrabController({
          fallbackBaseHeight: FALLBACK_BASE_HEIGHT,
          fallbackBaseWidth: FALLBACK_BASE_WIDTH,
          isEnabled: options.isMobileGrabEnabled
        });
        const { patchMobileQolboxHamburgerEntry } = createMobileQolboxMenuEntryController({
          findChangeControlsItem,
          getSettingsContainer: findSettingsContainer,
          isMobileQolboxMenuContext: mobileGrabController.isMobileQolboxMenuContext,
          openMenu: options.openMenu
        });
        return {
          ...mobileGrabController,
          patchMobileQolboxHamburgerEntry
        };
      }

      // src/features/popup-keyboard-controls.ts
      var NATIVE_POPUP_SELECTOR = [
        ".mouseBlockContainer > :not(.behindBlocker)",
        ".createWindowContainer .createWindow",
        ".passwordWindowContainer .passwordWindow",
        ".connectingWindowContainer .connectingWindow",
        ".autoLoginWindowContainer .autoLoginWindow",
        ".mapListContainer .enterNameWindow",
        ".oneButtonWindow",
        ".twoButtonWindow",
        ".updateNews",
        ".settingsWindow",
        ".recordsWindow",
        ".cosmeticWindow",
        ".rightClickMenu"
      ].join(", ");
      function isVisibleElement(element) {
        if (!(element instanceof HTMLElement)) {
          return false;
        }
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity || 1) !== 0 && rect.width > 0 && rect.height > 0;
      }
      function getVisibleNativePopup() {
        const popups = Array.from(document.querySelectorAll(NATIVE_POPUP_SELECTOR)).filter(isVisibleElement).filter((popup) => !popup.closest(".qolboxMenuOverlay"));
        return popups[popups.length - 1] || null;
      }
      function isDisabledAction(element) {
        return element.classList.contains("disabled") || element.hasAttribute("disabled") || element.getAttribute("aria-disabled") === "true" || window.getComputedStyle(element).pointerEvents === "none";
      }
      function findEnabledAction(popup, selectors) {
        for (const selector of selectors) {
          const action = popup.querySelector(selector);
          if (action && isVisibleElement(action) && !isDisabledAction(action)) {
            return action;
          }
        }
        return null;
      }
      function isNativeKeyBindingActive(popup) {
        return popup.matches(".settingsWindow") && Array.from(popup.querySelectorAll(".clickable")).some((element) => element.textContent?.trim() === "...");
      }
      function isMultilineEditor(target) {
        return target instanceof HTMLTextAreaElement || target instanceof HTMLElement && target.isContentEditable;
      }
      function dismissRightClickMenu(popup) {
        if (!popup.matches(".rightClickMenu")) {
          return false;
        }
        popup.remove();
        return true;
      }
      function getEscapeAction(popup) {
        return findEnabledAction(popup, [
          ".crossButton",
          ".cancelButton",
          ".backButton",
          ".oneButtonWindow .button",
          ".button"
        ]);
      }
      function getEnterAction(popup) {
        const activeElement = document.activeElement;
        if (activeElement instanceof HTMLElement && popup.contains(activeElement) && activeElement.matches('button, [role="button"], .button, .bottomButton, .item') && !isDisabledAction(activeElement)) {
          return activeElement;
        }
        const primaryAction = findEnabledAction(popup, [
          ".okButton",
          ".joinButton",
          ".createButton",
          ".saveButton",
          ".playButton",
          ".oneButtonWindow .button",
          ".button:not(.cancelButton):not(.leftButton):not(.rightButton)"
        ]);
        if (primaryAction) {
          return primaryAction;
        }
        return popup.matches(".updateNews") ? findEnabledAction(popup, [".crossButton"]) : null;
      }
      function getArrowAction(popup, direction) {
        const hasPageNavigation = popup.matches(".updateNews") || Boolean(popup.querySelector(".dateLabel"));
        if (!hasPageNavigation) {
          return null;
        }
        return findEnabledAction(popup, [direction === "left" ? ".leftButton" : ".rightButton"]);
      }
      function createPopupKeyboardController() {
        let hooksInstalled = false;
        function handlePopupKeyboard(event) {
          if (event.defaultPrevented || event.repeat || event.isComposing || event.altKey || event.ctrlKey || event.metaKey || document.querySelector(".qolboxMenuOverlay")) {
            return;
          }
          const popup = getVisibleNativePopup();
          if (!popup || isNativeKeyBindingActive(popup)) {
            return;
          }
          let handled = false;
          if (isEscapeKey(event)) {
            handled = dismissRightClickMenu(popup);
            const action = handled ? null : getEscapeAction(popup);
            if (action) {
              action.click();
              handled = true;
            }
          } else if (isEnterKey(event) && !isMultilineEditor(event.target)) {
            const action = getEnterAction(popup);
            if (action) {
              action.click();
              handled = true;
            }
          } else if (isArrowLeftKey(event) || isArrowRightKey(event)) {
            const action = getArrowAction(popup, isArrowLeftKey(event) ? "left" : "right");
            if (action) {
              action.click();
              handled = true;
            }
          }
          if (!handled) {
            return;
          }
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
        }
        function installPopupKeyboardHooks() {
          if (hooksInstalled) {
            return;
          }
          hooksInstalled = true;
          window.addEventListener("keydown", handlePopupKeyboard, true);
        }
        return {
          handlePopupKeyboard,
          installPopupKeyboardHooks
        };
      }

      // src/settings/onboarding-storage.ts
      var ONBOARDING_COMPLETE_KEY = "vm.hitbox.qolboxOnboardingComplete";
      function loadOnboardingComplete() {
        try {
          return localStorage.getItem(ONBOARDING_COMPLETE_KEY) === "true";
        } catch {
          return false;
        }
      }
      function saveOnboardingComplete() {
        try {
          localStorage.setItem(ONBOARDING_COMPLETE_KEY, "true");
        } catch {
        }
      }

      // src/config/qolbox-version.ts
      var QOLBOX_VERSION = "2.1.4";
      var QOLBOX_VERSION_LABEL = `v${QOLBOX_VERSION}`;
      var QOLBOX_GREASYFORK_URL = "https://greasyfork.org/en/scripts/568667-qolbox";
      var QOLBOX_GITHUB_URL = "https://github.com/AggressiveCombo/QOLBox";

      // src/config/qolbox-release-notes.ts
      var GREASYFORK_HISTORY_URL = "https://greasyfork.org/en/scripts/568667-qolbox/versions?show_all_versions=1";
      var GITHUB_RELEASES_URL = "https://api.github.com/repos/AggressiveCombo/QOLBox/releases?per_page=100";
      var RELEASE_HISTORY_CACHE_KEY = "vm.hitbox.qolboxReleaseHistory.v2";
      var RELEASE_HISTORY_CACHE_TTL_MS = 12 * 60 * 60 * 1e3;
      var RELEASE_HISTORY_FETCH_TIMEOUT_MS = 7e3;
      var RELEASE_HISTORY_BRIDGE_REQUEST_SOURCE = "qolbox-release-history";
      var RELEASE_HISTORY_BRIDGE_RESPONSE_SOURCE = "qolbox-release-history-bridge";
      var RELEASE_HISTORY_BRIDGE_REQUEST_TYPE = "fetch";
      var RELEASE_HISTORY_BRIDGE_RESPONSE_TYPE = "fetch-result";
      var LOCAL_CURRENT_RELEASE_FALLBACK_NOTES = [
        "No public update notes were found for this version."
      ];
      var GREASYFORK_EMPTY_HISTORY_NOTES = [
        "No public update notes were posted for this version."
      ];
      var INITIAL_RELEASE_NOTES = [
        "Initial release.",
        "Persisted Hitbox game and jukebox volume, with wheel controls and jukebox mute."
      ];
      var LOCAL_CURRENT_RELEASE_FALLBACK = [
        {
          version: QOLBOX_VERSION,
          source: "local-fallback",
          notes: LOCAL_CURRENT_RELEASE_FALLBACK_NOTES
        }
      ];
      function isRecord5(value) {
        return typeof value === "object" && value !== null;
      }
      function normalizeVersionKey(version) {
        return String(version || "").trim().replace(/^v/i, "").toLowerCase();
      }
      function parseVersionPoint(version) {
        const normalized = normalizeVersionKey(version);
        if (!normalized) {
          return null;
        }
        const [main, prerelease = ""] = normalized.split("-", 2);
        const rawParts = main.split(".");
        const parts = [];
        let wildcardIndex = null;
        for (let index = 0; index < 3; index += 1) {
          const rawPart = rawParts[index] ?? "0";
          if (/^(x|\*)$/i.test(rawPart)) {
            if (wildcardIndex === null) {
              wildcardIndex = index;
            }
            parts.push(0);
            continue;
          }
          if (!/^\d+$/.test(rawPart)) {
            return null;
          }
          parts.push(Number(rawPart));
        }
        return {
          parts,
          prereleaseWeight: prerelease ? -1 : 0,
          wildcardIndex
        };
      }
      function compareVersionPoints(left, right) {
        for (let index = 0; index < 3; index += 1) {
          const delta = left.parts[index] - right.parts[index];
          if (delta) {
            return delta;
          }
        }
        return left.prereleaseWeight - right.prereleaseWeight;
      }
      function getWildcardUpperBound(point) {
        if (point.wildcardIndex === null) {
          return point;
        }
        const parts = [...point.parts];
        for (let index = point.wildcardIndex; index < 3; index += 1) {
          parts[index] = Number.MAX_SAFE_INTEGER;
        }
        return {
          parts,
          prereleaseWeight: 0,
          wildcardIndex: null
        };
      }
      function isVersionInUpgradeRange(version, previousVersion, currentVersion) {
        const versionPoint = parseVersionPoint(version);
        const currentPoint = parseVersionPoint(currentVersion);
        if (!versionPoint) {
          return false;
        }
        if (currentPoint && compareVersionPoints(versionPoint, currentPoint) > 0) {
          return false;
        }
        if (!previousVersion) {
          return true;
        }
        const previousPoint = parseVersionPoint(previousVersion);
        if (!previousPoint) {
          return true;
        }
        const previousUpperBound = getWildcardUpperBound(previousPoint);
        return compareVersionPoints(versionPoint, previousUpperBound) > 0;
      }
      function compareReleaseVersionsNewestFirst(left, right) {
        const leftPoint = parseVersionPoint(left.version);
        const rightPoint = parseVersionPoint(right.version);
        if (leftPoint && rightPoint) {
          const versionDelta = compareVersionPoints(rightPoint, leftPoint);
          if (versionDelta) {
            return versionDelta;
          }
        }
        return getReleaseTimestamp(right) - getReleaseTimestamp(left);
      }
      function getReleaseTimestamp(entry) {
        const timestamp = entry.publishedAt ? Date.parse(entry.publishedAt) : 0;
        return Number.isFinite(timestamp) ? timestamp : 0;
      }
      function getSourcePriority(source) {
        switch (source) {
          case "github":
            return 3;
          case "greasyfork":
            return 2;
          case "local-fallback":
          default:
            return 1;
        }
      }
      function hasReleaseHistoryText(entry) {
        return !entry.notes.every((note) => GREASYFORK_EMPTY_HISTORY_NOTES.includes(note));
      }
      function shouldReplaceReleaseEntry(next, current) {
        const sourcePriorityDelta = getSourcePriority(next.source) - getSourcePriority(current.source);
        if (sourcePriorityDelta) {
          return sourcePriorityDelta > 0;
        }
        const noteQualityDelta = Number(hasReleaseHistoryText(next)) - Number(hasReleaseHistoryText(current));
        if (noteQualityDelta) {
          return noteQualityDelta > 0;
        }
        const timestampDelta = getReleaseTimestamp(next) - getReleaseTimestamp(current);
        if (timestampDelta) {
          return timestampDelta > 0;
        }
        return false;
      }
      function dedupeLatestReleaseEntries(entries) {
        const byVersion = /* @__PURE__ */ new Map();
        for (const entry of entries) {
          const versionKey = normalizeVersionKey(entry.version);
          if (!versionKey || !entry.notes.length) {
            continue;
          }
          const current = byVersion.get(versionKey);
          if (!current || shouldReplaceReleaseEntry(entry, current)) {
            byVersion.set(versionKey, entry);
          }
        }
        return Array.from(byVersion.values()).sort(compareReleaseVersionsNewestFirst);
      }
      function cleanReleaseText(text) {
        return text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/[`*_>#]+/g, "").replace(/\s+/g, " ").trim();
      }
      function extractMarkdownNotes(markdown) {
        if (typeof markdown !== "string") {
          return [];
        }
        const notes = [];
        for (const rawLine of markdown.split(/\r?\n/)) {
          const line = rawLine.trim();
          if (!line || /^#{1,6}\s+/.test(line)) {
            continue;
          }
          const bulletMatch = line.match(/^[-*+]\s+(.+)$/) || line.match(/^\d+[.)]\s+(.+)$/);
          if (bulletMatch) {
            const note = cleanReleaseText(bulletMatch[1]);
            if (note) {
              notes.push(note);
            }
          }
        }
        if (notes.length) {
          return notes;
        }
        const fallback = markdown.split(/\r?\n/).map(cleanReleaseText).find((line) => line && !/^#{1,6}\s+/.test(line));
        return fallback ? [fallback] : [];
      }
      function parseGitHubReleaseEntries(rawValue) {
        if (!Array.isArray(rawValue)) {
          return [];
        }
        return rawValue.filter((record) => isRecord5(record)).filter((record) => record.draft !== true).map((record) => {
          const version = normalizeVersionKey(record.tag_name);
          const notes = extractMarkdownNotes(record.body);
          return {
            version,
            source: "github",
            publishedAt: typeof record.published_at === "string" ? record.published_at : void 0,
            url: typeof record.html_url === "string" ? record.html_url : void 0,
            notes: notes.length ? notes : [cleanReleaseText(String(record.name || `QOLBox ${version}`))]
          };
        }).filter((entry) => entry.version && entry.notes.length);
      }
      async function fetchTextWithPageFetch(url, headers) {
        const controller = new AbortController();
        const timer = window.setTimeout(() => controller.abort(), RELEASE_HISTORY_FETCH_TIMEOUT_MS);
        try {
          const response = await fetch(url, {
            headers: {
              Accept: "application/json",
              ...headers
            },
            signal: controller.signal
          });
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
          return await response.text();
        } finally {
          window.clearTimeout(timer);
        }
      }
      function isReleaseHistoryBridgeResponse(value, id) {
        return isRecord5(value) && value.source === RELEASE_HISTORY_BRIDGE_RESPONSE_SOURCE && value.type === RELEASE_HISTORY_BRIDGE_RESPONSE_TYPE && value.id === id;
      }
      function makeBridgeRequestId() {
        return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
      }
      function fetchTextWithUserscriptBridge(url, headers) {
        if (!window.__qolboxReleaseHistoryBridgeReady) {
          return Promise.reject(new Error("Release-history bridge is unavailable."));
        }
        return new Promise((resolve, reject) => {
          const id = makeBridgeRequestId();
          const timer = window.setTimeout(() => {
            cleanup();
            reject(new Error("Release-history bridge timed out."));
          }, RELEASE_HISTORY_FETCH_TIMEOUT_MS);
          const cleanup = () => {
            window.clearTimeout(timer);
            window.removeEventListener("message", handleBridgeMessage);
          };
          const handleBridgeMessage = (event) => {
            if (event.source !== window || !isReleaseHistoryBridgeResponse(event.data, id)) {
              return;
            }
            cleanup();
            if (event.data.ok === true && typeof event.data.text === "string") {
              resolve(event.data.text);
              return;
            }
            reject(new Error(typeof event.data.error === "string" ? event.data.error : "Release-history bridge failed."));
          };
          window.addEventListener("message", handleBridgeMessage);
          window.postMessage(
            {
              source: RELEASE_HISTORY_BRIDGE_REQUEST_SOURCE,
              type: RELEASE_HISTORY_BRIDGE_REQUEST_TYPE,
              id,
              url,
              headers
            },
            window.location.origin
          );
        });
      }
      async function fetchText(url, headers = {}) {
        const requestHeaders = {
          Accept: "text/html",
          ...headers
        };
        if (window.__qolboxReleaseHistoryBridgeReady) {
          try {
            return await fetchTextWithUserscriptBridge(url, requestHeaders);
          } catch {
            return fetchTextWithPageFetch(url, requestHeaders);
          }
        }
        try {
          return await fetchTextWithPageFetch(url, requestHeaders);
        } catch {
          return fetchTextWithUserscriptBridge(url, requestHeaders);
        }
      }
      async function fetchJson(url, headers = {}) {
        return JSON.parse(await fetchText(url, {
          Accept: "application/json",
          ...headers
        }));
      }
      async function fetchGitHubReleaseEntries() {
        return parseGitHubReleaseEntries(await fetchJson(GITHUB_RELEASES_URL));
      }
      function getGreasyForkHistoryNotes(version, changelogElement) {
        if (!changelogElement) {
          return version === "1.0.0" ? INITIAL_RELEASE_NOTES : GREASYFORK_EMPTY_HISTORY_NOTES;
        }
        const notes = Array.from(changelogElement.querySelectorAll("li, p")).map((element) => cleanReleaseText(element.textContent || "")).filter(Boolean);
        return notes.length ? notes : GREASYFORK_EMPTY_HISTORY_NOTES;
      }
      function parseGreasyForkHistoryEntries(html) {
        const document2 = new DOMParser().parseFromString(html, "text/html");
        return Array.from(document2.querySelectorAll(".history_versions > li")).map((item) => {
          const versionLink = item.querySelector(".version-number a");
          const version = normalizeVersionKey(versionLink?.textContent);
          if (!version) {
            return null;
          }
          const href = versionLink?.getAttribute("href") || "";
          return {
            version,
            source: "greasyfork",
            publishedAt: item.querySelector("relative-time")?.getAttribute("datetime") || void 0,
            url: href ? new URL(href, GREASYFORK_HISTORY_URL).href : void 0,
            notes: getGreasyForkHistoryNotes(version, item.querySelector(".version-changelog"))
          };
        }).filter((entry) => Boolean(entry));
      }
      async function fetchGreasyForkReleaseEntries() {
        return parseGreasyForkHistoryEntries(await fetchText(GREASYFORK_HISTORY_URL));
      }
      function safeGetLocalStorage(key) {
        try {
          return localStorage.getItem(key);
        } catch {
          return null;
        }
      }
      function safeSetLocalStorage(key, value) {
        try {
          localStorage.setItem(key, value);
        } catch {
        }
      }
      function parseCachedReleaseHistory(rawValue) {
        if (!rawValue) {
          return null;
        }
        try {
          const parsed = JSON.parse(rawValue);
          if (!isRecord5(parsed) || typeof parsed.fetchedAt !== "number" || !Array.isArray(parsed.entries)) {
            return null;
          }
          const entries = parsed.entries.filter((entry) => isRecord5(entry) && typeof entry.version === "string" && Array.isArray(entry.notes)).map((entry) => ({
            version: entry.version,
            source: entry.source === "github" || entry.source === "greasyfork" || entry.source === "local-fallback" ? entry.source : "local-fallback",
            publishedAt: typeof entry.publishedAt === "string" ? entry.publishedAt : void 0,
            url: typeof entry.url === "string" ? entry.url : void 0,
            notes: entry.notes.map((note) => String(note)).filter(Boolean)
          }));
          return { fetchedAt: parsed.fetchedAt, entries };
        } catch {
          return null;
        }
      }
      function getCachedReleaseHistoryEntries(allowStale = false) {
        const cached = parseCachedReleaseHistory(safeGetLocalStorage(RELEASE_HISTORY_CACHE_KEY));
        if (!cached) {
          return null;
        }
        if (!allowStale && Date.now() - cached.fetchedAt > RELEASE_HISTORY_CACHE_TTL_MS) {
          return null;
        }
        return dedupeLatestReleaseEntries([...LOCAL_CURRENT_RELEASE_FALLBACK, ...cached.entries]);
      }
      function saveReleaseHistoryCache(entries) {
        safeSetLocalStorage(RELEASE_HISTORY_CACHE_KEY, JSON.stringify({
          fetchedAt: Date.now(),
          entries
        }));
      }
      async function fetchExternalReleaseHistoryEntries() {
        const [githubResult, greasyForkResult] = await Promise.allSettled([
          fetchGitHubReleaseEntries(),
          fetchGreasyForkReleaseEntries()
        ]);
        const externalEntries = [
          ...githubResult.status === "fulfilled" ? githubResult.value : [],
          ...greasyForkResult.status === "fulfilled" ? greasyForkResult.value : []
        ];
        if (!externalEntries.length) {
          throw new Error("No public release history entries loaded.");
        }
        const entries = dedupeLatestReleaseEntries([...LOCAL_CURRENT_RELEASE_FALLBACK, ...externalEntries]);
        saveReleaseHistoryCache(entries);
        return entries;
      }
      function getReleaseNotesBetween(previousVersion, currentVersion = QOLBOX_VERSION, releaseHistory = LOCAL_CURRENT_RELEASE_FALLBACK) {
        const entries = dedupeLatestReleaseEntries([...LOCAL_CURRENT_RELEASE_FALLBACK, ...releaseHistory]);
        return entries.filter((entry) => isVersionInUpgradeRange(entry.version, null, currentVersion));
      }
      function createInitialReleaseHistoryState(previousVersion, currentVersion = QOLBOX_VERSION) {
        const cachedEntries = getCachedReleaseHistoryEntries();
        if (cachedEntries) {
          const notes2 = getReleaseNotesBetween(previousVersion, currentVersion, cachedEntries);
          return {
            status: "ready",
            notes: notes2
          };
        }
        const notes = getReleaseNotesBetween(previousVersion, currentVersion);
        return {
          status: "loading",
          notes
        };
      }
      async function loadReleaseHistoryState(previousVersion, currentVersion = QOLBOX_VERSION) {
        try {
          const entries = await fetchExternalReleaseHistoryEntries();
          const notes = getReleaseNotesBetween(previousVersion, currentVersion, entries);
          return {
            status: "ready",
            notes
          };
        } catch {
          const cachedEntries = getCachedReleaseHistoryEntries(true);
          if (cachedEntries) {
            const notes2 = getReleaseNotesBetween(previousVersion, currentVersion, cachedEntries);
            return {
              status: "fallback",
              notes: notes2
            };
          }
          const notes = getReleaseNotesBetween(previousVersion, currentVersion);
          return {
            status: "fallback",
            notes
          };
        }
      }

      // src/settings/update-notice-storage.ts
      var LAST_VERSION_KEY = "vm.hitbox.qolboxLastVersion";
      var ACK_VERSION_KEY = "vm.hitbox.qolboxAcknowledgedVersion";
      function safeGetLocalStorage2(key) {
        try {
          return localStorage.getItem(key);
        } catch {
          return null;
        }
      }
      function safeSetLocalStorage2(key, value) {
        try {
          localStorage.setItem(key, value);
        } catch {
        }
      }
      function loadPendingUpdateNotice(currentVersion = QOLBOX_VERSION, existingInstallWithoutVersion = false) {
        const previousVersion = safeGetLocalStorage2(LAST_VERSION_KEY);
        const acknowledgedVersion = safeGetLocalStorage2(ACK_VERSION_KEY);
        if (!previousVersion) {
          if (existingInstallWithoutVersion) {
            return { previousVersion: "a pre-version-tracking build", currentVersion };
          }
          safeSetLocalStorage2(LAST_VERSION_KEY, currentVersion);
          safeSetLocalStorage2(ACK_VERSION_KEY, currentVersion);
          return null;
        }
        if (previousVersion === currentVersion || acknowledgedVersion === currentVersion) {
          if (previousVersion !== currentVersion) {
            safeSetLocalStorage2(LAST_VERSION_KEY, currentVersion);
          }
          return null;
        }
        return { previousVersion, currentVersion };
      }
      function acknowledgeUpdateNotice(currentVersion = QOLBOX_VERSION) {
        safeSetLocalStorage2(LAST_VERSION_KEY, currentVersion);
        safeSetLocalStorage2(ACK_VERSION_KEY, currentVersion);
      }

      // src/features/first-boot-onboarding.ts
      function createFirstBootOnboardingScheduler(options) {
        function scheduleFirstBootOnboarding() {
          if (options.isOnboardingComplete()) {
            return;
          }
          const show = () => {
            window.setTimeout(options.showFirstBootOnboarding, 0);
          };
          if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", show, { once: true });
          } else {
            show();
          }
        }
        return {
          scheduleFirstBootOnboarding
        };
      }

      // src/features/qolbox-menu-keyboard.ts
      function isModifiedQolboxMenuShortcut(event) {
        return event.altKey || event.ctrlKey || event.metaKey || event.shiftKey;
      }
      function isQolboxMenuShortcut(event, menuKey) {
        return !isModifiedQolboxMenuShortcut(event) && (event.key === menuKey || event.code === menuKey);
      }

      // src/features/qolbox-menu-view.ts
      function findQolboxMenuPanel(menuId) {
        const menu = document.getElementById(menuId);
        return menu ? menu.querySelector(".qolboxMenuPanel") : null;
      }
      function focusFirstQolboxMenuControl(panel) {
        window.setTimeout(() => {
          const focusTarget = panel.querySelector(".qolboxMenuButton.primary, .qolboxMenuChoice.primary") || panel.querySelector(".qolboxMenuToggle.active") || panel.querySelector(".qolboxMenuButton");
          focusElementWithoutScroll(focusTarget);
        }, 0);
      }
      function renderQolboxMenuPanel(menuId, markup) {
        const panel = findQolboxMenuPanel(menuId);
        if (!panel) {
          return;
        }
        panel.innerHTML = markup;
        focusFirstQolboxMenuControl(panel);
      }
      function ensureQolboxMenuOverlay(options) {
        let menu = document.getElementById(options.menuId);
        if (menu) {
          return menu;
        }
        const host = document.body || document.documentElement;
        if (!host) {
          return null;
        }
        menu = document.createElement("div");
        menu.id = options.menuId;
        menu.className = "qolboxMenuOverlay";
        menu.setAttribute("role", "dialog");
        menu.setAttribute("aria-modal", "true");
        menu.innerHTML = '<div class="qolboxMenuPanel"></div>';
        menu.addEventListener("pointerdown", options.onPointerEvent, true);
        menu.addEventListener("mousedown", options.onPointerEvent, true);
        menu.addEventListener("mouseup", options.onPointerEvent, true);
        menu.addEventListener("wheel", options.onPointerEvent, { capture: true, passive: true });
        menu.addEventListener("click", options.onClick, true);
        menu.addEventListener("change", options.onInput, true);
        menu.addEventListener("input", options.onInput, true);
        host.appendChild(menu);
        return menu;
      }

      // src/features/qolbox-menu-controller.ts
      var FEATURE_PAGE_KEYS = [
        FEATURE_FULLSCREEN,
        FEATURE_RESERVE,
        FEATURE_CHAT,
        FEATURE_GAME_START_ALERT,
        FEATURE_EDITOR_MAP_TRANSFER,
        FEATURE_MOBILE_GRAB
      ];
      var ADVANCED_TIMING_KEYS = [
        ADVANCED_RESERVE_RETRY_INTERVAL_MS,
        ADVANCED_ALERT_DELAY_MS,
        ADVANCED_ALERT_FLASH_INTERVAL_MS,
        ADVANCED_TYPING_DURATION_MS
      ];
      function createQolboxMenuController(options) {
        let onboardingComplete = options.initialOnboardingComplete;
        let onboardingStepIndex = 0;
        let settingsDraft = null;
        let settingsErrors = {};
        let settingsPage = "features";
        let updateNoticePageIndex = 0;
        let mode = "closed";
        let hooksInstalled = false;
        function isOnboardingComplete() {
          return onboardingComplete;
        }
        function getMode() {
          return mode;
        }
        function isClosed() {
          return mode === "closed";
        }
        function renderQolboxMenu() {
          if (mode === "settings" && !settingsDraft) {
            settingsDraft = options.createSettingsDraft();
          }
          if (mode === "update") {
            updateNoticePageIndex = Math.max(
              0,
              Math.min(updateNoticePageIndex, Math.max(1, options.getUpdateNoticePageCount()) - 1)
            );
          }
          const markup = mode === "settings" ? options.getSettingsMenuMarkup(settingsDraft, settingsPage, settingsErrors) : mode === "update" ? options.getUpdateNoticeMarkup(updateNoticePageIndex) : options.getOnboardingStepMarkup(onboardingStepIndex);
          renderQolboxMenuPanel(options.menuId, markup);
        }
        function stopQolboxMenuPointerEvent(event) {
          if (mode !== "closed") {
            event.stopPropagation();
          }
        }
        function closeQolboxMenu() {
          mode = "closed";
          settingsDraft = null;
          settingsErrors = {};
          options.onMenuModeChanged();
          const menu = document.getElementById(options.menuId);
          if (menu) {
            menu.remove();
          }
        }
        function completeOnboarding() {
          onboardingComplete = true;
          closeQolboxMenu();
          options.onCompleteOnboarding();
        }
        function openQolboxMenu(nextMode = "settings") {
          options.onBeforeOpen();
          if (!ensureQolboxMenu()) {
            return;
          }
          mode = nextMode;
          if (nextMode === "onboarding") {
            settingsDraft = null;
            settingsErrors = {};
            onboardingStepIndex = 0;
          } else if (nextMode === "settings") {
            settingsDraft = options.createSettingsDraft();
            settingsErrors = {};
            settingsPage = "features";
          } else if (nextMode === "update") {
            updateNoticePageIndex = 0;
          }
          options.onMenuModeChanged();
          renderQolboxMenu();
        }
        function getAdvancedDefinition(key) {
          return ADVANCED_SETTING_DEFINITIONS.find((definition) => definition.key === key) || null;
        }
        function getDraftAdvancedValue(key) {
          const panel = document.getElementById(options.menuId);
          const input = panel ? Array.from(panel.querySelectorAll("[data-qolbox-advanced-input]")).find((element) => element.dataset.qolboxAdvancedInput === key) : null;
          return input ? input.value : settingsDraft?.advanced[key];
        }
        function updateDraftAdvancedValue(key, value) {
          const definition = getAdvancedDefinition(key);
          if (!definition || !settingsDraft) {
            return;
          }
          settingsDraft.advanced[definition.key] = value;
          if (settingsErrors[definition.key]) {
            delete settingsErrors[definition.key];
          }
        }
        function validateAdvancedValue(definition, value) {
          if (definition.kind === "number") {
            const numericValue = Number(value);
            if (!Number.isFinite(numericValue)) {
              return "Enter a number.";
            }
            if (numericValue < definition.min || numericValue > definition.max) {
              return `Use ${definition.min}-${definition.max}${definition.unit ? ` ${definition.unit}` : ""}.`;
            }
            return null;
          }
          return value === true || value === false || value === "true" || value === "false" ? null : "Choose Enabled or Off.";
        }
        function getErrorPage(key) {
          if (key === ADVANCED_COMMAND_ALIASES || key === ADVANCED_BLACKLIST_ENFORCEMENT) {
            return "commands";
          }
          return "advanced";
        }
        function validateSettingsDraft() {
          if (!settingsDraft) {
            return null;
          }
          const errors = {};
          const sanitized = {};
          for (const definition of ADVANCED_SETTING_DEFINITIONS) {
            const value = getDraftAdvancedValue(definition.key);
            settingsDraft.advanced[definition.key] = value;
            const error = validateAdvancedValue(definition, value);
            if (error) {
              errors[definition.key] = error;
            } else {
              sanitized[definition.key] = sanitizeAdvancedSetting(definition, value);
            }
          }
          settingsErrors = errors;
          const firstError = ADVANCED_SETTING_DEFINITIONS.find((definition) => errors[definition.key]);
          if (firstError) {
            settingsPage = getErrorPage(firstError.key);
            return null;
          }
          return sanitized;
        }
        function resetFeatureDraft(keys) {
          if (!settingsDraft) {
            return;
          }
          const defaults = getDefaultFeatureSettings();
          for (const key of keys) {
            settingsDraft.features[key] = defaults[key];
          }
        }
        function resetAdvancedDraft(keys) {
          if (!settingsDraft) {
            return;
          }
          const defaults = getDefaultAdvancedSettings();
          for (const key of keys) {
            settingsDraft.advanced[key] = defaults[key];
            delete settingsErrors[key];
          }
        }
        function resetSettingsPageDraft() {
          switch (settingsPage) {
            case "commands":
              resetFeatureDraft([FEATURE_LOBBY_COMMANDS]);
              resetAdvancedDraft([ADVANCED_COMMAND_ALIASES, ADVANCED_BLACKLIST_ENFORCEMENT]);
              break;
            case "audio":
              resetFeatureDraft([FEATURE_AUDIO]);
              break;
            case "advanced":
              resetAdvancedDraft(ADVANCED_TIMING_KEYS);
              break;
            case "features":
              resetFeatureDraft(FEATURE_PAGE_KEYS);
              break;
            case "about":
            default:
              break;
          }
          renderQolboxMenu();
        }
        function saveSettingsDraft() {
          const sanitized = validateSettingsDraft();
          if (!settingsDraft || !sanitized) {
            renderQolboxMenu();
            return;
          }
          const featureDraft = { ...settingsDraft.features };
          options.onCommitSettingsDraft(featureDraft, sanitized);
          closeQolboxMenu();
        }
        function handleQolboxMenuClick(event) {
          if (mode !== "closed") {
            event.stopPropagation();
          }
          const actionElement = event.target instanceof Element ? event.target.closest("[data-qolbox-action]") : null;
          if (!actionElement) {
            return;
          }
          const action = actionElement.dataset.qolboxAction;
          event.preventDefault();
          event.stopImmediatePropagation();
          switch (action) {
            case "set-feature":
              options.onSetFeatureEnabled(actionElement.dataset.feature, actionElement.dataset.enabled === "true");
              break;
            case "draft-feature":
              if (settingsDraft && isKnownFeature(actionElement.dataset.feature || "")) {
                settingsDraft.features[actionElement.dataset.feature] = actionElement.dataset.enabled === "true";
                renderQolboxMenu();
              }
              break;
            case "draft-advanced":
              updateDraftAdvancedValue(actionElement.dataset.advanced, actionElement.dataset.value);
              renderQolboxMenu();
              break;
            case "settings-page":
              if (isSettingsPage(actionElement.dataset.page)) {
                settingsPage = actionElement.dataset.page;
                renderQolboxMenu();
              }
              break;
            case "reset-page":
              resetSettingsPageDraft();
              break;
            case "save-settings":
              saveSettingsDraft();
              break;
            case "cancel-settings":
              closeQolboxMenu();
              break;
            case "choose-express":
              options.onChooseExpressSetup();
              onboardingStepIndex = options.getOnboardingStepCount() - 1;
              renderQolboxMenu();
              break;
            case "choose-custom":
              onboardingStepIndex = Math.min(1, options.getOnboardingStepCount() - 1);
              renderQolboxMenu();
              break;
            case "next":
              onboardingStepIndex = Math.min(onboardingStepIndex + 1, options.getOnboardingStepCount() - 1);
              renderQolboxMenu();
              break;
            case "back":
              onboardingStepIndex = Math.max(0, onboardingStepIndex - 1);
              renderQolboxMenu();
              break;
            case "skip-onboarding":
            case "finish-onboarding":
              completeOnboarding();
              break;
            case "acknowledge-update":
              options.onAcknowledgeUpdateNotice();
              closeQolboxMenu();
              break;
            case "update-newer":
              updateNoticePageIndex = Math.max(0, updateNoticePageIndex - 1);
              renderQolboxMenu();
              break;
            case "update-older":
              updateNoticePageIndex = Math.min(
                Math.max(1, options.getUpdateNoticePageCount()) - 1,
                updateNoticePageIndex + 1
              );
              renderQolboxMenu();
              break;
            case "redo-onboarding":
              openQolboxMenu("onboarding");
              break;
            default:
              break;
          }
        }
        function ensureQolboxMenu() {
          return ensureQolboxMenuOverlay({
            menuId: options.menuId,
            onClick: handleQolboxMenuClick,
            onInput: handleQolboxMenuInput,
            onPointerEvent: stopQolboxMenuPointerEvent
          });
        }
        function isSettingsPage(value) {
          return value === "features" || value === "commands" || value === "audio" || value === "advanced" || value === "about";
        }
        function handleQolboxMenuInput(event) {
          if (mode !== "settings" || !settingsDraft || !(event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement)) {
            return;
          }
          const key = event.target.dataset.qolboxAdvancedInput;
          if (!key) {
            return;
          }
          updateDraftAdvancedValue(key, event.target.value);
        }
        function handleQolboxMenuKey(event) {
          if (mode !== "closed" && isEscapeKey(event)) {
            event.preventDefault();
            event.stopImmediatePropagation();
            closeQolboxMenu();
            return;
          }
          if (mode === "update" && (isArrowLeftKey(event) || isArrowRightKey(event))) {
            const action = isArrowLeftKey(event) ? "update-older" : "update-newer";
            const actionElement = document.querySelector(
              `#${options.menuId} [data-qolbox-action="${action}"]:not([disabled])`
            );
            if (actionElement) {
              event.preventDefault();
              event.stopImmediatePropagation();
              actionElement.click();
            }
            return;
          }
          if (mode !== "closed" && isEnterKey(event)) {
            const activeElement = document.activeElement;
            const actionElement = activeElement instanceof HTMLElement && activeElement.closest(`#${options.menuId}`) && activeElement.matches("[data-qolbox-action]:not([disabled])") ? activeElement : document.querySelector(
              `#${options.menuId} .qolboxMenuButton.primary:not([disabled]), #${options.menuId} .qolboxMenuChoice.primary:not([disabled])`
            );
            if (actionElement) {
              event.preventDefault();
              event.stopImmediatePropagation();
              actionElement.click();
            }
            return;
          }
          if (!isQolboxMenuShortcut(event, options.menuKey)) {
            return;
          }
          event.preventDefault();
          event.stopImmediatePropagation();
          if (mode === "settings") {
            closeQolboxMenu();
            return;
          }
          if (mode === "onboarding") {
            return;
          }
          openQolboxMenu(onboardingComplete ? "settings" : "onboarding");
        }
        function installQolboxMenuHooks() {
          if (hooksInstalled) {
            return;
          }
          hooksInstalled = true;
          window.addEventListener("keydown", handleQolboxMenuKey, true);
          document.addEventListener("keydown", handleQolboxMenuKey, true);
        }
        function showFirstBootOnboarding() {
          if (onboardingComplete || mode !== "closed") {
            return;
          }
          openQolboxMenu("onboarding");
        }
        function showUpdateNotice() {
          if (!onboardingComplete || mode !== "closed") {
            return;
          }
          openQolboxMenu("update");
        }
        return {
          closeQolboxMenu,
          getMode,
          installQolboxMenuHooks,
          isClosed,
          isOnboardingComplete,
          openQolboxMenu,
          renderQolboxMenu,
          showFirstBootOnboarding,
          showUpdateNotice
        };
      }

      // src/features/qolbox-menu-markup.ts
      var SETTINGS_PAGES = [
        { key: "features", title: "Features" },
        { key: "commands", title: "Commands" },
        { key: "audio", title: "Audio" },
        { key: "advanced", title: "Advanced" },
        { key: "about", title: "About" }
      ];
      var SETTINGS_PAGE_TITLES = {
        features: "Feature Settings",
        commands: "Command Settings",
        audio: "Audio Settings",
        advanced: "Advanced Settings",
        about: "About QOLBox"
      };
      var FEATURE_PAGE_KEYS2 = [
        FEATURE_FULLSCREEN,
        FEATURE_RESERVE,
        FEATURE_CHAT,
        FEATURE_GAME_START_ALERT,
        FEATURE_EDITOR_MAP_TRANSFER,
        FEATURE_MOBILE_GRAB
      ];
      var ADVANCED_TIMING_KEYS2 = [
        ADVANCED_RESERVE_RETRY_INTERVAL_MS,
        ADVANCED_ALERT_DELAY_MS,
        ADVANCED_ALERT_FLASH_INTERVAL_MS,
        ADVANCED_TYPING_DURATION_MS
      ];
      var GREASYFORK_ICON_DATA_URI = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABmJLR0QA/wD/AP+gvaeTAAAACXBIWXMAAAsTAAALEwEAmpwYAAAAB3RJTUUH3ggEBCQHM3fXsAAAAVdJREFUOMudkz2qwkAUhc/goBaGJBgUtBCZyj0ILkpwAW7Bws4yO3AHLiCtEFD8KVREkoiFxZzX5A2KGfN4F04zMN+ce+5c4LMUgDmANYBnrnV+plBSi+FwyHq9TgA2LQpvCiEiABwMBtzv95RSfoNEHy8DYBzHrNVqVEr9BWKcqNFoxF6vx3a7zc1mYyC73a4MogBg7vs+z+czO50OW60Wt9stK5UKp9Mpj8cjq9WqDTBHnjAdxzGQZrPJw+HA31oulzbAWgLoA0CWZVBKIY5jzGYzdLtdE9DlcrFNrY98zobqOA6TJKHW2jg4nU5sNBpFDp6mhVe5rsvVasUwDHm9Xqm15u12o+/7Hy0gD8KatOd5vN/v1FozTVN6nkchxFuI6hsAAIMg4OPxMJCXdtTbR7JJCMEgCJhlGUlyPB4XfumozInrupxMJpRSRtZlKoNYl+m/6/wDuWAjtPfsQuwAAAAASUVORK5CYII=";
      function getAdvancedSettingDefinition2(key) {
        return ADVANCED_SETTING_DEFINITIONS.find((definition) => definition.key === key);
      }
      function getFeatureDefinition(featureDefinitions, featureKey) {
        return featureDefinitions.find((feature) => feature.key === featureKey);
      }
      function createQolboxMenuMarkup(options) {
        function getOnboardingSteps() {
          const featureSteps = options.featureDefinitions.map((feature) => ({
            type: "feature",
            featureKey: feature.key,
            title: feature.title,
            text: feature.onboardingText || feature.summary
          }));
          return [
            {
              type: "intro",
              title: "Welcome to QOLBox",
              text: "QOLBox is a hitbox.io userscript with fullscreen layout, reserve spots in full lobbies, audio controls, away-tab alerts, mobile Grab, readable chat, lobby commands, and map import/export."
            },
            ...featureSteps,
            {
              type: "finish",
              title: "QOLBox is ready",
              text: `On desktop, press ${options.menuKeyLabel} to open QOLBox later. On mobile, open the site's hamburger dropdown and choose QOLBox. You can change features and advanced settings there any time.`
            }
          ];
        }
        function getToggleMarkup({
          action,
          active,
          ariaLabel,
          dataName,
          dataValue
        }) {
          return `
          <div class="qolboxMenuToggleGroup" role="group" aria-label="${escapeMenuText(ariaLabel)}">
            <button class="qolboxMenuToggle${active ? " active" : ""}" data-qolbox-action="${action}" ${dataName}="${escapeMenuText(dataValue)}" data-enabled="true" data-value="true" aria-pressed="${active ? "true" : "false"}">Enabled</button>
            <button class="qolboxMenuToggle${active ? "" : " active"}" data-qolbox-action="${action}" ${dataName}="${escapeMenuText(dataValue)}" data-enabled="false" data-value="false" aria-pressed="${active ? "false" : "true"}">Off</button>
          </div>
        `;
        }
        function getOnboardingToggleMarkup(featureKey) {
          return getToggleMarkup({
            action: "set-feature",
            active: options.isFeatureEnabled(featureKey),
            ariaLabel: `${featureKey} setting`,
            dataName: "data-feature",
            dataValue: featureKey
          });
        }
        function getDraftFeatureToggleMarkup(featureKey, draft) {
          return getToggleMarkup({
            action: "draft-feature",
            active: draft.features[featureKey] !== false,
            ariaLabel: `${featureKey} setting`,
            dataName: "data-feature",
            dataValue: featureKey
          });
        }
        function getOnboardingSummaryMarkup() {
          const enabledFeatures = options.featureDefinitions.filter((feature) => options.isFeatureEnabled(feature.key)).map((feature) => feature.shortTitle).join(", ");
          return `
          <div class="qolboxMenuInfoBox">
            <div class="qolboxMenuFeatureName">Enabled features</div>
            <div class="qolboxMenuFeatureSummary">${escapeMenuText(enabledFeatures || "No optional features enabled")}</div>
          </div>
        `;
        }
        function getOnboardingStepMarkup(onboardingStepIndex) {
          const steps = getOnboardingSteps();
          const step = steps[Math.max(0, Math.min(onboardingStepIndex, steps.length - 1))];
          const isFeatureStep = step.type === "feature";
          const isFirstStep = onboardingStepIndex === 0;
          const isFinalStep = onboardingStepIndex === steps.length - 1;
          const progress = steps.map((_, index) => `<span class="qolboxMenuDot${index === onboardingStepIndex ? " active" : ""}"></span>`).join("");
          if (isFirstStep) {
            return `
            <div class="qolboxMenuBody">
              <div class="qolboxMenuHeaderLine">
                <h1 class="qolboxMenuTitle">${escapeMenuText(step.title)}</h1>
              </div>
              <p class="qolboxMenuText">${escapeMenuText(step.text)}</p>
              <div class="qolboxMenuChoiceGrid">
                <button class="qolboxMenuChoice primary" data-qolbox-action="choose-express">
                  <span>Express</span>
                  <small>Recommended defaults. You can change everything later.</small>
                </button>
                <button class="qolboxMenuChoice" data-qolbox-action="choose-custom">
                  <span>Custom</span>
                  <small>Review each feature during setup.</small>
                </button>
              </div>
              <div class="qolboxMenuActions">
                <button class="qolboxMenuButton" data-qolbox-action="skip-onboarding">Skip</button>
              </div>
            </div>
          `;
          }
          return `
          <div class="qolboxMenuBody">
            <div class="qolboxMenuHeaderLine">
              <h1 class="qolboxMenuTitle">${escapeMenuText(step.title)}</h1>
            </div>
            <p class="qolboxMenuText">${escapeMenuText(step.text)}</p>
            ${isFeatureStep && step.featureKey ? getOnboardingToggleMarkup(step.featureKey) : getOnboardingSummaryMarkup()}
            <div class="qolboxMenuProgress" aria-hidden="true">${progress}</div>
            <div class="qolboxMenuActions">
              <button class="qolboxMenuButton" data-qolbox-action="back">Back</button>
              <button class="qolboxMenuButton primary" data-qolbox-action="${isFinalStep ? "finish-onboarding" : "next"}">${isFinalStep ? "Finish" : "Next"}</button>
            </div>
          </div>
        `;
        }
        function getSettingsTabsMarkup(activePage) {
          return `
          <div class="qolboxMenuTabs" role="tablist" aria-label="QOLBox settings sections">
            ${SETTINGS_PAGES.map((page) => `
              <button class="qolboxMenuTab${page.key === activePage ? " active" : ""}" role="tab" aria-selected="${page.key === activePage ? "true" : "false"}" data-qolbox-action="settings-page" data-page="${page.key}">${escapeMenuText(page.title)}</button>
            `).join("")}
          </div>
        `;
        }
        function getFeatureRowMarkup(featureKey, draft) {
          const feature = getFeatureDefinition(options.featureDefinitions, featureKey);
          return `
          <div class="qolboxMenuFeatureRow">
            <div>
              <div class="qolboxMenuFeatureName">${escapeMenuText(feature.title)}</div>
              <div class="qolboxMenuFeatureSummary">${escapeMenuText(feature.summary)}</div>
            </div>
            ${getDraftFeatureToggleMarkup(feature.key, draft)}
          </div>
        `;
        }
        function getAdvancedInputMarkup(definition, draft, errors) {
          const value = draft.advanced[definition.key];
          const error = errors[definition.key];
          const invalidClass = error ? " invalid" : "";
          if (definition.kind === "boolean") {
            const enabled = value === true || value === "true";
            return getToggleMarkup({
              action: "draft-advanced",
              active: enabled,
              ariaLabel: `${definition.title} setting`,
              dataName: "data-advanced",
              dataValue: definition.key
            });
          }
          return `
          <input class="qolboxMenuInput${invalidClass}" type="number" value="${escapeMenuText(String(value))}" min="${definition.min}" max="${definition.max}" step="${definition.step}" data-qolbox-advanced-input="${escapeMenuText(definition.key)}">
          ${error ? `<div class="qolboxMenuFieldError">${escapeMenuText(error)}</div>` : ""}
        `;
        }
        function getAdvancedRowMarkup(key, draft, errors) {
          const definition = getAdvancedSettingDefinition2(key);
          const rowKindClass = definition.kind === "boolean" ? " boolean" : " numeric";
          return `
          <div class="qolboxMenuFeatureRow compact${rowKindClass}">
            <div>
              <div class="qolboxMenuFeatureName">${escapeMenuText(definition.title)}</div>
              <div class="qolboxMenuFeatureSummary">${escapeMenuText(definition.description)}</div>
            </div>
            <div class="qolboxMenuFieldControl">
              ${getAdvancedInputMarkup(definition, draft, errors)}
            </div>
          </div>
        `;
        }
        function getFeaturePageMarkup(draft) {
          return `
          <div class="qolboxMenuSettingsList">
            ${FEATURE_PAGE_KEYS2.map((featureKey) => getFeatureRowMarkup(featureKey, draft)).join("")}
          </div>
          <div class="qolboxMenuActions slim">
            <button class="qolboxMenuButton" data-qolbox-action="reset-page">Reset Features</button>
          </div>
        `;
        }
        function getCommandsPageMarkup(draft, errors) {
          return `
          <div class="qolboxMenuSettingsList">
            ${getFeatureRowMarkup(FEATURE_LOBBY_COMMANDS, draft)}
            ${getAdvancedRowMarkup(ADVANCED_COMMAND_ALIASES, draft, errors)}
            ${getAdvancedRowMarkup(ADVANCED_BLACKLIST_ENFORCEMENT, draft, errors)}
          </div>
          <div class="qolboxMenuInfoBox">Special targets: /spec all|playing, /join all|spectators, and /red or /blue all|playing|spectators. Quote those words to use them as player names. Named targets for /spec, /join, /red, /blue, /host, /kick, and /ban accept exact or unique partial names. /blacklist stores exact names for host bans.</div>
          <div class="qolboxMenuActions slim">
            <button class="qolboxMenuButton" data-qolbox-action="reset-page">Reset Commands</button>
          </div>
        `;
        }
        function getAudioPageMarkup(draft) {
          return `
          <div class="qolboxMenuSettingsList">
            ${getFeatureRowMarkup(FEATURE_AUDIO, draft)}
          </div>
          <div class="qolboxMenuInfoBox">Adjust game and jukebox volume from Hitbox's hamburger menu.</div>
          <div class="qolboxMenuActions slim">
            <button class="qolboxMenuButton" data-qolbox-action="reset-page">Reset Audio</button>
          </div>
        `;
        }
        function getAdvancedPageMarkup(draft, errors) {
          return `
          <div class="qolboxMenuSettingsList">
            ${ADVANCED_TIMING_KEYS2.map((key) => getAdvancedRowMarkup(key, draft, errors)).join("")}
          </div>
          <div class="qolboxMenuActions slim">
            <button class="qolboxMenuButton" data-qolbox-action="reset-page">Reset Advanced</button>
          </div>
        `;
        }
        function getCreditsMarkup() {
          return `
          <div class="qolboxMenuAboutLinks">
            <a class="qolboxMenuCredit" href="${escapeMenuText(options.greaseForkUrl)}" target="_blank" rel="noreferrer">
              <img class="qolboxMenuCreditIcon" src="${GREASYFORK_ICON_DATA_URI}" alt="" aria-hidden="true">
              <span>GreasyFork</span>
            </a>
            <a class="qolboxMenuCredit" href="${escapeMenuText(options.githubUrl)}" target="_blank" rel="noreferrer">
              <svg class="qolboxMenuCreditSvg" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38v-1.49c-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82A7.65 7.65 0 0 1 8 3.86c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48v2.2c0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"/></svg>
              <span>GitHub</span>
            </a>
          </div>
        `;
        }
        function getAboutPageMarkup() {
          return `
          <div class="qolboxMenuInfoBox">
            <div class="qolboxMenuFeatureName">QOLBox ${escapeMenuText(options.versionLabel)}</div>
            <div class="qolboxMenuFeatureSummary">Fullscreen layout, reserve spots, audio controls, away-tab alerts, mobile Grab, readable chat, lobby commands, and map import/export for hitbox.io.</div>
          </div>
          ${getCreditsMarkup()}
        `;
        }
        function getSettingsPageMarkup(draft, page, errors) {
          switch (page) {
            case "commands":
              return getCommandsPageMarkup(draft, errors);
            case "audio":
              return getAudioPageMarkup(draft);
            case "advanced":
              return getAdvancedPageMarkup(draft, errors);
            case "about":
              return getAboutPageMarkup();
            case "features":
            default:
              return getFeaturePageMarkup(draft);
          }
        }
        function getSettingsMenuMarkup(draft, page, errors) {
          const pageTitle = SETTINGS_PAGES.find((candidate) => candidate.key === page)?.title || "Features";
          const settingsTitle = SETTINGS_PAGE_TITLES[page];
          return `
          <div class="qolboxMenuBody">
            <div class="qolboxMenuHeaderLine">
              <h1 class="qolboxMenuTitle">${escapeMenuText(settingsTitle)}</h1>
            </div>
            ${getSettingsTabsMarkup(page)}
            <div class="qolboxMenuPage" aria-label="${escapeMenuText(pageTitle)} settings">
              ${getSettingsPageMarkup(draft, page, errors)}
            </div>
            <div class="qolboxMenuActions">
              <button class="qolboxMenuButton" data-qolbox-action="redo-onboarding">Redo Setup</button>
              <button class="qolboxMenuButton" data-qolbox-action="cancel-settings">Cancel</button>
              <button class="qolboxMenuButton primary" data-qolbox-action="save-settings">OK</button>
            </div>
          </div>
        `;
        }
        function getReleaseSourceText(release) {
          switch (release.source) {
            case "github":
              return "GitHub release";
            case "greasyfork":
              return "GreasyFork history";
            case "local-fallback":
            default:
              return "";
          }
        }
        function getReleaseDateText(release) {
          if (!release.publishedAt) {
            return "";
          }
          const timestamp = Date.parse(release.publishedAt);
          return Number.isFinite(timestamp) ? ` - ${new Date(timestamp).toLocaleDateString()}` : "";
        }
        function getUpdateRangeMarkup(notice) {
          return `
          <div class="qolboxMenuUpdateRange" aria-label="Updated from ${escapeMenuText(notice.previousVersion)} to ${escapeMenuText(notice.currentVersion)}">
            <span class="qolboxMenuUpdateLabel">Updated</span>
            <span class="qolboxMenuVersionPill old">${escapeMenuText(notice.previousVersion)}</span>
            <span class="qolboxMenuVersionArrow" aria-hidden="true">&rarr;</span>
            <span class="qolboxMenuVersionPill current">${escapeMenuText(notice.currentVersion)}</span>
          </div>
        `;
        }
        function getUpdateNoticeMarkup(notice, releaseHistory, pageIndex) {
          if (releaseHistory.status === "loading") {
            return `
            <div class="qolboxMenuBody">
              <div class="qolboxMenuHeaderLine">
                <h1 class="qolboxMenuTitle">QOLBox Updated</h1>
              </div>
              ${getUpdateRangeMarkup(notice)}
              <div class="qolboxMenuLoading" role="status" aria-live="polite">
                <span class="qolboxMenuSpinner" aria-hidden="true"></span>
                <span>Loading update notes from GitHub and GreasyFork...</span>
              </div>
              <div class="qolboxMenuActions">
                <button class="qolboxMenuButton primary" data-qolbox-action="acknowledge-update">Skip</button>
              </div>
            </div>
          `;
          }
          const releaseNotes = releaseHistory.notes;
          const safePageIndex = Math.max(0, Math.min(pageIndex, Math.max(0, releaseNotes.length - 1)));
          const release = releaseNotes[safePageIndex] || null;
          const releaseSourceText = release ? `${getReleaseSourceText(release)}${getReleaseDateText(release)}`.trim() : "";
          const notes = release ? `
              <div class="qolboxMenuInfoBox">
                <div class="qolboxMenuFeatureName">${escapeMenuText(release.version)}</div>
                ${releaseSourceText ? `<div class="qolboxMenuFeatureSummary">${escapeMenuText(releaseSourceText)}</div>` : ""}
                <ul class="qolboxMenuNoteList">
                  ${release.notes.map((note) => `<li>${escapeMenuText(note)}</li>`).join("")}
                </ul>
              </div>
            ` : '<p class="qolboxMenuText">No update notes are available for this version range.</p>';
          const pageCount = Math.max(1, releaseNotes.length);
          const chronologicalPageNumber = releaseNotes.length ? pageCount - safePageIndex : 0;
          return `
          <div class="qolboxMenuBody">
            <div class="qolboxMenuHeaderLine">
              <h1 class="qolboxMenuTitle">QOLBox Updated</h1>
            </div>
            ${getUpdateRangeMarkup(notice)}
            ${notes}
            <div class="qolboxMenuHeaderLine">
              <button class="qolboxMenuButton" data-qolbox-action="update-older" ${safePageIndex >= releaseNotes.length - 1 ? "disabled" : ""}>Older</button>
              <span class="qolboxMenuFeatureSummary">Version ${chronologicalPageNumber} of ${pageCount}</span>
              <button class="qolboxMenuButton" data-qolbox-action="update-newer" ${safePageIndex <= 0 ? "disabled" : ""}>Newer</button>
            </div>
            <div class="qolboxMenuActions">
              <button class="qolboxMenuButton primary" data-qolbox-action="acknowledge-update">OK</button>
            </div>
          </div>
        `;
        }
        return {
          getOnboardingStepMarkup,
          getOnboardingSteps,
          getSettingsMenuMarkup,
          getUpdateNoticeMarkup
        };
      }

      // src/features/qolbox-menu-feature-bundle.ts
      function createQolboxMenuFeatureBundle(options) {
        const initialOnboardingComplete = loadOnboardingComplete();
        let pendingUpdateNotice = loadPendingUpdateNotice(void 0, initialOnboardingComplete);
        let updateReleaseHistory = pendingUpdateNotice ? createInitialReleaseHistoryState(pendingUpdateNotice.previousVersion, pendingUpdateNotice.currentVersion) : null;
        let updateReleaseHistoryRefreshStarted = false;
        const { getOnboardingStepMarkup, getOnboardingSteps, getSettingsMenuMarkup, getUpdateNoticeMarkup } = createQolboxMenuMarkup({
          featureDefinitions: FEATURE_DEFINITIONS,
          greaseForkUrl: QOLBOX_GREASYFORK_URL,
          githubUrl: QOLBOX_GITHUB_URL,
          isFeatureEnabled: options.isFeatureEnabled,
          menuKeyLabel: MENU_KEY_LABEL,
          versionLabel: QOLBOX_VERSION_LABEL
        });
        function createSettingsDraft() {
          const features = {};
          for (const definition of FEATURE_DEFINITIONS) {
            features[definition.key] = options.isFeatureEnabled(definition.key);
          }
          return {
            advanced: { ...options.getAdvancedSettings() },
            features
          };
        }
        const menuController = createQolboxMenuController({
          createSettingsDraft,
          getOnboardingStepMarkup,
          getOnboardingStepCount: () => getOnboardingSteps().length,
          getSettingsMenuMarkup,
          getUpdateNoticeMarkup: (pageIndex) => pendingUpdateNotice ? getUpdateNoticeMarkup(
            pendingUpdateNotice,
            updateReleaseHistory || createInitialReleaseHistoryState(
              pendingUpdateNotice.previousVersion,
              pendingUpdateNotice.currentVersion
            ),
            pageIndex
          ) : getSettingsMenuMarkup(createSettingsDraft(), "features", {}),
          getUpdateNoticePageCount: () => Math.max(1, updateReleaseHistory?.notes.length || 1),
          initialOnboardingComplete,
          menuId: QOLBOX_MENU_ID,
          menuKey: MENU_KEY,
          onAcknowledgeUpdateNotice: () => {
            acknowledgeUpdateNotice();
            pendingUpdateNotice = null;
            updateReleaseHistory = null;
          },
          onBeforeOpen: options.ensureGlobalStyle,
          onChooseExpressSetup: () => {
            options.setAllFeatureSettings(getDefaultFeatureSettings());
          },
          onCompleteOnboarding: () => {
            saveOnboardingComplete();
            options.applyFeatureRootClasses();
            options.applyPersistentFeatures();
            options.scheduleUiWork({ force: true, features: true, passes: FULLSCREEN_SETTLE_PASSES });
          },
          onCommitSettingsDraft: (features, advanced) => {
            options.setAllFeatureSettings(features);
            options.setAdvancedSettings(advanced);
          },
          onMenuModeChanged: options.applyFeatureRootClasses,
          onSetFeatureEnabled: options.setFeatureEnabled
        });
        const { scheduleFirstBootOnboarding } = createFirstBootOnboardingScheduler({
          isOnboardingComplete: menuController.isOnboardingComplete,
          showFirstBootOnboarding: menuController.showFirstBootOnboarding
        });
        function scheduleStartupQolboxNotice() {
          if (!menuController.isOnboardingComplete()) {
            scheduleFirstBootOnboarding();
            return;
          }
          if (!pendingUpdateNotice) {
            return;
          }
          refreshUpdateReleaseHistory();
          const show = () => {
            window.setTimeout(menuController.showUpdateNotice, 0);
          };
          if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", show, { once: true });
          } else {
            show();
          }
        }
        function refreshUpdateReleaseHistory() {
          if (!pendingUpdateNotice || updateReleaseHistoryRefreshStarted) {
            return;
          }
          updateReleaseHistoryRefreshStarted = true;
          loadReleaseHistoryState(pendingUpdateNotice.previousVersion, pendingUpdateNotice.currentVersion).then((nextHistory) => {
            updateReleaseHistory = nextHistory;
            if (menuController.getMode() === "update") {
              menuController.renderQolboxMenu();
            }
          }).catch(() => {
          });
        }
        return {
          ...menuController,
          getOnboardingSteps,
          scheduleFirstBootOnboarding: scheduleStartupQolboxNotice
        };
      }

      // src/features/feature-root-classes.ts
      function getFeatureRootClass(featureKey) {
        return `qolbox-feature-${featureKey}`;
      }
      function createFeatureRootClassController(options) {
        function applyFeatureRootClasses() {
          const root = document.documentElement;
          if (!root || !root.classList) {
            return;
          }
          for (const feature of options.featureDefinitions) {
            root.classList.toggle(getFeatureRootClass(feature.key), options.isFeatureActive(feature.key));
          }
          root.classList.toggle(options.menuRootClass, !options.isMenuClosed());
        }
        return {
          applyFeatureRootClasses
        };
      }

      // src/features/global-style-fullscreen.ts
      function prefixSelectorList(prefix, selectorList) {
        return selectorList.split(",").map((selector) => `${prefix} ${selector.trim()}`).join(",\n      ");
      }
      function getFullscreenGlobalStyleText(options) {
        return `
          html.qolbox-feature-fullscreen,
          html.qolbox-feature-fullscreen body {
            width: 100vw !important;
            height: 100vh !important;
            margin: 0 !important;
            overflow: hidden !important;
            background: #0a0a0a !important;
          }

          html.qolbox-feature-fullscreen #appContainer,
          html.qolbox-feature-fullscreen #relativeContainer {
            margin: 0 !important;
            max-width: none !important;
            max-height: none !important;
            border: 0 !important;
          }

          html.qolbox-feature-fullscreen #backgroundImage,
          html.qolbox-feature-fullscreen .mainMenuFancy {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            right: auto !important;
            bottom: auto !important;
            width: 100vw !important;
            height: 100vh !important;
            max-width: none !important;
            max-height: none !important;
          }

          ${prefixSelectorList("html.qolbox-feature-fullscreen", options.fullscreenRenderLayerSelector)} {
            position: absolute !important;
            margin: 0 !important;
            max-width: none !important;
            max-height: none !important;
            overflow: hidden !important;
            transform: none !important;
          }

          html.qolbox-feature-fullscreen #editorContainer {
            overflow: visible !important;
            transform-origin: top left !important;
          }

          ${prefixSelectorList("html.qolbox-feature-fullscreen", options.fullscreenRenderCanvasSelector)} {
            display: block !important;
            max-width: none !important;
            max-height: none !important;
            transform: none !important;
          }

          /* Keep game keyboard focus after chat closes without drawing a browser focus ring over the playfield. */
          ${prefixSelectorList("html.qolbox-feature-chat", options.fullscreenRenderCanvasFocusSelector)} {
            outline: 0 !important;
            outline-color: transparent !important;
            outline-style: none !important;
            outline-width: 0 !important;
          }

          html.qolbox-feature-fullscreen .scores {
            display: none !important;
          }

          html.qolbox-feature-fullscreen .spectateControls {
            bottom: 12px !important;
          }

          html.qolbox-feature-fullscreen .scores .title {
            background-color: rgb(56, 56, 56) !important;
          }

          html.qolbox-feature-fullscreen .scores .title,
          html.qolbox-feature-fullscreen .scores .entryContainer,
          html.qolbox-feature-fullscreen .scores .entryContainer .number,
          html.qolbox-feature-fullscreen .scores .entryContainer .name {
            vertical-align: middle !important;
          }
        `;
      }

      // src/features/global-style-reserve.ts
      function getReserveGlobalStyleText() {
        return `
          html.qolbox-feature-reserve body.qolbox-reserve-active .connectingWindowContainer:not(.qolboxReserveWindowContainer) {
            display: none !important;
          }

          .qolboxReserveWindowContainer {
            display: none;
            z-index: 10000;
          }

          html.qolbox-feature-reserve body.qolbox-reserve-active .qolboxReserveWindowContainer {
            display: block !important;
          }

          html.qolbox-feature-reserve .roomListContainer .bottomButton.right.qolboxReserveUnavailable {
            cursor: not-allowed !important;
            filter: grayscale(1) saturate(0.35) !important;
            opacity: 0.48 !important;
          }

          .qolboxReserveWindowContainer .qolboxReserveContent {
            align-items: center;
            bottom: 48px;
            display: flex;
            flex-direction: column;
            gap: 4px;
            justify-content: center;
            left: 16px;
            pointer-events: none;
            position: absolute;
            right: 16px;
            text-align: center;
            top: 50px;
          }

          .qolboxReserveWindowContainer .connectingWindow .spinner {
            bottom: auto !important;
            flex: 0 0 auto;
            left: auto !important;
            margin: 0 auto;
            order: 2;
            position: static !important;
            right: auto !important;
            top: auto !important;
          }

          .qolboxReserveWindowContainer .qolboxReserveStatus,
          .qolboxReserveWindowContainer .qolboxReserveCountdown,
          .qolboxReserveWindowContainer .qolboxReserveMessage {
            width: 100%;
          }

          .qolboxReserveWindowContainer .qolboxReserveStatus {
            color: rgb(205, 210, 218);
            font-size: 11px;
            line-height: 14px;
            min-height: 14px;
            order: 1;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .qolboxReserveWindowContainer .qolboxReserveCountdown {
            color: rgb(242, 242, 242);
            font-size: 13px;
            line-height: 16px;
            min-height: 16px;
            order: 3;
            white-space: nowrap;
          }

          .qolboxReserveWindowContainer .qolboxReserveMessage {
            color: rgb(242, 242, 242);
            font-size: 13px;
            line-height: 16px;
            order: 1;
            white-space: normal;
          }
    `;
      }

      // src/features/global-style-chat.ts
      function getChatGlobalStyleText() {
        return `
          html.qolbox-feature-chat .inGameChat {
            pointer-events: none;
          }

          html.qolbox-feature-chat .inGameChat.qolboxChatInteractive {
            pointer-events: auto;
          }

          html.qolbox-feature-chat .inGameChat .input {
            pointer-events: none;
          }

          html.qolbox-feature-chat .inGameChat .input:focus,
          html.qolbox-feature-chat .inGameChat .input.bgActive {
            pointer-events: auto;
          }

          html.qolbox-feature-chat .inGameChat:hover,
          html.qolbox-feature-chat .inGameChat.qolboxChatReading {
            opacity: 1 !important;
          }

          html.qolbox-feature-chat .inGameChat.qolboxChatReading {
            overflow: hidden !important;
            overscroll-behavior: contain;
          }
        `;
      }

      // src/features/global-style-menu.ts
      function getQolboxMenuGlobalStyleText() {
        return `
          .qolboxMenuOverlay {
            align-items: center;
            background: rgba(0, 0, 0, 0.72);
            box-sizing: border-box;
            display: flex;
            font-family: inherit;
            inset: 0;
            justify-content: center;
            opacity: 0;
            padding: 10px;
            pointer-events: none;
            position: fixed;
            z-index: 2147483647;
          }

          html.qolbox-menu-open .qolboxMenuOverlay {
            opacity: 1;
            pointer-events: auto;
          }

          .qolboxMenuPanel {
            background: rgba(22, 24, 28, 0.98);
            border: 2px solid rgb(69, 75, 86);
            border-radius: 4px;
            box-shadow: 0 8px 28px rgba(0, 0, 0, 0.55);
            box-sizing: border-box;
            color: #f4f4f4;
            display: flex;
            flex-direction: column;
            max-height: calc(100vh - 20px);
            max-width: min(430px, calc(100vw - 20px));
            overflow: hidden;
            width: 430px;
          }

          .qolboxMenuBody {
            box-sizing: border-box;
            display: flex;
            flex: 1 1 auto;
            flex-direction: column;
            gap: 8px;
            min-height: 0;
            overflow: auto;
            padding: 12px;
          }

          .qolboxMenuTitle {
            color: #ffffff;
            font-size: 18px;
            font-weight: 700;
            letter-spacing: 0;
            line-height: 22px;
            margin: 0;
          }

          .qolboxMenuHeaderLine {
            align-items: center;
            display: flex;
            gap: 8px;
            justify-content: space-between;
          }

          .qolboxMenuText {
            color: #d7dbe1;
            font-size: 12px;
            line-height: 16px;
            margin: 0;
          }

          .qolboxMenuUpdateRange {
            align-items: center;
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
          }

          .qolboxMenuUpdateLabel {
            color: #c4c9d1;
            font-size: 10px;
            font-weight: 700;
            line-height: 13px;
            text-transform: uppercase;
          }

          .qolboxMenuVersionPill {
            background: rgb(31, 34, 39);
            border: 1px solid rgb(72, 78, 89);
            border-radius: 3px;
            color: #f4f4f4;
            font-size: 12px;
            font-weight: 700;
            line-height: 15px;
            padding: 4px 7px;
          }

          .qolboxMenuVersionPill.current {
            border-color: rgba(245, 197, 66, 0.8);
            color: #f5c542;
          }

          .qolboxMenuVersionArrow {
            color: #c4c9d1;
            font-size: 13px;
            font-weight: 700;
            line-height: 15px;
          }

          .qolboxMenuProgress {
            align-items: center;
            display: flex;
            gap: 4px;
            margin-top: 2px;
          }

          .qolboxMenuDot {
            background: rgba(255, 255, 255, 0.25);
            border-radius: 999px;
            height: 5px;
            width: 12px;
          }

          .qolboxMenuDot.active {
            background: #f5c542;
          }

          .qolboxMenuToggleGroup {
            background: rgb(31, 34, 39);
            border: 1px solid rgb(72, 78, 89);
            border-radius: 3px;
            display: grid;
            grid-template-columns: 1fr 1fr;
            overflow: hidden;
          }

          .qolboxMenuButton,
          .qolboxMenuTab,
          .qolboxMenuToggle {
            align-items: center;
            appearance: none;
            border: 0;
            box-sizing: border-box;
            cursor: pointer;
            display: inline-flex;
            font-family: inherit;
            font-size: 12px;
            font-weight: 700;
            justify-content: center;
            letter-spacing: 0;
            line-height: 14px;
            min-height: 30px;
          }

          .qolboxMenuToggle {
            background: transparent;
            color: #cfd3da;
            padding: 0 8px;
          }

          .qolboxMenuToggle + .qolboxMenuToggle {
            border-left: 1px solid rgba(255, 255, 255, 0.14);
          }

          .qolboxMenuToggle.active {
            background: #f5c542;
            color: #111111;
          }

          .qolboxMenuActions {
            display: flex;
            gap: 6px;
            justify-content: flex-end;
            margin-top: 4px;
          }

          .qolboxMenuActions.slim {
            margin-top: 0;
          }

          .qolboxMenuButton {
            background: rgb(47, 51, 58);
            border: 1px solid rgb(92, 98, 108);
            border-radius: 3px;
            color: #f4f4f4;
            min-width: 72px;
            padding: 0 12px;
          }

          .qolboxMenuButton.primary {
            background: #f5c542;
            color: #111111;
          }

          .qolboxMenuButton:disabled {
            cursor: default;
            opacity: 0.45;
          }

          .qolboxMenuSettingsList {
            display: grid;
            gap: 6px;
          }

          .qolboxMenuTabs {
            border-bottom: 1px solid rgba(255, 255, 255, 0.12);
            display: flex;
            flex-wrap: wrap;
            gap: 4px;
            justify-content: center;
            padding-bottom: 8px;
          }

          .qolboxMenuTab {
            background: rgb(31, 34, 39);
            border: 1px solid rgb(72, 78, 89);
            border-radius: 3px;
            color: #cfd3da;
            flex: 0 1 calc((100% - 8px) / 3);
            font-size: 11px;
            line-height: 13px;
            min-width: 0;
            padding: 0 6px;
          }

          .qolboxMenuTab.active {
            background: #f5c542;
            border-color: #f5c542;
            color: #111111;
          }

          .qolboxMenuPage {
            align-content: start;
            display: grid;
            gap: 8px;
            min-height: 172px;
          }

          .qolboxMenuChoiceGrid {
            display: grid;
            gap: 6px;
            grid-template-columns: 1fr 1fr;
          }

          .qolboxMenuChoice {
            appearance: none;
            background: rgb(47, 51, 58);
            border: 1px solid rgb(92, 98, 108);
            border-radius: 3px;
            color: #f4f4f4;
            cursor: pointer;
            display: grid;
            font-family: inherit;
            gap: 3px;
            min-height: 62px;
            padding: 9px;
            text-align: left;
          }

          .qolboxMenuChoice.primary {
            border-color: #f5c542;
          }

          .qolboxMenuChoice span {
            color: #ffffff;
            font-size: 13px;
            font-weight: 700;
            line-height: 15px;
          }

          .qolboxMenuChoice small {
            color: #c4c9d1;
            font-size: 10px;
            line-height: 13px;
          }

          .qolboxMenuFeatureRow {
            align-items: center;
            border-bottom: 1px solid rgba(255, 255, 255, 0.09);
            display: grid;
            gap: 8px;
            grid-template-columns: minmax(0, 1fr) 108px;
            padding: 0 0 6px;
          }

          .qolboxMenuFeatureRow.compact {
            grid-template-columns: minmax(0, 1fr) 150px;
          }

          .qolboxMenuFeatureRow.compact.boolean {
            grid-template-columns: minmax(0, 1fr) 108px;
          }

          .qolboxMenuFeatureName {
            color: #ffffff;
            font-size: 12px;
            font-weight: 700;
            line-height: 15px;
          }

          .qolboxMenuFeatureSummary {
            color: #c4c9d1;
            font-size: 10px;
            line-height: 13px;
            margin-top: 1px;
          }

          .qolboxMenuFieldControl {
            display: grid;
            gap: 3px;
          }

          .qolboxMenuInput {
            appearance: none;
            background: rgb(31, 34, 39);
            border: 1px solid rgb(72, 78, 89);
            border-radius: 3px;
            box-sizing: border-box;
            color: #f4f4f4;
            font-family: inherit;
            font-size: 12px;
            height: 30px;
            line-height: 16px;
            min-height: 30px;
            min-width: 0;
            padding: 0 6px;
            width: 100%;
          }

          .qolboxMenuInput.invalid {
            border-color: #f05f57;
          }

          .qolboxMenuFieldError {
            color: #ffaaa4;
            font-size: 10px;
            line-height: 12px;
          }

          .qolboxMenuWarning,
          .qolboxMenuInfoBox {
            background: rgba(255, 255, 255, 0.06);
            border: 1px solid rgba(255, 255, 255, 0.12);
            border-radius: 3px;
            color: #d7dbe1;
            font-size: 10px;
            line-height: 13px;
            padding: 6px;
          }

          .qolboxMenuWarning {
            border-color: rgba(245, 197, 66, 0.45);
          }

          .qolboxMenuNoteList {
            color: #d7dbe1;
            font-size: 11px;
            line-height: 15px;
            margin: 5px 0 0;
            padding-left: 16px;
          }

          .qolboxMenuLoading {
            align-items: center;
            background: rgba(255, 255, 255, 0.06);
            border: 1px solid rgba(255, 255, 255, 0.12);
            border-radius: 3px;
            color: #d7dbe1;
            display: flex;
            font-size: 11px;
            gap: 9px;
            line-height: 15px;
            min-height: 54px;
            padding: 8px;
          }

          .qolboxMenuSpinner {
            animation: qolboxMenuSpin 0.8s linear infinite;
            border: 2px solid rgba(255, 255, 255, 0.28);
            border-radius: 50%;
            border-top-color: #f5c542;
            box-sizing: border-box;
            flex: 0 0 auto;
            height: 18px;
            width: 18px;
          }

          @keyframes qolboxMenuSpin {
            to {
              transform: rotate(360deg);
            }
          }

          .qolboxMenuAboutLinks {
            display: grid;
            gap: 6px;
          }

          .qolboxMenuCredit {
            align-items: center;
            background: rgb(31, 34, 39);
            border: 1px solid rgb(72, 78, 89);
            border-radius: 3px;
            color: #e6e9ee;
            display: flex;
            gap: 8px;
            font-size: 10px;
            font-weight: 700;
            line-height: 14px;
            min-height: 30px;
            padding: 0 8px;
            text-decoration: none;
          }

          .qolboxMenuCreditIcon {
            background: rgba(255, 255, 255, 0.12);
            border-radius: 2px;
            display: block;
            flex: 0 0 auto;
            height: 18px;
            object-fit: contain;
            padding: 1px;
            width: 18px;
          }

          .qolboxMenuCreditSvg {
            fill: currentColor;
            height: 16px;
            width: 16px;
          }

          @media (max-height: 620px) {
            .qolboxMenuBody {
              gap: 6px;
              padding: 9px;
            }
          }

          @media (max-width: 420px) {
            .qolboxMenuTab {
              flex-basis: calc((100% - 4px) / 2);
            }

            .qolboxMenuChoiceGrid,
            .qolboxMenuFeatureRow,
            .qolboxMenuFeatureRow.compact {
              grid-template-columns: 1fr;
            }
          }

          @media (prefers-reduced-motion: reduce) {
            .qolboxMenuOverlay,
            .qolboxMenuSpinner {
              transition: none !important;
            }

            .qolboxMenuSpinner {
              animation-duration: 1.6s;
            }
          }
        `;
      }

      // src/features/global-style-mobile-grab.ts
      function getMobileGrabGlobalStyleText(options) {
        return `
          .buttonArea.qolboxMobileGrabButton {
            background-image: url("${options.mobileGrabIconHref}") !important;
            background-position: center center !important;
            background-repeat: no-repeat !important;
            background-size: 68% !important;
            box-sizing: border-box !important;
            display: none;
            transform: none !important;
            z-index: 12;
          }
        `;
      }

      // src/features/global-style-typing.ts
      function getTypingGlobalStyleText() {
        return `
          .scores .entryContainer .qolboxTypingIndicator {
            background-image: url("graphics/ui/typing.svg");
            background-position: center center;
            background-repeat: no-repeat;
            background-size: contain;
            display: inline-block;
            height: 14px;
            margin-left: 5px;
            pointer-events: none;
            vertical-align: -2px;
            width: 14px;
          }

          @supports ((-webkit-mask-image: url("graphics/ui/typing.svg")) or (mask-image: url("graphics/ui/typing.svg"))) {
            .scores .entryContainer .qolboxTypingIndicator {
              background-color: currentColor;
              background-image: none;
              -webkit-mask-image: url("graphics/ui/typing.svg");
              mask-image: url("graphics/ui/typing.svg");
              -webkit-mask-position: center center;
              mask-position: center center;
              -webkit-mask-repeat: no-repeat;
              mask-repeat: no-repeat;
              -webkit-mask-size: contain;
              mask-size: contain;
            }
          }

          .qolboxWorldTypingLayer {
            left: 0;
            pointer-events: none;
            position: fixed;
            top: 0;
            z-index: 12;
          }

          .qolboxWorldTypingIndicator {
            background-color: rgba(37, 38, 42, 0.82);
            background-image: url("graphics/ui/typing.svg");
            background-position: center center;
            background-repeat: no-repeat;
            background-size: 14px 14px;
            border-radius: 3px;
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.35);
            height: 18px;
            pointer-events: none;
            position: fixed;
            transform: translate(-50%, -100%);
            width: 22px;
          }
        `;
      }

      // src/features/global-style-editor-map.ts
      function getEditorMapGlobalStyleText() {
        return `
          .qolboxEditorMapStatus {
            background: rgba(22, 24, 28, 0.96);
            border: 1px solid rgb(92, 98, 108);
            border-radius: 3px;
            box-shadow: 0 4px 14px rgba(0, 0, 0, 0.42);
            box-sizing: border-box;
            color: #f4f4f4;
            font-family: inherit;
            font-size: 12px;
            font-weight: 700;
            left: 50%;
            line-height: 15px;
            max-width: calc(100vw - 20px);
            opacity: 0;
            padding: 6px 10px;
            pointer-events: none;
            position: fixed;
            top: 36px;
            transform: translateX(-50%);
            transition: opacity 120ms ease;
            z-index: 2147483646;
          }

          .qolboxEditorMapStatus.visible {
            opacity: 1;
          }

          .qolboxEditorMapStatus.error {
            border-color: rgba(240, 95, 87, 0.8);
            color: #ffaaa4;
          }
        `;
      }

      // src/features/global-style.ts
      function getGlobalStyleText(options) {
        return `
          ${getFullscreenGlobalStyleText(options)}

          ${getTypingGlobalStyleText()}

          ${getChatGlobalStyleText()}

          .qolboxSwitchTeamsButton.qolboxSwitchTeamsButtonBusy {
            cursor: not-allowed !important;
            opacity: 0.62;
          }

          html.qolbox-feature-fullscreen #email,
          html.qolbox-feature-fullscreen #songcredit,
          html.qolbox-feature-fullscreen #betaLink {
            display: none !important;
          }

          ${getReserveGlobalStyleText()}

          ${getQolboxMenuGlobalStyleText()}

          ${getMobileGrabGlobalStyleText(options)}

          ${getEditorMapGlobalStyleText()}
        `;
      }
      function createGlobalStyleController(options) {
        function ensureGlobalStyle() {
          if (document.getElementById(options.styleId)) {
            return true;
          }
          const styleHost = document.head || document.documentElement;
          if (!styleHost) {
            return false;
          }
          const style = document.createElement("style");
          style.id = options.styleId;
          style.textContent = getGlobalStyleText(options);
          styleHost.appendChild(style);
          return true;
        }
        return {
          ensureGlobalStyle
        };
      }

      // src/features/qolbox-shell-feature-bundle.ts
      function createQolboxShellFeatureBundle(options) {
        const { ensureGlobalStyle } = createGlobalStyleController({
          styleId: "qolbox-style",
          fullscreenRenderLayerSelector: FULLSCREEN_RENDER_LAYER_SELECTOR,
          fullscreenRenderCanvasSelector: FULLSCREEN_RENDER_CANVAS_SELECTOR,
          fullscreenRenderCanvasFocusSelector: FULLSCREEN_RENDER_CANVAS_FOCUS_SELECTOR,
          mobileGrabIconHref: MOBILE_GRAB_ICON_HREF
        });
        const { applyFeatureRootClasses } = createFeatureRootClassController({
          featureDefinitions: FEATURE_DEFINITIONS,
          isMenuClosed: options.isMenuClosed,
          isFeatureActive: options.isFeatureActive,
          menuRootClass: QOLBOX_MENU_ROOT_CLASS
        });
        return {
          applyFeatureRootClasses,
          ensureGlobalStyle
        };
      }

      // src/hitbox/auto-join-adapter.ts
      function getNativeAutoJoin() {
        return readNativeProperty(window, "autoJoin");
      }
      function isNativeAutoJoinMatch(joinId, password) {
        const autoJoin = getNativeAutoJoin();
        if (!isNativeObject(autoJoin)) {
          return false;
        }
        return joinId === readNativeProperty(autoJoin, "address") && password === readNativeProperty(autoJoin, "passbypass");
      }
      function isNativeAutoJoinOnePersonRoom() {
        const autoJoin = getNativeAutoJoin();
        if (!isNativeObject(autoJoin)) {
          return false;
        }
        const maxPlayers = Number(
          readNativeProperty(autoJoin, "maxPlayers") || readNativeProperty(autoJoin, "maxplayers") || readNativeProperty(autoJoin, "max")
        );
        return Number.isFinite(maxPlayers) && maxPlayers === 1;
      }

      // src/hitbox/reserve-socket-emit-patcher.ts
      function isNativeReserveCallable(value) {
        return typeof value === "function";
      }
      function patchReserveSocketEmitTarget(target, options) {
        if (!target) {
          return false;
        }
        const nativeEmit = readNativeReflectProperty(target, "emit");
        if (readNativeReflectProperty(target, "__qolboxReservePatched") || !isNativeReserveCallable(nativeEmit)) {
          return false;
        }
        const baseEmit = nativeEmit;
        function wrappedReserveEmit(eventName, ...args) {
          if (options.shouldCaptureJoin(args)) {
            options.onJoin(this, eventName, args);
          }
          return Reflect.apply(baseEmit, this, [eventName, ...args]);
        }
        setNativeReflectProperty(target, "emit", wrappedReserveEmit);
        setNativeReflectProperty(target, "__qolboxReservePatched", true);
        setNativeReflectProperty(target, options.originalEmitKey, baseEmit);
        return true;
      }

      // src/hitbox/reserve-socket-adapter.ts
      function emitReserveSocketJoinAttempt(attempt, options) {
        const emit = readNativeProperty(attempt?.socket, "emit");
        if (!attempt || !isNativeReserveCallable(emit)) {
          return false;
        }
        const connect = readNativeProperty(attempt.socket, "connect");
        if (!readNativeProperty(attempt.socket, "connected") && isNativeReserveCallable(connect)) {
          try {
            Reflect.apply(connect, attempt.socket, []);
          } catch {
            return false;
          }
        }
        try {
          options.beforeEmit();
          Reflect.apply(emit, attempt.socket, [attempt.eventName, ...attempt.args.map(options.cloneValue)]);
          return true;
        } catch {
          return false;
        }
      }
      function createReserveSocketCaptureHook(options) {
        let socketHookInstalled = false;
        function patchSocket(socket) {
          patchReserveSocketEmitTarget(socket, {
            onJoin: options.onJoin,
            originalEmitKey: "__qolboxReserveOriginalEmit",
            shouldCaptureJoin: options.shouldCaptureJoin
          });
          return socket;
        }
        function patchSocketPrototype(ioFactory) {
          const prototype = readNativeReflectProperty(readNativeReflectProperty(ioFactory, "Socket"), "prototype");
          if (!prototype) {
            return;
          }
          patchReserveSocketEmitTarget(prototype, {
            onJoin: options.onJoin,
            originalEmitKey: "__qolboxReserveOriginalEmit",
            shouldCaptureJoin: options.shouldCaptureJoin
          });
        }
        function patchIo(ioFactory) {
          if (!isNativeReserveCallable(ioFactory) || readNativeReflectProperty(ioFactory, "__qolboxReservePatched")) {
            patchSocketPrototype(ioFactory);
            return ioFactory;
          }
          const baseIoFactory = ioFactory;
          function wrappedReserveIo(...args) {
            return patchSocket(Reflect.apply(baseIoFactory, this, args));
          }
          try {
            Object.setPrototypeOf(wrappedReserveIo, Object.getPrototypeOf(baseIoFactory));
          } catch {
          }
          for (const key of Reflect.ownKeys(baseIoFactory)) {
            try {
              setNativeReflectProperty(wrappedReserveIo, key, readNativeReflectProperty(baseIoFactory, key));
            } catch {
            }
          }
          setNativeReflectProperty(wrappedReserveIo, "__qolboxReservePatched", true);
          setNativeReflectProperty(wrappedReserveIo, "__qolboxReserveOriginal", baseIoFactory);
          patchSocketPrototype(wrappedReserveIo);
          return wrappedReserveIo;
        }
        function installReserveSocketCaptureHook() {
          if (socketHookInstalled) {
            return;
          }
          socketHookInstalled = true;
          try {
            let ioValue = readNativeReflectProperty(window, "io");
            Object.defineProperty(window, "io", {
              configurable: true,
              enumerable: true,
              get() {
                return ioValue;
              },
              set(value) {
                ioValue = patchIo(value);
              }
            });
            if (ioValue) {
              setNativeReflectProperty(window, "io", ioValue);
            }
          } catch {
            const ioValue = readNativeReflectProperty(window, "io");
            if (ioValue) {
              setNativeReflectProperty(window, "io", patchIo(ioValue));
            }
          }
        }
        return {
          installReserveSocketCaptureHook
        };
      }

      // src/features/reserve-action-controls.ts
      var SELECTED_RESERVE_ROW_SELECTOR = ".roomListContainer .scrollBox tr.SELECTED";
      function getText(element) {
        return (element.textContent || "").trim();
      }
      function setDatasetValue(element, key, value) {
        if (hasDataset(element)) {
          element.dataset[key] = value;
        }
      }
      function createReserveActionControls(options) {
        let passwordPromptPending = false;
        function clearReservePasswordPromptPending() {
          passwordPromptPending = false;
        }
        function isReservePasswordPromptPending() {
          return passwordPromptPending;
        }
        function setReservePasswordPromptPending(pending) {
          passwordPromptPending = Boolean(pending);
        }
        function syncReserveJoinButtonLabel() {
          const button = options.getReserveJoinButton();
          if (!(button instanceof Element)) {
            return;
          }
          if (!options.isEnabled()) {
            setDatasetValue(button, "qolboxReserveFull", "false");
            setDatasetValue(button, "qolboxReserveUnavailable", "false");
            button.classList.remove("qolboxReserveUnavailable");
            button.removeAttribute("aria-disabled");
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
          setDatasetValue(button, "qolboxReserveFull", shouldReserve ? "true" : "false");
          setDatasetValue(button, "qolboxReserveUnavailable", isUnavailable ? "true" : "false");
          button.classList.toggle("qolboxReserveUnavailable", isUnavailable);
          button.setAttribute("aria-disabled", isUnavailable ? "true" : "false");
        }
        function syncReservePasswordPrompt() {
          if (!options.isEnabled()) {
            clearReservePasswordPromptPending();
            return;
          }
          const container = document.querySelector(".passwordWindowContainer");
          const joinButton = container?.querySelector(".joinButton") || null;
          if (!options.isElementVisible(container) || !joinButton) {
            clearReservePasswordPromptPending();
            return;
          }
          if (passwordPromptPending && getText(joinButton) !== options.reserveButtonText) {
            joinButton.textContent = options.reserveButtonText;
          }
        }
        function clearReserveVisibleRoomSelection() {
          for (const row of document.querySelectorAll(SELECTED_RESERVE_ROW_SELECTOR)) {
            row.classList.remove("SELECTED");
          }
          syncReserveJoinButtonLabel();
        }
        return {
          clearReservePasswordPromptPending,
          clearReserveVisibleRoomSelection,
          isReservePasswordPromptPending,
          setReservePasswordPromptPending,
          syncReserveJoinButtonLabel,
          syncReservePasswordPrompt
        };
      }

      // src/features/reserve-join-payload.ts
      function cloneReserveJoinValue(value) {
        try {
          const cloned = JSON.parse(JSON.stringify(value));
          return cloned;
        } catch {
          return value;
        }
      }
      function isReserveJoinPayload(value) {
        return Boolean(
          isReflectableObject(value) && (typeof getReserveJoinPayloadJoinId(value) === "string" || Object.prototype.hasOwnProperty.call(value, "playerName") && Object.prototype.hasOwnProperty.call(value, "peerID") && Object.prototype.hasOwnProperty.call(value, "password"))
        );
      }
      function getReserveJoinPayload(args) {
        return args.find(isReserveJoinPayload) || null;
      }
      function getReserveJoinPayloadJoinId(payload) {
        return readObjectProperty(payload, "joinID");
      }
      function getReserveJoinPayloadPassword(payload) {
        return readObjectProperty(payload, "password");
      }

      // src/features/reserve-captured-join.ts
      function isAutoReserveJoin(payload, options) {
        if (!payload) {
          return false;
        }
        return options.isAutoJoinMatch(getReserveJoinPayloadJoinId(payload), getReserveJoinPayloadPassword(payload));
      }
      function createReserveCapturedJoinController(options) {
        let capturedJoin = null;
        function clearReserveCapturedJoin() {
          capturedJoin = null;
        }
        function getReserveCapturedJoin() {
          return capturedJoin;
        }
        function getRetryCapturedJoin() {
          return options.getState()?.capturedJoin || capturedJoin;
        }
        function captureReserveJoin(socket, eventName, args) {
          if (!options.isEnabled()) {
            return;
          }
          const payload = getReserveJoinPayload(args);
          if (!payload) {
            return;
          }
          capturedJoin = {
            socket,
            eventName,
            args: args.map(cloneReserveJoinValue),
            autoReserve: isAutoReserveJoin(payload, options),
            time: Date.now()
          };
          const state = options.getState();
          if (state?.active) {
            state.capturedJoin = capturedJoin;
          }
          options.onCaptured();
        }
        function shouldWatchRecentReserveCapture() {
          return Boolean(
            capturedJoin && Date.now() - capturedJoin.time < options.capturedJoinFreshMs && !options.hasSuccessfulJoinLayer()
          );
        }
        function canAutoReserveCapturedJoin() {
          return Boolean(options.getState()?.active || capturedJoin?.autoReserve);
        }
        function emitReserveJoinAttempt() {
          return emitReserveSocketJoinAttempt(getRetryCapturedJoin(), {
            beforeEmit: options.suppressRetryAudio,
            cloneValue: cloneReserveJoinValue
          });
        }
        return {
          canAutoReserveCapturedJoin,
          captureReserveJoin,
          clearReserveCapturedJoin,
          emitReserveJoinAttempt,
          getReserveCapturedJoin,
          shouldWatchRecentReserveCapture
        };
      }

      // src/features/reserve-connecting-state.ts
      function createReserveConnectingStateController(options) {
        function handleReserveConnectingState() {
          if (!options.isEnabled()) {
            if (options.getState()) {
              options.stopReserveSpot();
            }
            return;
          }
          const nativeText = options.getNativeConnectingText();
          if (options.isRoomFullSuppressed() && options.hasSuccessfulJoinLayer() && options.roomFullPattern.test(nativeText)) {
            options.hideNativeConnectingWindows();
            return;
          }
          if (options.getState()?.active && options.hasSuccessfulJoinLayer()) {
            options.stopAfterSuccessfulJoin();
            return;
          }
          if (options.getState()?.active && options.roomClosedPattern.test(nativeText)) {
            options.stopReserveSpot();
            return;
          }
          if (options.getState()?.active && options.wrongPasswordPattern.test(nativeText)) {
            options.showTerminalMessage("wrong-password", options.getReserveNativeMessage(options.wrongPasswordPattern));
            return;
          }
          const canAutoReserve = options.canAutoReserveCapturedJoin();
          if (options.roomFullPattern.test(nativeText) && canAutoReserve) {
            if (options.isAutoJoinOnePersonRoom()) {
              options.showOnePersonUnavailable();
              options.hideNativeConnectingWindows();
              return;
            }
            options.startReserveSpot("room-full");
            options.scheduleReserveRetry();
          }
        }
        return {
          handleReserveConnectingState
        };
      }

      // src/features/reserve-countdown-timer.ts
      function createReserveCountdownTimer(options) {
        let countdownTimer = 0;
        function clearReserveCountdownTimer() {
          if (countdownTimer) {
            window.clearTimeout(countdownTimer);
            countdownTimer = 0;
          }
        }
        function scheduleReserveCountdownUpdate() {
          if (countdownTimer || !options.getState()?.active) {
            return;
          }
          countdownTimer = window.setTimeout(() => {
            countdownTimer = 0;
            if (!options.getState()?.active) {
              return;
            }
            options.onTick();
            scheduleReserveCountdownUpdate();
          }, options.intervalMs);
        }
        return {
          clearReserveCountdownTimer,
          scheduleReserveCountdownUpdate
        };
      }

      // src/features/reserve-dom-event-hooks.ts
      function createReserveDomEventHooks(options) {
        let domEventsInstalled = false;
        function installReserveDomEventHooks() {
          if (domEventsInstalled) {
            return;
          }
          domEventsInstalled = true;
          document.addEventListener("click", options.onRoomListClick, true);
          document.addEventListener("dblclick", options.onRoomListDoubleClick, true);
          document.addEventListener("click", options.onPasswordSubmit, true);
          window.addEventListener("keyup", options.onPasswordKey, true);
        }
        return {
          installReserveDomEventHooks
        };
      }

      // src/features/reserve-feature-patch.ts
      function createReserveFeaturePatchController(options) {
        function shouldContinueReserveStatusWatch() {
          if (options.getState()?.active) {
            return true;
          }
          if (options.isRoomFullSuppressed()) {
            return true;
          }
          return options.shouldWatchRecentCapture();
        }
        function patchReserveSpotFeature() {
          if (!options.isEnabled()) {
            options.syncJoinButtonLabel();
            return;
          }
          options.installSocketCaptureHook();
          options.syncJoinButtonLabel();
          options.syncPasswordPrompt();
          options.handleConnectingState();
          options.installDomEventHooks();
        }
        return {
          patchReserveSpotFeature,
          shouldContinueReserveStatusWatch
        };
      }

      // src/features/reserve-interaction-events.ts
      function getClosestReserveJoinButton(target) {
        return target instanceof Element ? target.closest(".roomListContainer .bottomButton.right") : null;
      }
      function getReservePasswordSubmitButton(target) {
        return target instanceof Element ? target.closest(".passwordWindowContainer .joinButton") : null;
      }
      function getReserveEventKey(event) {
        const key = readObjectProperty(event, "key");
        return typeof key === "string" ? key : "";
      }
      function stopReserveNativeEvent(event) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
      function clickReserveElement(element) {
        const click = readObjectProperty(element, "click");
        if (typeof click === "function") {
          Reflect.apply(click, element, []);
        }
      }

      // src/features/reserve-interaction-handlers.ts
      function createReserveInteractionHandlers(options) {
        function scheduleJoinButtonSync() {
          window.setTimeout(options.syncJoinButtonLabel, 0);
        }
        function schedulePasswordPromptSync() {
          window.setTimeout(options.syncPasswordPrompt, 0);
        }
        function markPasswordPromptPending() {
          options.setPasswordPromptPending(true);
          schedulePasswordPromptSync();
        }
        function showSelectedUnavailable(event) {
          stopReserveNativeEvent(event);
          options.clearPasswordPromptPending();
          options.showOnePersonUnavailable(options.getSelectedRoomRow());
        }
        function cancelReserveSpot() {
          if (options.getState()?.unavailable) {
            options.stopReserveSpot({ clearSelection: true });
            return;
          }
          const cancelButton = options.getNativeConnectingWindows().map((windowElement) => windowElement.querySelector(".cancelButton")).find(Boolean);
          if (cancelButton) {
            clickReserveElement(cancelButton);
          }
          options.stopReserveSpot();
        }
        function handleReserveRoomListClick(event) {
          if (!options.isEnabled()) {
            return;
          }
          const row = options.getRowFromTarget(event.target);
          const joinButton = getClosestReserveJoinButton(event.target);
          if (row) {
            options.rememberSelectedRoom(row);
            scheduleJoinButtonSync();
            if (options.isUnavailableRoom(row)) {
              options.showOnePersonUnavailable(row);
              if (joinButton) {
                stopReserveNativeEvent(event);
              }
            }
          }
          if (!joinButton) {
            return;
          }
          const selectedState = options.getSelectedRoomState();
          const selectedRow = selectedState.row;
          if (selectedState.unavailable) {
            stopReserveNativeEvent(event);
            options.showOnePersonUnavailable(selectedRow);
            return;
          }
          if (!selectedState.full) {
            options.clearPasswordPromptPending();
            return;
          }
          if (options.isPasswordRoom(selectedRow)) {
            markPasswordPromptPending();
            return;
          }
          options.startReserveSpot("room-list");
        }
        function handleReserveRoomListDoubleClick(event) {
          if (!options.isEnabled()) {
            return;
          }
          const row = options.getRowFromTarget(event.target);
          if (!options.isRoomFull(row)) {
            return;
          }
          options.rememberSelectedRoom(row);
          if (options.isUnavailableRoom(row)) {
            stopReserveNativeEvent(event);
            options.showOnePersonUnavailable(row);
            return;
          }
          if (options.isPasswordRoom(row)) {
            markPasswordPromptPending();
            return;
          }
          options.startReserveSpot("room-list");
        }
        function handleReservePasswordSubmit(event) {
          if (!options.isEnabled()) {
            return;
          }
          const submitButton = getReservePasswordSubmitButton(event.target);
          if (!submitButton || !options.isPasswordPromptPending()) {
            return;
          }
          if (options.isUnavailableRoom(options.getSelectedRoomRow())) {
            showSelectedUnavailable(event);
            return;
          }
          options.clearPasswordPromptPending();
          options.startReserveSpot("password-room");
        }
        function handleReservePasswordKey(event) {
          if (!options.isEnabled()) {
            return;
          }
          const passwordWindow = document.querySelector(".passwordWindowContainer");
          if (getReserveEventKey(event) !== "Enter" || !options.isPasswordPromptPending() || !options.isElementVisible(passwordWindow)) {
            return;
          }
          if (options.isUnavailableRoom(options.getSelectedRoomRow())) {
            showSelectedUnavailable(event);
            return;
          }
          options.clearPasswordPromptPending();
          options.startReserveSpot("password-room");
        }
        return {
          cancelReserveSpot,
          handleReservePasswordKey,
          handleReservePasswordSubmit,
          handleReserveRoomListClick,
          handleReserveRoomListDoubleClick
        };
      }

      // src/features/reserve-lifecycle.ts
      function createReserveLifecycleController(options) {
        let reserveState = null;
        function getReserveState() {
          return reserveState;
        }
        function startReserveSpot(reason) {
          if (!options.isEnabled()) {
            return;
          }
          if (!reserveState?.active) {
            reserveState = {
              active: true,
              unavailable: false,
              reason,
              retryTimer: 0,
              nextRetryAt: Date.now() + options.getRetryDelayMs(),
              retries: 0,
              capturedJoin: options.getCapturedJoin(),
              lastStatusText: ""
            };
          } else {
            reserveState.reason = reserveState.reason || reason;
            reserveState.capturedJoin = reserveState.capturedJoin || options.getCapturedJoin();
            reserveState.nextRetryAt = reserveState.nextRetryAt || Date.now() + options.getRetryDelayMs();
            reserveState.unavailable = false;
          }
          options.updateWaitingWindow();
          options.setWaitingVisible(true);
          options.scheduleStatusWatch();
          options.scheduleCountdownUpdate();
        }
        function stopReserveSpot({ hideNative = false, clearCaptured = true, clearSelection = false } = {}) {
          options.clearRetryTimer(reserveState);
          options.clearStatusWatchTimer();
          options.clearCountdownTimer();
          if (clearCaptured) {
            options.clearCapturedJoin();
          }
          reserveState = null;
          options.clearPasswordPromptPending();
          options.setWaitingVisible(false);
          if (hideNative) {
            options.hideNativeConnectingWindows();
          }
          if (clearSelection) {
            options.clearVisibleRoomSelection();
          } else {
            options.syncJoinButtonLabel();
          }
        }
        function showReserveOnePersonUnavailable(row = null) {
          if (!options.isEnabled()) {
            return;
          }
          if (row) {
            options.rememberSelectedRoom(row);
          }
          options.clearRetryTimer(reserveState);
          options.clearStatusWatchTimer();
          options.clearCountdownTimer();
          options.clearCapturedJoin();
          options.clearPasswordPromptPending();
          reserveState = {
            active: false,
            unavailable: true,
            reason: "one-person-room",
            message: options.onePersonText
          };
          options.updateWaitingWindow();
          options.setWaitingVisible(true);
          options.syncJoinButtonLabel();
        }
        function showReserveTerminalMessage(reason, message) {
          if (!options.isEnabled()) {
            return;
          }
          options.clearRetryTimer(reserveState);
          options.clearStatusWatchTimer();
          options.clearCountdownTimer();
          options.clearCapturedJoin();
          options.clearPasswordPromptPending();
          reserveState = {
            active: false,
            unavailable: false,
            terminal: true,
            reason,
            message: message || options.statusFallbackText
          };
          options.updateWaitingWindow();
          options.setWaitingVisible(true);
          options.hideNativeConnectingWindows();
          options.syncJoinButtonLabel();
        }
        function stopReserveAfterSuccessfulJoin() {
          options.suppressRoomFullAfterJoin();
          stopReserveSpot({ hideNative: true });
          options.scheduleStatusWatch();
        }
        return {
          getReserveState,
          showReserveOnePersonUnavailable,
          showReserveTerminalMessage,
          startReserveSpot,
          stopReserveAfterSuccessfulJoin,
          stopReserveSpot
        };
      }

      // src/features/reserve-room-list.ts
      function getCell(row, index) {
        const cells = readObjectProperty(row, "cells");
        return readObjectProperty(cells, index);
      }
      function getCellText(row, index) {
        const text = readObjectProperty(getCell(row, index), "textContent");
        return typeof text === "string" ? text.trim() : "";
      }
      function hasAtLeastTwoCells(row) {
        const cells = readObjectProperty(row, "cells");
        const length = Number(readObjectProperty(cells, "length"));
        return Number.isFinite(length) && length >= 2;
      }
      function getReserveRowFromTarget(target) {
        return target instanceof Element ? target.closest(".roomListContainer .scrollBox tr") : null;
      }
      function getReserveRoomSignature(row) {
        if (!row || !getCell(row, 0)) {
          return "";
        }
        const roomName = getCellText(row, 0);
        const lockState = isReservePasswordRoom(row) ? "locked" : "open";
        return `${roomName}
    ${lockState}`;
      }
      function findReserveRoomBySignature(signature) {
        if (!signature) {
          return null;
        }
        return [...document.querySelectorAll(".roomListContainer .scrollBox tr")].find((row) => {
          return row.isConnected && getReserveRoomSignature(row) === signature;
        }) || null;
      }
      function parseReserveRoomPlayers(row) {
        if (!hasAtLeastTwoCells(row)) {
          return null;
        }
        const match = getCellText(row, 1).match(/^(\d+)\s*\/\s*(\d+)$/);
        if (!match) {
          return null;
        }
        return {
          current: Number(match[1]),
          max: Number(match[2])
        };
      }
      function isReserveRoomFull(row) {
        const players = parseReserveRoomPlayers(row);
        return Boolean(players && players.max > 0 && players.current >= players.max);
      }
      function isReserveOnePersonRoom(row) {
        const players = parseReserveRoomPlayers(row);
        return Boolean(players && players.max === 1);
      }
      function isReserveUnavailableRoom(row) {
        return Boolean(isReserveRoomFull(row) && isReserveOnePersonRoom(row));
      }
      function isReservePasswordRoom(row) {
        return Boolean(row instanceof Element && row.querySelector('img[src*="lock"]'));
      }
      function createReserveRoomList(options) {
        function getReserveJoinButton() {
          const button = document.querySelector(".roomListContainer .bottomButton.right");
          return options.isElementVisible(button) ? button : null;
        }
        return {
          getReserveJoinButton
        };
      }

      // src/features/reserve-room-full-suppression.ts
      function createReserveRoomFullSuppression(options) {
        let suppressUntil = 0;
        function isReserveJoinedRoomFullSuppressed() {
          return Date.now() < suppressUntil;
        }
        function suppressReserveRoomFullAfterJoin() {
          suppressUntil = Date.now() + options.suppressMs;
        }
        return {
          isReserveJoinedRoomFullSuppressed,
          suppressReserveRoomFullAfterJoin
        };
      }

      // src/features/reserve-retry-audio-suppression.ts
      function createReserveRetryAudioSuppression(options) {
        let suppressUntil = 0;
        function isReserveRetryAudioSuppressed() {
          return Date.now() < suppressUntil;
        }
        function suppressReserveRetryAudio() {
          suppressUntil = Date.now() + options.suppressMs;
        }
        return {
          isReserveRetryAudioSuppressed,
          suppressReserveRetryAudio
        };
      }

      // src/features/reserve-retry-scheduler.ts
      function createReserveRetryScheduler(options) {
        function clearReserveRetryTimer(state = options.getState()) {
          if (state?.retryTimer) {
            window.clearTimeout(state.retryTimer);
            state.retryTimer = 0;
          }
        }
        function scheduleReserveRetry() {
          const state = options.getState();
          if (!options.isEnabled() || !state?.active || state.retryTimer) {
            return;
          }
          const retryDelayMs = options.getRetryDelayMs();
          state.nextRetryAt = Date.now() + retryDelayMs;
          options.updateWaitingWindow();
          options.scheduleCountdownUpdate();
          state.retryTimer = window.setTimeout(() => {
            const currentState = options.getState();
            if (!currentState?.active) {
              return;
            }
            currentState.retryTimer = 0;
            currentState.nextRetryAt = 0;
            options.updateWaitingWindow();
            if (options.hasSuccessfulJoinLayer()) {
              options.onSuccessfulJoin();
              return;
            }
            if (options.emitJoinAttempt()) {
              currentState.retries = (currentState.retries || 0) + 1;
            }
            scheduleReserveRetry();
          }, retryDelayMs);
        }
        return {
          clearReserveRetryTimer,
          scheduleReserveRetry
        };
      }

      // src/features/reserve-native-status.ts
      function getWindowLines(windowElement) {
        const textElement = windowElement.querySelector(".textBox") || windowElement;
        return (textElement.textContent || "").split(/\r?\n/);
      }
      function normalizeLine(line) {
        return line.replace(/\s+/g, " ").trim();
      }
      function setDisplayNone(element) {
        if (isStyledElement(element)) {
          element.style.display = "none";
        }
      }
      function createReserveNativeStatus(options) {
        function getNativeConnectingWindows() {
          return [...document.querySelectorAll(".connectingWindowContainer:not(.qolboxReserveWindowContainer)")];
        }
        function getNativeConnectingText() {
          return getNativeConnectingWindows().map((windowElement) => windowElement.textContent || "").join("\n");
        }
        function hideNativeConnectingWindows() {
          for (const windowElement of getNativeConnectingWindows()) {
            setDisplayNone(windowElement);
          }
        }
        function getReserveStatusLines() {
          return getNativeConnectingWindows().flatMap(getWindowLines).map(normalizeLine).filter((line) => {
            return line && !options.roomFullPattern.test(line) && !options.roomClosedPattern.test(line) && !options.wrongPasswordPattern.test(line) && !/^cancel$/i.test(line) && line !== options.reserveWaitText;
          });
        }
        function getReserveNativeMessage(pattern) {
          return getNativeConnectingWindows().flatMap(getWindowLines).map(normalizeLine).find((line) => line && pattern.test(line)) || "";
        }
        return {
          getNativeConnectingText,
          getNativeConnectingWindows,
          getReserveNativeMessage,
          getReserveStatusLines,
          hideNativeConnectingWindows
        };
      }

      // src/features/reserve-selection-state.ts
      var SELECTED_RESERVE_ROW_SELECTOR2 = ".roomListContainer .scrollBox tr.SELECTED";
      function createReserveSelectionState() {
        let selectedRow = null;
        let selectedSignature = "";
        let selectedWasFull = false;
        let selectedWasUnavailable = false;
        function rememberReserveSelectedRoom(row) {
          if (!(row instanceof Element) || !row.isConnected) {
            return null;
          }
          selectedRow = row;
          selectedSignature = getReserveRoomSignature(row);
          selectedWasFull = isReserveRoomFull(row);
          selectedWasUnavailable = isReserveUnavailableRoom(row);
          return row;
        }
        function getReserveSelectedRoomRow() {
          const selected = document.querySelector(SELECTED_RESERVE_ROW_SELECTOR2);
          if (selected?.isConnected) {
            return rememberReserveSelectedRoom(selected);
          }
          if (selectedRow?.isConnected) {
            return rememberReserveSelectedRoom(selectedRow);
          }
          const matchingRow = findReserveRoomBySignature(selectedSignature);
          if (matchingRow) {
            return rememberReserveSelectedRoom(matchingRow);
          }
          return null;
        }
        function getReserveSelectedRoomState() {
          const row = getReserveSelectedRoomRow();
          if (row) {
            return {
              row,
              full: isReserveRoomFull(row),
              unavailable: isReserveUnavailableRoom(row)
            };
          }
          return {
            row: null,
            full: selectedWasFull,
            unavailable: selectedWasUnavailable
          };
        }
        return {
          getReserveSelectedRoomRow,
          getReserveSelectedRoomState,
          rememberReserveSelectedRoom
        };
      }

      // src/features/reserve-status-watch-timer.ts
      function createReserveStatusWatchTimer(options) {
        let statusWatchTimer = 0;
        function clearReserveStatusWatchTimer() {
          if (statusWatchTimer) {
            window.clearTimeout(statusWatchTimer);
            statusWatchTimer = 0;
          }
        }
        function scheduleReserveStatusWatch(delay = options.defaultDelayMs) {
          if (statusWatchTimer) {
            return;
          }
          statusWatchTimer = window.setTimeout(() => {
            statusWatchTimer = 0;
            options.onTick();
            if (options.shouldContinue()) {
              scheduleReserveStatusWatch(delay);
            }
          }, delay);
        }
        return {
          clearReserveStatusWatchTimer,
          scheduleReserveStatusWatch
        };
      }

      // src/features/reserve-waiting-window.ts
      var RESERVE_WINDOW_ID = "qolboxReserveWindow";
      function getReserveWindowHost() {
        return document.getElementById("appContainer") || document.body || document.documentElement;
      }
      function createReserveWaitingWindow(options) {
        function ensureReserveWaitingWindow() {
          const existing = document.getElementById(RESERVE_WINDOW_ID);
          if (existing) {
            return existing;
          }
          const container = document.createElement("div");
          container.id = RESERVE_WINDOW_ID;
          container.className = "connectingWindowContainer qolboxReserveWindowContainer";
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
          container.querySelector(".cancelButton")?.addEventListener("click", () => {
            options.onCancel();
          });
          getReserveWindowHost().appendChild(container);
          return container;
        }
        function getReserveStatusText() {
          const statusText = options.getReserveStatusLines().slice(-2).join(" - ");
          const state = options.getState();
          if (statusText) {
            if (state) {
              state.lastStatusText = statusText;
            }
            return statusText;
          }
          return state?.lastStatusText || options.statusFallbackText;
        }
        function getReserveCountdownText() {
          const nextRetryAt = options.getState()?.nextRetryAt;
          const remainingMs = nextRetryAt ? Math.max(0, nextRetryAt - Date.now()) : options.getRetryDelayMs();
          return `Retrying in ${(remainingMs / 1e3).toFixed(1)} seconds...`;
        }
        function updateReserveWaitingWindow() {
          const container = ensureReserveWaitingWindow();
          const state = options.getState();
          const title = container.querySelector(".topBar");
          const spinner = container.querySelector(".spinner");
          const status = container.querySelector(".qolboxReserveStatus");
          const countdown = container.querySelector(".qolboxReserveCountdown");
          const message = container.querySelector(".qolboxReserveMessage");
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
            status.textContent = isTerminalMessage ? "" : getReserveStatusText();
          }
          if (countdown) {
            countdown.hidden = isTerminalMessage;
            countdown.textContent = isTerminalMessage ? "" : getReserveCountdownText();
          }
          if (message) {
            message.hidden = !isTerminalMessage;
            message.textContent = isTerminalMessage ? state?.message || options.onePersonText : "";
          }
        }
        function setReserveWaitingVisible(visible) {
          document.body?.classList.toggle("qolbox-reserve-active", visible);
          ensureReserveWaitingWindow().style.display = visible ? "block" : "none";
        }
        return {
          ensureReserveWaitingWindow,
          getReserveCountdownText,
          getReserveStatusText,
          setReserveWaitingVisible,
          updateReserveWaitingWindow
        };
      }

      // src/features/reserve-feature-bundle.ts
      function createReserveFeatureBundle(options) {
        const {
          getReserveSelectedRoomRow,
          getReserveSelectedRoomState,
          rememberReserveSelectedRoom
        } = createReserveSelectionState();
        const {
          getReserveState,
          showReserveOnePersonUnavailable,
          showReserveTerminalMessage,
          startReserveSpot,
          stopReserveAfterSuccessfulJoin,
          stopReserveSpot
        } = createReserveLifecycleController({
          clearCapturedJoin: () => clearReserveCapturedJoin(),
          clearCountdownTimer: () => clearReserveCountdownTimer(),
          clearPasswordPromptPending: () => clearReservePasswordPromptPending(),
          clearRetryTimer: (state) => clearReserveRetryTimer(state),
          clearStatusWatchTimer: () => clearReserveStatusWatchTimer(),
          clearVisibleRoomSelection: () => clearReserveVisibleRoomSelection(),
          getCapturedJoin: () => getReserveCapturedJoin(),
          hideNativeConnectingWindows: () => hideNativeConnectingWindows(),
          isEnabled: options.isReserveEnabled,
          onePersonText: RESERVE_ONE_PERSON_TEXT,
          rememberSelectedRoom: (row) => rememberReserveSelectedRoom(row),
          getRetryDelayMs: getAdvancedReserveRetryIntervalMs,
          scheduleCountdownUpdate: () => scheduleReserveCountdownUpdate(),
          scheduleStatusWatch: () => scheduleReserveStatusWatch(),
          setWaitingVisible: (visible) => setReserveWaitingVisible(visible),
          statusFallbackText: RESERVE_STATUS_FALLBACK_TEXT,
          suppressRoomFullAfterJoin: () => suppressReserveRoomFullAfterJoin(),
          syncJoinButtonLabel: () => syncReserveJoinButtonLabel(),
          updateWaitingWindow: () => updateReserveWaitingWindow()
        });
        const { getReserveJoinButton } = createReserveRoomList({
          isElementVisible
        });
        const {
          clearReservePasswordPromptPending,
          clearReserveVisibleRoomSelection,
          isReservePasswordPromptPending,
          setReservePasswordPromptPending,
          syncReserveJoinButtonLabel,
          syncReservePasswordPrompt
        } = createReserveActionControls({
          getReserveJoinButton,
          getReserveSelectedRoomState,
          isElementVisible,
          isEnabled: options.isReserveEnabled,
          joinButtonText: JOIN_BUTTON_TEXT,
          reserveButtonText: RESERVE_BUTTON_TEXT
        });
        const {
          getNativeConnectingWindows,
          getNativeConnectingText,
          getReserveNativeMessage,
          getReserveStatusLines,
          hideNativeConnectingWindows
        } = createReserveNativeStatus({
          reserveWaitText: RESERVE_WAIT_TEXT,
          roomClosedPattern: RESERVE_ROOM_CLOSED_PATTERN,
          roomFullPattern: RESERVE_ROOM_FULL_PATTERN,
          wrongPasswordPattern: RESERVE_WRONG_PASSWORD_PATTERN
        });
        const {
          isReserveJoinedRoomFullSuppressed,
          suppressReserveRoomFullAfterJoin
        } = createReserveRoomFullSuppression({
          suppressMs: RESERVE_JOINED_ROOM_FULL_SUPPRESS_MS
        });
        const {
          clearReserveStatusWatchTimer,
          scheduleReserveStatusWatch
        } = createReserveStatusWatchTimer({
          defaultDelayMs: 250,
          onTick: () => handleReserveConnectingState(),
          shouldContinue: () => shouldContinueReserveStatusWatch()
        });
        const {
          isReserveRetryAudioSuppressed,
          suppressReserveRetryAudio
        } = createReserveRetryAudioSuppression({
          suppressMs: RESERVE_RETRY_AUDIO_SUPPRESS_MS
        });
        const {
          canAutoReserveCapturedJoin,
          captureReserveJoin,
          clearReserveCapturedJoin,
          emitReserveJoinAttempt,
          getReserveCapturedJoin,
          shouldWatchRecentReserveCapture
        } = createReserveCapturedJoinController({
          capturedJoinFreshMs: 3e4,
          getState: () => getReserveState(),
          hasSuccessfulJoinLayer: options.hasSuccessfulJoinLayer,
          isEnabled: options.isReserveEnabled,
          isAutoJoinMatch: isNativeAutoJoinMatch,
          onCaptured: () => scheduleReserveStatusWatch(),
          suppressRetryAudio: suppressReserveRetryAudio
        });
        const { installReserveSocketCaptureHook } = createReserveSocketCaptureHook({
          onJoin: captureReserveJoin,
          shouldCaptureJoin: (args) => Boolean(getReserveJoinPayload(args))
        });
        const {
          setReserveWaitingVisible,
          updateReserveWaitingWindow
        } = createReserveWaitingWindow({
          getReserveStatusLines,
          getState: () => getReserveState(),
          getRetryDelayMs: getAdvancedReserveRetryIntervalMs,
          onCancel: () => cancelReserveSpot(),
          onePersonText: RESERVE_ONE_PERSON_TEXT,
          statusFallbackText: RESERVE_STATUS_FALLBACK_TEXT,
          unavailableTitleText: RESERVE_UNAVAILABLE_TITLE_TEXT,
          waitTitleText: RESERVE_WAIT_TITLE_TEXT
        });
        const {
          clearReserveCountdownTimer,
          scheduleReserveCountdownUpdate
        } = createReserveCountdownTimer({
          getState: () => getReserveState(),
          intervalMs: RESERVE_COUNTDOWN_UPDATE_MS,
          onTick: () => updateReserveWaitingWindow()
        });
        const { clearReserveRetryTimer, scheduleReserveRetry } = createReserveRetryScheduler({
          emitJoinAttempt: emitReserveJoinAttempt,
          getState: () => getReserveState(),
          hasSuccessfulJoinLayer: options.hasSuccessfulJoinLayer,
          isEnabled: options.isReserveEnabled,
          onSuccessfulJoin: () => stopReserveAfterSuccessfulJoin(),
          getRetryDelayMs: getAdvancedReserveRetryIntervalMs,
          scheduleCountdownUpdate: () => scheduleReserveCountdownUpdate(),
          updateWaitingWindow: () => updateReserveWaitingWindow()
        });
        const { handleReserveConnectingState } = createReserveConnectingStateController({
          canAutoReserveCapturedJoin,
          getNativeConnectingText,
          getReserveNativeMessage,
          getState: () => getReserveState(),
          hasSuccessfulJoinLayer: options.hasSuccessfulJoinLayer,
          hideNativeConnectingWindows,
          isAutoJoinOnePersonRoom: isNativeAutoJoinOnePersonRoom,
          isEnabled: options.isReserveEnabled,
          isRoomFullSuppressed: isReserveJoinedRoomFullSuppressed,
          roomClosedPattern: RESERVE_ROOM_CLOSED_PATTERN,
          roomFullPattern: RESERVE_ROOM_FULL_PATTERN,
          scheduleReserveRetry,
          showOnePersonUnavailable: () => showReserveOnePersonUnavailable(),
          showTerminalMessage: showReserveTerminalMessage,
          startReserveSpot,
          stopAfterSuccessfulJoin: stopReserveAfterSuccessfulJoin,
          stopReserveSpot,
          wrongPasswordPattern: RESERVE_WRONG_PASSWORD_PATTERN
        });
        const {
          cancelReserveSpot,
          handleReservePasswordKey,
          handleReservePasswordSubmit,
          handleReserveRoomListClick,
          handleReserveRoomListDoubleClick
        } = createReserveInteractionHandlers({
          clearPasswordPromptPending: clearReservePasswordPromptPending,
          getNativeConnectingWindows,
          getRowFromTarget: getReserveRowFromTarget,
          getSelectedRoomRow: getReserveSelectedRoomRow,
          getSelectedRoomState: getReserveSelectedRoomState,
          getState: () => getReserveState(),
          isElementVisible,
          isEnabled: options.isReserveEnabled,
          isPasswordPromptPending: isReservePasswordPromptPending,
          isPasswordRoom: isReservePasswordRoom,
          isRoomFull: isReserveRoomFull,
          isUnavailableRoom: isReserveUnavailableRoom,
          rememberSelectedRoom: rememberReserveSelectedRoom,
          setPasswordPromptPending: setReservePasswordPromptPending,
          showOnePersonUnavailable: showReserveOnePersonUnavailable,
          startReserveSpot,
          stopReserveSpot,
          syncJoinButtonLabel: syncReserveJoinButtonLabel,
          syncPasswordPrompt: syncReservePasswordPrompt
        });
        const { installReserveDomEventHooks } = createReserveDomEventHooks({
          onPasswordKey: handleReservePasswordKey,
          onPasswordSubmit: handleReservePasswordSubmit,
          onRoomListClick: handleReserveRoomListClick,
          onRoomListDoubleClick: handleReserveRoomListDoubleClick
        });
        const {
          patchReserveSpotFeature,
          shouldContinueReserveStatusWatch
        } = createReserveFeaturePatchController({
          getState: () => getReserveState(),
          handleConnectingState: handleReserveConnectingState,
          installDomEventHooks: installReserveDomEventHooks,
          installSocketCaptureHook: installReserveSocketCaptureHook,
          isEnabled: options.isReserveEnabled,
          isRoomFullSuppressed: isReserveJoinedRoomFullSuppressed,
          shouldWatchRecentCapture: shouldWatchRecentReserveCapture,
          syncJoinButtonLabel: syncReserveJoinButtonLabel,
          syncPasswordPrompt: syncReservePasswordPrompt
        });
        return {
          clearReservePasswordPromptPending,
          getReserveState,
          installReserveSocketCaptureHook,
          isReserveRetryAudioSuppressed,
          patchReserveSpotFeature,
          stopReserveSpot,
          syncReserveJoinButtonLabel
        };
      }

      // src/hitbox/scoreboard-adapter.ts
      function getScorePlayers(session) {
        const players = readNativePath(session, ["KR", "uL", "Ho"]);
        return Array.isArray(players) ? players.filter(Boolean) : [];
      }

      // src/features/score-row-color-values.ts
      function parseCssRgbColor(value) {
        if (typeof value !== "string") {
          return null;
        }
        const match = value.match(
          /^rgba?\(\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)\s*,\s*(\d+(?:\.\d+)?)(?:\s*,\s*(\d+(?:\.\d+)?))?\s*\)$/i
        );
        if (!match) {
          return null;
        }
        return {
          red: Math.max(0, Math.min(255, Math.round(Number(match[1])))),
          green: Math.max(0, Math.min(255, Math.round(Number(match[2])))),
          blue: Math.max(0, Math.min(255, Math.round(Number(match[3])))),
          alpha: match[4] === void 0 ? 1 : Math.max(0, Math.min(1, Number(match[4])))
        };
      }
      function parseNumericRgbColor(value) {
        const color = Number(value);
        if (!Number.isFinite(color) || color < 0 || color > 16777215) {
          return null;
        }
        return {
          red: color >> 16 & 255,
          green: color >> 8 & 255,
          blue: color & 255,
          alpha: 1
        };
      }
      function parseHexRgbColor(value) {
        if (typeof value !== "string") {
          return null;
        }
        const normalized = value.trim().replace(/^#|^0x/i, "");
        if (!/^[0-9a-f]{6}$/i.test(normalized)) {
          return null;
        }
        return parseNumericRgbColor(Number.parseInt(normalized, 16));
      }
      function parsePlayerRgbColor(value) {
        return typeof value === "number" ? parseNumericRgbColor(value) : parseCssRgbColor(value) || parseHexRgbColor(value);
      }
      function colorsMatch(left, right) {
        return Boolean(
          left && right && left.red === right.red && left.green === right.green && left.blue === right.blue
        );
      }
      function getElementBackgroundColor(element) {
        return isStyledElement(element) && typeof element.style.backgroundColor === "string" ? element.style.backgroundColor : "";
      }
      function blendRgbColors(foreground, background) {
        const alpha = foreground.alpha;
        return {
          red: Math.round(foreground.red * alpha + background.red * (1 - alpha)),
          green: Math.round(foreground.green * alpha + background.green * (1 - alpha)),
          blue: Math.round(foreground.blue * alpha + background.blue * (1 - alpha)),
          alpha: 1
        };
      }
      function getRelativeLuminance(color) {
        const channels = [color.red, color.green, color.blue].map((value) => {
          const normalized = value / 255;
          return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
        });
        return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
      }
      function getContrastRatio(left, right) {
        const leftLuminance = getRelativeLuminance(left);
        const rightLuminance = getRelativeLuminance(right);
        const lighter = Math.max(leftLuminance, rightLuminance);
        const darker = Math.min(leftLuminance, rightLuminance);
        return (lighter + 0.05) / (darker + 0.05);
      }
      function getEffectiveBackgroundColor(element) {
        let current = element;
        let color = { red: 10, green: 10, blue: 10, alpha: 1 };
        const layers = [];
        while (current) {
          const background = parseCssRgbColor(window.getComputedStyle(current).backgroundColor);
          if (background && background.alpha > 0) {
            layers.unshift(background);
            if (background.alpha >= 1) {
              break;
            }
          }
          current = current.parentElement;
        }
        for (const layer of layers) {
          color = layer.alpha >= 1 ? { ...layer, alpha: 1 } : blendRgbColors(layer, color);
        }
        return color;
      }
      function getReadableTextColor(background) {
        const dark = { red: 0, green: 0, blue: 0, alpha: 1 };
        const light = { red: 255, green: 255, blue: 255, alpha: 1 };
        return getContrastRatio(dark, background) >= getContrastRatio(light, background) ? dark : light;
      }
      function toCssRgb(color) {
        return `rgb(${color.red}, ${color.green}, ${color.blue})`;
      }

      // src/features/score-row-colors.ts
      var MIN_SCORE_TEXT_CONTRAST = 4.5;
      function normalizeScoreName(value) {
        return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
      }
      function getScoreRowName(row) {
        const nameElement = row && row.querySelector ? row.querySelector(".name") : null;
        return normalizeScoreName(nameElement ? nameElement.textContent : row && row.textContent);
      }
      function createScoreRowColorController(options) {
        const scoreRowColorsByKey = /* @__PURE__ */ new Map();
        function isFallbackScoreRowColor(color) {
          return colorsMatch(color, options.fallbackRgb);
        }
        function getPlayerDirectScoreColor(player) {
          for (const value of getPlayerColorCandidates(player)) {
            const parsed = parsePlayerRgbColor(value);
            if (parsed) {
              return parsed;
            }
          }
          return null;
        }
        function getScoreRowColorKeys(row, player) {
          const keys = /* @__PURE__ */ new Set();
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
        function rememberScoreRowColor(keys, color) {
          if (!color || isFallbackScoreRowColor(color)) {
            return;
          }
          for (const key of keys) {
            scoreRowColorsByKey.set(key, { ...color, alpha: 1 });
          }
        }
        function getRememberedScoreRowColor(keys) {
          for (const key of keys) {
            const color = scoreRowColorsByKey.get(key);
            if (color) {
              return color;
            }
          }
          return null;
        }
        function getTeamScoreColor(player) {
          return options.teamScoreColors.get(options.getPlayerTeamState(player)) || null;
        }
        function getPlayerScoreColor(row, player) {
          const keys = getScoreRowColorKeys(row, player);
          return getPlayerDirectScoreColor(player) || getRememberedScoreRowColor(keys) || getTeamScoreColor(player);
        }
        function syncScoreRowTextContrast(row) {
          const background = getEffectiveBackgroundColor(row);
          const readableColor = toCssRgb(getReadableTextColor(background));
          let changed = false;
          const textElements = [row, ...Array.from(row.querySelectorAll(".number, .name"))];
          for (const element of textElements) {
            if (!(element.textContent || "").trim()) {
              continue;
            }
            const currentColor = parseCssRgbColor(window.getComputedStyle(element).color);
            if (currentColor && getContrastRatio(currentColor, background) >= MIN_SCORE_TEXT_CONTRAST) {
              continue;
            }
            options.setImportantStyle(element, "color", readableColor);
            changed = true;
          }
          return changed;
        }
        function getUniquePlayersByName(players) {
          const playersByName = /* @__PURE__ */ new Map();
          for (const player of players) {
            const name = normalizeScoreName(getPlayerDisplayName(player));
            if (!name) {
              continue;
            }
            playersByName.set(name, playersByName.has(name) ? null : player);
          }
          return playersByName;
        }
        function syncScoreRowsFromPlayers(scorePanel) {
          const rows = Array.from(scorePanel.querySelectorAll(".entryContainer"));
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
            options.setImportantStyle(row, "background-color", `rgb(${playerColor.red}, ${playerColor.green}, ${playerColor.blue})`);
            syncScoreRowTextContrast(row);
            changed = true;
          });
          return changed;
        }
        function syncAllScoreRowsFromPlayers() {
          let changed = false;
          for (const scorePanel of document.querySelectorAll(".scores")) {
            changed = syncScoreRowsFromPlayers(scorePanel) || changed;
          }
          return changed;
        }
        function makeScoreRowsOpaque(scorePanel) {
          const rows = Array.from(scorePanel.querySelectorAll(".entryContainer"));
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
                "background-color",
                `rgb(${parsedColor.red}, ${parsedColor.green}, ${parsedColor.blue})`
              );
            }
            syncScoreRowTextContrast(row);
          });
        }
        return {
          makeScoreRowsOpaque,
          syncAllScoreRowsFromPlayers,
          syncScoreRowsFromPlayers
        };
      }

      // src/hitbox/typing-pulse-adapter.ts
      function isNativeCallable9(value) {
        return typeof value === "function";
      }
      function getNativeLobbyUi(session) {
        const lobbyUi = readNativeProperty(session, "TJ");
        return isNativeObject(lobbyUi) ? lobbyUi : null;
      }
      function isNativeTypingPulseHookInstalled(session) {
        return Boolean(readNativeProperty(getNativeLobbyUi(session), "__qolboxTypingIndicatorPatched"));
      }
      function installNativeTypingPulseHook(session, onTypingPulse) {
        const lobbyUi = getNativeLobbyUi(session);
        if (!lobbyUi || isNativeTypingPulseHookInstalled(session)) {
          return Boolean(lobbyUi);
        }
        const nativeTypingPulse = readNativeProperty(lobbyUi, "$W");
        if (!isNativeCallable9(nativeTypingPulse)) {
          return false;
        }
        const wrappedTypingPulse = function wrappedTypingPulse2(playerId, ...rest) {
          onTypingPulse(playerId);
          return Reflect.apply(nativeTypingPulse, this, [playerId, ...rest]);
        };
        setNativeReflectProperty(lobbyUi, "$W", wrappedTypingPulse);
        setNativeReflectProperty(lobbyUi, "__qolboxTypingIndicatorOriginal", nativeTypingPulse);
        setNativeReflectProperty(lobbyUi, "__qolboxTypingIndicatorPatched", true);
        return true;
      }

      // src/features/typing-expiration-tracker.ts
      function createTypingExpirationTracker(options) {
        const timers = /* @__PURE__ */ new Map();
        const expirations = /* @__PURE__ */ new Map();
        function clear() {
          for (const timer of timers.values()) {
            window.clearTimeout(timer);
          }
          timers.clear();
          expirations.clear();
        }
        function isTyping(playerId) {
          const id = String(playerId);
          const expiresAt = expirations.get(id);
          if (!expiresAt) {
            return false;
          }
          if (expiresAt <= Date.now()) {
            expirations.delete(id);
            return false;
          }
          return true;
        }
        function note(playerId) {
          if (playerId === null || playerId === void 0) {
            return false;
          }
          const id = String(playerId);
          const timeoutMs = options.getTimeoutMs();
          const expiresAt = Date.now() + timeoutMs;
          const existingTimer = timers.get(id);
          if (existingTimer) {
            window.clearTimeout(existingTimer);
          }
          expirations.set(id, expiresAt);
          timers.set(
            id,
            window.setTimeout(() => {
              if ((expirations.get(id) || 0) <= Date.now()) {
                expirations.delete(id);
                timers.delete(id);
                options.onExpire();
              }
            }, timeoutMs + 50)
          );
          return true;
        }
        return {
          clear,
          isTyping,
          note
        };
      }

      // src/features/typing-score-indicators.ts
      function clearScoreTypingIndicators() {
        for (const indicator of document.querySelectorAll(".qolboxTypingIndicator")) {
          indicator.remove();
        }
      }
      function syncScoreTypingIndicators(scorePanel, typingPlayers) {
        const panels = scorePanel ? [scorePanel] : Array.from(document.querySelectorAll(".scores"));
        let changed = false;
        for (const panel of panels) {
          for (const row of panel.querySelectorAll(".entryContainer")) {
            const nameElement = row.querySelector(".name") || row;
            const rowName = getScoreRowName(row);
            const rowText = normalizeScoreName(row.textContent);
            const isTyping = typingPlayers.some(
              (entry) => entry.name && (entry.name === rowName || rowText.includes(entry.name))
            );
            const indicator = nameElement.querySelector(".qolboxTypingIndicator");
            if (isTyping && !indicator) {
              const newIndicator = document.createElement("span");
              newIndicator.className = "qolboxTypingIndicator";
              newIndicator.setAttribute("aria-label", "typing");
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

      // src/features/typing-world-indicators.ts
      function ensureWorldTypingLayer() {
        if (!document.body) {
          return null;
        }
        const existingLayer = document.querySelector(".qolboxWorldTypingLayer");
        if (existingLayer) {
          return existingLayer;
        }
        const layer = document.createElement("div");
        layer.className = "qolboxWorldTypingLayer";
        layer.setAttribute("aria-hidden", "true");
        document.body.appendChild(layer);
        return layer;
      }
      function createWorldTypingIndicatorController(options) {
        let typingIndicatorPositionRaf = 0;
        function stopTypingIndicatorPositionLoop() {
          if (!typingIndicatorPositionRaf) {
            return;
          }
          if (typeof window.cancelAnimationFrame === "function") {
            window.cancelAnimationFrame(typingIndicatorPositionRaf);
          } else {
            window.clearTimeout(typingIndicatorPositionRaf);
          }
          typingIndicatorPositionRaf = 0;
        }
        function syncWorldTypingIndicators(typingPlayers, session = options.getSession()) {
          const shouldShowWorldIndicators = options.isChatFeatureEnabled() && options.isSessionMatchActive(session) && typingPlayers.length > 0;
          const existingLayer = document.querySelector(".qolboxWorldTypingLayer");
          if (!shouldShowWorldIndicators) {
            if (existingLayer) {
              existingLayer.remove();
              return true;
            }
            return false;
          }
          const layer = ensureWorldTypingLayer();
          if (!layer) {
            return false;
          }
          const activeIds = /* @__PURE__ */ new Set();
          let changed = false;
          for (const player of typingPlayers) {
            const position = options.getWorldTypingPosition(player.id, session);
            if (!position) {
              continue;
            }
            const id = String(player.id);
            activeIds.add(id);
            let indicator = Array.from(layer.querySelectorAll(".qolboxWorldTypingIndicator")).find(
              (element) => element.dataset.playerId === id
            );
            if (!indicator) {
              indicator = document.createElement("span");
              indicator.className = "qolboxWorldTypingIndicator";
              indicator.dataset.playerId = id;
              indicator.setAttribute("aria-label", "typing");
              layer.appendChild(indicator);
              changed = true;
            }
            const left = `${Math.round(position.left)}px`;
            const top = `${Math.round(position.top)}px`;
            if (indicator.style.left !== left) {
              indicator.style.left = left;
            }
            if (indicator.style.top !== top) {
              indicator.style.top = top;
            }
          }
          for (const indicator of Array.from(layer.querySelectorAll(".qolboxWorldTypingIndicator"))) {
            if (!activeIds.has(indicator.dataset.playerId || "")) {
              indicator.remove();
              changed = true;
            }
          }
          if (!activeIds.size && layer.children.length === 0) {
            layer.remove();
            changed = true;
          }
          return changed;
        }
        function scheduleTypingIndicatorPositionLoop(session = options.getSession()) {
          if (typingIndicatorPositionRaf || !options.isSessionMatchActive(session)) {
            return;
          }
          const updateTypingIndicatorPositions = () => {
            typingIndicatorPositionRaf = 0;
            if (!options.isChatFeatureEnabled() || !options.isSessionMatchActive()) {
              syncWorldTypingIndicators([], options.getSession());
              return;
            }
            const typingPlayers = options.getTypingPlayers();
            syncWorldTypingIndicators(typingPlayers);
            if (typingPlayers.length > 0) {
              scheduleTypingIndicatorPositionLoop();
            }
          };
          typingIndicatorPositionRaf = typeof window.requestAnimationFrame === "function" ? window.requestAnimationFrame(updateTypingIndicatorPositions) : window.setTimeout(updateTypingIndicatorPositions, options.fallbackUpdateDelayMs);
        }
        function clearWorldTypingIndicators() {
          stopTypingIndicatorPositionLoop();
          const worldLayer = document.querySelector(".qolboxWorldTypingLayer");
          if (worldLayer) {
            worldLayer.remove();
          }
        }
        return {
          clearWorldTypingIndicators,
          scheduleTypingIndicatorPositionLoop,
          stopTypingIndicatorPositionLoop,
          syncWorldTypingIndicators
        };
      }

      // src/features/typing-indicators.ts
      function createTypingIndicatorController(options) {
        let typingIndicatorSession = null;
        const typingExpirations = createTypingExpirationTracker({
          getTimeoutMs: options.getTimeoutMs,
          onExpire: () => syncTypingIndicators()
        });
        const worldTypingIndicators = createWorldTypingIndicatorController({
          fallbackUpdateDelayMs: 100,
          getSession: options.getSession,
          getTypingPlayers,
          getWorldTypingPosition: options.getWorldTypingPosition,
          isChatFeatureEnabled: options.isChatFeatureEnabled,
          isSessionMatchActive: options.isSessionMatchActive
        });
        function clearTypingIndicators() {
          worldTypingIndicators.clearWorldTypingIndicators();
          typingExpirations.clear();
          clearScoreTypingIndicators();
        }
        function isPlayerTypingNow(playerId) {
          return typingExpirations.isTyping(playerId);
        }
        function getTypingPlayers(session = options.getSession()) {
          const localPlayerId = options.getLocalPlayerId(session);
          return options.getSessionPlayers(session).filter(({ id }) => !options.isSamePlayerId(id, localPlayerId) && isPlayerTypingNow(id)).map(({ id, player }) => ({
            id,
            name: normalizeScoreName(getPlayerDisplayName(player))
          }));
        }
        function syncWorldTypingIndicators(typingPlayers, session = options.getSession()) {
          return worldTypingIndicators.syncWorldTypingIndicators(typingPlayers, session);
        }
        function scheduleTypingIndicatorPositionLoop(session = options.getSession()) {
          worldTypingIndicators.scheduleTypingIndicatorPositionLoop(session);
        }
        function syncTypingIndicators(scorePanel = null) {
          if (!options.isChatFeatureEnabled()) {
            clearTypingIndicators();
            return false;
          }
          const session = options.getSession();
          if (!session) {
            worldTypingIndicators.stopTypingIndicatorPositionLoop();
            return false;
          }
          const typingPlayers = getTypingPlayers(session);
          let changed = syncScoreTypingIndicators(scorePanel, typingPlayers);
          changed = syncWorldTypingIndicators(typingPlayers, session) || changed;
          if (typingPlayers.length > 0 && options.isSessionMatchActive(session)) {
            scheduleTypingIndicatorPositionLoop(session);
          } else {
            worldTypingIndicators.stopTypingIndicatorPositionLoop();
          }
          return changed;
        }
        function notePlayerTyping(playerId) {
          if (!options.isChatFeatureEnabled()) {
            clearTypingIndicators();
            return false;
          }
          if (playerId === null || playerId === void 0) {
            return false;
          }
          if (options.isSamePlayerId(playerId, options.getLocalPlayerId())) {
            return false;
          }
          typingExpirations.note(playerId);
          syncTypingIndicators();
          return true;
        }
        function patchTypingIndicatorHooks() {
          if (!options.isChatFeatureEnabled()) {
            clearTypingIndicators();
            return false;
          }
          const session = options.getSession();
          if (isNativeTypingPulseHookInstalled(session)) {
            return true;
          }
          if (typingIndicatorSession && typingIndicatorSession !== session) {
            clearTypingIndicators();
          }
          const installed = installNativeTypingPulseHook(session, notePlayerTyping);
          if (installed) {
            typingIndicatorSession = session;
          }
          return installed;
        }
        return {
          clearTypingIndicators,
          notePlayerTyping,
          patchTypingIndicatorHooks,
          syncTypingIndicators,
          syncWorldTypingIndicators
        };
      }

      // src/hitbox/world-state-adapter.ts
      function hasForEach(value) {
        return isNativeObject(value) && typeof readNativeProperty(value, "forEach") === "function";
      }
      function getCollectionEntries(collection) {
        if (!collection) {
          return [];
        }
        if (Array.isArray(collection)) {
          return collection.map((value, key) => ({ key, value })).filter((entry) => entry.value);
        }
        if (collection instanceof Map) {
          const entries = [];
          collection.forEach((value, key) => {
            if (value) {
              entries.push({ key, value });
            }
          });
          return entries;
        }
        if (hasForEach(collection)) {
          const entries = [];
          collection.forEach((value, key) => {
            if (value) {
              entries.push({ key, value });
            }
          });
          return entries;
        }
        if (!isNativeObject(collection)) {
          return [];
        }
        return Object.keys(collection).map((key) => ({ key, value: readNativeProperty(collection, key) })).filter((entry) => entry.value);
      }
      function readFiniteNumber(source, property) {
        const value = Number(readNativeProperty(source, property));
        return Number.isFinite(value) ? value : null;
      }
      function getPlayerWorldEntityPosition(playerId, session) {
        const sources = [
          // Live match entities observed during gameplay.
          readNativePath(session, ["KR", "uL", "Ho"]),
          // Alternate player collection observed around match/lobby transitions.
          readNativePath(session, ["KR", "mL", "Pi"])
        ];
        for (const source of sources) {
          for (const { key, value } of getCollectionEntries(source)) {
            const id = readNativeProperty(value, "id") !== void 0 ? readNativeProperty(value, "id") : key;
            const x = readFiniteNumber(value, "x");
            const y = readFiniteNumber(value, "y");
            if (isSamePlayerId(id, playerId) && x !== null && y !== null) {
              return { x, y };
            }
          }
        }
        return null;
      }
      function getWorldCameraState(session) {
        const camera = readNativePath(session, ["KR", "ed"]) || readNativePath(session, ["KR", "hb", "Bc"]);
        return {
          width: Number(readNativeProperty(camera, "fc")),
          height: Number(readNativeProperty(camera, "gc")),
          left: Number(readNativeProperty(camera, "yc")),
          top: Number(readNativeProperty(camera, "vc"))
        };
      }

      // src/features/world-typing-position.ts
      function createWorldTypingPositioner(options) {
        function getPlayerWorldEntity(playerId, session = options.getSession()) {
          return getPlayerWorldEntityPosition(playerId, session);
        }
        function getWorldTypingViewport(session = options.getSession()) {
          const canvas = options.getActiveGameplayCanvas();
          if (!canvas || !isElementVisible(canvas)) {
            return null;
          }
          const rect = canvas.getBoundingClientRect();
          const camera = getWorldCameraState(session);
          const baseGameSize = options.getBaseGameSize();
          return {
            rect,
            worldLeft: Number.isFinite(camera.left) ? camera.left : 0,
            worldTop: Number.isFinite(camera.top) && camera.top >= 0 ? camera.top : 0,
            worldWidth: Number.isFinite(camera.width) && camera.width > 0 ? camera.width : baseGameSize.width,
            worldHeight: Number.isFinite(camera.height) && camera.height > 0 ? camera.height : (Number.isFinite(camera.width) && camera.width > 0 ? camera.width : baseGameSize.width) * (rect.height / rect.width)
          };
        }
        function getWorldTypingPosition(playerId, session = options.getSession()) {
          const entity = getPlayerWorldEntity(playerId, session);
          const viewport = getWorldTypingViewport(session);
          if (!entity || !viewport) {
            return null;
          }
          const { rect, worldLeft, worldTop, worldWidth, worldHeight } = viewport;
          const rectRight = Number.isFinite(rect.right) ? rect.right : rect.left + rect.width;
          const rectBottom = Number.isFinite(rect.bottom) ? rect.bottom : rect.top + rect.height;
          const x = rect.left + (entity.x - worldLeft) / worldWidth * rect.width;
          const y = rect.top + (entity.y - worldTop) / worldHeight * rect.height - 42;
          return {
            left: Math.max(rect.left + 11, Math.min(rectRight - 11, x)),
            top: Math.max(rect.top + 18, Math.min(rectBottom - 6, y))
          };
        }
        return {
          getPlayerWorldEntity,
          getWorldTypingPosition,
          getWorldTypingViewport
        };
      }

      // src/features/typing-feature-bundle.ts
      function createTypingFeatureBundle(options) {
        const scoreRows = createScoreRowColorController({
          fallbackRgb: SCORE_ROW_FALLBACK_RGB,
          teamScoreColors: TEAM_SCORE_COLORS,
          getPlayerTeamState,
          getScorePlayers: () => getScorePlayers(getMultiplayerSession()),
          setImportantStyle: options.setImportantStyle
        });
        const { getWorldTypingPosition } = createWorldTypingPositioner({
          getActiveGameplayCanvas: () => options.getActiveRenderCanvas("gameplay"),
          getBaseGameSize: options.getBaseGameSize,
          getSession: getMultiplayerSession
        });
        const typingIndicators = createTypingIndicatorController({
          getTimeoutMs: getAdvancedTypingIndicatorDurationMs,
          getLocalPlayerId,
          getSession: getMultiplayerSession,
          getSessionPlayers,
          getWorldTypingPosition,
          isChatFeatureEnabled: options.isChatFeatureEnabled,
          isSamePlayerId,
          isSessionMatchActive
        });
        return {
          ...scoreRows,
          ...typingIndicators,
          getWorldTypingPosition
        };
      }

      // src/app/qolbox-app.ts
      (function() {
        "use strict";
        if (!shouldRunGamePageBootstrap()) {
          return;
        }
        function scheduleAppUiWork(request) {
          scheduleUiWork(request);
        }
        const { isFeatureEnabled, setAllFeatureSettings, setFeatureEnabled, shouldRunFeature } = createFeatureSettingsController({
          isOnboardingComplete: () => qolboxMenuController.isOnboardingComplete(),
          onApplyFeatureRootClasses: () => applyFeatureRootClasses(),
          onApplyPersistentFeatures: () => applyPersistentFeatures(),
          onDisableFeatureSideEffects: (featureKey) => disableFeatureSideEffects(featureKey),
          onRenderMenu: () => renderQolboxMenu(),
          onScheduleUiWork: scheduleAppUiWork,
          resizeSettlePasses: RESIZE_SETTLE_PASSES
        });
        const featureGates = createFeatureGateSet(shouldRunFeature);
        const { patchEditorMapFileTransfer, removeEditorMapFileTransfer } = createEditorMapFileTransferController({
          isEditorMapTransferEnabled: featureGates.isEditorMapTransferEnabled
        });
        const { cleanupInGameChatScroll, patchInGameChatScroll } = createInGameChatScrollController({
          isChatFeatureEnabled: featureGates.isChatEnabled
        });
        const {
          getAdvancedSettings,
          setAdvancedSetting,
          setAdvancedSettings
        } = createAdvancedSettingsController({
          onApplyPersistentFeatures: () => applyPersistentFeatures(),
          onRenderMenu: () => renderQolboxMenu(),
          onScheduleLayoutRefresh: () => scheduleAppUiWork({ force: true, features: true, passes: FULLSCREEN_SETTLE_PASSES })
        });
        const {
          applyPersistentFeatures,
          disableFeatureSideEffects
        } = createFeatureSideEffectsController({
          applyFeatureRootClasses: () => applyFeatureRootClasses(),
          applyGameVolume: () => applyGameVolume(),
          applyJukeboxState: () => applyJukeboxState(),
          clearFullscreenLayoutStyles: () => clearFullscreenLayoutStyles(),
          clearReservePasswordPromptPending: () => clearReservePasswordPromptPending(),
          clearTypingIndicators: () => clearTypingIndicators(),
          cleanupInGameChatScroll: () => cleanupInGameChatScroll(),
          disableGameStartAlerts: () => disableGameStartAlerts(),
          hookHowlPrototype: () => hookHowlPrototype(),
          hookYouTubePlayer: () => hookYouTubePlayer(),
          installGameStartIndicatorHooks: () => installGameStartIndicatorHooks(),
          installPlayerPopupDismissal: () => installPlayerPopupDismissal2(),
          installTabFocusHooks: () => installTabFocusHooks(),
          installYouTubeReadyCallbackHook: () => installYouTubeReadyCallbackHook(),
          patchChatTabOrder: () => patchChatTabOrder(),
          patchEditorMapFileTransfer: () => patchEditorMapFileTransfer(),
          patchInGameChatScroll,
          patchGameVolumeMenu: () => patchGameVolumeMenu(),
          patchJukeboxKnob: () => patchJukeboxKnob(),
          patchJukeboxMenu: () => patchJukeboxMenu(),
          patchLobbyMusicController: () => patchLobbyMusicController(),
          patchLobbyBlacklist: () => patchLobbyBlacklist(),
          patchMobileGrabButton: () => patchMobileGrabButton(),
          patchMobileQolboxHamburgerEntry: () => patchMobileQolboxHamburgerEntry(),
          patchReserveSpotFeature: () => patchReserveSpotFeature(),
          patchSlashCommands: () => patchSlashCommands(),
          patchSwitchTeamsButton: () => patchSwitchTeamsButton(),
          patchTypingIndicatorHooks: () => patchTypingIndicatorHooks(),
          removeEditorMapFileTransfer: () => removeEditorMapFileTransfer(),
          removeJukeboxMenuItem: () => removeJukeboxMenuItem(),
          removeMobileGrabButton: () => removeMobileGrabButton(),
          removeSwitchTeamsButton: () => removeSwitchTeamsButton(),
          restoreChatTabOrder: () => restoreChatTabOrder(),
          restoreJukeboxState: () => restoreJukeboxState(),
          featureGates,
          stopReserveSpot: (options) => stopReserveSpot(options),
          syncScoreRows: () => syncAllScoreRowsFromPlayers(),
          syncReserveJoinButtonLabel: () => syncReserveJoinButtonLabel(),
          syncTypingIndicators: () => syncTypingIndicators(),
          updateGameStartIndicator: () => updateGameStartIndicator()
        });
        const {
          clearReservePasswordPromptPending,
          getReserveState,
          installReserveSocketCaptureHook,
          isReserveRetryAudioSuppressed,
          patchReserveSpotFeature,
          stopReserveSpot,
          syncReserveJoinButtonLabel
        } = createReserveFeatureBundle({
          hasSuccessfulJoinLayer: () => hasReserveSuccessfulJoinLayer(),
          isReserveEnabled: featureGates.isReserveEnabled
        });
        const {
          handleMobileGrabPointerStart,
          hideMobileGrabButton,
          isMobileGameMode,
          isMobileQolboxMenuContext,
          layoutMobileGrabButton,
          patchMobileGrabButton,
          removeMobileGrabButton,
          setMobileGrabPressed,
          shouldShowMobileGrabButton,
          syncMobileGrabButton,
          patchMobileQolboxHamburgerEntry
        } = createMobileFeatureBundle({
          isMobileGrabEnabled: featureGates.isMobileGrabEnabled,
          openMenu: () => openQolboxMenu(qolboxMenuController.isOnboardingComplete() ? "settings" : "onboarding")
        });
        const {
          clearGameStartIndicator,
          disableGameStartAlerts,
          handleGameStartInteractionFocus,
          hasPendingLocalPlayTransition,
          hasReserveSuccessfulJoinLayer,
          installGameStartIndicatorHooks,
          isCurrentPlayerSpectating,
          isMenuGameplayOverlap,
          isPageFocused,
          isPlayableLobby,
          isPlayingMatch,
          noteLocallyInitiatedPlayTransition,
          patchMultiplayerSessionGameStartHooks,
          setGameStartPageFocused,
          setGameStartWasInLobbyWhenUnfocused,
          setGameStartWasPlayingWhenUnfocused,
          updateGameStartIndicator
        } = createGameplayAlertFeatureBundle({
          isGameStartAlertEnabled: featureGates.isGameStartAlertEnabled
        });
        const { applyFeatureRootClasses, ensureGlobalStyle } = createQolboxShellFeatureBundle({
          isMenuClosed: () => qolboxMenuController.isClosed(),
          isFeatureActive: featureGates.shouldRunFeature
        });
        const {
          buildFullscreenSignature,
          clearFullscreenStyleSnapshots,
          getActiveRenderCanvas,
          getActiveRenderMode,
          getBaseGameSize,
          getFullscreenDimensions,
          getLayoutProbe,
          getNativeUiZoom,
          getRelativeContainerBounds,
          installNativeFullscreenPatch,
          isEditorCanvas,
          isEditorLayer,
          isNativeProbeAligned,
          isRenderProbeAligned,
          restoreFullscreenStyles,
          restoreNativeFullscreenPatch,
          restoreNativeLayoutSizeFallback,
          runNativeResize,
          setImportantStyle,
          setNativeFullscreenSize,
          shouldWaitForNativeLayoutSeed
        } = createFullscreenFoundationBundle();
        const {
          captureGameplayInputFocus,
          focusActiveRenderCanvas,
          handleGameplayBackgroundFocus,
          installChatCommandAliasHooks,
          installChatEscapeHooks,
          installGameplayBackgroundFocusHooks,
          isChatInput,
          patchChatTabOrder,
          resetBrowserScroll,
          restoreChatTabOrder,
          restoreLobbyChatPrompt,
          shouldCaptureGameplayBackgroundFocus
        } = createInputFocusFeatureBundle({
          getActiveRenderCanvas,
          isChatFeatureEnabled: featureGates.isChatEnabled,
          areLobbyCommandsEnabled: featureGates.isLobbyCommandsEnabled,
          isPlayingMatch,
          isQolboxMenuClosed: () => qolboxMenuController.isClosed()
        });
        const {
          clearTypingIndicators,
          getWorldTypingPosition,
          makeScoreRowsOpaque,
          notePlayerTyping,
          patchTypingIndicatorHooks,
          syncAllScoreRowsFromPlayers,
          syncScoreRowsFromPlayers,
          syncTypingIndicators,
          syncWorldTypingIndicators
        } = createTypingFeatureBundle({
          getActiveRenderCanvas,
          getBaseGameSize,
          isChatFeatureEnabled: featureGates.isChatEnabled,
          setImportantStyle
        });
        const {
          clearFullscreenLayoutStyles,
          enforceFullscreenLayout,
          fitEditorCanvasToNative,
          fitEditorLayerToFrame,
          getScaledEditorFrame,
          installGameReadyHook,
          layoutRelativeHud,
          refreshObservedResizeTargets,
          resizeKnownFullscreenRenderers: resizeKnownFullscreenRenderers2,
          setFullscreenResizeObserver,
          syncSpectateControlsBottomWithJukebox
        } = createFullscreenLayoutFeatureBundle({
          clearFullscreenSignature: () => clearFullscreenSignature(),
          clearFullscreenStyleSnapshots,
          ensureGlobalStyle,
          getFullscreenDimensions,
          getNativeUiZoom,
          getRelativeContainerBounds,
          isEditorCanvas,
          isEditorLayer,
          isFullscreenEnabled: featureGates.isFullscreenEnabled,
          makeScoreRowsOpaque,
          restoreFullscreenStyles,
          restoreNativeFullscreenPatch,
          restoreNativeLayoutSizeFallback,
          scheduleUiWork: scheduleAppUiWork,
          setImportantStyle,
          syncScoreRowsFromPlayers,
          syncTypingIndicators
        });
        const qolboxMenuController = createQolboxMenuFeatureBundle({
          applyFeatureRootClasses,
          applyPersistentFeatures,
          ensureGlobalStyle,
          getAdvancedSettings,
          isFeatureEnabled,
          scheduleUiWork: scheduleAppUiWork,
          setAdvancedSettings,
          setAllFeatureSettings,
          setFeatureEnabled
        });
        const { getOnboardingSteps, installQolboxMenuHooks, openQolboxMenu, renderQolboxMenu, scheduleFirstBootOnboarding } = qolboxMenuController;
        const { handlePopupKeyboard, installPopupKeyboardHooks } = createPopupKeyboardController();
        const {
          applyGameVolume,
          applyJukeboxState,
          getEffectiveJukeboxPercent,
          hookHowlPrototype,
          hookYouTubePlayer,
          installTabFocusHooks,
          installYouTubeReadyCallbackHook,
          patchGameVolumeMenu,
          patchJukeboxKnob,
          patchJukeboxMenu,
          patchLobbyMusicController,
          removeJukeboxMenuItem,
          restoreJukeboxState,
          setJukeboxState,
          stopLobbyMusicIfNeeded
        } = createAudioFeatureBundle({
          focusActiveRenderCanvas,
          getActiveRenderCanvas,
          getActiveRenderMode,
          isAudioEnabled: featureGates.isAudioEnabled,
          isChatInput,
          isReserveRetryAudioSuppressed: () => Boolean(
            featureGates.isReserveEnabled() && getReserveState()?.active && isReserveRetryAudioSuppressed()
          ),
          resetBrowserScroll,
          scheduleUiWork: scheduleAppUiWork
        });
        const {
          endCurrentGame,
          findPlayerByName: findPlayerByName2,
          installPlayerPopupDismissal: installPlayerPopupDismissal2,
          handleJoinSlashCommand,
          handleQolboxSlashCommand,
          handleBlacklistSlashCommand,
          handleSpecSlashCommand,
          patchSlashCommands,
          patchLobbyBlacklist,
          enforceBlacklist,
          patchSwitchTeamsButton,
          requestBulkTeamState,
          requestTeamState,
          restartCurrentGame,
          removeSwitchTeamsButton,
          showAllHostSettings,
          switchTeamPlayers
        } = createLobbyCommandsFeatureBundle({
          areGameStartAlertsEnabled: featureGates.isGameStartAlertEnabled,
          areLobbyCommandsEnabled: featureGates.isLobbyCommandsEnabled,
          isBlacklistEnforcementEnabled: () => isAdvancedBlacklistEnforcementEnabled(getAdvancedSettings()),
          installStartAlertHooks: (session) => patchMultiplayerSessionGameStartHooks(session),
          isCurrentPlayerSpectating,
          noteLocallyInitiatedPlayTransition,
          setBlacklistEnforcementEnabled: (enabled) => setAdvancedSetting(ADVANCED_BLACKLIST_ENFORCEMENT, enabled)
        });
        const {
          clearFullscreenSignature,
          installFullscreenHooks,
          scheduleUiWork
        } = createFullscreenOrchestrationBundle({
          applyFeatureRootClasses,
          applyPersistentFeatures,
          buildFullscreenSignature,
          clearFullscreenLayoutStyles,
          enforceFullscreenLayout,
          ensureGlobalStyle,
          getFullscreenDimensions,
          getLayoutProbe,
          installChatCommandAliasHooks,
          installChatEscapeHooks,
          installGameReadyHook,
          installGameStartIndicatorHooks,
          installGameplayBackgroundFocusHooks,
          installQolboxMenuHooks,
          installReserveSocketCaptureHook,
          installTabFocusHooks,
          installNativeFullscreenPatch,
          isAudioEnabled: featureGates.isAudioEnabled,
          isFullscreenEnabled: featureGates.isFullscreenEnabled,
          isGameStartAlertEnabled: featureGates.isGameStartAlertEnabled,
          isMenuGameplayOverlap,
          isNativeProbeAligned,
          isRenderProbeAligned,
          isReserveEnabled: featureGates.isReserveEnabled,
          patchLobbyMusicController,
          refreshObservedResizeTargets,
          resizeKnownFullscreenRenderers: resizeKnownFullscreenRenderers2,
          runNativeResize,
          setFullscreenResizeObserver,
          setNativeFullscreenSize,
          shouldWaitForNativeLayoutSeed,
          stopLobbyMusicIfNeeded,
          syncSpectateControlsBottomWithJukebox,
          syncNonFullscreenHud: () => {
            if (featureGates.isChatEnabled()) {
              syncAllScoreRowsFromPlayers();
              syncTypingIndicators();
            }
          },
          updateGameStartIndicator
        });
        void captureGameplayInputFocus;
        void clearGameStartIndicator;
        void endCurrentGame;
        void enforceBlacklist;
        void findPlayerByName2;
        void fitEditorCanvasToNative;
        void fitEditorLayerToFrame;
        void getEffectiveJukeboxPercent;
        void getOnboardingSteps;
        void getScaledEditorFrame;
        void getWorldTypingPosition;
        void handleBlacklistSlashCommand;
        void handleGameStartInteractionFocus;
        void handleGameplayBackgroundFocus;
        void handleJoinSlashCommand;
        void handleMobileGrabPointerStart;
        void hideMobileGrabButton;
        void handlePopupKeyboard;
        void handleQolboxSlashCommand;
        void handleSpecSlashCommand;
        void hasPendingLocalPlayTransition;
        void isMobileGameMode;
        void isMobileQolboxMenuContext;
        void isPageFocused;
        void isPlayableLobby;
        void layoutMobileGrabButton;
        void layoutRelativeHud;
        void notePlayerTyping;
        void requestBulkTeamState;
        void requestTeamState;
        void restartCurrentGame;
        void restoreLobbyChatPrompt;
        void setGameStartPageFocused;
        void setGameStartWasInLobbyWhenUnfocused;
        void setGameStartWasPlayingWhenUnfocused;
        void setJukeboxState;
        void setMobileGrabPressed;
        void shouldCaptureGameplayBackgroundFocus;
        void shouldShowMobileGrabButton;
        void showAllHostSettings;
        void switchTeamPlayers;
        void syncAllScoreRowsFromPlayers;
        void syncMobileGrabButton;
        void syncWorldTypingIndicators;
        runQolboxStartupSequence({
          applyFeatureRootClasses,
          ensureGlobalStyle,
          installFullscreenHooks,
          installPopupKeyboardHooks,
          installQolboxMenuHooks,
          installReserveSocketCaptureHook,
          installYouTubeReadyCallbackHook,
          isAudioEnabled: featureGates.isAudioEnabled,
          isReserveEnabled: featureGates.isReserveEnabled,
          scheduleFirstBootOnboarding,
          scheduleUiWork
        });
      })();
    })();

  }

  installReleaseHistoryBridge();
  injectPageFunction(runQolboxPageApp, 'QOLBox.page.js');
})();
