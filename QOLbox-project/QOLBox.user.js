// ==UserScript==
// @name         QOLBox
// @namespace    Violentmonkey Scripts
// @author       AggressiveCombo
// @version      3.0.0
// @description  Sharp fullscreen, themes, sound banks, Reserve Spots, lobby tools, readable chat, alerts, mobile Grab, and an improved hitbox.io editor.
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
// @downloadURL https://update.greasyfork.org/scripts/568667/QOLBox.user.js
// @updateURL https://update.greasyfork.org/scripts/568667/QOLBox.meta.js
// ==/UserScript==
/*
# Third-party notices

## Lucide Icons

QOLBox includes SVG geometry from [Lucide](https://github.com/lucide-icons/lucide).

ISC License

Copyright (c) 2026 Lucide Icons and Contributors

Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted, provided that the above copyright notice and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.

Some included Lucide icons derive from Feather.

MIT License

Copyright (c) 2013-present Cole Bemis

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

## Tabler Icons

QOLBox's editor color-picker icon is from [Tabler Icons](https://github.com/tabler/tabler-icons).

MIT License

Copyright (c) 2020-2026 Paweł Kuna

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/
(() => {
  'use strict';

  const QOLBOX_BRIDGE_READY_SCRIPT = 'window.__qolboxReleaseHistoryBridgeReady = true;';
  const REQUEST_SOURCE = 'qolbox-release-history';
  const RESPONSE_SOURCE = 'qolbox-release-history-bridge';
  const REQUEST_TYPE = 'fetch';
  const RESPONSE_TYPE = 'fetch-result';
  const REQUEST_TIMEOUT_MS = 7000;
  const PAGE_APP_STATUS_TIMEOUT_MS = 5000;
  const PAGE_APP_STATUS_ATTRIBUTE = 'data-qolbox-page-app-status-' + Math.random().toString(36).slice(2);
  const MAX_REQUESTS_PER_PAGE = 4;
  const MAX_RESPONSE_LENGTH = 2 * 1024 * 1024;
  const ENDPOINTS = {
    github: {
      url: 'https://api.github.com/repos/AggressiveCombo/QOLBox/releases?per_page=100',
      accept: 'application/json',
    },
    greasyfork: {
      url: 'https://greasyfork.org/en/scripts/568667-qolbox/versions?show_all_versions=1',
      accept: 'text/html',
    },
  };
  let requestCount = 0;
  function injectPageScript(source, sourceName) {
    const script = document.createElement('script');
    script.textContent = source + '\n//# sourceURL=' + sourceName;
    const host = document.documentElement || document.head || document.body;
    if (!host) {
      document.addEventListener('DOMContentLoaded', () => injectPageScript(source, sourceName), { once: true });
      return;
    }
    host.appendChild(script);
    script.remove();
  }

  function injectPageFunction(fn, sourceName) {
    injectPageScript(
      'try { (' + fn.toString() + ')(); document.documentElement.setAttribute("' + PAGE_APP_STATUS_ATTRIBUTE + '", "ready"); } catch (error) { document.documentElement.setAttribute("' + PAGE_APP_STATUS_ATTRIBUTE + '", "error:" + String(error && error.message || error)); throw error; }',
      sourceName
    );
  }

  function installPageAppStatusWatch() {
    return () => window.setTimeout(() => {
      const status = document.documentElement.getAttribute(PAGE_APP_STATUS_ATTRIBUTE) || '';
      document.documentElement.removeAttribute(PAGE_APP_STATUS_ATTRIBUTE);
      if (status.startsWith('error:')) {
        console.error('[QOLBox] Page application failed to start:', status.slice(6) || 'unknown error');
      } else if (status !== 'ready') {
        console.error('[QOLBox] Page application did not start. Inline script injection may be blocked by CSP.');
      }
    }, PAGE_APP_STATUS_TIMEOUT_MS);
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
    if (!request || !/\/game2\.html$/i.test(window.location.pathname)) {
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
      const endpoint = typeof data.endpoint === 'string' ? ENDPOINTS[data.endpoint] : null;
      if (!id || !endpoint || requestCount >= MAX_REQUESTS_PER_PAGE) {
        postBridgeResponse(id, { ok: false, error: 'Release-history request was not allowed.' });
        return;
      }
      requestCount += 1;

      let settled = false;
      const details = {
        method: 'GET',
        url: endpoint.url,
        headers: { Accept: endpoint.accept },
        anonymous: true,
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
          const responseText = typeof response?.responseText === 'string' ? response.responseText : '';
          if (responseText.length > MAX_RESPONSE_LENGTH) {
            postBridgeResponse(id, {
              ok: false,
              status,
              error: 'Release-history response was too large.',
            });
            return;
          }
          postBridgeResponse(id, {
            ok: true,
            status,
            text: responseText,
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
        ".scores",
        ".spectateControls",
        ".rightClickMenu"
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
        ".mapListContainer",
        ".mapListContainer .topBar",
        ".mapListContainer .dropdownContainer .element",
        ".mapListContainer .secondaryContainer .secondaryElement",
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
      function isCallable(value) {
        return typeof value === "function";
      }
      function isRecord(value) {
        return typeof value === "object" && value !== null;
      }
      function isReflectableObject(value) {
        return typeof value === "object" && value !== null || typeof value === "function";
      }
      function readObjectProperty(source, property) {
        if (!isReflectableObject(source)) {
          return void 0;
        }
        try {
          return Reflect.get(source, property);
        } catch {
          return void 0;
        }
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
      function isExpectedGameFrameMessage(event) {
        if (!HITBOX_ORIGIN_PATTERN.test(event.origin)) {
          return false;
        }
        return Array.from(document.querySelectorAll("iframe")).some((frame) => {
          if (frame.contentWindow !== event.source) {
            return false;
          }
          try {
            const frameUrl = new URL(frame.src || frame.getAttribute("src") || "", document.baseURI);
            return frameUrl.origin === event.origin && /\/game2\.html$/i.test(frameUrl.pathname);
          } catch {
            return false;
          }
        });
      }
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
            if (!isExpectedGameFrameMessage(event)) {
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
            features: true,
            passes: FULLSCREEN_SETTLE_PASSES
          });
        };
        options.applyFeatureRootClasses();
        options.ensureGlobalStyle();
        options.installQolboxMenuHooks();
        options.installPopupKeyboardHooks();
        options.installLobbyInformationHooks();
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
        }
      }

      // src/config/qolbox-version.ts
      var QOLBOX_VERSION = "3.0.0";
      var QOLBOX_VERSION_LABEL = `v${QOLBOX_VERSION}`;
      var QOLBOX_GREASYFORK_URL = "https://greasyfork.org/en/scripts/568667-qolbox";
      var QOLBOX_GITHUB_URL = "https://github.com/AggressiveCombo/QOLBox";

      // src/utils/local-storage.ts
      function getLocalStorageItem(key) {
        try {
          return localStorage.getItem(key);
        } catch {
          return null;
        }
      }
      function setLocalStorageItem(key, value) {
        try {
          localStorage.setItem(key, value);
          return true;
        } catch {
          return false;
        }
      }
      function removeLocalStorageItem(key) {
        try {
          localStorage.removeItem(key);
          return true;
        } catch {
          return false;
        }
      }

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
      var LOCAL_CURRENT_RELEASE_FALLBACK_NOTES = QOLBOX_VERSION.replace(/-dev$/i, "") === "3.0.0" ? [
        "Added editor multi-selection with Shift/Ctrl clicking and drag-box area selection; selected objects can be moved, copied, pasted, deleted, undone, redone, and edited together.",
        "Added shared editor property editing: different values show Mixed, fill and stroke swatches show every distinct selected color, unsupported objects stay unchanged, and selected object IDs remain visible.",
        "Added merged-body workflows, including group movement, rotation, mirroring and clipboard operations, direct Ctrl-click subbody editing, and Ungroup in Subbody Properties.",
        "Added horizontal and vertical Mirror actions plus relative value commands such as =+3 and =-3.",
        "Added an editor color picker with the I shortcut, fill/outline sampling, and exact #RGB or #RRGGBB fields for fill, stroke, and map background colors.",
        "Added exact #RGB or #RRGGBB entry for the native player appearance color.",
        "Added references for QOLBox controls, compact command syntax, sound-bank manifests, and effect filenames, plus a one-time step-by-step improved-editor introduction and a permanent Editor Help menu.",
        "Added an Editor Save option that keeps Hitbox's native Save action available after loading a map.",
        "Added View Patch Notes to the QOLBox About page.",
        "Added Room List to the in-room hamburger so the native browser opens over the current lobby or match and disconnects the current session before joining another room, plus Player Info for the registered-player level and exact XP progress Hitbox exposes.",
        "Added customizable QOLBox and Hitbox interface accent colors, with exact hex entry, contrast-aware text and icons, a themed native player emblem, and an option to keep both accents linked or separate.",
        "Added system-aware light mode for Hitbox and QOLBox, with readable themed surfaces and System, Dark, and Light choices in Appearance.",
        "Added inline slash-command completion with Tab or Right Arrow to accept and Up or Down Arrow to cycle matching commands.",
        "Added saved custom sound banks that replace individual game effects with uploaded audio or direct-URL manifests, include volume-matched previews, and keep the complete Vanilla bank available.",
        "Improved fullscreen rendering so the game stays sharp at the monitor's displayed resolution while preserving Hitbox's native camera, UI scale, and browser-zoom behavior, with proportionally cropped backgrounds instead of stretching or tiling at unusual aspect ratios.",
        "Improved editor outlines and hit testing so rotated polygons, circles, rectangles, and joints remain aligned through zoom and selection changes, and polygon selection follows the actual shape.",
        "Improved editor camera and map lifecycle behavior so the first view and new maps are centered, fullscreen changes preserve the same position and relative zoom, and stale selections or IDs do not survive map replacement.",
        "Improved editor zoom safety and WebGL recovery by respecting the active device's rendering limits and rebuilding the current game or editor scene after a restored context.",
        "Improved editor map import/export with descriptive filenames, optional readable JSON exports, strict validation, an 8 MiB input limit, backup-and-rollback imports, and support for compact .hitboxmap, readable JSON, and compatible text files.",
        "Improved keyboard navigation across the main menu, server browser, Quick Play, hamburger menus, lobby and map controls, native dialogs, and editor menus, including contained tab order and focus restoration.",
        "Improved the map browser so long descriptions can be scrolled and published-map like/dislike icons work with mouse or keyboard input.",
        "Improved Load Map responsiveness by pausing automatic previews during scrolling, rendering ordinary previews progressively, and skipping oversized automatic previews without blocking the selected map.",
        "Improved action clarity with icons across main, hamburger, Room List, QOLBox, popup, and editor controls, and consolidated Volume, Music, and Jukebox under one expandable Audio command with persistent mute controls and fine volume dragging.",
        "Improved in-game chat formatting so command results and jukebox suggestions retain the same semantic colors and action emphasis as the lobby.",
        "Improved the QOLBox menu with a larger responsive panel that can be resized and remembers its size, one global QOLBox Defaults action, cleaner footer placement, and reliable short-window scrolling.",
        "Improved fullscreen HUD spacing so spectator controls, the jukebox, editor object counter, and player action menus keep stable positions and margins as controls open or close.",
        "Fixed lobby music playing in-game; it now stops in lobbies and games and resumes after leaving.",
        "Fixed cancelling Reserve Spots leaving stale room selection or button state behind.",
        "Fixed update history showing releases outside the installed-to-current version range.",
        "Fixed editor color wheels staying open after clicking the black void outside the map, and made open File, Tools, and Settings dropdowns close when the pointer leaves them.",
        "Fixed editor map actions leaving the File dropdown open or disappearing after native menu refreshes.",
        "Fixed the editor export fallback being able to trigger a real Play transition.",
        "Fixed editor object dragging and camera panning competing for the same pointer input.",
        "Fixed native connecting and loading controls so Cancel closes every popup without stale room selection, long errors wrap inside dialogs, and Room List refresh cannot leave a duplicate or permanently stuck spinner."
      ] : ["No public update notes were found for this version."];
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
      function normalizeVersionKey(version) {
        return String(version || "").trim().replace(/^v/i, "").toLowerCase();
      }
      function parseVersionPoint(version) {
        const normalized = normalizeVersionKey(version);
        if (!normalized) {
          return null;
        }
        const [main = "", prerelease = ""] = normalized.split("-", 2);
        const rawParts = main.split(".");
        if (!main || rawParts.length > 3) {
          return null;
        }
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
          const delta = (left.parts[index] ?? 0) - (right.parts[index] ?? 0);
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
        return text.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1").replace(/`([^`]*)`/g, "$1").replace(/\*\*([^*]+)\*\*/g, "$1").replace(/__([^_]+)__/g, "$1").replace(/(^|[\s(])([*_])([^*_\n]+)\2(?=$|[\s).,;:!?])/g, "$1$3").replace(/^>\s*/, "").replace(/\s+/g, " ").trim();
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
            const note = cleanReleaseText(bulletMatch[1] ?? "");
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
        return rawValue.filter((record) => isRecord(record)).filter((record) => record.draft !== true && record.prerelease !== true).map((record) => {
          const version = normalizeVersionKey(record.tag_name);
          const notes = extractMarkdownNotes(record.body);
          return {
            version,
            source: "github",
            publishedAt: typeof record.published_at === "string" ? record.published_at : void 0,
            url: typeof record.html_url === "string" ? record.html_url : void 0,
            notes: notes.length ? notes : [cleanReleaseText(typeof record.name === "string" ? record.name : `QOLBox ${version}`)]
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
        return isRecord(value) && value.source === RELEASE_HISTORY_BRIDGE_RESPONSE_SOURCE && value.type === RELEASE_HISTORY_BRIDGE_RESPONSE_TYPE && value.id === id;
      }
      function makeBridgeRequestId() {
        return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
      }
      function fetchTextWithUserscriptBridge(endpoint) {
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
              endpoint
            },
            window.location.origin
          );
        });
      }
      function getReleaseHistoryEndpoint(url) {
        if (url === GITHUB_RELEASES_URL) {
          return "github";
        }
        return url === GREASYFORK_HISTORY_URL ? "greasyfork" : null;
      }
      function firstFulfilled(promises) {
        return new Promise((resolve, reject) => {
          let rejectionCount = 0;
          let lastError = null;
          for (const promise of promises) {
            promise.then(resolve, (error) => {
              rejectionCount += 1;
              lastError = error;
              if (rejectionCount >= promises.length) {
                reject(lastError);
              }
            });
          }
        });
      }
      async function fetchText(url, headers = {}) {
        const endpoint = getReleaseHistoryEndpoint(url);
        if (!endpoint) {
          throw new Error("Unknown release-history endpoint.");
        }
        const requestHeaders = {
          Accept: "text/html",
          ...headers
        };
        if (endpoint === "github") {
          try {
            return await fetchTextWithPageFetch(url, requestHeaders);
          } catch {
            return fetchTextWithUserscriptBridge(endpoint);
          }
        }
        return fetchTextWithUserscriptBridge(endpoint);
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
      function getReleaseHistoryStateFromEntries(previousVersion, currentVersion, entries, status = "ready") {
        return {
          status,
          notes: getReleaseNotesBetween(previousVersion, currentVersion, entries)
        };
      }
      function mergeReleaseHistoryEntries(externalEntries, cachedEntries = []) {
        return dedupeLatestReleaseEntries([
          ...LOCAL_CURRENT_RELEASE_FALLBACK,
          ...cachedEntries,
          ...externalEntries
        ]);
      }
      function handleReleaseHistoryCompletion(previousVersion, currentVersion, externalPromises, cachedEntries, onUpdate) {
        void Promise.allSettled(externalPromises).then((results) => {
          const externalEntries = results.flatMap((result) => result.status === "fulfilled" ? result.value : []);
          if (!externalEntries.length) {
            return;
          }
          const entries = mergeReleaseHistoryEntries(externalEntries, cachedEntries);
          saveReleaseHistoryCache(entries);
          onUpdate?.(getReleaseHistoryStateFromEntries(previousVersion, currentVersion, entries));
        });
      }
      function parseCachedReleaseHistory(rawValue) {
        if (!rawValue) {
          return null;
        }
        try {
          const parsed = JSON.parse(rawValue);
          if (!isRecord(parsed) || !Number.isFinite(parsed.fetchedAt) || !Array.isArray(parsed.entries)) {
            return null;
          }
          const entries = parsed.entries.filter(
            (entry) => isRecord(entry) && typeof entry.version === "string" && Array.isArray(entry.notes)
          ).map((entry) => ({
            version: entry.version,
            source: entry.source === "github" || entry.source === "greasyfork" || entry.source === "local-fallback" ? entry.source : "local-fallback",
            publishedAt: typeof entry.publishedAt === "string" ? entry.publishedAt : void 0,
            url: typeof entry.url === "string" ? entry.url : void 0,
            notes: entry.notes.filter((note) => typeof note === "string").map((note) => note.trim()).filter(Boolean)
          })).filter((entry) => entry.notes.length > 0);
          return { fetchedAt: parsed.fetchedAt, entries };
        } catch {
          return null;
        }
      }
      function getCachedReleaseHistoryEntries(allowStale = false) {
        const cached = parseCachedReleaseHistory(getLocalStorageItem(RELEASE_HISTORY_CACHE_KEY));
        if (!cached) {
          return null;
        }
        if (!allowStale && Date.now() - cached.fetchedAt > RELEASE_HISTORY_CACHE_TTL_MS) {
          return null;
        }
        return dedupeLatestReleaseEntries([...LOCAL_CURRENT_RELEASE_FALLBACK, ...cached.entries]);
      }
      function saveReleaseHistoryCache(entries) {
        setLocalStorageItem(RELEASE_HISTORY_CACHE_KEY, JSON.stringify({
          fetchedAt: Date.now(),
          entries
        }));
      }
      function getReleaseNotesBetween(previousVersion, currentVersion = QOLBOX_VERSION, releaseHistory = LOCAL_CURRENT_RELEASE_FALLBACK) {
        const entries = dedupeLatestReleaseEntries([...LOCAL_CURRENT_RELEASE_FALLBACK, ...releaseHistory]);
        return entries.filter((entry) => isVersionInUpgradeRange(entry.version, previousVersion, currentVersion));
      }
      function createInitialReleaseHistoryState(previousVersion, currentVersion = QOLBOX_VERSION) {
        const cachedEntries = getCachedReleaseHistoryEntries();
        if (cachedEntries) {
          return getReleaseHistoryStateFromEntries(previousVersion, currentVersion, cachedEntries);
        }
        return {
          status: "loading",
          notes: getReleaseNotesBetween(previousVersion, currentVersion)
        };
      }
      async function loadReleaseHistoryState(previousVersion, currentVersion = QOLBOX_VERSION, onUpdate) {
        const cachedEntries = getCachedReleaseHistoryEntries(true) || [];
        const githubPromise = fetchGitHubReleaseEntries();
        const greasyForkPromise = fetchGreasyForkReleaseEntries();
        const externalPromises = [githubPromise, greasyForkPromise];
        try {
          const firstEntries = await firstFulfilled(externalPromises);
          handleReleaseHistoryCompletion(previousVersion, currentVersion, externalPromises, cachedEntries, onUpdate);
          return getReleaseHistoryStateFromEntries(
            previousVersion,
            currentVersion,
            mergeReleaseHistoryEntries(firstEntries, cachedEntries)
          );
        } catch {
          if (cachedEntries.length) {
            return getReleaseHistoryStateFromEntries(previousVersion, currentVersion, cachedEntries, "fallback");
          }
          return {
            status: "fallback",
            notes: getReleaseNotesBetween(previousVersion, currentVersion)
          };
        }
      }

      // src/settings/advanced-settings.ts
      var ADVANCED_RESERVE_RETRY_INTERVAL_MS = "reserveRetryIntervalMs";
      var ADVANCED_COMMAND_ALIASES = "commandAliases";
      var ADVANCED_BLACKLIST_ENFORCEMENT = "blacklistEnforcement";
      var ADVANCED_EDITOR_MAP_READABLE_FILES = "editorMapReadableFiles";
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
          key: ADVANCED_EDITOR_MAP_READABLE_FILES,
          kind: "boolean",
          title: "Readable map exports",
          description: "Export readable JSON instead of compact map data. JSON import is always supported.",
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
            if (value === true || value === "true") {
              return true;
            }
            if (value === false || value === "false") {
              return false;
            }
            return definition.defaultValue;
        }
      }
      function loadAdvancedSettings() {
        const settings = getDefaultAdvancedSettings();
        try {
          const rawSettings = getLocalStorageItem(ADVANCED_SETTINGS_KEY);
          if (!rawSettings) {
            return settings;
          }
          const parsedSettings = JSON.parse(rawSettings);
          if (!isRecord(parsedSettings)) {
            return settings;
          }
          for (const definition of ADVANCED_SETTING_DEFINITIONS) {
            if (Object.prototype.hasOwnProperty.call(parsedSettings, definition.key)) {
              const storedValue = parsedSettings[definition.key];
              if (definition.kind !== "boolean" || typeof storedValue === "boolean") {
                settings[definition.key] = sanitizeAdvancedSetting(definition, storedValue);
              }
            }
          }
        } catch {
        }
        return settings;
      }
      function saveAdvancedSettings(settings) {
        setLocalStorageItem(ADVANCED_SETTINGS_KEY, JSON.stringify(settings));
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
      function areAdvancedEditorMapReadableFilesEnabled(settings = loadAdvancedSettings()) {
        return settings[ADVANCED_EDITOR_MAP_READABLE_FILES];
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
      var FEATURE_EDITOR_FORCE_SAVE = "editorForceSave";
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
          summary: "Control volume and mute states."
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
          onboardingText: "Use /spec, /join, /red, /blue, /switch, /lock, /unlock, /host, /start, /end, /restart, /record, /settings all, and /blacklist. With Command aliases enabled, /r runs /restart and /rec runs /record. Special targets: /spec all|playing, /join all|spectators, and /red or /blue all|playing|spectators. Named targets for /spec, /join, /red, /blue, /host, /kick, and /ban accept exact or unique partial player names. /blacklist stores exact names only."
        },
        {
          key: FEATURE_EDITOR_MAP_TRANSFER,
          title: "Map Import and Export",
          shortTitle: "Map Files",
          summary: "Add Import and Export to the editor File menu for saving map files on your computer."
        },
        {
          key: FEATURE_EDITOR_FORCE_SAVE,
          title: "Enable Editor Save",
          shortTitle: "Editor Save",
          summary: "Keep native Save available for loaded maps."
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
        [FEATURE_EDITOR_MAP_TRANSFER]: true,
        [FEATURE_EDITOR_FORCE_SAVE]: true
      };
      function getDefaultFeatureSettings() {
        return { ...DEFAULT_FEATURE_SETTINGS };
      }
      function loadFeatureSettings() {
        const defaults = getDefaultFeatureSettings();
        try {
          const rawSettings = getLocalStorageItem(FEATURE_SETTINGS_KEY);
          if (!rawSettings) {
            return defaults;
          }
          const parsedSettings = JSON.parse(rawSettings);
          if (!isRecord(parsedSettings)) {
            return defaults;
          }
          for (const feature of FEATURE_DEFINITIONS) {
            if (Object.prototype.hasOwnProperty.call(parsedSettings, feature.key)) {
              const value = parsedSettings[feature.key];
              if (typeof value === "boolean") {
                defaults[feature.key] = value;
              }
            }
          }
        } catch {
        }
        return defaults;
      }
      function saveFeatureSettings(settings) {
        setLocalStorageItem(FEATURE_SETTINGS_KEY, JSON.stringify(settings));
      }
      function isKnownFeature(featureKey) {
        return FEATURE_DEFINITIONS.some((feature) => feature.key === featureKey);
      }

      // src/settings/feature-gates.ts
      function createFeatureGateSet(shouldRunFeature) {
        return {
          isAudioEnabled: () => shouldRunFeature(FEATURE_AUDIO),
          isChatEnabled: () => shouldRunFeature(FEATURE_CHAT),
          isEditorForceSaveEnabled: () => shouldRunFeature(FEATURE_EDITOR_FORCE_SAVE),
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
            options.onScheduleUiWork({ features: true, passes: options.resizeSettlePasses });
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

      // src/hitbox/native-access.ts
      function isNativeObject(value) {
        return typeof value === "object" && value !== null;
      }
      function isNativeReflectTarget(value) {
        return isNativeObject(value) || typeof value === "function";
      }
      function readNativeProperty(source, property) {
        try {
          return isNativeObject(source) ? Reflect.get(source, property) : void 0;
        } catch {
          return void 0;
        }
      }
      function readNativeReflectProperty(source, property) {
        try {
          return isNativeReflectTarget(source) ? Reflect.get(source, property) : void 0;
        } catch {
          return void 0;
        }
      }
      function setNativeReflectProperty(source, property, value) {
        try {
          return isNativeReflectTarget(source) && Reflect.set(source, property, value);
        } catch {
          return false;
        }
      }
      function replaceNativeReflectProperty(source, property, value) {
        return setNativeReflectProperty(source, property, value) && readNativeReflectProperty(source, property) === value;
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
      function callNativeMethodSafely(source, methodName, args = []) {
        try {
          return callNativeMethod(source, methodName, args).result;
        } catch {
          return void 0;
        }
      }

      // src/hitbox/renderer-discovery.ts
      var RENDER_CAPTURE_MARKER = "__qolboxRendererCaptureInstalled";
      var NATIVE_RENDERER_CAPTURE_MARKER = "__qolboxNativeRendererCapture";
      var NATIVE_RENDER_CAPTURE_MARKER = "__qolboxNativeRenderCapture";
      var ATOMIC_RESIZE_MARKER = "__qolboxAtomicResize";
      var observedPixiRenderers = /* @__PURE__ */ new Set();
      var observedRenderArguments = /* @__PURE__ */ new WeakMap();
      var observedRendererWrappers = /* @__PURE__ */ new WeakMap();
      var syntheticRendererWrappers = /* @__PURE__ */ new WeakSet();
      var observedNativeDrawArgumentMaps = /* @__PURE__ */ new Set();
      var observedNativeRenderArgumentMaps = /* @__PURE__ */ new Set();
      var observedNativeRendererSets = /* @__PURE__ */ new Set();
      var pendingResizeRenders = /* @__PURE__ */ new WeakSet();
      var rendererByContextView = /* @__PURE__ */ new WeakMap();
      var contextRecoveryViews = /* @__PURE__ */ new WeakSet();
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
      function isSyntheticRendererWrapper(renderer) {
        return syntheticRendererWrappers.has(renderer);
      }
      function installNativeRendererCapture(renderer) {
        const prototype = Object.getPrototypeOf(renderer);
        if (!isNativeObject(prototype)) return;
        const draw = readNativeReflectProperty(prototype, "Dg");
        const existing = readNativeReflectProperty(draw, NATIVE_RENDERER_CAPTURE_MARKER);
        const existingRenderers = readNativeProperty(existing, "renderers");
        const existingDrawArguments = readNativeProperty(existing, "arguments");
        if (existingRenderers instanceof Set && existingDrawArguments instanceof WeakMap) {
          observedNativeRendererSets.add(existingRenderers);
          observedNativeDrawArgumentMaps.add(existingDrawArguments);
        } else if (typeof draw === "function") {
          try {
            const captured = existing instanceof Set ? existing : /* @__PURE__ */ new Set([renderer]);
            const capturedArguments = /* @__PURE__ */ new WeakMap();
            const wrappedDraw = function(...args) {
              captured.add(this);
              capturedArguments.set(this, args);
              return Reflect.apply(draw, this, args);
            };
            Object.defineProperty(wrappedDraw, NATIVE_RENDERER_CAPTURE_MARKER, {
              value: { arguments: capturedArguments, renderers: captured }
            });
            Object.defineProperty(prototype, "Dg", {
              configurable: true,
              writable: true,
              value: wrappedDraw
            });
            observedNativeRendererSets.add(captured);
            observedNativeDrawArgumentMaps.add(capturedArguments);
          } catch {
          }
        }
        const render = readNativeReflectProperty(prototype, "render");
        const existingRenderCapture = readNativeReflectProperty(render, NATIVE_RENDER_CAPTURE_MARKER);
        let capturedRenderArguments = null;
        if (existingRenderCapture instanceof WeakMap) {
          capturedRenderArguments = existingRenderCapture;
        } else if (typeof render === "function") {
          try {
            const capturedArguments = /* @__PURE__ */ new WeakMap();
            const wrappedRender = function(...args) {
              capturedArguments.set(this, args);
              return Reflect.apply(render, this, args);
            };
            Object.defineProperty(wrappedRender, NATIVE_RENDER_CAPTURE_MARKER, { value: capturedArguments });
            Object.defineProperty(prototype, "render", {
              configurable: true,
              writable: true,
              value: wrappedRender
            });
            capturedRenderArguments = capturedArguments;
          } catch {
          }
        }
        if (capturedRenderArguments) observedNativeRenderArgumentMaps.add(capturedRenderArguments);
        const resize = readNativeReflectProperty(prototype, "cg");
        if (capturedRenderArguments && typeof resize === "function" && !readNativeReflectProperty(resize, ATOMIC_RESIZE_MARKER)) {
          try {
            const renderArgumentsByRenderer = capturedRenderArguments;
            const wrappedResize = function(...args) {
              const result = Reflect.apply(resize, this, args);
              if (!pendingResizeRenders.has(this)) {
                pendingResizeRenders.add(this);
                queueMicrotask(() => {
                  pendingResizeRenders.delete(this);
                  const renderArguments = renderArgumentsByRenderer.get(this);
                  const currentRender = readNativeProperty(this, "render");
                  if (renderArguments && typeof currentRender === "function") {
                    Reflect.apply(currentRender, this, renderArguments);
                  }
                });
              }
              return result;
            };
            Object.defineProperty(wrappedResize, ATOMIC_RESIZE_MARKER, { value: true });
            Object.defineProperty(prototype, "cg", {
              configurable: true,
              writable: true,
              value: wrappedResize
            });
          } catch {
          }
        }
      }
      function readLastArguments(renderer, maps) {
        for (const map of maps) {
          const args = map.get(renderer);
          if (args) return args;
        }
        return null;
      }
      function getLastRendererDrawArguments(renderer) {
        return readLastArguments(renderer, observedNativeDrawArgumentMaps);
      }
      function recoverRendererContext(renderer) {
        const draw = readNativeProperty(renderer, "Dg");
        const drawArguments = readLastArguments(renderer, observedNativeDrawArgumentMaps);
        const render = readNativeProperty(renderer, "render");
        const renderArguments = readLastArguments(renderer, observedNativeRenderArgumentMaps);
        try {
          let replayed = false;
          if (drawArguments && typeof draw === "function") {
            Reflect.apply(draw, renderer, drawArguments);
            replayed = true;
          }
          if (renderArguments && typeof render === "function") {
            Reflect.apply(render, renderer, renderArguments);
            replayed = true;
          }
          if (!replayed) rerenderKnownRenderer(renderer);
        } catch {
        }
      }
      function installRendererContextRecovery(renderer) {
        const view = getRendererView(renderer);
        if (!view) return;
        rendererByContextView.set(view, renderer);
        if (contextRecoveryViews.has(view)) return;
        contextRecoveryViews.add(view);
        view.addEventListener("webglcontextlost", (event) => event.preventDefault());
        view.addEventListener("webglcontextrestored", () => {
          queueMicrotask(() => {
            const currentRenderer = rendererByContextView.get(view);
            if (currentRenderer && view.isConnected) recoverRendererContext(currentRenderer);
          });
        });
      }
      function installPixiRendererCapture(windowObject) {
        const pixi = readNativeProperty(windowObject, "PIXI");
        let installed2 = false;
        for (const constructorName of ["Renderer", "AbstractRenderer"]) {
          const rendererConstructor = readNativeProperty(pixi, constructorName);
          const prototype = readNativeReflectProperty(rendererConstructor, "prototype");
          const render = readNativeProperty(prototype, "render");
          if (!isNativeObject(prototype) || typeof render !== "function" || readNativeReflectProperty(render, RENDER_CAPTURE_MARKER)) {
            installed2 || (installed2 = Boolean(readNativeReflectProperty(render, RENDER_CAPTURE_MARKER)));
            continue;
          }
          try {
            const wrappedRender = function(...args) {
              observedPixiRenderers.add(this);
              observedRenderArguments.set(this, args);
              return Reflect.apply(render, this, args);
            };
            Object.defineProperty(wrappedRender, RENDER_CAPTURE_MARKER, { value: true });
            Object.defineProperty(prototype, "render", {
              configurable: true,
              writable: true,
              value: wrappedRender
            });
            installed2 = true;
          } catch {
          }
        }
        return installed2;
      }
      function rerenderKnownRenderer(renderer) {
        const pixiRenderer = readNativeProperty(renderer, "Ag");
        if (!isNativeObject(pixiRenderer)) return;
        const args = observedRenderArguments.get(pixiRenderer);
        const render = readNativeProperty(pixiRenderer, "render");
        if (!args || typeof render !== "function") return;
        try {
          Reflect.apply(render, pixiRenderer, args);
        } catch {
        }
      }
      function rerenderKnownNativeRenderer(renderer) {
        const args = readLastArguments(renderer, observedNativeRenderArgumentMaps);
        const render = readNativeProperty(renderer, "render");
        if (!args || typeof render !== "function") {
          rerenderKnownRenderer(renderer);
          return;
        }
        try {
          Reflect.apply(render, renderer, args);
        } catch {
          rerenderKnownRenderer(renderer);
        }
      }
      function schedulePixiRendererCapture(windowObject = window) {
        if (installPixiRendererCapture(windowObject)) return;
        const setIntervalMethod = readNativeProperty(windowObject, "setInterval");
        const clearIntervalMethod = readNativeProperty(windowObject, "clearInterval");
        if (typeof setIntervalMethod !== "function" || typeof clearIntervalMethod !== "function") return;
        let attempts = 0;
        const timer = Reflect.apply(setIntervalMethod, windowObject, [
          () => {
            attempts += 1;
            if (installPixiRendererCapture(windowObject) || attempts >= 200) {
              Reflect.apply(clearIntervalMethod, windowObject, [timer]);
            }
          },
          50
        ]);
      }
      function getObservedRendererWrapper(pixiRenderer) {
        const existing = observedRendererWrappers.get(pixiRenderer);
        if (existing) return existing;
        const view = readNativeProperty(pixiRenderer, "view");
        const screen = readNativeProperty(pixiRenderer, "screen");
        const width = Number(readNativeProperty(screen, "width")) || Number(readNativeProperty(pixiRenderer, "width"));
        const height = Number(readNativeProperty(screen, "height")) || Number(readNativeProperty(pixiRenderer, "height"));
        if (!(view instanceof Element) || !Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
          return null;
        }
        const backing = {};
        Object.defineProperties(backing, {
          mc: { enumerable: true, get: () => Number(readNativeProperty(readNativeProperty(pixiRenderer, "screen"), "height")) },
          wc: { enumerable: true, get: () => Number(readNativeProperty(readNativeProperty(pixiRenderer, "screen"), "width")) }
        });
        const wrapper = {
          Ag: pixiRenderer,
          Bc: backing,
          Tg: view.parentElement
        };
        observedRendererWrappers.set(pixiRenderer, wrapper);
        syntheticRendererWrappers.add(wrapper);
        return wrapper;
      }
      function getKnownFullscreenRenderers(windowObject = window) {
        const renderers = [];
        const seen = /* @__PURE__ */ new Set();
        const seenViews = /* @__PURE__ */ new Set();
        installPixiRendererCapture(windowObject);
        function addRenderer(candidate) {
          if (!isRendererCandidate(candidate) || seen.has(candidate)) {
            return;
          }
          const view = getRendererView(candidate);
          if (view && seenViews.has(view)) return;
          seen.add(candidate);
          installNativeRendererCapture(candidate);
          installRendererContextRecovery(candidate);
          if (view) seenViews.add(view);
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
        collect(readNativePath(windowObject, ["multiplayerSession", "KR", "hb"]));
        collect(readNativeProperty(windowObject, "A4"));
        collect(readNativePath(windowObject, ["a8", "II"]));
        for (const captured of observedNativeRendererSets) {
          for (const renderer of captured) {
            const view = getRendererView(renderer);
            if (view && !view.isConnected) captured.delete(renderer);
            else addRenderer(renderer);
          }
        }
        for (const pixiRenderer of observedPixiRenderers) {
          const view = readNativeProperty(pixiRenderer, "view");
          if (readNativeProperty(pixiRenderer, "destroyed") === true || view instanceof Element && !view.isConnected) {
            observedPixiRenderers.delete(pixiRenderer);
            continue;
          }
          addRenderer(getObservedRendererWrapper(pixiRenderer));
        }
        return renderers;
      }
      schedulePixiRendererCapture();

      // src/settings/theme-settings.ts
      var DEFAULT_QOLBOX_ACCENT = "#FF6200";
      var DEFAULT_GAME_ACCENT = "#4A7AB1";
      var THEME_QOLBOX_ACCENT = "qolboxAccent";
      var THEME_GAME_ACCENT = "gameAccent";
      var THEME_MODE = "mode";
      var THEME_SETTINGS_KEY = "vm.hitbox.qolboxThemeSettings";
      var GAME_THEME_STYLE_ID = "qolbox-game-theme-overrides";
      var HEX_COLOR = /^#[0-9a-f]{6}$/i;
      var NATIVE_PLAYER_EMBLEM_COLOR = 16766016;
      var PLAYER_EMBLEM_RENDER_HOOK = "__qolboxPlayerEmblemRenderHook";
      var playerEmblemFills = /* @__PURE__ */ new WeakSet();
      var playerEmblemTarget = NATIVE_PLAYER_EMBLEM_COLOR;
      var appliedDocument = null;
      var appliedThemeSignature = "";
      var themedStylesheetSignature = "";
      var NATIVE_BLUE_VARIABLES = [
        [/(?:#4a7ab1|rgb\(74,\s*122,\s*177\))/gi, "var(--qolbox-game-accent)"],
        [/(?:#5c85b4|rgb\(92,\s*133,\s*180\))/gi, "var(--qolbox-game-accent-hover)"],
        [/(?:#5a8ac1|rgb\(90,\s*138,\s*193\))/gi, "var(--qolbox-game-accent-focus)"],
        [/(?:#375a83|rgb\(55,\s*90,\s*131\))/gi, "var(--qolbox-game-accent-shadow)"],
        [/(?:#6190d4|rgb\(97,\s*144,\s*212\))/gi, "var(--qolbox-game-accent-bright)"],
        [/(?:#3d5874|rgb\(61,\s*88,\s*116\))/gi, "var(--qolbox-game-accent-dark)"],
        [/(?:#405664|rgb\(64,\s*86,\s*100\))/gi, "var(--qolbox-game-accent-darker)"]
      ];
      var NATIVE_PALETTE = [
        [/(?:#191818|rgb\(25,\s*24,\s*24\))/gi, "--qolbox-ui-dark-border", "#191818", "#A4ADB9"],
        [/(?:#191919|rgb\(25,\s*25,\s*25\))/gi, "--qolbox-ui-room-header", "#191919", "#D8DDE3"],
        [/(?:#1c1c1c|rgb\(28,\s*28,\s*28\))/gi, "--qolbox-ui-strong-border", "#1C1C1C", "#A4ADB9"],
        [/(?:#202020|rgb\(32,\s*32,\s*32\))/gi, "--qolbox-ui-settings-table", "#202020", "#E9EDF2"],
        [/(?:#222222|rgb\(34,\s*34,\s*34\))/gi, "--qolbox-ui-border", "#222222", "#AEB6C2"],
        [/(?:#25262a|rgb\(37,\s*38,\s*42\))/gi, "--qolbox-ui-panel", "#25262A", "#F4F6F8"],
        [/(?:#262626|rgb\(38,\s*38,\s*38\))/gi, "--qolbox-ui-room-panel", "#262626", "#F8F9FB"],
        [/(?:#27292c|rgb\(39,\s*41,\s*44\))/gi, "--qolbox-ui-popup-menu", "#27292C", "#EDF1F5"],
        [/(?:#2b2d31|rgb\(43,\s*45,\s*49\))/gi, "--qolbox-ui-context-menu", "#2B2D31", "#E8EDF2"],
        [/(?:#2c2e32|rgb\(44,\s*46,\s*50\))/gi, "--qolbox-ui-control", "#2C2E32", "#E2E7ED"],
        [/(?:#2e2f31|rgb\(46,\s*47,\s*49\))/gi, "--qolbox-ui-list-item", "#2E2F31", "#F0F2F5"],
        [/(?:#303030|rgb\(48,\s*48,\s*48\))/gi, "--qolbox-ui-input", "#303030", "#FFFFFF"],
        [/(?:#323438|rgb\(50,\s*52,\s*56\))/gi, "--qolbox-ui-popup-menu-hover", "#323438", "#D6DEE7"],
        [/(?:#333f37|rgb\(51,\s*63,\s*55\))/gi, "--qolbox-ui-friends-present", "#333F37", "#D4E8D9"],
        [/(?:#35383d|rgb\(53,\s*56,\s*61\))/gi, "--qolbox-ui-tile", "#35383D", "#E4E9EE"],
        [/(?:#363636|rgb\(54,\s*54,\s*54\))/gi, "--qolbox-ui-table-border", "#363636", "#B7BEC8"],
        [/(?:#36373c|rgb\(54,\s*55,\s*60\))/gi, "--qolbox-ui-list-hover", "#36373C", "#DCE3EA"],
        [/(?:#3d4046|rgb\(61,\s*64,\s*70\))/gi, "--qolbox-ui-chrome", "#3D4046", "#D4DCE5"],
        [/(?:#3f4044|rgb\(63,\s*64,\s*68\))/gi, "--qolbox-ui-list-meta-bg", "#3F4044", "#DFE5EB"],
        [/(?:#3f474e|rgb\(63,\s*71,\s*78\))/gi, "--qolbox-ui-filter-bar", "#3F474E", "#D7DEE6"],
        [/(?:#3f4c50|rgb\(63,\s*76,\s*80\))/gi, "--qolbox-ui-list-selected-hover", "#3F4C50", "#CED9E1"],
        [/(?:#414141|rgb\(65,\s*65,\s*65\))/gi, "--qolbox-ui-subtle-border", "#414141", "#B7BEC8"],
        [/(?:#474747|rgb\(71,\s*71,\s*71\))/gi, "--qolbox-ui-settings-row", "#474747", "#E3E7EC"],
        [/(?:#49575c|rgb\(73,\s*87,\s*92\))/gi, "--qolbox-ui-list-selected", "#49575C", "#C4D2DB"],
        [/(?:#535962|rgb\(83,\s*89,\s*98\))/gi, "--qolbox-ui-tile-selected", "#535962", "#C7D4E2"],
        [/(?:#555555|rgb\(85,\s*85,\s*85\))/gi, "--qolbox-ui-disabled", "#555555", "#C7CDD5"],
        [/(?:#585858|rgb\(88,\s*88,\s*88\))/gi, "--qolbox-ui-generic-control", "#585858", "#E1E5EA"],
        [/(?:#5a5a5a|rgb\(90,\s*90,\s*90\))/gi, "--qolbox-ui-item-border", "#5A5A5A", "#919AA7"],
        [/(?:#6c6c6c|rgb\(108,\s*108,\s*108\))/gi, "--qolbox-ui-input-border", "#6C6C6C", "#919AA7"],
        [/(?:#a9a9a9|rgb\(169,\s*169,\s*169\))/gi, "--qolbox-ui-status-text", "#A9A9A9", "#59636F"],
        [/(?:#a5a5a5|rgb\(165,\s*165,\s*165\))/gi, "--qolbox-ui-list-meta", "#A5A5A5", "#59636F"],
        [/(?:#bababa|rgb\(186,\s*186,\s*186\))/gi, "--qolbox-ui-preview-border", "#BABABA", "#7D8793"],
        [/(?:#b5b5b5|rgb\(181,\s*181,\s*181\))/gi, "--qolbox-ui-help-text", "#B5B5B5", "#4D5662"],
        [/(?:#c3c3c3|rgb\(195,\s*195,\s*195\))/gi, "--qolbox-ui-muted", "#C3C3C3", "#414A55"],
        [/(?:#d5d5d5|rgb\(213,\s*213,\s*213\))/gi, "--qolbox-ui-list-text", "#D5D5D5", "#303640"],
        [/(?:#ebebeb|rgb\(235,\s*235,\s*235\))/gi, "--qolbox-ui-text", "#EBEBEB", "#171A1F"]
      ];
      var COLOR_SCHEMES = {
        dark: Object.fromEntries(NATIVE_PALETTE.map(([, property, dark]) => [property, dark])),
        light: Object.fromEntries(NATIVE_PALETTE.map(([, property, , light]) => [property, light]))
      };
      function normalizeThemeColor(value) {
        if (typeof value !== "string") return null;
        const normalized = value.trim().startsWith("#") ? value.trim() : `#${value.trim()}`;
        return HEX_COLOR.test(normalized) ? normalized.toUpperCase() : null;
      }
      function getDefaultThemeSettings() {
        return {
          gameAccent: DEFAULT_GAME_ACCENT,
          linked: false,
          mode: "system",
          qolboxAccent: DEFAULT_QOLBOX_ACCENT
        };
      }
      function sanitizeThemeSettings(value) {
        const defaults = getDefaultThemeSettings();
        if (!isRecord(value)) return defaults;
        const qolboxAccent = normalizeThemeColor(value.qolboxAccent) || defaults.qolboxAccent;
        const linked = value.linked === true;
        return {
          gameAccent: linked ? qolboxAccent : normalizeThemeColor(value.gameAccent) || defaults.gameAccent,
          linked,
          mode: value.mode === "dark" || value.mode === "light" ? value.mode : "system",
          qolboxAccent
        };
      }
      function loadThemeSettings() {
        try {
          const stored = getLocalStorageItem(THEME_SETTINGS_KEY);
          return stored ? sanitizeThemeSettings(JSON.parse(stored)) : getDefaultThemeSettings();
        } catch {
          return getDefaultThemeSettings();
        }
      }
      function saveThemeSettings(settings) {
        setLocalStorageItem(THEME_SETTINGS_KEY, JSON.stringify(sanitizeThemeSettings(settings)));
      }
      function getRgb(hex) {
        return [1, 3, 5].map((index) => parseInt(hex.slice(index, index + 2), 16));
      }
      function mixColors(hex, target, amount) {
        const targetRgb = getRgb(target);
        return `#${getRgb(hex).map((channel, index) => Math.round(channel + ((targetRgb[index] ?? channel) - channel) * amount).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
      }
      function mix(hex, target, amount) {
        return mixColors(hex, target ? "#FFFFFF" : "#000000", amount);
      }
      function getLuminance(hex) {
        return getRgb(hex).map((channel) => channel / 255).map((channel) => channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4).reduce((sum, channel, index) => sum + channel * ([0.2126, 0.7152, 0.0722][index] ?? 0), 0);
      }
      function getContrastRatio(left, right) {
        const values = [getLuminance(left), getLuminance(right)].sort((a, b) => b - a);
        return ((values[0] ?? 0) + 0.05) / ((values[1] ?? 0) + 0.05);
      }
      function getContrastColor(hex) {
        const luminance = getLuminance(hex);
        const whiteContrast = 1.05 / (luminance + 0.05);
        const blackContrast = (luminance + 0.05) / 0.05;
        return blackContrast >= whiteContrast ? "#000000" : "#FFFFFF";
      }
      function keepThemeContrast(color, base, foreground) {
        for (let attempt = 0; attempt < 10 && getContrastRatio(color, foreground) < 4.5; attempt += 1) {
          color = mixColors(color, base, 0.5);
        }
        return getContrastRatio(color, foreground) >= 4.5 ? color : base;
      }
      function replaceNativeThemeColors(value) {
        let result = value;
        for (const [pattern, replacement] of NATIVE_BLUE_VARIABLES) result = result.replace(pattern, replacement);
        for (const [pattern, property] of NATIVE_PALETTE) result = result.replace(pattern, `var(${property})`);
        return result;
      }
      function getResolvedColorScheme(mode) {
        if (mode !== "system") return mode;
        return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
      }
      function recolorPlayerEmblems(renderer) {
        let rendererChanged = false;
        const players = readNativeProperty(renderer, "nf");
        if (!isNativeObject(players)) return false;
        for (const key of Reflect.ownKeys(players)) {
          const group = readNativeProperty(players, key);
          for (const player of Array.isArray(group) ? group : [group]) {
            const children = readNativePath(player, ["Ic", "children"]);
            if (!Array.isArray(children)) continue;
            for (const graphic of children) {
              const geometry = readNativeProperty(graphic, "geometry");
              if (!isNativeObject(graphic) || !isNativeObject(geometry)) continue;
              const data = readNativeProperty(geometry, "graphicsData");
              if (!Array.isArray(data)) continue;
              let changed = false;
              for (const item of data) {
                const fill = readNativeProperty(item, "fillStyle");
                if (!isNativeObject(fill)) continue;
                const color = readNativeProperty(fill, "color");
                if (color === NATIVE_PLAYER_EMBLEM_COLOR) playerEmblemFills.add(fill);
                if (!playerEmblemFills.has(fill) || color === playerEmblemTarget) continue;
                Reflect.set(fill, "color", playerEmblemTarget);
                changed = true;
              }
              const invalidate = readNativeProperty(geometry, "invalidate");
              if (changed && typeof invalidate === "function") {
                Reflect.apply(invalidate, geometry, []);
                rendererChanged = true;
              }
            }
          }
        }
        return rendererChanged;
      }
      function installPlayerEmblemRenderHook(renderer) {
        const pixiRenderer = readNativeProperty(renderer, "Ag");
        const render = readNativeProperty(pixiRenderer, "render");
        if (!isNativeObject(pixiRenderer) || typeof render !== "function" || readNativeProperty(render, PLAYER_EMBLEM_RENDER_HOOK)) {
          return;
        }
        const wrappedRender = function(...args) {
          if (playerEmblemTarget !== NATIVE_PLAYER_EMBLEM_COLOR) recolorPlayerEmblems(renderer);
          return Reflect.apply(render, this, args);
        };
        Reflect.set(wrappedRender, PLAYER_EMBLEM_RENDER_HOOK, true);
        Reflect.set(pixiRenderer, "render", wrappedRender);
      }
      function applyPlayerEmblemColor(gameAccent) {
        const nextTarget = gameAccent === DEFAULT_GAME_ACCENT ? NATIVE_PLAYER_EMBLEM_COLOR : parseInt(gameAccent.slice(1), 16);
        playerEmblemTarget = nextTarget;
        for (const renderer of getKnownFullscreenRenderers()) {
          if (playerEmblemTarget !== NATIVE_PLAYER_EMBLEM_COLOR) installPlayerEmblemRenderHook(renderer);
          if (recolorPlayerEmblems(renderer)) rerenderKnownRenderer(renderer);
        }
      }
      function getBackgroundContrastVariable(value) {
        const matches = NATIVE_BLUE_VARIABLES.filter(([pattern]) => {
          pattern.lastIndex = 0;
          const matched = pattern.test(value);
          pattern.lastIndex = 0;
          return matched;
        });
        const match = matches.length === 1 ? matches[0] : null;
        return match ? match[1].replace(/\)$/, "-contrast)") : null;
      }
      function getGameThemeSourceSignature() {
        const sources = [];
        for (const [index, sheet] of Array.from(document.styleSheets || []).entries()) {
          const owner = sheet.ownerNode;
          if (owner instanceof HTMLElement && (owner.id === "qolbox-style" || owner.id === GAME_THEME_STYLE_ID)) continue;
          let ruleCount = -1;
          try {
            ruleCount = sheet.cssRules.length;
          } catch {
          }
          const identity = sheet.href || (owner instanceof HTMLElement ? `${owner.tagName}:${owner.id}:${owner.getAttribute("href") || ""}` : "anonymous");
          sources.push(`${index}:${identity}:${ruleCount}`);
        }
        return sources.join("|");
      }
      function ensureGameThemeOverrides() {
        const declarations = [];
        for (const sheet of Array.from(document.styleSheets || [])) {
          const owner = sheet.ownerNode;
          if (owner instanceof HTMLElement && (owner.id === "qolbox-style" || owner.id === GAME_THEME_STYLE_ID)) continue;
          let rules;
          try {
            rules = sheet.cssRules;
          } catch {
            continue;
          }
          for (const rule of rules) {
            if (!(rule instanceof CSSStyleRule)) continue;
            const properties = [];
            let contrast = null;
            for (const property of rule.style) {
              const value = rule.style.getPropertyValue(property);
              const themed = replaceNativeThemeColors(value);
              if (themed === value) continue;
              properties.push(`${property}:${themed}${rule.style.getPropertyPriority(property) ? "!important" : ""}`);
              if (/^background(?:-color)?$/i.test(property)) contrast = getBackgroundContrastVariable(value);
            }
            if (contrast) properties.push(`color:${contrast}`);
            if (properties.length) declarations.push(`${rule.selectorText}{${properties.join(";")}}`);
          }
        }
        declarations.push(".mainMenuFancy .rightContainer .bigButton .text{color:var(--qolbox-game-accent-contrast)!important}");
        declarations.push("#appContainer .spinnerHideText{color:transparent!important;text-shadow:none!important}");
        declarations.push(".checkbox.checked{background-color:var(--qolbox-game-accent)!important;background-image:none!important;position:relative}");
        declarations.push('.checkbox.checked::after{border:solid var(--qolbox-game-accent-contrast);border-width:0 2px 2px 0;content:"";height:10px;left:7px;position:absolute;top:3px;transform:rotate(45deg);width:5px}');
        declarations.push('html[data-qolbox-color-scheme="light"] #editorContainer .sideBar .button{background-color:var(--qolbox-ui-control);background-blend-mode:difference}');
        declarations.push('html[data-qolbox-color-scheme="light"] #editorContainer .sideBar .button:hover{background-color:var(--qolbox-ui-chrome)}');
        declarations.push('html[data-qolbox-color-scheme="light"] .editorPropertiesWindow{color:var(--qolbox-ui-text)}');
        declarations.push('html[data-qolbox-color-scheme="light"] .mapListContainer .mapsContainer .element .title{color:var(--qolbox-ui-list-text)}');
        declarations.push('html[data-qolbox-color-scheme="light"] .lobbyContainer .playerElement .level{color:var(--qolbox-ui-list-meta)}');
        declarations.push('html[data-qolbox-color-scheme="light"] .lobbyContainer .playerElement{background:var(--qolbox-ui-control)}');
        declarations.push('html[data-qolbox-color-scheme="light"] .lobbyContainer .playerElement:hover{background:var(--qolbox-ui-list-hover)}');
        declarations.push('html[data-qolbox-color-scheme="light"] .lobbyContainer .playerElement .pingText.highPing{color:#B42318}');
        declarations.push('html[data-qolbox-color-scheme="light"] .roomListContainer .roomList .friendsPopup{background:var(--qolbox-ui-context-menu);color:var(--qolbox-ui-text)}');
        declarations.push('html[data-qolbox-color-scheme="light"] .lobbyContainer .settingsBox .mapTextContainer{color:#fff;text-shadow:0 1px 2px #000}');
        declarations.push('html[data-qolbox-color-scheme="light"] .lobbyContainer .settingsBox .modeDropdown{background-color:var(--qolbox-game-accent)!important;border-color:var(--qolbox-game-accent)!important;color:var(--qolbox-game-accent-contrast)!important}');
        declarations.push('html[data-qolbox-color-scheme="light"] .lobbyContainer .chatBox .content .status{color:var(--qolbox-game-accent-darker)}');
        declarations.push('html[data-qolbox-color-scheme="light"] .lobbyContainer .chatBox .content .status.jukeStatus{color:#805200}');
        declarations.push('html[data-qolbox-color-scheme="light"] .lobbyContainer .chatBox .content :is(.name,.message){filter:brightness(.4)}');
        declarations.push('html[data-qolbox-color-scheme="light"] .postGameContainer{color:var(--qolbox-ui-text)}');
        declarations.push('html[data-qolbox-color-scheme="light"] .postGameContainer .xpGroup .lvNow,html[data-qolbox-color-scheme="light"] .postGameContainer .xpGroup .lvNext,html[data-qolbox-color-scheme="light"] .postGameContainer .xpGroup .xpSlash{color:var(--qolbox-ui-list-meta)}');
        declarations.push('html[data-qolbox-color-scheme="light"] .postGameContainer .xpGroup .barContainer{background:var(--qolbox-ui-disabled)}');
        declarations.push('html[data-qolbox-color-scheme="light"] .postGameContainer .xpGroup .barInner{background:var(--qolbox-ui-list-meta)}');
        declarations.push('html[data-qolbox-color-scheme="light"] .qolboxPlayerInfoLabel{color:var(--qolbox-ui-list-meta)}');
        declarations.push('html[data-qolbox-color-scheme="light"] .qolboxPlayerInfoValue{color:var(--qolbox-ui-text)}');
        declarations.push('html[data-qolbox-color-scheme="light"] .qolboxPlayerInfoUnknownProgress{opacity:.68}');
        declarations.push(".cornerButton .items .item{color:#fff!important;text-shadow:1px 1px 2px #000!important}");
        declarations.push(".cornerButton .items .item.disabled{color:#737b86!important}");
        let style = document.getElementById(GAME_THEME_STYLE_ID);
        if (!style) {
          style = document.createElement("style");
          style.id = GAME_THEME_STYLE_ID;
          (document.head || document.documentElement).append(style);
        }
        style.textContent = declarations.join("\n");
      }
      function applyThemeSettings(value) {
        const settings = sanitizeThemeSettings(value);
        const documentChanged = appliedDocument !== document;
        const colorScheme = getResolvedColorScheme(settings.mode);
        const themeSignature = `${settings.qolboxAccent}|${settings.gameAccent}|${settings.mode}|${colorScheme}`;
        if (documentChanged || appliedThemeSignature !== themeSignature) {
          const root = document.documentElement.style;
          document.documentElement.dataset.qolboxColorScheme = colorScheme;
          root.colorScheme = colorScheme;
          for (const [property, color] of Object.entries(COLOR_SCHEMES[colorScheme])) root.setProperty(property, color);
          const [red, green, blue] = getRgb(settings.qolboxAccent);
          root.setProperty("--qolbox-accent", settings.qolboxAccent);
          root.setProperty("--qolbox-accent-rgb", `${red} ${green} ${blue}`);
          root.setProperty("--qolbox-accent-contrast", getContrastColor(settings.qolboxAccent));
          const gameForeground = getContrastColor(settings.gameAccent);
          const gameVariants = {
            accent: settings.gameAccent,
            hover: mix(settings.gameAccent, 255, 0.12),
            focus: mix(settings.gameAccent, 255, 0.16),
            shadow: mix(settings.gameAccent, 0, 0.26),
            bright: mix(settings.gameAccent, 255, 0.22),
            dark: mix(settings.gameAccent, 0, 0.25),
            darker: mix(settings.gameAccent, 0, 0.4)
          };
          for (const [name, candidate] of Object.entries(gameVariants)) {
            const color = keepThemeContrast(candidate, settings.gameAccent, gameForeground);
            const variable = name === "accent" ? "--qolbox-game-accent" : `--qolbox-game-accent-${name}`;
            root.setProperty(variable, color);
            root.setProperty(`${variable}-contrast`, gameForeground);
          }
          appliedThemeSignature = themeSignature;
        }
        const sourceSignature = getGameThemeSourceSignature();
        if (documentChanged || themedStylesheetSignature !== sourceSignature || !document.getElementById(GAME_THEME_STYLE_ID)) {
          ensureGameThemeOverrides();
          themedStylesheetSignature = sourceSignature;
        }
        applyPlayerEmblemColor(settings.gameAccent);
        appliedDocument = document;
        return settings;
      }
      function createThemeSettingsController() {
        let settings = loadThemeSettings();
        const systemTheme = window.matchMedia?.("(prefers-color-scheme: light)");
        function apply() {
          settings = applyThemeSettings(settings);
        }
        function setThemeSettings(value) {
          settings = sanitizeThemeSettings(value);
          saveThemeSettings(settings);
          apply();
        }
        systemTheme?.addEventListener?.("change", () => {
          if (settings.mode === "system") apply();
        });
        return {
          applyThemeSettings: apply,
          getThemeSettings: () => ({ ...settings }),
          setThemeSettings
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
      function clampPercent(value, fallback = 0) {
        if (value === null || value === void 0 || typeof value === "string" && value.trim() === "") {
          return fallback;
        }
        const numericValue = Number(value);
        if (!Number.isFinite(numericValue)) {
          return fallback;
        }
        return Math.max(0, Math.min(100, Math.round(numericValue)));
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
        return clampPercent(getLocalStorageItem(GAME_VOLUME_KEY), DEFAULT_GAME_PERCENT);
      }
      function saveGamePercent(percent) {
        setLocalStorageItem(GAME_VOLUME_KEY, String(percent));
      }
      function loadJukeboxState() {
        const fallback = { percent: null, muted: false };
        try {
          const rawState = getLocalStorageItem(JUKEBOX_STATE_KEY);
          if (!rawState) {
            return fallback;
          }
          const parsed = JSON.parse(rawState);
          if (!isRecord(parsed)) {
            return fallback;
          }
          return {
            percent: parsed.percent !== null && parsed.percent !== void 0 ? clampJukeboxPercent(parsed.percent) : null,
            muted: parsed.muted === true
          };
        } catch {
          return fallback;
        }
      }
      function saveJukeboxState(state) {
        setLocalStorageItem(JUKEBOX_STATE_KEY, JSON.stringify(state));
      }

      // src/hitbox/howler-audio-adapter.ts
      function createHowlerGameAudioAdapter(options) {
        let originalHowlVolume = null;
        let originalHowlStop = null;
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
            isCallable(currentVolumeMethod) && readNativeReflectProperty(currentVolumeMethod, "__qolboxWrapped") === true
          );
          if (!volumePatched && isCallable(currentVolumeMethod)) {
            let wrappedVolume2 = function(...args) {
              if (!args.length) {
                const baseVolume = readNativeReflectProperty(this, "__qolboxBaseVolume");
                if (typeof baseVolume === "number") {
                  return baseVolume;
                }
                return Reflect.apply(baseVolumeMethod, this, []);
              }
              const [value, ...rest] = args;
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
            volumePatched = replaceNativeReflectProperty(howlPrototype, "volume", wrappedVolume2);
          }
          const currentPlayMethod = readNativeReflectProperty(howlPrototype, "play");
          const playPatched = isCallable(currentPlayMethod) && readNativeReflectProperty(currentPlayMethod, "__qolboxReserveAudioWrapped");
          if (isCallable(currentPlayMethod) && !playPatched) {
            let wrappedPlay2 = function(...args) {
              if (options.isAudioEnabled() && options.shouldSuppressReserveRetryAudio()) {
                return void 0;
              }
              const customPlaybackId = options.isAudioEnabled() ? options.playCustomSound?.(this) : null;
              if (typeof customPlaybackId === "number") {
                if (originalHowlStop) Reflect.apply(originalHowlStop, this, []);
                return customPlaybackId;
              }
              return Reflect.apply(basePlayMethod, this, args);
            };
            var wrappedPlay = wrappedPlay2;
            const basePlayMethod = currentPlayMethod;
            setNativeReflectProperty(wrappedPlay2, "__qolboxReserveAudioWrapped", true);
            replaceNativeReflectProperty(howlPrototype, "play", wrappedPlay2);
          }
          const currentStopMethod = readNativeReflectProperty(howlPrototype, "stop");
          const stopPatched = isCallable(currentStopMethod) && readNativeReflectProperty(currentStopMethod, "__qolboxSoundBankWrapped");
          if (isCallable(currentStopMethod) && !stopPatched) {
            let wrappedStop2 = function(id, ...rest) {
              if (options.stopCustomSound?.(this, id)) return this;
              return Reflect.apply(baseStopMethod, this, [id, ...rest]);
            };
            var wrappedStop = wrappedStop2;
            const baseStopMethod = currentStopMethod;
            originalHowlStop = baseStopMethod;
            setNativeReflectProperty(wrappedStop2, "__qolboxSoundBankWrapped", true);
            replaceNativeReflectProperty(howlPrototype, "stop", wrappedStop2);
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
        return (clampPercent(percent, DEFAULT_GAME_PERCENT) / 100) ** GAME_CURVE_EXPONENT;
      }
      function percentToJukeboxVolume(percent) {
        const clampedPercent = clampJukeboxPercent(percent);
        if (clampedPercent <= 0) {
          return 0;
        }
        return Math.max(1, Math.round((clampedPercent / 100) ** JUKEBOX_CURVE_EXPONENT * 100));
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
        const matrixValues = transform.match(/^matrix\(([^)]+)\)$/i)?.[1];
        if (matrixValues) {
          const values = matrixValues.split(",").map((value) => Number(value.trim()));
          if (values.length >= 4 && values.every(Number.isFinite)) {
            return normalizeJukeboxAngle(Math.atan2(values[1] ?? 0, values[0] ?? 0) * 180 / Math.PI);
          }
        }
        const matrix3dValues = transform.match(/^matrix3d\(([^)]+)\)$/i)?.[1];
        if (matrix3dValues) {
          const values = matrix3dValues.split(",").map((value) => Number(value.trim()));
          if (values.length >= 16 && values.every(Number.isFinite)) {
            return normalizeJukeboxAngle(Math.atan2(values[1] ?? 0, values[0] ?? 0) * 180 / Math.PI);
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
        if (isTabbableElement(element) && element.tabIndex !== -1) {
          element.tabIndex = -1;
        }
      }
      function keepInBrowserTabOrder(element) {
        if (isTabbableElement(element) && element.tabIndex !== 0) {
          element.tabIndex = 0;
        }
      }
      function matchesElementOrDescendant(node, selector) {
        if (!(node instanceof Element)) {
          return false;
        }
        return node.matches(selector) || Boolean(node.querySelector(selector));
      }
      function mutationTouchesSelector(record, selector) {
        const targetElement = record.target instanceof Element ? record.target : record.target.parentElement instanceof Element ? record.target.parentElement : null;
        if (targetElement?.matches(selector)) {
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
        const label = `Volume: ${gamePercent}%`;
        if (item.textContent?.trim() !== label) item.textContent = label;
        item.setAttribute("title", "Drag vertically to adjust by 1%, scroll or use arrow keys by 5%, left-click up, right-click down");
        item.style.cursor = "ns-resize";
        item.style.userSelect = "none";
        keepInBrowserTabOrder(item);
        item.setAttribute("role", "slider");
        item.setAttribute("aria-label", "Game volume");
        item.setAttribute("aria-valuemin", "0");
        item.setAttribute("aria-valuemax", "100");
        item.setAttribute("aria-valuenow", String(gamePercent));
        item.setAttribute("aria-valuetext", `${gamePercent}%`);
      }

      // src/features/game-volume-menu-control.ts
      var PATCHED_VIEW_ATTRIBUTES = [
        "aria-label",
        "aria-valuemax",
        "aria-valuemin",
        "aria-valuenow",
        "aria-valuetext",
        "role",
        "tabindex",
        "title"
      ];
      var DRAG_PIXELS_PER_PERCENT = 2;
      var POINTER_PIXEL_EPSILON = 0.01;
      function getDragPercentDelta(delta) {
        return Math.sign(delta) * Math.floor((Math.abs(delta) + POINTER_PIXEL_EPSILON) / DRAG_PIXELS_PER_PERCENT);
      }
      function readNumberProperty(source, property) {
        const value = readObjectProperty(source, property);
        return typeof value === "number" ? value : Number(value);
      }
      function createGameVolumeMenuController(options) {
        let currentGameMenuItem = null;
        let originalView = null;
        let activeDrag = null;
        let suppressNextClick = false;
        function captureOriginalView(item) {
          if (originalView?.item === item) {
            return;
          }
          originalView = {
            attributes: new Map(PATCHED_VIEW_ATTRIBUTES.map((attribute) => [attribute, item.getAttribute(attribute)])),
            cursor: item.style.cursor,
            item,
            textContent: item.textContent,
            userSelect: item.style.userSelect
          };
        }
        function cleanupGameVolumeMenu() {
          if (!originalView) {
            return;
          }
          const { attributes, cursor, item, textContent, userSelect } = originalView;
          item.textContent = textContent;
          item.style.cursor = cursor;
          item.style.userSelect = userSelect;
          for (const [attribute, value] of attributes) {
            if (value === null) {
              item.removeAttribute(attribute);
            } else {
              item.setAttribute(attribute, value);
            }
          }
          originalView = null;
          currentGameMenuItem = null;
        }
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
          captureOriginalView(currentGameMenuItem);
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
          captureOriginalView(item);
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
                if (suppressNextClick) {
                  suppressNextClick = false;
                  return;
                }
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
            item.addEventListener("pointerdown", (rawEvent) => {
              if (!(rawEvent instanceof PointerEvent)) return;
              const event = rawEvent;
              if (!options.isAudioEnabled() || event.button !== 0 || !(item instanceof HTMLElement)) return;
              activeDrag = {
                moved: false,
                pointerId: event.pointerId,
                startPercent: options.getGamePercent(),
                startY: event.clientY
              };
              focusElementWithoutScroll(item);
              item.setPointerCapture(event.pointerId);
            }, true);
            item.addEventListener("pointermove", (rawEvent) => {
              if (!(rawEvent instanceof PointerEvent)) return;
              const event = rawEvent;
              if (!activeDrag || activeDrag.pointerId !== event.pointerId) return;
              const delta = activeDrag.startY - event.clientY;
              if (Math.abs(delta) < 1) return;
              event.preventDefault();
              event.stopImmediatePropagation();
              activeDrag.moved = true;
              const percentDelta = getDragPercentDelta(delta);
              options.setGamePercent(
                activeDrag.startPercent + percentDelta
              );
            }, true);
            const finishDrag = (event) => {
              if (!(event instanceof PointerEvent)) return;
              if (!activeDrag || activeDrag.pointerId !== event.pointerId) return;
              const cancelled = event.type === "pointercancel";
              const delta = activeDrag.startY - event.clientY;
              if (!cancelled && Math.abs(delta) >= 1) {
                activeDrag.moved = true;
                const percentDelta = getDragPercentDelta(delta);
                options.setGamePercent(activeDrag.startPercent + percentDelta);
              }
              suppressNextClick = !cancelled;
              if (!cancelled && !activeDrag.moved) {
                options.setGamePercent(options.getGamePercent() + options.stepPercent);
              }
              activeDrag = null;
              if (item instanceof HTMLElement && item.hasPointerCapture(event.pointerId)) {
                item.releasePointerCapture(event.pointerId);
              }
            };
            item.addEventListener("pointerup", finishDrag, true);
            item.addEventListener("pointercancel", finishDrag, true);
          }
          updateGameVolumeText();
          return true;
        }
        return {
          cleanupGameVolumeMenu,
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
          playCustomSound: options.playCustomSound,
          stopCustomSound: options.stopCustomSound,
          shouldSuppressReserveRetryAudio: options.isReserveRetryAudioSuppressed
        });
        const menuController = createGameVolumeMenuController({
          stepPercent: STEP_PERCENT,
          getGamePercent: () => gamePercent,
          isAudioEnabled: options.isAudioEnabled,
          setGamePercent
        });
        function applyGameVolume() {
          menuController.updateGameVolumeText();
          howlerAudio.applyGameVolumeToHowls();
        }
        function setGamePercent(nextPercent) {
          gamePercent = clampPercent(nextPercent, DEFAULT_GAME_PERCENT);
          saveGamePercent(gamePercent);
          applyGameVolume();
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
          cleanupGameVolumeMenu: menuController.cleanupGameVolumeMenu,
          hookHowlPrototype,
          patchGameVolumeMenu: menuController.patchGameVolumeMenu,
          setGamePercent,
          shouldSuppressReserveRetryAudio: options.isReserveRetryAudioSuppressed
        };
      }

      // src/hitbox/youtube-player-native.ts
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
        if (!isRecord(optionsArg)) {
          return wrappedArgs;
        }
        const events = isRecord(optionsArg.events) ? optionsArg.events : {};
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
              return isCallable(originalOnReady) ? Reflect.apply(originalOnReady, this, [event, ...readyArgs]) : void 0;
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
        const trackedPlayers = /* @__PURE__ */ new Set();
        const originalPlayerStates = /* @__PURE__ */ new Map();
        let hookInstalled = false;
        let playerStateApplied = false;
        let retryTimer = 0;
        let retryCount = 0;
        let readyCallbackHookInstalled = false;
        function trackPlayer(player) {
          if (!player || !isCallable(readObjectProperty(player, "setVolume"))) {
            return;
          }
          trackedPlayers.add(player);
        }
        function discoverPlayers() {
          const yt = readObjectProperty(window, "YT");
          const getPlayer = readObjectProperty(yt, "get");
          if (!isCallable(getPlayer)) {
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
          if (!player || !isCallable(setVolume)) {
            trackedPlayers.delete(player);
            return;
          }
          try {
            const setPlaybackRate = readObjectProperty(player, "setPlaybackRate");
            const getPlaybackRate = readObjectProperty(player, "getPlaybackRate");
            const playbackRate = isCallable(getPlaybackRate) ? Reflect.apply(getPlaybackRate, player, []) : null;
            if (isCallable(setPlaybackRate) && playbackRate !== 1) {
              Reflect.apply(setPlaybackRate, player, [1]);
            }
            const getVolume = readObjectProperty(player, "getVolume");
            const getMuted = readObjectProperty(player, "isMuted");
            const currentVolume = isCallable(getVolume) ? Reflect.apply(getVolume, player, []) : null;
            const currentlyMuted = isCallable(getMuted) ? Reflect.apply(getMuted, player, []) : null;
            if (!originalPlayerStates.has(player)) {
              originalPlayerStates.set(player, {
                muted: typeof currentlyMuted === "boolean" ? currentlyMuted : null,
                volume: typeof currentVolume === "number" && Number.isFinite(currentVolume) ? currentVolume : null
              });
            }
            if (options.isMuted()) {
              if (currentVolume !== 0) {
                Reflect.apply(setVolume, player, [0]);
              }
              const mute = readObjectProperty(player, "mute");
              if (isCallable(mute) && currentlyMuted !== true) {
                Reflect.apply(mute, player, []);
              }
            } else {
              const targetVolume = options.getVolume();
              if (currentVolume !== targetVolume) {
                Reflect.apply(setVolume, player, [targetVolume]);
              }
              const unMute = readObjectProperty(player, "unMute");
              if (isCallable(unMute) && currentlyMuted === true) {
                Reflect.apply(unMute, player, []);
              }
            }
            playerStateApplied = true;
          } catch {
            trackedPlayers.delete(player);
            originalPlayerStates.delete(player);
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
        function restoreTrackedPlayers() {
          if (!playerStateApplied) {
            return;
          }
          for (const player of Array.from(trackedPlayers)) {
            const setVolume = readObjectProperty(player, "setVolume");
            if (!player || !isCallable(setVolume)) {
              trackedPlayers.delete(player);
              originalPlayerStates.delete(player);
              continue;
            }
            try {
              const originalState = originalPlayerStates.get(player);
              if (typeof originalState?.volume === "number") {
                Reflect.apply(setVolume, player, [originalState.volume]);
              }
              const muteMethod = readObjectProperty(player, originalState?.muted ? "mute" : "unMute");
              if (originalState?.muted !== null && originalState?.muted !== void 0 && isCallable(muteMethod)) {
                Reflect.apply(muteMethod, player, []);
              }
            } catch {
              trackedPlayers.delete(player);
            }
          }
          originalPlayerStates.clear();
          trackedPlayers.clear();
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
          if (!isCallable(callback) || readBooleanProperty2(callback, "__qolboxWrapped")) {
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
          if (hookInstalled || readBooleanProperty2(playerConstructor, "__qolboxWrapped")) {
            hookInstalled = true;
            retryCount = 0;
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
          if (!setObjectProperty(yt, "Player", WrappedPlayer) || readObjectProperty(yt, "Player") !== WrappedPlayer) {
            scheduleRetry();
            return false;
          }
          hookInstalled = true;
          retryCount = 0;
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
      function readJukeboxNumberProperty(source, property) {
        const value = readObjectProperty(source, property);
        return typeof value === "number" ? value : Number(value);
      }
      function readJukeboxBooleanProperty(source, property) {
        return readObjectProperty(source, property) === true;
      }
      function isJukeboxStyleDatasetElement(value) {
        return value instanceof Element && typeof readObjectProperty(value, "dataset") === "object" && typeof readObjectProperty(value, "style") === "object";
      }
      function requestJukeboxPointerCapture(knob, event) {
        const setPointerCapture = readObjectProperty(knob, "setPointerCapture");
        const pointerId = readObjectProperty(event, "pointerId");
        if (!isCallable(setPointerCapture) || pointerId === void 0) {
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

      // src/features/chat-command-completions.ts
      var COMMANDS = [
        "/ban",
        "/blacklist",
        "/blacklist clear",
        "/blacklist off",
        "/blacklist on",
        "/blue",
        "/end",
        "/help",
        "/host",
        "/join",
        "/kick",
        "/lock",
        "/record",
        "/red",
        "/restart",
        "/settings",
        "/settings all",
        "/spec",
        "/start",
        "/switch",
        "/unlock"
      ];
      var PLAYER_COMMANDS = ["/ban", "/blacklist", "/blue", "/host", "/join", "/kick", "/red", "/spec"];
      var GROUP_COMMANDS = ["/blue", "/join", "/red", "/spec"];
      var GROUPS = ["all", "playing", "spectators"];
      function formatPlayerName(name) {
        return /^(?:all|playing|spectators|clear|on|off)$/i.test(name) ? `"${name}"` : name;
      }
      function getChatCommandCandidates() {
        const players = getSessionPlayers().map(({ player }) => String(getPlayerName(player) || "").trim()).filter(Boolean);
        const candidates = new Set(COMMANDS);
        if (areAdvancedCommandAliasesEnabled()) {
          candidates.add("/r");
          candidates.add("/rec");
        }
        for (const command of GROUP_COMMANDS) {
          for (const group of GROUPS) candidates.add(`${command} ${group}`);
        }
        for (const name of players) {
          const formattedName = formatPlayerName(name);
          for (const command of PLAYER_COMMANDS) candidates.add(`${command} ${formattedName}`);
          candidates.add(`/blacklist remove ${formattedName}`);
        }
        return candidates;
      }
      function isKnownChatCommand(value) {
        const typed = value.trimStart().toLowerCase();
        return typed.startsWith("/") && [...getChatCommandCandidates()].some((candidate) => candidate.toLowerCase() === typed);
      }
      function getChatCommandCompletions(value) {
        const leadingSpace = value.match(/^\s*/)?.[0] || "";
        const typed = value.slice(leadingSpace.length);
        if (!typed.startsWith("/")) return [];
        const normalized = typed.toLowerCase();
        return [...getChatCommandCandidates()].filter((candidate) => candidate.length > typed.length && candidate.toLowerCase().startsWith(normalized)).sort((left, right) => left.localeCompare(right) || left.length - right.length).map((candidate) => `${leadingSpace}${candidate}`);
      }

      // src/features/chat-input-controls.ts
      function createChatInputController(options) {
        let escapeHooksInstalled = false;
        let commandAliasHooksInstalled = false;
        let suppressEscapeKeyUntil = 0;
        let completionIndex = 0;
        let completionInput = null;
        let completionValue = "";
        let completionGhost = null;
        const originalTabIndexByInput = /* @__PURE__ */ new Map();
        function hideCommandCompletion() {
          completionGhost?.remove();
          completionInput?.classList.remove("qolboxChatCommandRichInput");
          completionGhost = null;
          completionInput = null;
          completionValue = "";
          completionIndex = 0;
        }
        function appendCommandPart(host, text, start, end, typedLength, className) {
          const typedEnd = Math.min(end, Math.max(start, typedLength));
          if (typedEnd > start) {
            const entered = document.createElement("span");
            entered.className = className;
            entered.textContent = text.slice(start, typedEnd);
            host.append(entered);
          }
          if (end > typedEnd) {
            const suggestion = document.createElement("span");
            suggestion.className = `${className} qolboxChatCommandSuggestion qolboxChatCommandSuffix`;
            suggestion.textContent = text.slice(typedEnd, end);
            host.append(suggestion);
          }
        }
        function renderCommandText(host, text, typedLength) {
          const commandStart = text.search(/\S/);
          const commandEnd = text.indexOf(" ", Math.max(0, commandStart));
          if (commandStart > 0) host.append(document.createTextNode(text.slice(0, commandStart)));
          const split = commandEnd < 0 ? text.length : commandEnd;
          appendCommandPart(host, text, Math.max(0, commandStart), split, typedLength, "qolboxChatCommandName");
          appendCommandPart(host, text, split, text.length, typedLength, "qolboxChatCommandArgument");
        }
        function syncCommandCompletion(input, keepIndex = false) {
          if (!options.areLobbyCommandsEnabled() || document.activeElement !== input || input.selectionStart !== input.value.length || input.selectionEnd !== input.value.length) {
            hideCommandCompletion();
            return;
          }
          const completions = getChatCommandCompletions(input.value);
          if (!completions.length && !isKnownChatCommand(input.value)) {
            hideCommandCompletion();
            return;
          }
          if (!keepIndex || completionInput !== input || completionValue !== input.value) completionIndex = 0;
          if (completions.length) completionIndex = (completionIndex + completions.length) % completions.length;
          const completion = completions[completionIndex] || input.value;
          if (!completion) return;
          completionGhost || (completionGhost = document.createElement("span"));
          completionGhost.className = "qolboxChatCommandGhost";
          completionGhost.setAttribute("aria-hidden", "true");
          const host = input.offsetParent instanceof HTMLElement ? input.offsetParent : input.parentElement;
          if (!host) return;
          host.append(completionGhost);
          if (completionInput && completionInput !== input) completionInput.classList.remove("qolboxChatCommandRichInput");
          input.classList.add("qolboxChatCommandRichInput");
          const style = getComputedStyle(input);
          Object.assign(completionGhost.style, {
            bottom: "auto",
            boxSizing: style.boxSizing,
            font: style.font,
            height: `${input.offsetHeight}px`,
            left: `${input.offsetLeft}px`,
            letterSpacing: style.letterSpacing,
            lineHeight: style.lineHeight,
            padding: style.padding,
            textAlign: style.textAlign,
            textIndent: style.textIndent,
            top: `${input.offsetTop}px`,
            width: `${input.offsetWidth}px`
          });
          completionGhost.replaceChildren();
          renderCommandText(completionGhost, completion, input.value.length);
          completionGhost.scrollLeft = input.scrollLeft;
          completionInput = input;
          completionValue = input.value;
        }
        function getCompletionInput(target) {
          return target instanceof HTMLInputElement && isChatInput(target) ? target : null;
        }
        function handleChatCompletionInput(event) {
          const input = getCompletionInput(event.target);
          if (input) syncCommandCompletion(input);
        }
        function handleChatCompletionKeydown(event) {
          const input = getCompletionInput(event.target);
          if (!input || !options.areLobbyCommandsEnabled()) return false;
          const completions = getChatCommandCompletions(input.value);
          if (!completions.length || input.selectionStart !== input.value.length || input.selectionEnd !== input.value.length) {
            if (input.selectionStart !== input.value.length || input.selectionEnd !== input.value.length) hideCommandCompletion();
            return false;
          }
          if (event.key === "ArrowUp" || event.key === "ArrowDown") {
            event.preventDefault();
            event.stopImmediatePropagation();
            completionIndex += event.key === "ArrowDown" ? 1 : -1;
            syncCommandCompletion(input, true);
            return true;
          }
          if (event.key !== "Tab" && event.key !== "ArrowRight") return false;
          event.preventDefault();
          event.stopImmediatePropagation();
          completionIndex = (completionIndex + completions.length) % completions.length;
          input.value = completions[completionIndex] || input.value;
          input.dispatchEvent(new Event("input", { bubbles: true }));
          syncCommandCompletion(input);
          return true;
        }
        function isChatInput(element) {
          return isChatInputElement(element, options.chatInputSelector);
        }
        function isLobbyChatInput(element) {
          return isChatInputElement(element, options.lobbyChatInputSelector);
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
          if (handleChatCompletionKeydown(event)) return;
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
          document.addEventListener("input", handleChatCompletionInput, true);
          document.addEventListener("focusout", hideCommandCompletion, true);
          document.addEventListener("pointerup", handleChatCompletionInput, true);
        }
        function patchChatTabOrder() {
          if (!options.isChatFeatureEnabled()) {
            return;
          }
          if (!document.querySelector(".inGameChat, .lobbyContainer")) {
            return;
          }
          for (const input of originalTabIndexByInput.keys()) {
            if (!input.isConnected) {
              originalTabIndexByInput.delete(input);
            }
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
      function isStyleElement(value) {
        return value instanceof Element && typeof readObjectProperty(value, "style") === "object";
      }
      function isStyleDatasetElement(value) {
        return value instanceof Element && typeof readObjectProperty(value, "dataset") === "object" && typeof readObjectProperty(value, "style") === "object";
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
          const onMouseEnter = readObjectProperty(jukebox, "onmouseenter");
          if (isCallable(onMouseEnter)) {
            Reflect.apply(onMouseEnter, jukebox, []);
          } else {
            setJukeboxBottom(jukebox, "0px");
          }
          options.scheduleUiWork({ passes: options.resizeSettlePasses });
        }
        function closeJukeboxFromKeyboardFocus(jukebox, nextFocusTarget) {
          if (!options.isAudioEnabled() || !jukebox || nextFocusTarget instanceof Element && jukebox.contains(nextFocusTarget) || jukebox.matches(":hover")) {
            return;
          }
          const onMouseLeave = readObjectProperty(jukebox, "onmouseleave");
          if (isCallable(onMouseLeave)) {
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
            (event) => closeJukeboxFromKeyboardFocus(jukebox, readObjectProperty(event, "relatedTarget")),
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
          setObjectProperty(window, "__qolboxJukeboxGlobalsPatched", true);
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
        let createdJukeboxMenuItem = false;
        let adoptedView = null;
        const wiredItems = /* @__PURE__ */ new WeakSet();
        function updateJukeboxMenuItem() {
          if (!currentJukeboxMenuItem || !currentJukeboxMenuItem.isConnected) {
            return;
          }
          const label = options.getLabel();
          currentJukeboxMenuItem.setAttribute(
            "data-qolbox-icon",
            label.startsWith("Unmute") ? "radio-off" : "radio"
          );
          if (currentJukeboxMenuItem.textContent?.trim() !== label) {
            currentJukeboxMenuItem.textContent = label;
          }
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
            item = Array.from(container.querySelectorAll(":scope > .item")).find((candidate) => /^(?:Mute|Unmute) Jukebox$/.test(candidate.textContent?.trim() || "")) || null;
            createdJukeboxMenuItem = !item;
            if (!item) {
              item = document.createElement("div");
              item.className = "item";
              const beforeItem = options.findChangeControlsItem(container);
              container.insertBefore(item, beforeItem);
            } else {
              adoptedView = {
                icon: item.getAttribute("data-qolbox-icon"),
                item,
                text: item.textContent,
                title: item.getAttribute("title")
              };
            }
            item.dataset.qolboxJukeboxMenu = "true";
          }
          if (!wiredItems.has(item)) {
            wiredItems.add(item);
            item.addEventListener(
              "click",
              (event) => {
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
        function removeJukeboxMenuItem() {
          if (currentJukeboxMenuItem && currentJukeboxMenuItem.isConnected) {
            if (createdJukeboxMenuItem) {
              currentJukeboxMenuItem.remove();
            } else if (adoptedView?.item === currentJukeboxMenuItem) {
              currentJukeboxMenuItem.textContent = adoptedView.text;
              for (const [attribute, value] of [["data-qolbox-icon", adoptedView.icon], ["title", adoptedView.title]]) {
                if (value === null) currentJukeboxMenuItem.removeAttribute(attribute);
                else currentJukeboxMenuItem.setAttribute(attribute, value);
              }
              delete currentJukeboxMenuItem.dataset.qolboxJukeboxMenu;
            }
          }
          currentJukeboxMenuItem = null;
          createdJukeboxMenuItem = false;
          adoptedView = null;
        }
        return {
          patchJukeboxMenu,
          removeJukeboxMenuItem,
          updateJukeboxMenuItem
        };
      }

      // src/features/jukebox-knob-view.ts
      var PATCHED_KNOB_ATTRIBUTES = [
        "aria-label",
        "aria-orientation",
        "aria-valuemin",
        "aria-valuemax",
        "aria-valuenow",
        "aria-valuetext",
        "role",
        "tabindex",
        "title"
      ];
      var originalKnobViews = /* @__PURE__ */ new Map();
      function isStyleElement2(value) {
        return value instanceof Element && typeof readObjectProperty(value, "style") === "object";
      }
      function setAttribute(element, name, value) {
        if (element.getAttribute(name) !== value) element.setAttribute(name, value);
      }
      function captureJukeboxKnobView(knob) {
        for (const savedKnob of originalKnobViews.keys()) {
          if (!savedKnob.isConnected) {
            originalKnobViews.delete(savedKnob);
          }
        }
        if (originalKnobViews.has(knob)) {
          return;
        }
        const bar = knob.querySelector(".barSVG");
        const styledBar = isStyleElement2(bar) ? bar : null;
        const arcPath = knob.querySelector(".arcSVG path");
        originalKnobViews.set(knob, {
          arcPath,
          arcPathData: arcPath?.getAttribute("d") ?? null,
          attributes: new Map(PATCHED_KNOB_ATTRIBUTES.map((attribute) => [attribute, knob.getAttribute(attribute)])),
          bar: styledBar,
          barTransform: styledBar?.style.transform ?? "",
          knob,
          touchAction: isStyleElement2(knob) ? knob.style.touchAction : ""
        });
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
        setAttribute(knob, "aria-label", "Jukebox volume");
        setAttribute(knob, "aria-orientation", "vertical");
        setAttribute(knob, "aria-valuemin", "0");
        setAttribute(knob, "aria-valuemax", "100");
        setAttribute(knob, "aria-valuenow", String(effectivePercent));
        setAttribute(knob, "aria-valuetext", state.muted ? `Muted (${effectivePercent}%)` : `${effectivePercent}%`);
        setAttribute(knob, "role", "slider");
        keepInBrowserTabOrder(knob);
      }
      function setJukeboxKnobVisual(knob, visualPercent, state) {
        if (!knob) {
          return;
        }
        captureJukeboxKnobView(knob);
        const angle = percentToJukeboxAngle(visualPercent ?? DEFAULT_JUKEBOX_PERCENT);
        const bar = knob.querySelector(".barSVG");
        const arcPath = knob.querySelector(".arcSVG path");
        if (isStyleElement2(bar)) {
          const transform = `rotate(${angle}deg)`;
          if (bar.style.transform !== transform) bar.style.transform = transform;
        }
        if (arcPath) {
          const startPoint = polarToArcPoint(JUKEBOX_MIN_ANGLE);
          const endPoint = polarToArcPoint(angle);
          const sweepDegrees = Math.max(0, angle - JUKEBOX_MIN_ANGLE);
          const largeArcFlag = sweepDegrees > 180 ? 1 : 0;
          setAttribute(
            arcPath,
            "d",
            `M ${startPoint.x} ${startPoint.y} A ${JUKEBOX_ARC_RADIUS} ${JUKEBOX_ARC_RADIUS} 0 ${largeArcFlag} 1 ${endPoint.x} ${endPoint.y}`
          );
        }
        updateJukeboxKnobAccessibility(knob, visualPercent, state);
      }
      function restoreJukeboxKnobViews() {
        for (const snapshot of originalKnobViews.values()) {
          for (const [attribute, value] of snapshot.attributes) {
            if (value === null) {
              snapshot.knob.removeAttribute(attribute);
            } else {
              snapshot.knob.setAttribute(attribute, value);
            }
          }
          if (isStyleElement2(snapshot.knob)) {
            snapshot.knob.style.touchAction = snapshot.touchAction;
          }
          if (snapshot.bar) {
            snapshot.bar.style.transform = snapshot.barTransform;
          }
          if (snapshot.arcPath) {
            if (snapshot.arcPathData === null) {
              snapshot.arcPath.removeAttribute("d");
            } else {
              snapshot.arcPath.setAttribute("d", snapshot.arcPathData);
            }
          }
        }
        originalKnobViews.clear();
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
          getVolume: () => percentToJukeboxVolume(jukeboxState.getEffectivePercent()),
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
          getLabel: jukeboxState.getMenuLabel,
          isAudioEnabled: options.isAudioEnabled,
          onToggleMute: toggleJukeboxMute
        });
        const knobInteraction = createJukeboxKnobInteractionController({
          dragSensitivity: options.jukeboxDragSensitivity,
          wheelStep: options.jukeboxWheelStep,
          applyJukeboxState,
          ensureJukeboxPercent,
          getEffectiveJukeboxPercent: jukeboxState.getEffectivePercent,
          getJukeboxPercent: () => jukeboxState.getPercent(),
          isAudioEnabled: options.isAudioEnabled,
          isJukeboxMuted: () => jukeboxState.isMuted(),
          setJukeboxPercent,
          unmuteJukeboxIfMuted: () => jukeboxState.unmuteIfMuted(),
          updateJukeboxMenuItem: menuController.updateJukeboxMenuItem
        });
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
        function setJukeboxPercent(nextPercent) {
          if (!options.isAudioEnabled()) {
            return;
          }
          jukeboxState.setPercent(nextPercent);
          menuController.updateJukeboxMenuItem();
          setJukeboxKnobVisual(findJukeboxKnob(), jukeboxState.getPercent(), jukeboxState.getState());
          applyJukeboxState();
        }
        function toggleJukeboxMute() {
          if (!options.isAudioEnabled()) {
            return;
          }
          ensureJukeboxPercent(findJukeboxKnob());
          jukeboxState.toggleMuted();
          menuController.updateJukeboxMenuItem();
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
          keyboardFocus.patchJukeboxKeyboardFocus(knob);
          knobInteraction.patchJukeboxKnobInteraction(knob);
          return true;
        }
        function restoreJukeboxState() {
          restoreJukeboxKnobViews();
          youTubeAdapter.restoreTrackedPlayers();
        }
        function setJukeboxState(nextState) {
          jukeboxState.setState(nextState);
        }
        return {
          applyJukeboxState,
          findJukeboxKnob,
          getEffectiveJukeboxPercent: jukeboxState.getEffectivePercent,
          handleGameplayTabFocus: keyboardFocus.handleGameplayTabFocus,
          hookYouTubePlayer: youTubeAdapter.hookPlayerConstructor,
          installTabFocusHooks: keyboardFocus.installTabFocusHooks,
          installYouTubeReadyCallbackHook: youTubeAdapter.installReadyCallbackHook,
          patchJukeboxKeyboardFocus: keyboardFocus.patchJukeboxKeyboardFocus,
          patchJukeboxKnob,
          patchJukeboxMenu: menuController.patchJukeboxMenu,
          removeJukeboxMenuItem: menuController.removeJukeboxMenuItem,
          restoreJukeboxState,
          setJukeboxState
        };
      }

      // src/hitbox/lobby-music-adapter.ts
      var NATIVE_LOBBY_MUSIC_FILENAME = "meganeko_Daydreamer128.mp3";
      function getNativeLobbyMusicController() {
        const game = readNativeReflectProperty(window, "a8");
        const controller = readNativeReflectProperty(game, "cR");
        return isNativeReflectTarget(controller) ? controller : null;
      }
      function isNativeLobbyMusicHowl(howl) {
        const source = readNativeReflectProperty(howl, "_src");
        const sources = Array.isArray(source) ? source : [source];
        return sources.some(
          (candidate) => typeof candidate === "string" && candidate.includes(NATIVE_LOBBY_MUSIC_FILENAME)
        );
      }
      function getKnownLobbyMusicHowls() {
        const howler = readNativeReflectProperty(window, "Howler");
        const howls = readNativeReflectProperty(howler, "_howls");
        return Array.isArray(howls) ? howls.filter(isNativeLobbyMusicHowl) : [];
      }
      function stopKnownLobbyMusicHowls() {
        let stopped = false;
        for (const howl of getKnownLobbyMusicHowls()) {
          if (!isNativeReflectTarget(howl)) {
            continue;
          }
          const stop = readNativeReflectProperty(howl, "stop");
          if (!isCallable(stop)) {
            continue;
          }
          try {
            Reflect.apply(stop, howl, []);
            stopped = true;
          } catch {
          }
        }
        return stopped;
      }
      function startNativeLobbyMusic() {
        const howls = getKnownLobbyMusicHowls();
        for (const howl of howls) {
          const playing = readNativeReflectProperty(howl, "playing");
          if (!isCallable(playing)) {
            continue;
          }
          try {
            if (Reflect.apply(playing, howl, []) === true) {
              return true;
            }
          } catch {
          }
        }
        for (const howl of [...howls].reverse()) {
          const play = readNativeReflectProperty(howl, "play");
          if (!isCallable(play)) {
            continue;
          }
          try {
            Reflect.apply(play, howl, []);
            return true;
          } catch {
          }
        }
        return false;
      }
      function stopNativeLobbyMusic(controller = getNativeLobbyMusicController()) {
        const stop = readNativeReflectProperty(controller, "stop");
        let controllerStopped = false;
        if (isCallable(stop)) {
          try {
            Reflect.apply(stop, controller, []);
            controllerStopped = true;
          } catch {
          }
        }
        return stopKnownLobbyMusicHowls() || controllerStopped;
      }
      function patchNativeLobbyMusicStart(shouldAllowStart, forcePatch = false) {
        const controller = getNativeLobbyMusicController();
        const start = readNativeReflectProperty(controller, "start");
        if (!isCallable(start)) {
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
        return replaceNativeReflectProperty(controller, "start", wrappedStart);
      }

      // src/features/lobby-music-control.ts
      function createLobbyMusicController(options) {
        let lobbyMusicPatchInstalled = false;
        function updateNativeMusicMenuItems() {
          const muted = isNativeMusicMuted();
          for (const item of document.querySelectorAll(".cornerButton .items .item")) {
            if (!item.dataset.qolboxMusicMenu && !/^(?:Mute|Unmute) Music$/.test(item.textContent?.trim() || "")) {
              continue;
            }
            if (!options.isAudioEnabled()) {
              item.classList.remove("qolboxMusicMenuOption");
              item.removeAttribute("data-qolbox-icon");
              continue;
            }
            if (item.dataset.qolboxMusicMenu !== "true") item.dataset.qolboxMusicMenu = "true";
            const icon = muted ? "music-off" : "music";
            if (item.dataset.qolboxIcon !== icon) item.dataset.qolboxIcon = icon;
            item.classList.add("qolboxMusicMenuOption");
            const label = muted ? "Unmute Music" : "Mute Music";
            if (item.textContent?.trim() !== label) item.textContent = label;
            if (!item.dataset.qolboxMusicMenuPatched) {
              item.dataset.qolboxMusicMenuPatched = "true";
              item.addEventListener("click", (event) => {
                if (!options.isAudioEnabled()) return;
                event.preventDefault();
                event.stopImmediatePropagation();
                const saved = isNativeMusicMuted() ? removeLocalStorageItem("music_mute") : setLocalStorageItem("music_mute", "true");
                if (!saved) return;
                updateNativeMusicMenuItems();
                syncLobbyMusic();
              }, true);
            }
          }
        }
        function isNativeMusicMuted() {
          return Boolean(getLocalStorageItem("music_mute"));
        }
        function isLobbyMusicAllowed() {
          return !options.isAudioEnabled() || !hasVisibleLayer(options.playLayerSelector) && !hasVisibleLayer(".lobbyContainer");
        }
        function syncLobbyMusic() {
          if (!options.isAudioEnabled()) {
            return;
          }
          if (isLobbyMusicAllowed() && !isNativeMusicMuted()) {
            startNativeLobbyMusic();
          } else {
            stopNativeLobbyMusic();
          }
        }
        function patchLobbyMusicController() {
          updateNativeMusicMenuItems();
          if (!options.isAudioEnabled() && !lobbyMusicPatchInstalled) {
            return false;
          }
          const patched = patchNativeLobbyMusicStart(isLobbyMusicAllowed, !lobbyMusicPatchInstalled);
          if (patched) {
            lobbyMusicPatchInstalled = true;
          }
          syncLobbyMusic();
          return patched;
        }
        return {
          patchLobbyMusicController
        };
      }

      // src/features/audio-feature-bundle.ts
      function createAudioFeatureBundle(options) {
        const gameVolume = createGameVolumeController({
          isAudioEnabled: options.isAudioEnabled,
          playCustomSound: options.playCustomSound,
          stopCustomSound: options.stopCustomSound,
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

      // src/features/map-list-performance.ts
      var installed = false;
      var selectionDecodeAllowedUntil = 0;
      var patchedMapStatePrototype = null;
      var MAX_AUTOMATIC_PREVIEW_BYTES = 5e4;
      function isMapListOpen() {
        return Array.from(document.querySelectorAll(".mapListContainer")).some((container) => container.getClientRects().length > 0);
      }
      function patchLargeMapPreviewDecode() {
        if (patchedMapStatePrototype || !isMapListOpen()) return;
        const currentMapState = readNativePath(window, ["multiplayerSession", "TJ", "JD", "tP", 0, "state"]);
        if (!isNativeReflectTarget(currentMapState)) return;
        const prototype = Object.getPrototypeOf(currentMapState);
        const nativeDecode = readNativeProperty(prototype, "ac");
        if (!isNativeReflectTarget(prototype) || typeof nativeDecode !== "function") return;
        const wrappedDecode = function(...args) {
          const encoded = args.find((value) => typeof value === "string");
          const isOversizedPreview = performance.now() > selectionDecodeAllowedUntil && this !== currentMapState && isMapListOpen() && typeof encoded === "string" && encoded.length > MAX_AUTOMATIC_PREVIEW_BYTES;
          if (!isOversizedPreview) return Reflect.apply(nativeDecode, this, args);
          window.__qolboxSkippedLargeMapPreviews = (window.__qolboxSkippedLargeMapPreviews ?? 0) + 1;
          return void 0;
        };
        if (setNativeReflectProperty(prototype, "ac", wrappedDecode)) patchedMapStatePrototype = prototype;
      }
      function installMapListPreviewThrottling() {
        if (installed) return;
        installed = true;
        const nativeSetTimeout = window.setTimeout.bind(window);
        const nativeClearTimeout = window.clearTimeout.bind(window);
        const queuedPreviews = [];
        let drainTimer = 0;
        let pausedUntil = 0;
        const scheduleDrain = (delay = 16) => {
          if (drainTimer || !queuedPreviews.length) return;
          drainTimer = nativeSetTimeout(() => {
            drainTimer = 0;
            const remainingPause = pausedUntil - performance.now();
            if (remainingPause > 0) {
              scheduleDrain(remainingPause);
              return;
            }
            if (!isMapListOpen()) {
              queuedPreviews.length = 0;
              return;
            }
            const startedAt = performance.now();
            const preview = queuedPreviews.shift();
            if (!preview) return;
            try {
              preview();
            } finally {
              if (performance.now() - startedAt > 32) pausedUntil = performance.now() + 250;
              scheduleDrain();
            }
          }, delay);
        };
        document.addEventListener("wheel", (event) => {
          if (!(event.target instanceof Element) || !event.target.closest(".mapListContainer .mapsContainer")) return;
          pausedUntil = performance.now() + 250;
          if (drainTimer) nativeClearTimeout(drainTimer);
          drainTimer = 0;
          scheduleDrain(250);
        }, { capture: true, passive: true });
        document.addEventListener("click", (event) => {
          if (!(event.target instanceof Element) || !event.target.closest(".mapListContainer .mapsContainer > .element")) {
            return;
          }
          selectionDecodeAllowedUntil = performance.now() + 5e3;
        }, true);
        window.setTimeout = ((callback, delay, ...args) => {
          const isMapPreview = typeof callback === "function" && delay === 1 && /\.IC\(\)/.test(Function.prototype.toString.call(callback)) && Boolean(document.querySelector(".mapListContainer .mapsContainer"));
          if (!isMapPreview) return nativeSetTimeout(callback, delay, ...args);
          window.__qolboxDeferredMapPreviews = (window.__qolboxDeferredMapPreviews ?? 0) + 1;
          return nativeSetTimeout(() => {
            queuedPreviews.push(() => Reflect.apply(callback, window, args));
            scheduleDrain();
          }, 0);
        });
      }

      // src/features/action-iconography.ts
      var ICONS = {
        "arrow-left": '<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
        "arrow-right": '<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
        "bell-ring": '<path d="M10.268 21a2 2 0 0 0 3.464 0"/><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/><path d="M4 2C2.8 3.7 2 5.7 2 8M20 2c1.2 1.7 2 3.7 2 6"/>',
        "calendar-days": '<path d="M8 2v4M16 2v4M3 10h18"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01"/>',
        check: '<path d="M20 6 9 17l-5-5"/>',
        "chevron-down": '<path d="m6 9 6 6 6-6"/>',
        "circle-help": '<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/>',
        clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
        clipboard: '<rect width="8" height="4" x="8" y="2" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>',
        combine: '<path d="M14 3a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1"/><path d="M19 3a1 1 0 0 1 1 1v5a1 1 0 0 1-1 1"/><path d="m7 15 3 3"/><path d="m7 21 3-3H5a2 2 0 0 1-2-2v-2"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="3" width="7" height="7" rx="1"/>',
        copy: '<rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/>',
        download: '<path d="M12 15V3"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/>',
        eye: '<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/>',
        "eye-off": '<path d="m2 2 20 20"/><path d="M6.71 6.71C4.66 8.06 3.21 9.91 2.06 11.65a1 1 0 0 0 0 .7C4.03 15.33 7.55 19 12 19c1.15 0 2.23-.25 3.22-.67"/><path d="M10.73 5.08C11.14 5.03 11.56 5 12 5c4.45 0 7.97 3.67 9.94 6.65a1 1 0 0 1 0 .7 16 16 0 0 1-2.01 2.48"/><path d="M14.12 14.12A3 3 0 0 1 9.88 9.88"/>',
        "file-plus": '<path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"/><path d="M14 2v5a1 1 0 0 0 1 1h5"/><path d="M9 15h6"/><path d="M12 18v-6"/>',
        "flip-horizontal": '<path d="m3 7 5 5-5 5V7"/><path d="m21 7-5 5 5 5V7"/><path d="M12 20v2M12 14v2M12 8v2M12 2v2"/>',
        "flip-vertical": '<path d="m17 3-5 5-5-5h10"/><path d="m17 21-5-5-5 5h10"/><path d="M4 12H2M10 12H8M16 12h-2M22 12h-2"/>',
        flame: '<path d="M12 3q1 4 4 6.5t3 5.5a1 1 0 0 1-14 0 5 5 0 0 1 1-3 1 1 0 0 0 5 0c0-2-1.5-3-1.5-5q0-2 2.5-4"/>',
        "folder-open": '<path d="m6 14 1.5-2.9A2 2 0 0 1 9.24 10H20a2 2 0 0 1 1.94 2.5l-1.54 6a2 2 0 0 1-1.95 1.5H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h3.9a2 2 0 0 1 1.69.9l.81 1.2a2 2 0 0 0 1.67.9H18a2 2 0 0 1 2 2v2"/>',
        info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>',
        keyboard: '<path d="M10 8h.01M12 12h.01M14 8h.01M16 12h.01M18 8h.01M6 8h.01M7 16h10M8 12h.01"/><rect width="20" height="16" x="2" y="4" rx="2"/>',
        link: '<path d="M10 13a5 5 0 0 0 7.07.07l2-2a5 5 0 0 0-7.07-7.07l-1.15 1.15"/><path d="M14 11a5 5 0 0 0-7.07-.07l-2 2A5 5 0 0 0 12 20l1.15-1.15"/>',
        lock: '<rect width="14" height="11" x="5" y="11" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
        "lock-open": '<rect width="14" height="11" x="5" y="11" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.9-.9"/>',
        list: '<path d="M3 5h.01M3 12h.01M3 19h.01M8 5h13M8 12h13M8 19h13"/>',
        "log-in": '<path d="m10 17 5-5-5-5"/><path d="M15 12H3"/><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/>',
        "log-out": '<path d="m16 17 5-5-5-5"/><path d="M21 12H9"/><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>',
        maximize: '<path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/>',
        menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
        monitor: '<rect width="20" height="14" x="2" y="3" rx="2"/><path d="M8 21h8M12 17v4"/>',
        map: '<path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z"/><path d="M15 5.764v15M9 3.236v15"/>',
        "message-circle": '<path d="M21 15a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4z"/>',
        mirror: '<path d="M12 3v18"/><path d="m8 8-4 4 4 4M16 8l4 4-4 4"/>',
        move: '<path d="M12 2v20M15 19l-3 3-3-3M19 9l3 3-3 3M2 12h20M5 9l-3 3 3 3M9 5l3-3 3 3"/>',
        moon: '<path d="M20.985 12.486A9 9 0 1 1 11.514 3.015c.447-.028.683.541.366.857a6 6 0 0 0 8.248 8.248c.316-.317.885-.081.857.366"/>',
        "mouse-pointer": '<path d="M4.037 4.688a.495.495 0 0 1 .651-.651l16 6.5a.5.5 0 0 1-.063.947l-6.124 1.58a2 2 0 0 0-1.438 1.435l-1.579 6.126a.5.5 0 0 1-.947.063z"/>',
        music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
        "music-off": '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/><path d="m2 2 20 20"/>',
        package: '<path d="M11 21.73a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73z"/><path d="M12 22V12"/><polyline points="3.29 7 12 12 20.71 7"/><path d="m7.5 4.27 9 5.15"/>',
        palette: '<path d="M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z"/><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/>',
        pause: '<rect x="14" y="3" width="5" height="18" rx="1"/><rect x="5" y="3" width="5" height="18" rx="1"/>',
        "pencil-ruler": '<path d="M13 7 8.7 2.7a2.41 2.41 0 0 0-3.4 0L2.7 5.3a2.41 2.41 0 0 0 0 3.4L7 13M8 6l2-2M18 16l2-2M17 11l4.3 4.3c.94.94.94 2.46 0 3.4l-2.6 2.6c-.94.94-2.46.94-3.4 0L11 17"/><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497zM15 5l4 4"/>',
        play: '<path d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z"/>',
        plus: '<path d="M5 12h14M12 5v14"/>',
        radio: '<path d="M16.247 7.761a6 6 0 0 1 0 8.478M19.075 4.933a10 10 0 0 1 0 14.134M4.925 19.067a10 10 0 0 1 0-14.134M7.753 16.239a6 6 0 0 1 0-8.478"/><circle cx="12" cy="12" r="2"/>',
        "radio-off": '<path d="M16.247 7.761a6 6 0 0 1 0 8.478M19.075 4.933a10 10 0 0 1 0 14.134M4.925 19.067a10 10 0 0 1 0-14.134M7.753 16.239a6 6 0 0 1 0-8.478"/><circle cx="12" cy="12" r="2"/><path d="m2 2 20 20"/>',
        "refresh-cw": '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
        "rotate-ccw": '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
        "rotate-cw": '<path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/>',
        save: '<path d="M15.2 3a2 2 0 0 1 1.4.6l3.8 3.8a2 2 0 0 1 .6 1.4V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M17 21v-7a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v7M7 3v4a1 1 0 0 0 1 1h7"/>',
        search: '<path d="m21 21-4.34-4.34"/><circle cx="11" cy="11" r="8"/>',
        "share-2": '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.59 13.51 6.83 3.98M15.41 6.51 8.59 10.49"/>',
        shield: '<path d="M20 13c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V5l8-3 8 3z"/>',
        "shield-x": '<path d="M20 13c0 5-3.5 7.5-8 9-4.5-1.5-8-4-8-9V5l8-3 8 3z"/><path d="m9.5 9.5 5 5M14.5 9.5l-5 5"/>',
        "skip-forward": '<path d="M21 4v16"/><path d="M6.029 4.285A2 2 0 0 0 3 6v12a2 2 0 0 0 3.029 1.715l9.997-5.998a2 2 0 0 0 .003-3.432z"/>',
        square: '<rect width="16" height="16" x="4" y="4" rx="2"/>',
        sliders: '<path d="M10 5H3M12 19H3M14 3v4M16 17v4M21 12h-9M21 19h-5M21 5h-7M8 10v4M8 12H3"/>',
        star: '<path d="M11.525 2.295a.53.53 0 0 1 .95 0l2.31 4.679a2.123 2.123 0 0 0 1.595 1.16l5.166.751a.53.53 0 0 1 .294.904l-3.738 3.643a2.123 2.123 0 0 0-.61 1.88l.882 5.146a.53.53 0 0 1-.77.559l-4.62-2.428a2.122 2.122 0 0 0-1.969 0l-4.619 2.428a.53.53 0 0 1-.77-.559l.882-5.145a2.122 2.122 0 0 0-.611-1.879L2.16 9.79a.53.53 0 0 1 .294-.904l5.165-.751a2.122 2.122 0 0 0 1.597-1.16z"/>',
        sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>',
        terminal: '<path d="M12 19h8"/><path d="m4 17 6-6-6-6"/>',
        trash: '<path d="M10 11v6M14 11v6M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
        upload: '<path d="M12 3v12M17 8l-5-5-5 5M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>',
        unlink: '<path d="m18.84 12.25 1.23-1.18a5 5 0 0 0-7.07-7.07l-1.17 1.23"/><path d="m5.17 11.75-1.24 1.18A5 5 0 0 0 11 20l1.17-1.23"/><path d="M8 2v3M2 8h3M16 19v3M19 16h3"/>',
        user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
        "user-minus": '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 11h-6"/>',
        users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
        "volume-2": '<path d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298zM16 9a5 5 0 0 1 0 6M19.364 18.364a9 9 0 0 0 0-12.728"/>',
        wrench: '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.106-3.105c.32-.322.863-.22.983.218a6 6 0 0 1-8.259 7.057l-7.91 7.91a1 1 0 0 1-2.999-3l7.91-7.91a6 6 0 0 1 7.057-8.259c.438.12.54.662.219.984z"/>',
        wifi: '<path d="M12 20h.01M2 8.82a15 15 0 0 1 20 0M5 12.86a10 10 0 0 1 14 0M8.5 16.43a5 5 0 0 1 7 0"/>',
        x: '<path d="M18 6 6 18M6 6l12 12"/>',
        zap: '<path d="M15.914 4a1.5 1.5 0 0 0-2.474-1.561l-9 9A1.5 1.5 0 0 0 5.5 14h4.002a.5.5 0 0 1 .471.666L8.086 20a1.5 1.5 0 0 0 2.475 1.56l9-9A1.5 1.5 0 0 0 18.5 10h-3.997a.5.5 0 0 1-.472-.667z"/>'
      };
      var ICON_ONLY_CLOSE_SELECTOR = ".crossButton, .mapListContainer .closeButton, .replayViewer .closeButton";
      var ICON_ONLY_ACTION_SELECTOR = [
        ICON_ONLY_CLOSE_SELECTOR,
        ".cornerButton .square",
        ".lobbyContainer .teamLockButton",
        ".lobbyContainer .settingsBox .linkButton",
        ".spectateControls .button.prev",
        ".spectateControls .button.next"
      ].join(", ");
      var ACTION_SELECTOR = [
        "button",
        ".bigButton",
        ".bottomButton",
        ".button",
        ".item",
        ".teamButton",
        ".topLabel",
        ".searchButton",
        ".mapListContainer .sortBy",
        ".mapListContainer .topBar",
        ".connectingWindowContainer:not(.qolboxReserveWindowContainer) .connectingWindow .topBar",
        ".autoLoginWindowContainer .autoLoginWindow .topBar",
        ".recordsWindow .topBar",
        ICON_ONLY_ACTION_SELECTOR,
        ".mapListContainer .dropdownContainer .element",
        ".mapListContainer .secondaryContainer .secondaryElement",
        ".qolboxMenuFeatureName[data-qolbox-icon]",
        '#appContainer [class*="Button"]:not(.cornerButton)',
        '[role="button"]'
      ].join(", ");
      var AUDIO_LABEL = /^(?:Volume:\s*\d+%|(?:Mute|Unmute) (?:Music|Jukebox))$/i;
      var ROOM_LIST_LABEL_SELECTOR = ".roomListContainer .topBar, .roomListContainer .tableHeader .element";
      var STATUS_SELECTOR = [
        ".connectingWindowContainer:not(.qolboxReserveWindowContainer) .connectingWindow .textBox",
        ".autoLoginWindowContainer .autoLoginWindow .textBox",
        ".mapListContainer .mapList .statusText",
        ".roomListContainer .roomList > .status",
        ".recordsWindow > .status",
        ".inGameCSS .matchmakingNotification"
      ].join(", ");
      var MAP_DROPDOWN_ARROW_SELECTOR = [
        ".mapListContainer .dropdownContainer img.downArrow",
        ".mapListContainer .dropdownContainer img.rightArrow"
      ].join(", ");
      var NATIVE_SPINNER_TIMEOUT_MS = 8e3;
      var nativeSpinnerRecoveryTimers = /* @__PURE__ */ new WeakMap();
      var PLAYER_HEX_COLOR = /^#(?:[\da-f]{3}|[\da-f]{6})$/i;
      function normalizePlayerHexColor(value) {
        if (!PLAYER_HEX_COLOR.test(value.trim())) return null;
        const hex = value.trim().slice(1);
        return `#${hex.length === 3 ? [...hex].map((character) => character.repeat(2)).join("") : hex}`.toUpperCase();
      }
      function rgbToHsv(hex) {
        const red = parseInt(hex.slice(1, 3), 16) / 255;
        const green = parseInt(hex.slice(3, 5), 16) / 255;
        const blue = parseInt(hex.slice(5, 7), 16) / 255;
        const max = Math.max(red, green, blue);
        const min = Math.min(red, green, blue);
        const delta = max - min;
        let hue = 0;
        if (delta) {
          if (max === red) hue = 60 * ((green - blue) / delta % 6);
          else if (max === green) hue = 60 * ((blue - red) / delta + 2);
          else hue = 60 * ((red - green) / delta + 4);
        }
        return [(hue + 360) % 360, max ? delta / max * 100 : 0, max * 100];
      }
      function sendColorWheelMouse(target, clientX, clientY) {
        const type = "PointerEvent" in window ? "pointerdown" : "mousedown";
        const EventClass = "PointerEvent" in window ? PointerEvent : MouseEvent;
        target.dispatchEvent(new EventClass(type, {
          bubbles: true,
          button: 0,
          clientX,
          clientY,
          ...EventClass === PointerEvent ? { isPrimary: true, pointerId: 1, pointerType: "mouse" } : {}
        }));
      }
      function applyNativePlayerColor(windowElement, colorBox, hex) {
        colorBox.click();
        const wheel = windowElement.querySelector(".colorWheelContainer");
        const hueWheel = wheel?.querySelector(".reinvented-color-wheel--hue-wheel");
        const valueSquare = wheel?.querySelector(".reinvented-color-wheel--sv-space");
        if (!wheel || !hueWheel || !valueSquare) return false;
        const [hue, saturation, value] = rgbToHsv(hex);
        const hueBounds = hueWheel.getBoundingClientRect();
        const hueAngle = (hue - 90) * Math.PI / 180;
        const hueRadius = hueBounds.width / 2 - 10;
        sendColorWheelMouse(
          hueWheel,
          hueBounds.left + hueBounds.width / 2 + Math.cos(hueAngle) * hueRadius,
          hueBounds.top + hueBounds.height / 2 + Math.sin(hueAngle) * hueRadius
        );
        const valueBounds = valueSquare.getBoundingClientRect();
        sendColorWheelMouse(
          valueSquare,
          valueBounds.left + valueBounds.width * saturation / 100,
          valueBounds.top + valueBounds.height * (100 - value) / 100
        );
        wheel.style.display = "none";
        return true;
      }
      function decoratePlayerColorInput(root) {
        const windows = root instanceof HTMLElement && root.matches(".cosmeticWindow") ? [root] : [...root.querySelectorAll(".cosmeticWindow")];
        for (const windowElement of windows) {
          if (windowElement.dataset.qolboxPlayerHex) continue;
          const row = windowElement.querySelector(".optionsContainer .singleContainer");
          const colorBox = row?.querySelector(".colorBox");
          if (!row || !colorBox) continue;
          windowElement.dataset.qolboxPlayerHex = "true";
          const input = document.createElement("input");
          input.className = "qolboxPlayerHexInput";
          input.value = getComputedStyle(colorBox).backgroundColor.match(/\d+/g)?.slice(0, 3).map((channel) => Number(channel).toString(16).padStart(2, "0")).join("").toUpperCase().replace(/^/, "#") || "#FFFFFF";
          input.maxLength = 7;
          input.spellcheck = false;
          input.setAttribute("aria-label", "Main color hex code");
          input.addEventListener("input", () => {
            const color = normalizePlayerHexColor(input.value);
            input.setAttribute("aria-invalid", String(!color));
            if (color && applyNativePlayerColor(windowElement, colorBox, color)) input.value = color;
          });
          new MutationObserver(() => {
            const color = getComputedStyle(colorBox).backgroundColor.match(/\d+/g)?.slice(0, 3).map((channel) => Number(channel).toString(16).padStart(2, "0")).join("").toUpperCase();
            if (color) input.value = `#${color}`;
          }).observe(colorBox, { attributes: true, attributeFilter: ["style"] });
          row.append(input);
        }
      }
      function createIcon(name) {
        const icon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        icon.classList.add("qolboxActionIcon");
        icon.setAttribute("viewBox", "0 0 24 24");
        icon.setAttribute("fill", "none");
        icon.setAttribute("stroke", "currentColor");
        icon.setAttribute("stroke-width", "2");
        icon.setAttribute("stroke-linecap", "round");
        icon.setAttribute("stroke-linejoin", "round");
        icon.setAttribute("aria-hidden", "true");
        icon.dataset.qolboxIcon = name;
        icon.innerHTML = ICONS[name];
        return icon;
      }
      function getActionLabel(element) {
        const copy = element.cloneNode(true);
        copy.querySelectorAll(".qolboxActionIcon, .tooltip, .container, .qolboxAudioMenuOptions").forEach((child) => child.remove());
        return (copy.textContent || "").replace(/\s+/g, " ").trim();
      }
      function getActionIcon(label, element) {
        const text = label.toLowerCase();
        const explicit = element.dataset.qolboxIcon;
        if (explicit && explicit in ICONS) return explicit;
        if (/^(?:ok|finish|apply|confirm|done|yes)$/.test(text)) return "check";
        if (/^(?:close|cancel|no)$/.test(text)) return "x";
        if (/^(?:back|previous)$/.test(text)) return "arrow-left";
        if (/^(?:next|newer|continue)$/.test(text)) return "arrow-right";
        if (text === "older") return "arrow-left";
        if (/\bkick\b/.test(text)) return "log-out";
        if (/\bban\b/.test(text)) return "shield-x";
        if (/delete|remove/.test(text)) return "trash";
        if (/copy/.test(text)) return "copy";
        if (/paste|clipboard/.test(text)) return "clipboard";
        if (/undo|default|reset|redo setup/.test(text)) return "rotate-ccw";
        if (/^redo$/.test(text)) return "rotate-cw";
        if (/refresh|reload/.test(text)) return "refresh-cw";
        if (/save/.test(text)) return "save";
        if (/export|download/.test(text)) return "download";
        if (/import|upload/.test(text)) return "upload";
        if (/^(?:load|open)/.test(text)) return "folder-open";
        if (/^(?:new|create)(?:\s|$)/.test(text)) return "file-plus";
        if (/quick play|training|^play$|^start$/.test(text)) return "play";
        if (text === "end game") return "square";
        if (/play as guest/.test(text)) return "user";
        if (/pause/.test(text)) return "pause";
        if (/retry|switch/.test(text)) return "refresh-cw";
        if (text === "hide lobby") return "eye-off";
        if (/^(?:show )?lobby$/.test(text)) return "eye";
        if (/^move to spec/.test(text)) return "user-minus";
        if (/^move to (?:ffa|red|blue)/.test(text)) return "users";
        if (/spectate/.test(text)) return "eye";
        if (/join/.test(text)) return "log-in";
        if (/welcome back/.test(text)) return "log-in";
        if (/^connecting$/.test(text)) return "wifi";
        if (/fastest times/.test(text)) return "clock";
        if (/reserve|register|sign in|log in/.test(text)) return "log-in";
        if (/leave|log out|exit/.test(text)) return "log-out";
        if (/room list|custom game|server/.test(text)) return "list";
        if (/editor/.test(text)) return "pencil-ruler";
        if (/hot maps/.test(text)) return "flame";
        if (/chaz(?:'|’)?s picks|top rated|favorite/.test(text)) return "star";
        if (/^sort by:\s*best$/.test(text)) return "star";
        if (/^sort by:\s*newest$/.test(text)) return "clock";
        if (/newest/.test(text)) return "clock";
        if (/^(?:19|20)\d{2}$/.test(text)) return "calendar-days";
        if (/private/.test(text)) return "lock";
        if (/published/.test(text)) return "upload";
        if (/\bmaps?\b/.test(text)) return "map";
        if (/volume|^audio$/.test(text)) return "volume-2";
        if (/^unmute music$/.test(text)) return "music-off";
        if (/music/.test(text)) return "music";
        if (/^unmute jukebox$/.test(text)) return "radio-off";
        if (/jukebox/.test(text)) return "radio";
        if (/qolbox/.test(text)) return "package";
        if (/controls|keyboard|shortcut/.test(text)) return "keyboard";
        if (/fullscreen/.test(text)) return "maximize";
        if (/player info|account|profile/.test(text)) return "user";
        if (/host|change name/.test(text)) return "user";
        if (/lock/.test(text)) return "lock";
        if (/share|invite/.test(text)) return "upload";
        if (/^file$|patch notes/.test(text)) return "folder-open";
        if (/tools?/.test(text)) return "wrench";
        if (/settings|advanced|custom/.test(text)) return "sliders";
        if (/help|reference/.test(text)) return "circle-help";
        if (/about|info/.test(text)) return "info";
        if (/news/.test(text)) return "info";
        if (/commands?/.test(text)) return "terminal";
        if (/features?/.test(text)) return "list";
        if (/mirror|horizontal/.test(text)) return "flip-horizontal";
        if (/vertical/.test(text)) return "flip-vertical";
        if (/merge|group/.test(text)) return "combine";
        if (/selection/.test(text)) return "mouse-pointer";
        if (/transform|move/.test(text)) return "move";
        if (/appearance|color|paint/.test(text)) return "palette";
        if (/search/.test(text)) return "search";
        if (/express/.test(text)) return "zap";
        if (/skip/.test(text)) return "skip-forward";
        return element.matches(".item, .topLabel") ? "arrow-right" : "check";
      }
      function getIconOnlyActionIcon(element) {
        if (element.matches(ICON_ONLY_CLOSE_SELECTOR)) return "x";
        if (element.matches(".cornerButton .square")) {
          return element.querySelector(".icon.opened") ? "x" : "menu";
        }
        if (element.matches(".lobbyContainer .teamLockButton")) {
          return element.matches(".lockedClient, .lockedHost") ? "lock" : "lock-open";
        }
        if (element.matches(".lobbyContainer .settingsBox .linkButton")) return "share-2";
        if (element.matches(".spectateControls .button.prev")) return "arrow-left";
        if (element.matches(".spectateControls .button.next")) return "arrow-right";
        return null;
      }
      function getRoomListLabelIcon(label) {
        switch (label.toUpperCase()) {
          case "ROOM LIST":
            return "list";
          case "ROOM NAME":
            return "list";
          case "PLAYERS":
            return "users";
          case "PASSWORD":
            return "lock";
          case "JUKEBOX":
            return "radio";
          case "DISTANCE":
            return "map";
          default:
            return null;
        }
      }
      function getIconHost(element) {
        if (!element.matches(".bigButton")) return element;
        const host = element.querySelector(".text");
        if (!host) return element;
        host.classList.add("qolboxMainActionText");
        let label = host.querySelector(":scope > .qolboxMainActionLabel");
        if (!label) {
          label = document.createElement("span");
          label.className = "qolboxMainActionLabel";
          while (host.firstChild) label.append(host.firstChild);
          host.append(label);
        }
        return host;
      }
      function isRendered(element) {
        if (!element || !element.getClientRects().length) return false;
        const style = getComputedStyle(element);
        return style.display !== "none" && style.visibility !== "hidden";
      }
      function syncLobbyEditorAction(root) {
        const button = root instanceof HTMLElement && root.matches(".lobbyContainer .editorButton") ? root : root.querySelector(".lobbyContainer .editorButton");
        const lobby = button?.closest(".lobbyContainer");
        const editor = document.getElementById("editorContainer");
        if (!button || isRendered(editor) || !isRendered(lobby ?? null) || getActionLabel(button) !== "HIDE LOBBY") return;
        button.textContent = "EDITOR";
      }
      function decorateAction(element) {
        if (element.matches(".lobbyContainer .voteSpan")) {
          element.querySelector(":scope > .qolboxActionIcon")?.remove();
          return;
        }
        const spinners = element.querySelectorAll(":scope > .spinner");
        if (spinners.length && !element.classList.contains("spinnerHideText")) {
          const pendingRecovery = nativeSpinnerRecoveryTimers.get(element);
          if (pendingRecovery) window.clearTimeout(pendingRecovery);
          nativeSpinnerRecoveryTimers.delete(element);
          spinners.forEach((spinner) => spinner.remove());
          if (!getActionLabel(element)) element.textContent = element.dataset.qolboxSpinnerLabel || "REFRESH";
        }
        if (element.classList.contains("spinnerHideText")) {
          element.querySelector(":scope > .qolboxActionIcon")?.remove();
          armNativeSpinnerRecovery(element);
          return;
        }
        const containsActions = !element.matches(".qolboxAudioMenuGroup, .qolboxMirrorItem, .topLabel") && Boolean(element.querySelector(ACTION_SELECTOR));
        const isMapCategory = element.matches(
          ".mapListContainer .dropdownContainer .element, .mapListContainer .secondaryContainer .secondaryElement"
        );
        if (element.matches('.qolboxMenuToggle, .qolboxColorPicker, .checkbox, [role="checkbox"], [role="radio"], [role="switch"]') || containsActions || !isMapCategory && element.querySelector("img, svg:not(.qolboxActionIcon)")) return;
        let label = getActionLabel(element);
        if (!label && element.dataset.qolboxSpinnerLabel) {
          label = element.dataset.qolboxSpinnerLabel;
          element.append(document.createTextNode(label));
        }
        const iconName = label ? getActionIcon(label, element) : getIconOnlyActionIcon(element);
        if (!iconName) return;
        element.classList.toggle("qolboxIconOnlyAction", !label);
        const host = getIconHost(element);
        const existing = host.querySelector(":scope > .qolboxActionIcon");
        if (existing?.dataset.qolboxIcon === iconName) return;
        existing?.remove();
        host.querySelector(":scope > .qolboxEditorHelpMark")?.remove();
        host.prepend(createIcon(iconName));
      }
      function decorateRoomListLabel(element) {
        const label = getActionLabel(element);
        const iconName = getRoomListLabelIcon(label);
        if (!iconName) return;
        const existing = element.querySelector(":scope > .qolboxActionIcon");
        if (existing?.dataset.qolboxIcon === iconName) return;
        existing?.remove();
        element.prepend(createIcon(iconName));
      }
      function getStatusIconName(line) {
        const text = line.toLowerCase();
        return /fail|error|incorrect|closed|full|invalid|disconnect|not found|no rooms/.test(text) ? "x" : /success|sync|ready/.test(text) ? "check" : /address|connect|server|p2p/.test(text) ? "wifi" : /join|attempt|log(?:ging)?|automatically load/.test(text) ? "log-in" : /search|find|match/.test(text) ? "search" : /fetch|load|download|map/.test(text) ? "download" : /player|await/.test(text) ? "users" : /no records|haven't/.test(text) ? "info" : /retry|wait/.test(text) ? "refresh-cw" : "clock";
      }
      function decorateStatus(element) {
        const lines = (element.textContent || "").split(/\r?\n/).map((line) => line.replace(/\s*✓\s*$/, "").trim()).filter(Boolean);
        const statusText = lines.join("\n");
        if (!statusText) {
          element.replaceChildren();
          delete element.dataset.qolboxStatusText;
          return;
        }
        if (element.dataset.qolboxStatusText === statusText && element.querySelector(".qolboxStatusLine")) return;
        const list = document.createElement("span");
        list.className = "qolboxStatusLines";
        list.append(...lines.map((line, index) => {
          const row = document.createElement("span");
          row.className = "qolboxStatusLine";
          if (index > 0) {
            const separator = document.createElement("span");
            separator.className = "qolboxStatusSeparator";
            separator.textContent = "\n";
            row.append(separator);
          }
          const isRoomName = index > 0 && /attempting to join room:$/i.test(lines[index - 1] || "");
          if (!isRoomName) {
            const icon = createIcon(getStatusIconName(line));
            icon.classList.add("qolboxStatusIcon");
            row.append(icon);
          } else {
            const spacer = document.createElement("span");
            spacer.className = "qolboxStatusIconSpacer";
            row.append(spacer);
          }
          const label = document.createElement("span");
          label.className = "qolboxStatusLabel";
          label.textContent = line;
          row.append(label);
          return row;
        }));
        element.replaceChildren(list);
        element.dataset.qolboxStatusText = statusText;
      }
      function decorateMapDropdownArrows(root) {
        const arrows = root instanceof HTMLElement && root.matches(MAP_DROPDOWN_ARROW_SELECTOR) ? [root] : Array.from(root.querySelectorAll(MAP_DROPDOWN_ARROW_SELECTOR));
        for (const arrow of arrows) {
          const icon = createIcon("chevron-down");
          icon.classList.add(...arrow.classList, "qolboxDropdownArrow");
          arrow.replaceWith(icon);
        }
      }
      function decorateRoomPasswordIcons(root) {
        const rows = root instanceof HTMLElement && root.matches(".roomListContainer .scrollBox table tr") ? [root] : Array.from(root.querySelectorAll(".roomListContainer .scrollBox table tr"));
        for (const row of rows) {
          const cell = row.cells[2];
          if (!cell) continue;
          const nativeLock = cell.querySelector('img[src*="lock-outline-roomlist"]');
          const existing = cell.querySelector(":scope > .qolboxRoomPasswordIcon");
          if (!nativeLock) {
            if (existing?.dataset.qolboxIcon !== "lock") existing?.remove();
            continue;
          }
          nativeLock?.remove();
          if (existing?.dataset.qolboxIcon === "lock") continue;
          existing?.remove();
          const icon = createIcon("lock");
          icon.classList.add("qolboxRoomPasswordIcon");
          cell.append(icon);
        }
      }
      function preserveNativeSpinnerContract(element) {
        if (!/^(?:refresh|retry)$/i.test(getActionLabel(element)) || element.dataset.qolboxSpinnerSafe) return;
        element.dataset.qolboxSpinnerSafe = "true";
        element.addEventListener("click", () => {
          element.dataset.qolboxSpinnerLabel = getActionLabel(element);
          const pendingRecovery = nativeSpinnerRecoveryTimers.get(element);
          if (pendingRecovery) window.clearTimeout(pendingRecovery);
          nativeSpinnerRecoveryTimers.delete(element);
          element.querySelector(":scope > .qolboxActionIcon")?.remove();
          element.querySelectorAll(":scope > .spinner").forEach((spinner) => spinner.remove());
          element.classList.remove("spinnerHideText");
          window.setTimeout(() => {
            if (element.classList.contains("spinnerHideText") || element.querySelector(":scope > .spinner")) {
              armNativeSpinnerRecovery(element);
            }
          }, 0);
        }, true);
      }
      function armNativeSpinnerRecovery(element) {
        if (nativeSpinnerRecoveryTimers.has(element)) return;
        const label = element.dataset.qolboxSpinnerLabel || getActionLabel(element) || "REFRESH";
        element.dataset.qolboxSpinnerLabel = label;
        nativeSpinnerRecoveryTimers.set(element, window.setTimeout(() => {
          nativeSpinnerRecoveryTimers.delete(element);
          if (!element.classList.contains("spinnerHideText") && !element.querySelector(":scope > .spinner")) return;
          element.classList.remove("spinnerHideText");
          element.querySelectorAll(":scope > .spinner").forEach((spinner) => spinner.remove());
          element.textContent = label;
          decorateAction(element);
        }, NATIVE_SPINNER_TIMEOUT_MS));
      }
      function getDirectAudioItems(menu) {
        return Array.from(menu.querySelectorAll(":scope > .item")).filter((item) => AUDIO_LABEL.test(getActionLabel(item)));
      }
      function createActionIconographyController() {
        function decorateActions(root = document) {
          patchLargeMapPreviewDecode();
          decoratePlayerColorInput(root);
          syncLobbyEditorAction(root);
          if (root instanceof HTMLElement && root.matches(".cornerButton .square .icon")) {
            decorateAction(root.parentElement);
          }
          if (root instanceof HTMLElement && root.matches(ACTION_SELECTOR)) {
            preserveNativeSpinnerContract(root);
            decorateAction(root);
          }
          root.querySelectorAll(ACTION_SELECTOR).forEach((element) => {
            preserveNativeSpinnerContract(element);
            decorateAction(element);
          });
          if (root instanceof HTMLElement && root.matches(ROOM_LIST_LABEL_SELECTOR)) decorateRoomListLabel(root);
          root.querySelectorAll(ROOM_LIST_LABEL_SELECTOR).forEach(decorateRoomListLabel);
          if (root instanceof HTMLElement && root.matches(STATUS_SELECTOR)) decorateStatus(root);
          root.querySelectorAll(STATUS_SELECTOR).forEach(decorateStatus);
          decorateMapDropdownArrows(root);
          decorateRoomPasswordIcons(root);
          root.querySelectorAll(".mapListContainer .mapsContainer .thumbImage").forEach((image) => image.parentElement?.querySelector(".qolboxMapPreviewPlaceholder")?.remove());
          root.querySelectorAll(".mapListContainer .mapsContainer .thumb:empty").forEach((thumbnail) => {
            const icon = createIcon("map");
            icon.classList.add("qolboxMapPreviewPlaceholder");
            thumbnail.append(icon);
          });
        }
        function patchHamburgerAudioGroup() {
          for (const menu of document.querySelectorAll(".cornerButton .items")) {
            let group = menu.querySelector(":scope > .qolboxAudioMenuGroup");
            const directItems = getDirectAudioItems(menu);
            if (!group && directItems.length < 2) continue;
            if (!group) {
              group = document.createElement("div");
              group.className = "item qolboxAudioMenuGroup";
              group.dataset.qolboxIcon = "volume-2";
              group.tabIndex = 0;
              group.setAttribute("role", "menuitem");
              group.setAttribute("aria-haspopup", "menu");
              group.setAttribute("aria-expanded", "false");
              const label = document.createElement("span");
              label.className = "qolboxAudioMenuLabel";
              label.textContent = "Audio";
              const arrow = document.createElement("span");
              arrow.className = "qolboxAudioMenuArrow";
              arrow.textContent = "›";
              arrow.setAttribute("aria-hidden", "true");
              const options2 = document.createElement("div");
              options2.className = "qolboxAudioMenuOptions";
              options2.setAttribute("role", "menu");
              group.append(label, arrow, options2);
              menu.insertBefore(group, directItems[0] || null);
              group.addEventListener("click", (event) => {
                if (event.target instanceof Element && event.target.closest(".qolboxAudioMenuOptions")) return;
                event.preventDefault();
                event.stopImmediatePropagation();
                const open = group?.classList.toggle("open") ?? false;
                group?.setAttribute("aria-expanded", String(open));
              }, true);
            }
            const options = group.querySelector(".qolboxAudioMenuOptions");
            if (!options) continue;
            for (const item of directItems) {
              item.classList.add("qolboxAudioMenuOption");
              options.appendChild(item);
            }
          }
          decorateActions();
        }
        function removeHamburgerAudioGroup() {
          for (const group of document.querySelectorAll(".qolboxAudioMenuGroup")) {
            const menu = group.parentElement;
            if (!menu) continue;
            for (const item of group.querySelectorAll(".qolboxAudioMenuOption")) {
              item.classList.remove("qolboxAudioMenuOption");
              menu.insertBefore(item, group);
            }
            group.remove();
          }
        }
        return { decorateActions, patchHamburgerAudioGroup, removeHamburgerAudioGroup };
      }

      // src/hitbox/editor-map-adapter.ts
      var EDITOR_MAP_STATE_PATH = ["multiplayerSession", "TJ", "JD", "tP"];
      var EDITOR_FILE_MENU_SELECTOR = "#editorContainer .fileMenu";
      var EDITOR_MENU_ITEM_SELECTOR = ".item";
      var EDITOR_MAP_TITLE_FIELDS = ["name", "title", "label", "mapname", "mapName", "EN"];
      var EDITOR_MAP_AUTHOR_FIELDS = ["authorname", "authorName", "author", "BN"];
      function getEditorMapEntry() {
        const maps = readNativePath(window, EDITOR_MAP_STATE_PATH);
        if (!Array.isArray(maps)) {
          return null;
        }
        return maps[0] || null;
      }
      function getEditorMapState() {
        return readNativeProperty(getEditorMapEntry(), "state") || null;
      }
      function readMetadataString(source, fields) {
        for (const field of fields) {
          const value = readNativeProperty(source, field);
          if (typeof value !== "string" && typeof value !== "number") {
            continue;
          }
          const text = String(value).replace(/\s+/g, " ").trim();
          if (text) {
            return text;
          }
        }
        return null;
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
          if (readNativeProperty(target, methodName) === replacement) {
            setNativeReflectProperty(target, methodName, original);
          }
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
        const replacements = [
          replaceNativeMethod(lobbyState, "tU", (maps) => {
            if (Array.isArray(maps)) {
              captureMap(maps[0]);
            }
          }),
          replaceNativeMethod(lobbyState, "sU", (map) => {
            captureMap(map);
          }),
          replaceNativeMethod(session, "_J", () => void 0)
        ];
        const installedRestores = replacements.filter((restore) => typeof restore === "function");
        if (installedRestores.length !== replacements.length) {
          for (const restore of installedRestores.reverse()) {
            restore();
          }
          return null;
        }
        try {
          playItem.click();
          return callMapExport(capturedMapState);
        } catch {
          return null;
        } finally {
          for (const restore of installedRestores.reverse()) {
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
      function getEditorMapMetadata() {
        const mapEntry = getEditorMapEntry();
        return {
          title: readMetadataString(mapEntry, EDITOR_MAP_TITLE_FIELDS),
          author: readMetadataString(mapEntry, EDITOR_MAP_AUTHOR_FIELDS)
        };
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

      // src/hitbox/editor-map-codec.ts
      var REQUIRED_MAP_ARRAY_KEYS = ["b", "j", "s", "tu", "gp"];
      var OPTIONAL_MAP_ARRAY_KEYS = ["p", "tc", "c"];
      var MAX_EDITOR_MAP_DATA_LENGTH = 8 * 1024 * 1024;
      var MAX_EDITOR_MAP_JSON_LENGTH = 16 * 1024 * 1024;
      function getWindowPako() {
        const pako = window.pako;
        if (typeof pako === "object" && pako !== null && typeof pako.deflate === "function" && typeof pako.inflate === "function") {
          return pako;
        }
        return null;
      }
      function isRecord2(value) {
        return typeof value === "object" && value !== null && !Array.isArray(value);
      }
      function isCompactMapObject(value) {
        if (!isRecord2(value)) {
          return false;
        }
        if (!REQUIRED_MAP_ARRAY_KEYS.every((key) => Array.isArray(value[key]))) {
          return false;
        }
        if (!isRecord2(value.set)) {
          return false;
        }
        for (const key of OPTIONAL_MAP_ARRAY_KEYS) {
          if (value[key] !== void 0 && !Array.isArray(value[key])) {
            return false;
          }
        }
        const bodies = value.b;
        if (!bodies.every((body) => {
          if (!isRecord2(body) || !Array.isArray(body.s)) {
            return false;
          }
          return body.s.every((shape) => isRecord2(shape) && Array.isArray(shape.p) && shape.p.every((point) => typeof point === "number" && Number.isFinite(point)));
        })) {
          return false;
        }
        return [...REQUIRED_MAP_ARRAY_KEYS.slice(1), ...OPTIONAL_MAP_ARRAY_KEYS].every((key) => value[key] === void 0 || value[key].every(isRecord2));
      }
      function binaryStringFromBytes(bytes) {
        let binary = "";
        const chunkSize = 32768;
        for (let index = 0; index < bytes.length; index += chunkSize) {
          binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
        }
        return binary;
      }
      function getStringPakoResult(result) {
        if (typeof result === "string") {
          return result;
        }
        if (result instanceof Uint8Array) {
          return new TextDecoder().decode(result);
        }
        return null;
      }
      function getBinaryPakoResult(result) {
        if (typeof result === "string") {
          return result;
        }
        if (result instanceof Uint8Array) {
          return binaryStringFromBytes(result);
        }
        return null;
      }
      function bytesFromBinaryString(binary) {
        const bytes = new Uint8Array(binary.length);
        for (let index = 0; index < binary.length; index += 1) {
          bytes[index] = binary.charCodeAt(index);
        }
        return bytes;
      }
      function inflateEditorMapJson(pako, compressedBinary) {
        if (typeof pako.Inflate !== "function") {
          const inflated2 = getStringPakoResult(pako.inflate(compressedBinary, { to: "string" }));
          return inflated2 && inflated2.length <= MAX_EDITOR_MAP_JSON_LENGTH ? inflated2 : null;
        }
        const inflator = new pako.Inflate();
        const decoder = new TextDecoder();
        let inflated = "";
        let inflatedBytes = 0;
        inflator.onData = (chunk) => {
          if (!(chunk instanceof Uint8Array)) {
            throw new Error("Unsupported pako output");
          }
          inflatedBytes += chunk.byteLength;
          if (inflatedBytes > MAX_EDITOR_MAP_JSON_LENGTH) {
            throw new Error("Editor map is too large");
          }
          inflated += decoder.decode(chunk, { stream: true });
        };
        const compressed = bytesFromBinaryString(compressedBinary);
        const chunkSize = 64 * 1024;
        for (let index = 0; index < compressed.length; index += chunkSize) {
          const final = index + chunkSize >= compressed.length;
          if (inflator.push(compressed.subarray(index, index + chunkSize), final) === false || inflator.err) {
            return null;
          }
        }
        inflated += decoder.decode();
        return inflated;
      }
      function decodeEditorMapData(mapData) {
        const pako = getWindowPako();
        const trimmedMapData = mapData.trim();
        if (!pako || !trimmedMapData || trimmedMapData.length > MAX_EDITOR_MAP_DATA_LENGTH) {
          return null;
        }
        try {
          const compressedBinary = window.atob(decodeURIComponent(trimmedMapData));
          const inflated = inflateEditorMapJson(pako, compressedBinary);
          return inflated ? JSON.parse(inflated) : null;
        } catch {
          return null;
        }
      }
      function encodeEditorMapData(mapJson) {
        const pako = getWindowPako();
        if (!pako || !isCompactMapObject(mapJson)) {
          return null;
        }
        try {
          const deflated = getBinaryPakoResult(pako.deflate(JSON.stringify(mapJson), { to: "string" }));
          return deflated ? encodeURIComponent(window.btoa(deflated)) : null;
        } catch {
          return null;
        }
      }
      function getReadableEditorMapJson(mapData) {
        const decodedMap = decodeEditorMapData(mapData);
        return isCompactMapObject(decodedMap) ? `${JSON.stringify(decodedMap, null, 2)}
    ` : null;
      }
      function getValidatedEditorMapData(mapData) {
        const trimmedMapData = mapData.trim();
        return isCompactMapObject(decodeEditorMapData(trimmedMapData)) ? trimmedMapData : null;
      }
      function getStringMapDataFromParsedJson(value) {
        if (typeof value === "string") {
          return getValidatedEditorMapData(value);
        }
        if (!isRecord2(value)) {
          return null;
        }
        for (const key of ["leveldata", "levelData", "map", "mapData", "data"]) {
          const mapData = value[key];
          if (typeof mapData === "string") {
            const validatedMapData = getValidatedEditorMapData(mapData);
            if (validatedMapData) {
              return validatedMapData;
            }
          }
        }
        return null;
      }
      function getMapObjectFromParsedJson(value) {
        if (isCompactMapObject(value)) {
          return value;
        }
        if (!isRecord2(value)) {
          return null;
        }
        for (const key of ["map", "mapData", "data"]) {
          const mapData = value[key];
          if (isCompactMapObject(mapData)) {
            return mapData;
          }
        }
        return null;
      }
      function getEditorMapDataFromParsedJson(value) {
        const stringMapData = getStringMapDataFromParsedJson(value);
        if (stringMapData) {
          return stringMapData;
        }
        const mapObject = getMapObjectFromParsedJson(value);
        return mapObject ? encodeEditorMapData(mapObject) : null;
      }

      // src/features/editor-map-file-transfer.ts
      var EDITOR_FILE_MENU_SELECTOR2 = ".fileMenu";
      var EDITOR_MENU_ITEM_SELECTOR2 = ".item";
      var EDITOR_TRANSFER_ITEM_SELECTOR = "[data-qolbox-editor-map-transfer]";
      var EDITOR_MAP_FILE_INPUT_ID = "qolboxEditorMapFileInput";
      var EDITOR_MAP_STATUS_ID = "qolboxEditorMapStatus";
      var EDITOR_FORCE_SAVE_ATTR = "data-qolbox-editor-force-save";
      var EDITOR_FORCE_SAVE_WAS_DISABLED_ATTR = "data-qolbox-editor-force-save-was-disabled";
      var EDITOR_MAP_COMPACT_FILE_EXTENSION = "hitboxmap";
      var EDITOR_MAP_JSON_FILE_EXTENSION = "json";
      var STATUS_HIDE_DELAY_MS = 2400;
      var FILE_MENU_SYNC_RETRY_DELAYS_MS = [0, 25, 75, 150, 300];
      var MAX_FILENAME_PART_LENGTH = 80;
      var MAX_DOWNLOAD_BASENAME_LENGTH = 180;
      var MAX_EDITOR_MAP_FILE_SIZE_BYTES = 8 * 1024 * 1024;
      var WINDOWS_RESERVED_FILENAMES = /* @__PURE__ */ new Set([
        "CON",
        "PRN",
        "AUX",
        "NUL",
        "COM1",
        "COM2",
        "COM3",
        "COM4",
        "COM5",
        "COM6",
        "COM7",
        "COM8",
        "COM9",
        "LPT1",
        "LPT2",
        "LPT3",
        "LPT4",
        "LPT5",
        "LPT6",
        "LPT7",
        "LPT8",
        "LPT9"
      ]);
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
        return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`;
      }
      function sanitizeFilenamePart(value) {
        const cleaned = String(value || "").replace(/[<>:"/\\|?*\x00-\x1f]/g, " ").replace(/\s+/g, " ").replace(/^[. ]+|[. ]+$/g, "").trim().slice(0, MAX_FILENAME_PART_LENGTH).replace(/[. ]+$/g, "");
        if (!cleaned) {
          return null;
        }
        return WINDOWS_RESERVED_FILENAMES.has(cleaned.toUpperCase()) ? `${cleaned} map` : cleaned;
      }
      function getMapDownloadBaseName(metadata) {
        const title = sanitizeFilenamePart(metadata.title);
        const author = sanitizeFilenamePart(metadata.author);
        const exportedAt = getDownloadTimestamp();
        const parts = ["hitbox-map", title, author, exportedAt].filter((part) => Boolean(part));
        return parts.join(" - ").slice(0, MAX_DOWNLOAD_BASENAME_LENGTH).replace(/[. ]+$/g, "") || `hitbox-map-${getDownloadTimestamp()}`;
      }
      function createEditorMapMenuItem(label, action, handler) {
        const item = document.createElement("div");
        item.className = "item";
        item.textContent = label;
        item.tabIndex = 0;
        item.setAttribute("role", "menuitem");
        item.setAttribute("data-qolbox-editor-map-transfer", action);
        const activate = (event) => {
          event.preventDefault();
          event.stopPropagation();
          item.closest(EDITOR_FILE_MENU_SELECTOR2)?.click();
          handler();
        };
        item.addEventListener(
          "click",
          activate,
          true
        );
        item.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            item.click();
          }
        }, true);
        return item;
      }
      function extractMapDataFromFileText(fileText) {
        const trimmedText = fileText.trim();
        if (!trimmedText) {
          return null;
        }
        let parsedJson;
        try {
          parsedJson = JSON.parse(trimmedText);
        } catch {
          return getValidatedEditorMapData(trimmedText);
        }
        return getEditorMapDataFromParsedJson(parsedJson);
      }
      function createEditorMapFileTransferController(options) {
        let statusHideTimer = 0;
        let documentHooksInstalled = false;
        let fileMenuSyncGeneration = 0;
        let lastPreOpenSyncedFileMenu = null;
        let lastPreOpenSyncTime = 0;
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
          status.setAttribute("aria-live", "polite");
          status.setAttribute("role", "status");
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
        function closeOpenFileMenu() {
          const fileMenu = document.querySelector(EDITOR_FILE_MENU_SELECTOR2);
          const dropdown = fileMenu?.querySelector(".container");
          if (fileMenu && dropdown && dropdown.getBoundingClientRect().height > 0) {
            fileMenu.click();
          }
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
          input.accept = `.${EDITOR_MAP_COMPACT_FILE_EXTENSION},.${EDITOR_MAP_JSON_FILE_EXTENSION},.txt,application/json,text/plain`;
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
            const preferReadableFiles = options.useReadableMapFiles();
            const readableJson = preferReadableFiles ? getReadableEditorMapJson(mapData) : null;
            const exportText = readableJson || mapData;
            const fileExtension = readableJson ? EDITOR_MAP_JSON_FILE_EXTENSION : EDITOR_MAP_COMPACT_FILE_EXTENSION;
            const contentType = readableJson ? "application/json;charset=utf-8" : "text/plain;charset=utf-8";
            const blob = new Blob([exportText], { type: contentType });
            const objectUrl = URL.createObjectURL(blob);
            const downloadBaseName = getMapDownloadBaseName(getEditorMapMetadata());
            const anchor = document.createElement("a");
            anchor.href = objectUrl;
            anchor.download = `${downloadBaseName}.${fileExtension}`;
            anchor.style.display = "none";
            (document.body || document.documentElement).appendChild(anchor);
            anchor.click();
            anchor.remove();
            window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1e3);
            showStatus(readableJson || !preferReadableFiles ? "Map export started." : "Map export started as compact data.");
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
          if (file.size > MAX_EDITOR_MAP_FILE_SIZE_BYTES) {
            showStatus("This map file is too large to import safely.", "error");
            return;
          }
          try {
            const mapData = extractMapDataFromFileText(await file.text());
            if (!mapData) {
              showStatus("Could not import this map file.", "error");
              return;
            }
            const previousMapData = exportEditorMapData();
            if (!previousMapData) {
              showStatus("Could not back up the current map, so import was cancelled.", "error");
              return;
            }
            if (!importEditorMapData(mapData)) {
              const restored = importEditorMapData(previousMapData);
              showStatus(
                restored ? "Could not import this map file. The previous map was restored." : "Import failed and the previous map could not be restored.",
                "error"
              );
              return;
            }
            closeOpenFileMenu();
            showStatus("Map imported.");
          } catch {
            showStatus("Could not import this map file.", "error");
          }
        }
        function removeTransferItems(fileMenu = document.documentElement) {
          fileMenuSyncGeneration += 1;
          fileMenu.querySelectorAll(EDITOR_TRANSFER_ITEM_SELECTOR).forEach((item) => item.remove());
        }
        function restoreSaveItem(saveItem) {
          if (!(saveItem instanceof HTMLElement) || !saveItem.hasAttribute(EDITOR_FORCE_SAVE_ATTR)) {
            return false;
          }
          if (saveItem.getAttribute(EDITOR_FORCE_SAVE_WAS_DISABLED_ATTR) === "true") {
            saveItem.classList.add("disabled");
            saveItem.setAttribute("aria-disabled", "true");
          }
          saveItem.removeAttribute(EDITOR_FORCE_SAVE_ATTR);
          saveItem.removeAttribute(EDITOR_FORCE_SAVE_WAS_DISABLED_ATTR);
          return true;
        }
        function restoreSaveItems(root = document) {
          let restored = false;
          root.querySelectorAll(`[${EDITOR_FORCE_SAVE_ATTR}]`).forEach((saveItem) => {
            restored = restoreSaveItem(saveItem) || restored;
          });
          return restored;
        }
        function syncSaveItem(fileMenu) {
          const saveItem = findMenuItem(fileMenu, "Save");
          if (!(saveItem instanceof HTMLElement)) {
            return false;
          }
          if (!options.isForceSaveEnabled()) {
            return restoreSaveItem(saveItem);
          }
          const firstSync = !saveItem.hasAttribute(EDITOR_FORCE_SAVE_ATTR);
          const wasDisabled = saveItem.classList.contains("disabled") || saveItem.getAttribute("aria-disabled") === "true";
          if (firstSync) {
            saveItem.setAttribute(EDITOR_FORCE_SAVE_ATTR, "true");
            saveItem.setAttribute(EDITOR_FORCE_SAVE_WAS_DISABLED_ATTR, wasDisabled ? "true" : "false");
          }
          saveItem.classList.remove("disabled");
          saveItem.setAttribute("aria-disabled", "false");
          return firstSync && wasDisabled;
        }
        function syncOpenFileMenu(fileMenu) {
          const mapTransferEnabled = options.isEditorMapTransferEnabled();
          const forceSaveEnabled = options.isForceSaveEnabled();
          if (!mapTransferEnabled && !forceSaveEnabled) {
            removeTransferItems(fileMenu);
            restoreSaveItems(fileMenu);
            return false;
          }
          const saveChanged = forceSaveEnabled ? syncSaveItem(fileMenu) : restoreSaveItems(fileMenu);
          if (!mapTransferEnabled) {
            removeTransferItems(fileMenu);
            return saveChanged;
          }
          const loadItem = findMenuItem(fileMenu, "Load");
          const dropdownContainer = loadItem?.parentElement || null;
          if (!loadItem || !dropdownContainer) {
            return saveChanged;
          }
          if (dropdownContainer.querySelector(EDITOR_TRANSFER_ITEM_SELECTOR)) {
            return saveChanged;
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
        function scheduleOpenFileMenuSync(fileMenu) {
          const syncGeneration = ++fileMenuSyncGeneration;
          for (const delay of FILE_MENU_SYNC_RETRY_DELAYS_MS) {
            window.setTimeout(() => {
              if (syncGeneration === fileMenuSyncGeneration && fileMenu.isConnected) {
                syncOpenFileMenu(fileMenu);
              }
            }, delay);
          }
        }
        function handleFileMenuPreOpen(event) {
          const fileMenu = getEventFileMenu(event);
          if (!fileMenu) {
            removeTransferItems();
            return;
          }
          syncOpenFileMenu(fileMenu);
          lastPreOpenSyncedFileMenu = fileMenu;
          lastPreOpenSyncTime = Date.now();
        }
        function installDocumentHooks() {
          if (documentHooksInstalled) {
            return false;
          }
          documentHooksInstalled = true;
          document.addEventListener("pointerdown", handleFileMenuPreOpen, true);
          document.addEventListener("mousedown", handleFileMenuPreOpen, true);
          document.addEventListener(
            "click",
            (event) => {
              const clickedFileMenu = getEventFileMenu(event);
              const hadTransferItems = Boolean(clickedFileMenu?.querySelector(EDITOR_TRANSFER_ITEM_SELECTOR));
              const clickedTransferItem = event.target instanceof Element && Boolean(event.target.closest(EDITOR_TRANSFER_ITEM_SELECTOR));
              const recentlySyncedBeforeOpen = clickedFileMenu === lastPreOpenSyncedFileMenu && Date.now() - lastPreOpenSyncTime < 500;
              window.setTimeout(() => {
                if (!clickedFileMenu) {
                  removeTransferItems();
                  return;
                }
                if (clickedTransferItem || hadTransferItems && !recentlySyncedBeforeOpen) {
                  removeTransferItems(clickedFileMenu);
                  return;
                }
                scheduleOpenFileMenuSync(clickedFileMenu);
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
          restoreSaveItems();
          document.getElementById(EDITOR_MAP_FILE_INPUT_ID)?.remove();
          document.getElementById(EDITOR_MAP_STATUS_ID)?.remove();
        }
        function patchEditorMapFileTransfer() {
          if (!options.isEditorMapTransferEnabled() && !options.isForceSaveEnabled()) {
            removeEditorMapFileTransfer();
            return false;
          }
          if (!options.isForceSaveEnabled()) {
            restoreSaveItems();
          }
          const installed2 = installDocumentHooks();
          document.querySelectorAll(EDITOR_FILE_MENU_SELECTOR2).forEach((fileMenu) => {
            const loadItem = findMenuItem(fileMenu, "Load");
            if (loadItem && loadItem.getBoundingClientRect().height > 0) {
              syncOpenFileMenu(fileMenu);
            }
          });
          return installed2;
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
              options.stopCustomSounds();
              options.removeHamburgerAudioGroup();
              options.cleanupGameVolumeMenu();
              options.removeJukeboxMenuItem();
              options.restoreJukeboxState();
              options.applyGameVolume();
              options.patchLobbyMusicController();
              break;
            case FEATURE_FULLSCREEN:
              options.clearFullscreenLayoutStyles();
              if (options.featureGates.isChatEnabled()) {
                options.syncScoreRows();
                options.syncTypingIndicators();
              }
              break;
            case FEATURE_EDITOR_MAP_TRANSFER:
            case FEATURE_EDITOR_FORCE_SAVE:
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
          options.installPlayerPopupDismissal();
          options.patchSlashCommands();
          options.patchLobbyBlacklist();
          options.patchLobbyInformation();
          options.patchSwitchTeamsButton();
          options.patchMobileQolboxHamburgerEntry();
          options.patchEditorSelectionControls();
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
          if (options.featureGates.isEditorMapTransferEnabled() || options.featureGates.isEditorForceSaveEnabled()) {
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
            options.patchHamburgerAudioGroup();
            options.patchJukeboxKnob();
            options.applyJukeboxState();
          } else {
            disableFeatureSideEffects(FEATURE_AUDIO);
          }
          options.decorateActions();
        }
        return {
          applyPersistentFeatures,
          disableFeatureSideEffects
        };
      }

      // src/features/fullscreen-probe-alignment.ts
      function isFullscreenRenderProbeAligned(probe, dimensions) {
        if (probe.renderWidth <= 0 || probe.renderHeight <= 0) {
          return false;
        }
        const rawPixelRatio = Number(window.devicePixelRatio);
        const pixelRatio = Number.isFinite(rawPixelRatio) && rawPixelRatio > 0 ? rawPixelRatio : 1;
        const backingAligned = Math.abs(probe.backingWidth - Math.round(dimensions.width * pixelRatio)) <= 2 && Math.abs(probe.backingHeight - Math.round(dimensions.height * pixelRatio)) <= 2;
        const expectedResolution = pixelRatio * dimensions.width / dimensions.baseWidth;
        const rendererAligned = dimensions.baseWidth > 0 && probe.rendererLogicalHeight > 0 && Math.abs(probe.rendererLogicalWidth - dimensions.baseWidth) <= 1 && Math.abs(probe.rendererLogicalHeight - dimensions.baseHeight) <= 1 && Math.abs(probe.rendererResolution - expectedResolution) <= 0.01;
        return Math.abs(probe.renderWidth - dimensions.width) <= 2 && Math.abs(probe.renderHeight - dimensions.height) <= 2 && Math.abs(probe.renderLeft - dimensions.left) <= 2 && Math.abs(probe.renderTop - dimensions.top) <= 2 && backingAligned && rendererAligned;
      }

      // src/features/fullscreen-geometry.ts
      function createFullscreenGeometry(options) {
        function getModeInsets(_mode) {
          return {
            left: 0,
            right: 0,
            top: 0,
            bottom: 0
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
            insets,
            mode
          };
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
        return {
          getFullscreenDimensions,
          getModeInsets,
          getRelativeContainerBounds,
          isRenderProbeAligned
        };
      }

      // src/hitbox/renderer-adapter.ts
      function getRendererLogicalSize(canvas, windowObject = window) {
        for (const renderer of getKnownFullscreenRenderers(windowObject)) {
          if (getRendererView(renderer) !== canvas) {
            continue;
          }
          const backing = readNativeProperty(renderer, "Bc");
          const width = readPositiveNumber(backing, "wc");
          const height = readPositiveNumber(backing, "mc");
          if (width && height) {
            return { width, height };
          }
        }
        return null;
      }
      var DENSITY_SNAPSHOT = "__qolboxDensitySnapshot";
      var RESIZE_GUARD_MARKER = "__qolboxResizeGuard";
      var physicalFrameWidths = /* @__PURE__ */ new WeakMap();
      var rendererLogicalSizes = /* @__PURE__ */ new WeakMap();
      function readPositiveNumber(source, property) {
        const value = Number(readNativeProperty(source, property));
        return Number.isFinite(value) && value > 0 ? value : null;
      }
      function captureRendererView(renderer) {
        const camera = readNativeProperty(renderer, "fg");
        const scale = readNativeProperty(readNativeProperty(renderer, "Bc"), "scale");
        const drawArguments = getLastRendererDrawArguments(renderer)?.slice() ?? null;
        return {
          camera,
          drawArguments,
          renderer,
          scale,
          x: readNativeProperty(camera, "x"),
          y: readNativeProperty(camera, "y")
        };
      }
      function restoreRendererView(view) {
        const backing = readNativeProperty(view.renderer, "Bc");
        if (isNativeObject(backing) && typeof view.scale === "number") {
          setNativeReflectProperty(backing, "scale", view.scale);
        }
        if (isNativeObject(view.camera)) {
          if (typeof view.x === "number") setNativeReflectProperty(view.camera, "x", view.x);
          if (typeof view.y === "number") setNativeReflectProperty(view.camera, "y", view.y);
        }
        const draw = readNativeProperty(view.renderer, "Dg");
        if (view.drawArguments && typeof draw === "function") {
          Reflect.apply(draw, view.renderer, view.drawArguments);
        }
        rerenderKnownNativeRenderer(view.renderer);
      }
      function isRendererOutputCurrent(renderer, width, height) {
        const screen = readNativeProperty(renderer, "screen");
        const view = readNativeProperty(renderer, "view");
        const screenWidth = readPositiveNumber(screen, "width");
        const screenHeight = readPositiveNumber(screen, "height");
        const backingWidth = readPositiveNumber(view, "width");
        const backingHeight = readPositiveNumber(view, "height");
        const resolution = readPositiveNumber(renderer, "resolution");
        return Boolean(
          screenWidth && screenHeight && backingWidth && backingHeight && resolution && Math.abs(screenWidth - width) <= 1 && Math.abs(screenHeight - height) <= 1 && Math.abs(backingWidth - Math.round(width * resolution)) <= 2 && Math.abs(backingHeight - Math.round(height * resolution)) <= 2
        );
      }
      function setRendererDensity(renderer, density) {
        const options = readNativeProperty(renderer, "options");
        const interaction = readNativeProperty(readNativeProperty(renderer, "plugins"), "interaction");
        setNativeReflectProperty(renderer, "autoDensity", true);
        setNativeReflectProperty(renderer, "resolution", density);
        if (isNativeObject(options)) {
          setNativeReflectProperty(options, "autoDensity", true);
          setNativeReflectProperty(options, "resolution", density);
        }
        if (isNativeObject(interaction)) setNativeReflectProperty(interaction, "resolution", density);
      }
      function guardRedundantResize(renderer, resize) {
        const currentResize = readNativeProperty(renderer, "resize");
        if (readNativeReflectProperty(currentResize, RESIZE_GUARD_MARKER)) return;
        const guardedResize = function(width, height) {
          if (isNativeObject(this)) {
            const physicalWidth = physicalFrameWidths.get(this);
            if (physicalWidth && width > 0) setRendererDensity(this, physicalWidth / width);
          }
          if (!isRendererOutputCurrent(this, width, height)) {
            return Reflect.apply(resize, this, [width, height]);
          }
          return void 0;
        };
        setNativeReflectProperty(guardedResize, RESIZE_GUARD_MARKER, true);
        setNativeReflectProperty(renderer, "resize", guardedResize);
      }
      function resizeKnownRenderer(renderer, logicalWidth, logicalHeight, frameWidth, pixelRatio) {
        if (isNativeObject(renderer)) {
          const previous = rendererLogicalSizes.get(renderer);
          const camera = readNativeProperty(renderer, "fg");
          if (previous && isNativeObject(camera)) {
            const x = Number(readNativeProperty(camera, "x")) + (logicalWidth - previous.width) / 2;
            const y = Number(readNativeProperty(camera, "y")) + (logicalHeight - previous.height) / 2;
            if (Number.isFinite(x) && Number.isFinite(y)) {
              setNativeReflectProperty(camera, "x", x);
              setNativeReflectProperty(camera, "y", y);
            }
          }
          rendererLogicalSizes.set(renderer, { height: logicalHeight, width: logicalWidth });
        }
        const pixiRenderer = readNativeProperty(renderer, "Ag");
        if (!isNativeObject(pixiRenderer)) {
          return;
        }
        const pixiResize = readNativeProperty(pixiRenderer, "resize");
        if (typeof pixiResize !== "function") {
          return;
        }
        const options = readNativeProperty(pixiRenderer, "options");
        const interaction = readNativeProperty(readNativeProperty(pixiRenderer, "plugins"), "interaction");
        let snapshot = readNativeProperty(pixiRenderer, DENSITY_SNAPSHOT);
        if (!isNativeObject(snapshot)) {
          const newSnapshot = {
            resize: pixiResize,
            autoDensity: readNativeProperty(pixiRenderer, "autoDensity"),
            optionsAutoDensity: readNativeProperty(options, "autoDensity"),
            optionsResolution: readNativeProperty(options, "resolution"),
            interactionResolution: readNativeProperty(interaction, "resolution"),
            resolution: readNativeProperty(pixiRenderer, "resolution")
          };
          snapshot = newSnapshot;
          setNativeReflectProperty(pixiRenderer, DENSITY_SNAPSHOT, newSnapshot);
        }
        const density = pixelRatio * frameWidth / logicalWidth;
        physicalFrameWidths.set(pixiRenderer, pixelRatio * frameWidth);
        setRendererDensity(pixiRenderer, density);
        try {
          const nativeResize = readNativeProperty(snapshot, "resize");
          if (typeof nativeResize === "function") {
            guardRedundantResize(pixiRenderer, nativeResize);
            if (!isRendererOutputCurrent(pixiRenderer, logicalWidth, logicalHeight)) {
              Reflect.apply(nativeResize, pixiRenderer, [logicalWidth, logicalHeight]);
              rerenderKnownRenderer(renderer);
            }
          }
        } catch {
        }
      }
      function restoreKnownRenderer(renderer, pixelRatio) {
        const pixiRenderer = readNativeProperty(renderer, "Ag");
        if (!isNativeObject(pixiRenderer)) {
          return;
        }
        const snapshot = readNativeProperty(pixiRenderer, DENSITY_SNAPSHOT);
        if (!isNativeObject(snapshot)) {
          return;
        }
        const options = readNativeProperty(pixiRenderer, "options");
        const interaction = readNativeProperty(readNativeProperty(pixiRenderer, "plugins"), "interaction");
        const nativeResize = readNativeProperty(snapshot, "resize");
        if (typeof nativeResize === "function") {
          setNativeReflectProperty(pixiRenderer, "resize", nativeResize);
        }
        const originalResolution = readPositiveNumber(snapshot, "resolution");
        if (originalResolution && Math.abs(originalResolution - pixelRatio) <= 1e-3) {
          setNativeReflectProperty(pixiRenderer, "autoDensity", readNativeProperty(snapshot, "autoDensity"));
          setNativeReflectProperty(pixiRenderer, "resolution", originalResolution);
          if (isNativeObject(options)) {
            setNativeReflectProperty(options, "autoDensity", readNativeProperty(snapshot, "optionsAutoDensity"));
            setNativeReflectProperty(options, "resolution", readNativeProperty(snapshot, "optionsResolution"));
          }
          if (isNativeObject(interaction)) {
            setNativeReflectProperty(interaction, "resolution", readNativeProperty(snapshot, "interactionResolution"));
          }
        } else {
          setRendererDensity(pixiRenderer, pixelRatio);
        }
        const screen = readNativeProperty(pixiRenderer, "screen");
        const logicalWidth = readPositiveNumber(screen, "width");
        const logicalHeight = readPositiveNumber(screen, "height");
        const pixiResize = readNativeProperty(pixiRenderer, "resize");
        if (logicalWidth && logicalHeight && typeof pixiResize === "function") {
          try {
            Reflect.apply(pixiResize, pixiRenderer, [logicalWidth, logicalHeight]);
            const draw = readNativeProperty(renderer, "Dg");
            const drawArguments = isNativeObject(renderer) ? getLastRendererDrawArguments(renderer) : null;
            if (drawArguments && typeof draw === "function") Reflect.apply(draw, renderer, drawArguments);
            rerenderKnownRenderer(renderer);
          } catch {
          }
        }
        Reflect.deleteProperty(pixiRenderer, DENSITY_SNAPSHOT);
        physicalFrameWidths.delete(pixiRenderer);
        if (isNativeObject(renderer)) rendererLogicalSizes.delete(renderer);
      }
      function resizeKnownFullscreenRenderers(options) {
        const { dimensions, fitElementToFrame, windowObject = window } = options;
        const frameWidth = Math.max(1, Math.round(dimensions.width));
        const fallbackLogicalWidth = Math.max(1, dimensions.baseWidth ?? frameWidth);
        const fallbackLogicalHeight = Math.max(1, dimensions.baseHeight ?? dimensions.height);
        const rawPixelRatio = Number(readNativeProperty(windowObject, "devicePixelRatio"));
        const pixelRatio = Number.isFinite(rawPixelRatio) && rawPixelRatio > 0 ? rawPixelRatio : 1;
        for (const renderer of getKnownFullscreenRenderers(windowObject)) {
          const view = getRendererView(renderer);
          const backing = readNativeProperty(renderer, "Bc");
          const useNativeCameraSize = !isSyntheticRendererWrapper(renderer);
          const logicalWidth = useNativeCameraSize ? readPositiveNumber(backing, "wc") ?? fallbackLogicalWidth : fallbackLogicalWidth;
          const logicalHeight = useNativeCameraSize ? readPositiveNumber(backing, "mc") ?? fallbackLogicalHeight : fallbackLogicalHeight;
          resizeKnownRenderer(renderer, logicalWidth, logicalHeight, frameWidth, pixelRatio);
          fitElementToFrame(getRendererHost(renderer), dimensions);
          fitElementToFrame(view, dimensions);
          fitElementToFrame(view?.parentElement, dimensions);
        }
      }
      function restoreKnownFullscreenRenderers(windowObject = window) {
        const rawPixelRatio = Number(readNativeProperty(windowObject, "devicePixelRatio"));
        const pixelRatio = Number.isFinite(rawPixelRatio) && rawPixelRatio > 0 ? rawPixelRatio : 1;
        const renderers = getKnownFullscreenRenderers(windowObject);
        const views = renderers.map(captureRendererView);
        for (const renderer of renderers) {
          restoreKnownRenderer(renderer, pixelRatio);
        }
        const restoreViews = () => views.forEach(restoreRendererView);
        restoreViews();
        const requestFrame = readNativeProperty(windowObject, "requestAnimationFrame");
        if (typeof requestFrame === "function") Reflect.apply(requestFrame, windowObject, [restoreViews]);
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
      function setStyleSize(element, width, height) {
        const style = getStyleDeclaration(element);
        if (!style) {
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
          const rawPixelRatio = Number(window.devicePixelRatio);
          const pixelRatio = Number.isFinite(rawPixelRatio) && rawPixelRatio > 0 ? rawPixelRatio : 1;
          const rendererSize = getRendererLogicalSize(canvas);
          const nativeWidth = rendererSize?.width ?? backingWidth / pixelRatio;
          const nativeHeight = rendererSize?.height ?? backingHeight / pixelRatio;
          const fitScale = Math.min(1, window.innerWidth / nativeWidth, window.innerHeight / nativeHeight);
          const width = nativeWidth * fitScale;
          const height = nativeHeight * fitScale;
          if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
            return;
          }
          const canvasWidthPx = `${Math.round(width * 10) / 10}px`;
          const canvasHeightPx = `${Math.round(height * 10) / 10}px`;
          for (const element of [document.getElementById("appContainer"), document.getElementById("relativeContainer"), canvas]) {
            setStyleSize(element, canvasWidthPx, canvasHeightPx);
          }
        }
        return {
          restoreNativeLayoutSizeFallback,
          shouldWaitForNativeLayoutSeed
        };
      }

      // src/features/fullscreen-render-state.ts
      var HITBOX_REFERENCE_VIEWPORT_WIDTH = 1366;
      var HITBOX_VIEWPORT_SCALE = 1.15;
      var HITBOX_MOBILE_WIDTH = 1e3;
      var HITBOX_MOBILE_USER_AGENT = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
      function createFullscreenRenderState(options) {
        function getViewportSize() {
          return {
            width: Math.max(window.innerWidth, document.documentElement.clientWidth || 0),
            height: Math.max(window.innerHeight, document.documentElement.clientHeight || 0)
          };
        }
        function getBaseGameSize() {
          const nativeScale = window.innerWidth / HITBOX_REFERENCE_VIEWPORT_WIDTH * HITBOX_VIEWPORT_SCALE;
          const nativeWidth = HITBOX_MOBILE_USER_AGENT.test(window.navigator?.userAgent ?? "") ? HITBOX_MOBILE_WIDTH : options.fallbackBaseWidth;
          return {
            width: Math.max(1, Math.floor(nativeWidth * nativeScale)),
            height: Math.max(1, Math.floor(options.fallbackBaseHeight * nativeScale))
          };
        }
        function isCanvasElement(element) {
          return element instanceof Element && element.tagName === "CANVAS";
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
          const renderer = renderers.find((candidate) => getRendererView(candidate) === renderLayer);
          const pixiRenderer = readNativeProperty(renderer, "Ag");
          const rendererScreen = readNativeProperty(pixiRenderer, "screen");
          const backingSize = getCanvasBackingSize(renderLayer);
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
            rendererLogicalWidth: Number(readNativeProperty(rendererScreen, "width")) || 0,
            rendererLogicalHeight: Number(readNativeProperty(rendererScreen, "height")) || 0,
            rendererResolution: Number(readNativeProperty(pixiRenderer, "resolution")) || 0
          };
        }
        return {
          getActiveRenderCanvas,
          getActiveRenderMode,
          getBaseGameSize,
          getLayoutProbe,
          getViewportSize
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
          if (element.style.getPropertyValue(property) === value && element.style.getPropertyPriority(property) === "important") {
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
            if (!original) {
              continue;
            }
            if (original.hadValue) {
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
          getViewportSize: renderState.getViewportSize
        });
        return {
          ...renderState,
          ...nativeLayoutFallback,
          ...styleManager,
          ...geometry
        };
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
        "overflow",
        "transform",
        "transform-origin"
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
        "overflow",
        "transform",
        "transform-origin"
      ];
      function createFullscreenCleanup(options) {
        function clearFullscreenLayoutStyles() {
          options.restoreFullscreenStyles(document.documentElement, ["overflow"]);
          options.restoreFullscreenStyles(document.body, ["overflow", "margin", "background-color"]);
          options.restoreFullscreenStyles(document.getElementById("appContainer"), APP_CONTAINER_PROPERTIES);
          options.restoreFullscreenStyles(document.getElementById("relativeContainer"), RELATIVE_CONTAINER_PROPERTIES);
          options.restoreFullscreenStyles(document.getElementById("backgroundImage"), BACKGROUND_IMAGE_PROPERTIES);
          for (const topBar of document.querySelectorAll(".mainMenuFancy > .topBar")) {
            options.restoreFullscreenStyles(topBar, ["left", "top", "width"]);
          }
          for (const bottomBar of document.querySelectorAll(".mainMenuFancy > .bottomBar")) {
            options.restoreFullscreenStyles(bottomBar, ["left", "bottom", "width"]);
          }
          for (const cornerButton of document.querySelectorAll(".cornerButton")) {
            options.restoreFullscreenStyles(cornerButton, ["left", "right", "top"]);
          }
          for (const element of document.querySelectorAll(options.renderLayerSelector)) {
            options.restoreFullscreenStyles(element, FRAME_PROPERTIES);
          }
          for (const canvas of document.querySelectorAll(options.renderCanvasSelector)) {
            options.restoreFullscreenStyles(canvas, FRAME_PROPERTIES);
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
          for (const menu of document.querySelectorAll(".rightClickMenu .container")) {
            options.restoreFullscreenStyles(menu, ["left", "top"]);
            delete menu.dataset.qolboxNativeLeft;
            delete menu.dataset.qolboxNativeTop;
          }
          for (const physicsCount of document.querySelectorAll(".physicsCountWindow")) {
            options.restoreFullscreenStyles(physicsCount, ["bottom"]);
          }
          options.restoreNativeLayoutSizeFallback();
          options.clearFullscreenStyleSnapshots();
          restoreKnownFullscreenRenderers();
        }
        return {
          clearFullscreenLayoutStyles
        };
      }

      // src/features/fullscreen-container-layout.ts
      function alignNativePointerMenus(options, dimensions, appContainer) {
        var _a, _b;
        const appRect = appContainer.getBoundingClientRect();
        const scale = dimensions.scale || 1;
        for (const menu of appContainer.querySelectorAll(".rightClickMenu .container")) {
          (_a = menu.dataset).qolboxNativeLeft || (_a.qolboxNativeLeft = menu.style.left);
          (_b = menu.dataset).qolboxNativeTop || (_b.qolboxNativeTop = menu.style.top);
          const nativeLeft = Number.parseFloat(menu.dataset.qolboxNativeLeft);
          const nativeTop = Number.parseFloat(menu.dataset.qolboxNativeTop);
          if (!Number.isFinite(nativeLeft) || !Number.isFinite(nativeTop)) {
            continue;
          }
          const pointerX = nativeLeft + appContainer.offsetLeft;
          const pointerY = nativeTop + appContainer.offsetTop;
          options.setImportantStyle(menu, "left", `${(pointerX - appRect.left) / scale}px`);
          options.setImportantStyle(menu, "top", `${(pointerY - appRect.top) / scale}px`);
        }
      }
      function applyFullscreenChromeLayout(options, dimensions) {
        const scale = dimensions.scale || 1;
        const leftInset = dimensions.left / scale;
        const topInset = dimensions.top / scale;
        const rightInset = (dimensions.viewportWidth - dimensions.left - dimensions.baseWidth * scale) / scale;
        const bottomInset = (dimensions.viewportHeight - dimensions.top - dimensions.baseHeight * scale) / scale;
        const viewportWidth = dimensions.viewportWidth / scale;
        for (const topBar of document.querySelectorAll(".mainMenuFancy > .topBar")) {
          options.setImportantStyle(topBar, "left", `${-leftInset}px`);
          options.setImportantStyle(topBar, "top", `${-topInset}px`);
          options.setImportantStyle(topBar, "width", `${viewportWidth}px`);
        }
        for (const bottomBar of document.querySelectorAll(".mainMenuFancy > .bottomBar")) {
          options.setImportantStyle(bottomBar, "left", `${-leftInset}px`);
          options.setImportantStyle(bottomBar, "bottom", `${-bottomInset}px`);
          options.setImportantStyle(bottomBar, "width", `${viewportWidth}px`);
        }
        for (const cornerButton of document.querySelectorAll(".cornerButton")) {
          options.setImportantStyle(cornerButton, "top", `${15 - topInset}px`);
          if (cornerButton.classList.contains("left")) {
            options.setImportantStyle(cornerButton, "left", `${15 - leftInset}px`);
          } else {
            options.setImportantStyle(cornerButton, "right", `${15 - rightInset}px`);
          }
        }
      }
      function applyFullscreenContainerLayout(options, dimensions) {
        options.setImportantStyle(document.documentElement, "overflow", "hidden");
        options.setImportantStyle(document.body, "overflow", "hidden");
        options.setImportantStyle(document.body, "margin", "0");
        options.setImportantStyle(document.body, "background-color", "#0a0a0a");
        const appContainer = document.getElementById("appContainer");
        const rootLeft = dimensions.left;
        const rootTop = dimensions.top;
        const rootWidth = dimensions.baseWidth;
        const rootHeight = dimensions.baseHeight;
        const rootTransform = `scale(${dimensions.scale})`;
        if (appContainer) {
          options.setImportantStyle(appContainer, "position", "fixed");
          options.setImportantStyle(appContainer, "left", `${rootLeft}px`);
          options.setImportantStyle(appContainer, "top", `${rootTop}px`);
          options.setImportantStyle(appContainer, "right", "auto");
          options.setImportantStyle(appContainer, "bottom", "auto");
          options.setImportantStyle(appContainer, "margin", "0");
          options.setImportantStyle(appContainer, "width", `${rootWidth}px`);
          options.setImportantStyle(appContainer, "height", `${rootHeight}px`);
          options.setImportantStyle(appContainer, "max-width", "none");
          options.setImportantStyle(appContainer, "max-height", "none");
          options.setImportantStyle(appContainer, "border", "0");
          options.setImportantStyle(appContainer, "overflow", "visible");
          options.setImportantStyle(appContainer, "transform", rootTransform);
          options.setImportantStyle(appContainer, "transform-origin", "top left");
          alignNativePointerMenus(options, dimensions, appContainer);
        }
        const relativeContainer = document.getElementById("relativeContainer");
        if (relativeContainer) {
          options.setImportantStyle(relativeContainer, "position", "fixed");
          options.setImportantStyle(relativeContainer, "left", `${rootLeft}px`);
          options.setImportantStyle(relativeContainer, "top", `${rootTop}px`);
          options.setImportantStyle(relativeContainer, "right", "auto");
          options.setImportantStyle(relativeContainer, "bottom", "auto");
          options.setImportantStyle(relativeContainer, "margin", "0");
          options.setImportantStyle(relativeContainer, "width", `${rootWidth}px`);
          options.setImportantStyle(relativeContainer, "height", `${rootHeight}px`);
          options.setImportantStyle(relativeContainer, "overflow", "visible");
          options.setImportantStyle(relativeContainer, "transform", rootTransform);
          options.setImportantStyle(relativeContainer, "transform-origin", "top left");
        }
        const backgroundImage = document.getElementById("backgroundImage");
        if (backgroundImage) {
          const backgroundScale = dimensions.scale;
          options.setImportantStyle(backgroundImage, "position", "fixed");
          options.setImportantStyle(backgroundImage, "left", `${-rootLeft / backgroundScale}px`);
          options.setImportantStyle(backgroundImage, "top", `${-rootTop / backgroundScale}px`);
          options.setImportantStyle(backgroundImage, "right", "auto");
          options.setImportantStyle(backgroundImage, "bottom", "auto");
          options.setImportantStyle(backgroundImage, "width", `${dimensions.viewportWidth / backgroundScale}px`);
          options.setImportantStyle(backgroundImage, "height", `${dimensions.viewportHeight / backgroundScale}px`);
        }
        applyFullscreenChromeLayout(options, dimensions);
      }

      // src/features/fullscreen-frame-layout.ts
      function createFullscreenFrameLayout(options) {
        function fitElementToFrame(element, dimensions = options.getFullscreenDimensions()) {
          if (!(element instanceof Element)) return;
          options.setImportantStyle(element, "position", "absolute");
          options.setImportantStyle(element, "left", "0");
          options.setImportantStyle(element, "top", "0");
          options.setImportantStyle(element, "right", "auto");
          options.setImportantStyle(element, "bottom", "auto");
          options.setImportantStyle(element, "margin", "0");
          options.setImportantStyle(element, "width", `${dimensions.baseWidth}px`);
          options.setImportantStyle(element, "height", `${dimensions.baseHeight}px`);
          options.setImportantStyle(element, "max-width", "none");
          options.setImportantStyle(element, "max-height", "none");
          options.setImportantStyle(element, "transform", "none");
        }
        function fitRenderLayersToFrame(dimensions) {
          for (const layer of document.querySelectorAll(options.renderLayerSelector)) {
            fitElementToFrame(layer, dimensions);
            options.setImportantStyle(layer, "zoom", "1");
          }
        }
        function fitRenderCanvasesToFrame(dimensions) {
          for (const canvas of document.querySelectorAll(options.renderCanvasSelector)) {
            fitElementToFrame(canvas, dimensions);
          }
        }
        function enforceFullscreenLayout(dimensions = options.getFullscreenDimensions()) {
          options.ensureGlobalStyle();
          const relativeBounds = options.getRelativeContainerBounds(dimensions);
          applyFullscreenContainerLayout(options, dimensions);
          fitRenderLayersToFrame(dimensions);
          fitRenderCanvasesToFrame(dimensions);
          options.layoutRelativeHud(relativeBounds, dimensions);
          return true;
        }
        return {
          enforceFullscreenLayout,
          fitElementToFrame
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
      var OPEN_CONTROLS_FALLBACK_BOTTOM_OFFSET_PX = 62;
      var PHYSICS_COUNT_FALLBACK_BOTTOM_OFFSET_PX = 17;
      var PHYSICS_COUNT_RADIO_MARGIN_PX = 10;
      var SPECTATE_CONTROLS_RADIO_MARGIN_PX = 5;
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
      function callNativeJukeboxHandler(jukebox, handlerName, fallbackBottom) {
        const handler = readObjectProperty(jukebox, handlerName);
        if (isCallable(handler)) {
          Reflect.apply(handler, jukebox, []);
          return;
        }
        const style = readObjectProperty(jukebox, "style");
        if (style instanceof CSSStyleDeclaration) {
          style.bottom = fallbackBottom;
        }
      }
      function getRadioBottomOffset(jukebox, margin, fallback) {
        const circleRect = jukebox.querySelector(".circle")?.getBoundingClientRect();
        const jukeboxRect = jukebox.getBoundingClientRect();
        const jukeboxHeight = Number.parseFloat(window.getComputedStyle(jukebox).height);
        const layoutScale = jukeboxRect.height > 0 && jukeboxHeight > 0 ? jukeboxRect.height / jukeboxHeight : 1;
        return circleRect && circleRect.height > 0 ? (window.innerHeight - circleRect.top) / layoutScale + margin : fallback;
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
        const liveOffset = getRadioBottomOffset(
          jukebox,
          SPECTATE_CONTROLS_RADIO_MARGIN_PX,
          CLOSED_CONTROLS_BOTTOM_OFFSET_PX
        );
        const openOffset = Number.isFinite(bottom) ? liveOffset - bottom : OPEN_CONTROLS_FALLBACK_BOTTOM_OFFSET_PX;
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
        let useGameplayHudLayout = false;
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
        function setBottom(element, bottom) {
          if (getFullscreenInlineStyleProperty(element, "bottom") === bottom) {
            return false;
          }
          options.setImportantStyle(element, "bottom", bottom);
          return true;
        }
        function setPhysicsCountBottom(state) {
          const offset = state.jukebox ? getRadioBottomOffset(
            state.jukebox,
            PHYSICS_COUNT_RADIO_MARGIN_PX,
            PHYSICS_COUNT_FALLBACK_BOTTOM_OFFSET_PX
          ) : PHYSICS_COUNT_FALLBACK_BOTTOM_OFFSET_PX;
          let changed = false;
          for (const count of document.querySelectorAll(".physicsCountWindow")) {
            changed = setBottom(count, `${offset}px`) || changed;
          }
          return changed;
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
          if (!options.isFullscreenEnabled()) {
            releaseSpectatorRadioHold();
            return false;
          }
          const useSpectateControls = useGameplayHudLayout && options.isSessionMatchActive();
          if (!useSpectateControls) {
            releaseSpectatorRadioHold();
          }
          const state = getSpectatorRadioLayoutState(
            options,
            spectatorRadioHoldActive,
            keepControlsOpenUntilRadioCloses
          );
          const forceOpenControls = useSpectateControls && syncJukeboxSpectatorHold(state);
          const bottom = `${forceOpenControls ? state.openOffset : state.controlsBottomOffset}px`;
          let changed = setPhysicsCountBottom(state);
          if (!useSpectateControls) {
            for (const controls of document.querySelectorAll(options.spectateControlsSelector)) {
              resetSpectateControlsLayout(controls);
            }
            return changed;
          }
          for (const controls of document.querySelectorAll(options.spectateControlsSelector)) {
            changed = setBottom(controls, bottom) || changed;
          }
          return changed;
        }
        function layoutSpectateControls(gameplayHudLayout) {
          useGameplayHudLayout = gameplayHudLayout;
          const useSpectateControls = gameplayHudLayout && options.isSessionMatchActive();
          if (!useSpectateControls) {
            releaseSpectatorRadioHold();
          }
          const state = getSpectatorRadioLayoutState(
            options,
            spectatorRadioHoldActive,
            keepControlsOpenUntilRadioCloses
          );
          const forceOpenControls = useSpectateControls && syncJukeboxSpectatorHold(state);
          const controlsBottomOffset = forceOpenControls ? state.openOffset : state.controlsBottomOffset;
          setPhysicsCountBottom(state);
          if (useSpectateControls) {
            for (const spectateControls of document.querySelectorAll(options.spectateControlsSelector)) {
              options.setImportantStyle(spectateControls, "position", "absolute");
              options.setImportantStyle(spectateControls, "left", "50%");
              options.setImportantStyle(spectateControls, "right", "auto");
              options.setImportantStyle(spectateControls, "top", "auto");
              setBottom(spectateControls, `${controlsBottomOffset}px`);
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
          resetSpectateControlsLayout: spectateControlsLayout.resetSpectateControlsLayout,
          syncSpectateControlsBottomWithJukebox: spectateControlsLayout.syncSpectateControlsBottomWithJukebox
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
          getRelativeContainerBounds: options.getRelativeContainerBounds,
          layoutRelativeHud: hudLayout.layoutRelativeHud,
          setImportantStyle: options.setImportantStyle
        });
        const cleanup = createFullscreenCleanup({
          renderCanvasSelector: FULLSCREEN_RENDER_CANVAS_SELECTOR,
          renderLayerSelector: FULLSCREEN_RENDER_LAYER_SELECTOR,
          clearFullscreenStyleSnapshots: options.clearFullscreenStyleSnapshots,
          resetScorePanelLayout: hudLayout.resetScorePanelLayout,
          resetSpectateControlsLayout: hudLayout.resetSpectateControlsLayout,
          restoreFullscreenStyles: options.restoreFullscreenStyles,
          restoreNativeLayoutSizeFallback: options.restoreNativeLayoutSizeFallback
        });
        const resizeTargets = createFullscreenResizeTargetObserver({
          renderCanvasSelector: FULLSCREEN_RENDER_CANVAS_SELECTOR,
          renderLayerSelector: FULLSCREEN_RENDER_LAYER_SELECTOR
        });
        function resizeFullscreenRenderers(dimensions) {
          resizeKnownFullscreenRenderers({
            dimensions,
            fitElementToFrame: frameLayout.fitElementToFrame
          });
        }
        return {
          ...hudLayout,
          ...frameLayout,
          ...cleanup,
          ...resizeTargets,
          resizeKnownFullscreenRenderers: resizeFullscreenRenderers
        };
      }

      // src/features/fullscreen-hook-installer.ts
      function createFullscreenHookInstaller(options) {
        let installed2 = false;
        function scheduleResizeSettle() {
          options.scheduleUiWork({ passes: options.resizeSettlePasses });
        }
        function installFullscreenHooks() {
          if (installed2) {
            return;
          }
          if (!document.documentElement) {
            options.scheduleUiWork({ features: true, passes: options.fullscreenSettlePasses });
            return;
          }
          installed2 = true;
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
            () => options.scheduleUiWork({ features: true, passes: options.fullscreenSettlePasses }),
            true
          );
          window.addEventListener(
            "pageshow",
            () => options.scheduleUiWork({ features: true, passes: options.resizeSettlePasses }),
            true
          );
          document.addEventListener(
            "visibilitychange",
            () => {
              if (!document.hidden) {
                options.scheduleUiWork({ features: true, passes: options.resizeSettlePasses });
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
                options.scheduleUiWork({ passes: 1 });
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
        function discardFullscreenMutationRecords() {
          fullscreenMutationObserver?.takeRecords();
        }
        return {
          discardFullscreenMutationRecords,
          installFullscreenMutationObserver
        };
      }

      // src/features/fullscreen-refresh-controller.ts
      function createFullscreenRefreshController(options) {
        let nativeSeedRetryTimer = 0;
        function clearNativeSeedRetry() {
          if (!nativeSeedRetryTimer) {
            return;
          }
          window.clearTimeout(nativeSeedRetryTimer);
          nativeSeedRetryTimer = 0;
        }
        function refreshFullscreen() {
          if (!options.isFullscreenEnabled()) {
            clearNativeSeedRetry();
            options.syncNonFullscreenHud();
            return false;
          }
          if (options.shouldWaitForNativeLayoutSeed()) {
            if (!nativeSeedRetryTimer) {
              nativeSeedRetryTimer = window.setTimeout(() => {
                nativeSeedRetryTimer = 0;
                options.scheduleUiWork({ passes: 1 });
              }, 100);
            }
            return false;
          }
          clearNativeSeedRetry();
          const dimensions = options.getFullscreenDimensions();
          const transitionOverlap = options.isMenuGameplayOverlap();
          options.patchLobbyMusicController();
          options.updateGameStartIndicator();
          options.enforceFullscreenLayout(dimensions);
          if (!transitionOverlap) {
            options.resizeKnownFullscreenRenderers(dimensions);
          }
          if (options.isRenderProbeAligned(options.getLayoutProbe(), dimensions)) {
            return false;
          }
          options.enforceFullscreenLayout(dimensions);
          return true;
        }
        return {
          refreshFullscreen
        };
      }

      // src/features/fullscreen-work-scheduler.ts
      function createFullscreenWorkScheduler(options) {
        let scheduledWorkRaf = 0;
        let scheduledWorkFeatures = false;
        let scheduledWorkPasses = 0;
        function scheduleUiWork({ features = false, passes = 1 } = {}) {
          scheduledWorkFeatures = scheduledWorkFeatures || features;
          scheduledWorkPasses = Math.max(scheduledWorkPasses, Math.max(1, passes));
          if (scheduledWorkRaf) {
            return;
          }
          const runScheduledWork = () => {
            scheduledWorkRaf = 0;
            const shouldPatchFeatures = scheduledWorkFeatures;
            const remainingPasses = scheduledWorkPasses;
            scheduledWorkFeatures = false;
            scheduledWorkPasses = 0;
            options.ensureGlobalStyle();
            options.applyFeatureRootClasses();
            options.installFullscreenHooks();
            if (shouldPatchFeatures) {
              options.applyPersistentFeatures();
            }
            options.refreshFullscreen();
            options.refreshObservedResizeTargets();
            options.discardObservedMutations();
            if (remainingPasses > 1) {
              scheduleUiWork({ passes: remainingPasses - 1 });
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
        let discardObservedMutations = () => {
        };
        const { refreshFullscreen } = createFullscreenRefreshController({
          enforceFullscreenLayout: options.enforceFullscreenLayout,
          getFullscreenDimensions: options.getFullscreenDimensions,
          getLayoutProbe: options.getLayoutProbe,
          isFullscreenEnabled: options.isFullscreenEnabled,
          isMenuGameplayOverlap: options.isMenuGameplayOverlap,
          isRenderProbeAligned: options.isRenderProbeAligned,
          patchLobbyMusicController: options.patchLobbyMusicController,
          resizeKnownFullscreenRenderers: options.resizeKnownFullscreenRenderers,
          scheduleUiWork: (request) => scheduleUiWork(request),
          shouldWaitForNativeLayoutSeed: options.shouldWaitForNativeLayoutSeed,
          syncNonFullscreenHud: options.syncNonFullscreenHud,
          updateGameStartIndicator: options.updateGameStartIndicator
        });
        const { scheduleUiWork } = createFullscreenWorkScheduler({
          applyFeatureRootClasses: options.applyFeatureRootClasses,
          applyPersistentFeatures: options.applyPersistentFeatures,
          discardObservedMutations: () => discardObservedMutations(),
          ensureGlobalStyle: options.ensureGlobalStyle,
          installFullscreenHooks: () => installFullscreenHooks(),
          refreshFullscreen,
          refreshObservedResizeTargets: options.refreshObservedResizeTargets
        });
        const mutationObserver = createFullscreenMutationObserver({
          featurePatchTargetSelector: FEATURE_PATCH_TARGET_SELECTOR,
          layoutTargetSelector: FULLSCREEN_LAYOUT_TARGET_SELECTOR,
          scheduleUiWork,
          settlePasses: FULLSCREEN_SETTLE_PASSES,
          syncSpectateControlsBottomWithJukebox: options.syncSpectateControlsBottomWithJukebox,
          updateGameStartIndicator: options.updateGameStartIndicator
        });
        const { installFullscreenMutationObserver } = mutationObserver;
        discardObservedMutations = mutationObserver.discardFullscreenMutationRecords;
        const { installFullscreenHooks } = createFullscreenHookInstaller({
          fullscreenSettlePasses: FULLSCREEN_SETTLE_PASSES,
          installChatCommandAliasHooks: options.installChatCommandAliasHooks,
          installChatEscapeHooks: options.installChatEscapeHooks,
          installFullscreenMutationObserver,
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
          installFullscreenHooks,
          installFullscreenMutationObserver,
          refreshFullscreen,
          scheduleUiWork: (request) => scheduleUiWork(request)
        };
      }

      // src/hitbox/native-contract.ts
      var HITBOX_NATIVE = {
        session: {
          chatSend: "CJ",
          localGameStart: "_J",
          playerJoined: "VW",
          remoteGameStart: ["KJ", "ZJ"],
          runtime: "KR",
          showStatus: "vG"
        },
        renderer: {
          backing: "Bc",
          draw: "Dg",
          nested: "hb",
          pixi: "Ag",
          resize: "cg"
        },
        mobile: {
          controls: "PD",
          hide: "_L",
          inputState: "hg",
          mobileFlag: "xm",
          pressGrab: "Fn",
          setInputState: "ED",
          show: "NL",
          slots: ["oz", "rz", "az"],
          view: "hf"
        }
      };

      // src/hitbox/game-start-hooks.ts
      var REMOTE_START_METHODS = HITBOX_NATIVE.session.remoteGameStart;
      var LOCAL_START_METHOD = HITBOX_NATIVE.session.localGameStart;
      function isWrappedGameStartMethod(method) {
        return isCallable(method) && readNativeReflectProperty(method, "__qolboxWrapped") === true;
      }
      function markWrappedGameStartMethod(method, originalMethod) {
        setNativeReflectProperty(method, "__qolboxWrapped", true);
        setNativeReflectProperty(method, "__qolboxOriginal", originalMethod);
      }
      function areGameStartSessionHooksInstalled(session) {
        return [...REMOTE_START_METHODS, LOCAL_START_METHOD].every((methodName) => {
          const method = readNativeProperty(session, methodName);
          return !isCallable(method) || isWrappedGameStartMethod(method);
        });
      }
      function installGameStartSessionHooks(session, callbacks) {
        if (!isNativeObject(session)) {
          return false;
        }
        let hookInstalled = false;
        for (const methodName of REMOTE_START_METHODS) {
          const originalMethod = readNativeProperty(session, methodName);
          if (!isCallable(originalMethod)) {
            continue;
          }
          if (isWrappedGameStartMethod(originalMethod)) {
            hookInstalled = true;
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
          hookInstalled = replaceNativeReflectProperty(session, methodName, wrappedMethod) || hookInstalled;
        }
        const originalStartRequest = readNativeProperty(session, LOCAL_START_METHOD);
        if (isCallable(originalStartRequest) && !isWrappedGameStartMethod(originalStartRequest)) {
          const wrappedStartRequest = function wrappedLocalGameStartRequest(...args) {
            callbacks.noteLocalStartRequest(this);
            return Reflect.apply(originalStartRequest, this, args);
          };
          markWrappedGameStartMethod(wrappedStartRequest, originalStartRequest);
          hookInstalled = replaceNativeReflectProperty(session, LOCAL_START_METHOD, wrappedStartRequest) || hookInstalled;
        }
        return hookInstalled;
      }

      // src/features/game-start-display.ts
      var HITBOX_ORIGIN_PATTERN2 = /^https:\/\/(www\.)?hitbox\.io$/i;
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
            const targetOrigin = new URL(document.referrer).origin;
            if (!HITBOX_ORIGIN_PATTERN2.test(targetOrigin)) {
              return;
            }
            window.top?.postMessage(
              {
                ...payload,
                feature: "gameStartIndicator",
                source: "QOLBox"
              },
              targetOrigin
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
          initializeFocusState();
          if (hooksInstalled) {
            return;
          }
          hooksInstalled = true;
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

      // src/features/game-start-indicator.ts
      function getTitlePrefix(reason) {
        return reason === "pulled" ? GAME_PULLED_TITLE_PREFIX : GAME_START_TITLE_PREFIX;
      }
      function createGameStartIndicatorController(options) {
        const display = createGameStartDisplayController();
        let localTransitionSession = null;
        let localTransitionUntil = 0;
        let sessionHookTarget = null;
        let indicatorActive = false;
        const timers = { endWatch: 0, flash: 0, indicator: 0, watch: 0 };
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
        function clearTimer(timer) {
          if (timers[timer]) {
            window.clearTimeout(timers[timer]);
            timers[timer] = 0;
          }
        }
        function setTimer(timer, callback, delayMs) {
          timers[timer] = window.setTimeout(() => {
            timers[timer] = 0;
            callback();
          }, delayMs);
        }
        function flashIndicator() {
          if (!indicatorActive) {
            return;
          }
          flashOn = !flashOn;
          display.setTitle(`${getTitlePrefix(indicatorReason)}${originalTitle}`);
          display.setFavicon(flashOn);
          setTimer("flash", flashIndicator, options.getFlashIntervalMs());
        }
        function scheduleEndWatch() {
          if (!indicatorActive || timers.endWatch) {
            return;
          }
          setTimer("endWatch", () => {
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
          clearTimer("flash");
          flashIndicator();
          scheduleEndWatch();
        }
        function clearIndicator() {
          clearTimer("indicator");
          clearTimer("endWatch");
          clearTimer("flash");
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
          if (!options.isEnabled() || !session) {
            return;
          }
          localTransitionSession = session;
          localTransitionUntil = Date.now() + options.localTransitionTimeoutMs;
          clearTimer("indicator");
        }
        function hasPendingLocalPlayTransition(session = options.getSession()) {
          if (!localTransitionSession || Date.now() > localTransitionUntil) {
            clearLocalPlayTransition();
            return false;
          }
          return localTransitionSession === session;
        }
        function consumePendingLocalPlayTransition(session = options.getSession()) {
          if (!hasPendingLocalPlayTransition(session)) {
            return false;
          }
          clearLocalPlayTransition();
          return true;
        }
        function clearLocalPlayTransition() {
          localTransitionSession = null;
          localTransitionUntil = 0;
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
          if (!options.isEnabled() || timers.indicator || isIndicatorPageFocused()) {
            return;
          }
          clearTimer("watch");
          indicatorReason = reason;
          setTimer("indicator", () => {
            if (!isIndicatorPageFocused() && !wasPlayingWhenUnfocused && !hasPendingLocalPlayTransition() && options.isPlayingMatch() && !options.isPlayableLobby()) {
              showIndicator(indicatorReason);
            }
          }, options.getIndicatorDelayMs());
        }
        function scheduleWatch() {
          if (!options.isEnabled() || timers.watch || isIndicatorPageFocused() || indicatorActive) {
            return;
          }
          setTimer("watch", () => {
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
            clearTimer("watch");
            clearTimer("indicator");
            return;
          }
          if (startedPlaying && wasPlayableLobby && !isIndicatorPageFocused()) {
            clearTimer("watch");
            clearTimer("indicator");
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
            clearTimer("indicator");
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
            clearTimer("watch");
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
              clearTimer("watch");
              clearTimer("indicator");
              return;
            }
            scheduleIndicator(getPolledReason());
            return;
          }
          if (!playingMatch) {
            wasPlayingWhenUnfocused = false;
            wasInLobbyWhenUnfocused = false;
            clearSessionEntryGrace();
            clearTimer("watch");
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
          clearTimer("watch");
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
          clearLocalPlayTransition();
          clearTimer("watch");
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
      var JUKEBOX_TITLE_CLASS = "qolboxInGameJukeboxTitle";
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
      function decorateJukeboxMessage(node) {
        if (!(node instanceof HTMLElement) || node.querySelector(`.${JUKEBOX_TITLE_CLASS}`)) return;
        const message = node.querySelector(":scope > .message:not(.link)");
        if (!message || !node.querySelector(":scope > .message.link")) return;
        const text = message.textContent || "";
        const titleStart = text.indexOf(" suggests ");
        if (titleStart < 0) return;
        const split = titleStart + " suggests ".length;
        const title = text.slice(split);
        if (!title) return;
        message.textContent = text.slice(0, split);
        const titleElement = document.createElement("span");
        titleElement.className = JUKEBOX_TITLE_CLASS;
        titleElement.textContent = title;
        message.append(titleElement);
      }
      function decorateJukeboxMessages(nodes) {
        nodes.forEach(decorateJukeboxMessage);
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
        const newNodes = messages.nodes.slice(overlap);
        const newSignatures = signatures.slice(overlap);
        state.historyHtml.push(...newHtml);
        state.historyNodes.push(...newNodes);
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
        decorateJukeboxMessages(Array.from(content.children));
        rememberMessageRecords(getContentMessages(content), state);
      }
      function rememberAddedChatNodes(nodes, state) {
        decorateJukeboxMessages(nodes);
        const retainedNodes = nodes.filter((node) => !isRestoredChatMessageNode(node, state) && (node.textContent || "").trim());
        const html = retainedNodes.map(getMessageHtml);
        if (rememberMessageRecords({ html, nodes: retainedNodes }, state)) {
          state.historyVisibleUntil = performance.now() + RESTORED_HISTORY_DISPLAY_MS;
        }
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
          }
        }
        state.restoring = false;
        state.restoredDomActive = true;
      }
      function clearRestoredChatDom(content, state, force = false) {
        if (!force && !state.historyInteractionActive) {
          return;
        }
        if (state.restoredDomActive) {
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
            const content = getChatContent(chat);
            const currentState = chatStates.get(chat);
            if (content && currentState) {
              for (const record of records) {
                if (record.type === "childList" && record.target === content && record.addedNodes.length) {
                  rememberAddedChatNodes(Array.from(record.addedNodes), currentState);
                }
              }
            }
            scheduleChatSync(chat);
          });
          chatObserver.observe(chat, {
            attributes: true,
            attributeFilter: ["class", "style"],
            childList: true,
            subtree: true
          });
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
          for (const chat of Array.from(patchedChats)) {
            if (!chat.isConnected) {
              unpatchChatScroll(chat);
            }
          }
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
        return Boolean(readNativeProperty(game, HITBOX_NATIVE.mobile.mobileFlag) || readNativeProperty(game, HITBOX_NATIVE.mobile.controls));
      }
      function isNativeTouchLobbyChatPrompt() {
        return Boolean(readNativeProperty(window.a8, HITBOX_NATIVE.mobile.mobileFlag));
      }
      function getNativeMobileControls() {
        return readNativeProperty(window.a8, HITBOX_NATIVE.mobile.controls) ?? null;
      }
      function getControlSlot(controls, key) {
        return readNativeProperty(controls, key);
      }
      function getControlInputState(control) {
        const inputState = readNativeProperty(control, HITBOX_NATIVE.mobile.inputState);
        return isNativeObject(inputState) ? inputState : null;
      }
      function getNativeMobileControlInputState(controls = getNativeMobileControls()) {
        for (const key of [...HITBOX_NATIVE.mobile.slots, "nz"]) {
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
        for (const key of HITBOX_NATIVE.mobile.slots) {
          const element = readNativeProperty(getControlSlot(controls, key), HITBOX_NATIVE.mobile.view);
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
        return setNativeReflectProperty(inputState, HITBOX_NATIVE.mobile.pressGrab, pressed);
      }
      function installNativeMobileControlHooks(hooks) {
        const controls = getNativeMobileControls();
        if (!isNativeObject(controls)) {
          return false;
        }
        let hookInstalled = false;
        function installHook(methodName, createWrapper) {
          const method = readNativeProperty(controls, methodName);
          if (typeof method !== "function") {
            return;
          }
          if (readNativeReflectProperty(method, "__qolboxMobileGrabWrapped") === true) {
            hookInstalled = true;
            return;
          }
          const wrapper = createWrapper(method);
          setNativeReflectProperty(wrapper, "__qolboxMobileGrabWrapped", true);
          hookInstalled = replaceNativeReflectProperty(controls, methodName, wrapper) || hookInstalled;
        }
        installHook(
          HITBOX_NATIVE.mobile.setInputState,
          (originalSetInputState) => function wrappedMobileControlInputState(inputState, ...rest) {
            hooks.onInputStateObserved(inputState);
            const result = Reflect.apply(originalSetInputState, this, [inputState, ...rest]);
            hooks.afterInputStateSet(inputState);
            hooks.onControlsShown();
            return result;
          }
        );
        installHook(
          HITBOX_NATIVE.mobile.show,
          (originalShowControls) => function wrappedMobileControlsShow(...args) {
            const result = Reflect.apply(originalShowControls, this, args);
            hooks.onControlsShown();
            return result;
          }
        );
        installHook(
          HITBOX_NATIVE.mobile.hide,
          (originalHideControls) => function wrappedMobileControlsHide(...args) {
            const result = Reflect.apply(originalHideControls, this, args);
            hooks.onControlsHidden();
            return result;
          }
        );
        return hookInstalled;
      }

      // src/features/gameplay-background-focus-events.ts
      function readStringProperty2(source, property) {
        const value = readObjectProperty(source, property);
        return typeof value === "string" ? value : "";
      }
      function readNumberProperty2(source, property) {
        const value = readObjectProperty(source, property);
        return typeof value === "number" ? value : Number(value);
      }
      function readGameplayFocusBooleanProperty(source, property) {
        return readObjectProperty(source, property) === true;
      }
      function canPreventGameplayDefault(event) {
        return typeof event === "object" && event !== null && typeof readObjectProperty(event, "preventDefault") === "function";
      }
      function canDispatchEvents(element) {
        return element instanceof Element && typeof readObjectProperty(element, "dispatchEvent") === "function";
      }
      function canBlurGameplayFocusTarget(element) {
        return typeof element === "object" && element !== null && typeof readObjectProperty(element, "blur") === "function";
      }
      function hasTabIndexApi(element) {
        return element instanceof Element && typeof readObjectProperty(element, "hasAttribute") === "function" && typeof readObjectProperty(element, "tabIndex") === "number";
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
        const button = readObjectProperty(event, "button");
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
            isPrimary: readObjectProperty(event, "isPrimary") !== false
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
          const target = readObjectProperty(event, "target");
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

      // src/hitbox/chat-send-adapter.ts
      function getAccurateNativeHelpText(text) {
        return text === "/settings -- view all gameplay commands" ? "/settings -- view normal gameplay settings" : text;
      }
      function callNativeChatSend(nativeSendChat, session, message, rest) {
        return Reflect.apply(nativeSendChat, session, [message, ...rest]);
      }
      function callNativeChatSendWithSettingsHelpCorrection(nativeSendChat, session, message, rest) {
        const nativeShowStatus = readNativeProperty(session, HITBOX_NATIVE.session.showStatus);
        if (!isNativeObject(session) || !isCallable(nativeShowStatus)) {
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
        const nativeSendChat = readNativeProperty(session, HITBOX_NATIVE.session.chatSend);
        if (!isCallable(nativeSendChat) || readNativeProperty(session, "__qolboxSlashCommandsPatched")) {
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
        if (!replaceNativeReflectProperty(session, HITBOX_NATIVE.session.chatSend, wrappedSendChat)) {
          return false;
        }
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
        function focusActiveRenderCanvas() {
          const canvas = options.getActiveRenderCanvas();
          if (!canvas) {
            return;
          }
          if (isTabbableElement(canvas) && !canvas.hasAttribute("tabindex")) {
            canvas.tabIndex = -1;
          }
          focusElementWithoutScroll(canvas);
        }
        function resetBrowserScroll() {
          try {
            window.scrollTo(0, 0);
          } catch {
          }
          document.documentElement.scrollTop = 0;
          document.body.scrollTop = 0;
        }
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
          const uniqueMatch = uniqueMatches[0];
          if (uniqueMatches.length === 1 && uniqueMatch) {
            return { status: "found", match: uniqueMatch, matches: uniqueMatches };
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
        return { type: "player", value: quotedMatch?.[2] ?? value };
      }

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

      // src/hitbox/team-state.ts
      var TEAM_STATE_SPECTATE = 0;
      var TEAM_STATE_FFA = 1;
      var TEAM_STATE_RED = 2;
      var TEAM_STATE_BLUE = 3;

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
      function getQolboxCommandReferenceLines() {
        return [
          "QOLBox commands:",
          "/help -- show Hitbox and QOLBox command help",
          "/spec [target] -- move yourself, one player, or active players to spectators",
          "/join [target] -- move yourself, one player, or spectators into play in non-team modes",
          "/red | /blue [target] -- move yourself or matching players to a team",
          "/switch -- swap red and blue teams",
          "/lock | /unlock -- lock or unlock team switching",
          "/host | /kick | /ban playername -- give host to, kick, or ban a player",
          "/blacklist [action or name] -- view or manage exact-name automatic host bans",
          "/start | /end | /restart -- control the current game as host",
          "/r -- same as /restart when Command aliases is enabled",
          "/record | /rec -- record the current replay; /rec requires Command aliases",
          "/settings [all] -- view normal settings, or include hidden settings with all",
          "Targets accept exact or unique partial player names. Depending on the command, all, playing, and spectators select groups. Blacklist actions are remove, clear, on, and off. Quote a reserved word to use it as a player name."
        ];
      }
      function writeQolboxCommandHelp(session) {
        for (const line of getQolboxCommandHelpLines()) {
          writeChatLine(session, line);
        }
      }

      // src/features/lobby-command-actions.ts
      function createLobbyCommandActions(dependencies) {
        const teamActions = createLobbyCommandTeamActions({
          isCurrentPlayerSpectating: dependencies.isCurrentPlayerSpectating,
          isTeamMode: dependencies.isTeamMode,
          noteLocallyInitiatedPlayTransition: dependencies.noteLocallyInitiatedPlayTransition,
          showStatus: dependencies.showStatus
        });
        function resolveNamedCommandPlayer(argument, session = getMultiplayerSession()) {
          const result = findPlayerByName(argument, session);
          if (result.status === "missing") {
            dependencies.showStatus(`Couldn't find player '${argument}'.`);
            return null;
          }
          if (result.status === "ambiguous") {
            const matches = result.matches.map(({ player }) => dependencies.getPlayerDisplayName(player) || "Unnamed Player").slice(0, 4).join(", ");
            dependencies.showStatus(`Player name '${argument}' is ambiguous${matches ? `: ${matches}` : ""}.`);
            return null;
          }
          return result.match;
        }
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
          const target = resolveNamedCommandPlayer(argument, session);
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
            return teamActions.requestBulkTeamState(TEAM_STATE_FFA, { targetGroup: targetArgument.group });
          }
          const target = argument ? resolveNamedCommandPlayer(targetArgument.value, session) : { id: getLocalPlayerId(session), player: null };
          if (!target) {
            return false;
          }
          const player = getSessionPlayerById(session, target.id);
          if (player && getPlayerTeamState(player) === TEAM_STATE_FFA) {
            dependencies.showStatus(`${formatCommandPlayerName(player)} is already playing.`);
            return true;
          }
          return teamActions.requestTeamState(target.id, TEAM_STATE_FFA);
        }
        function handleSpecSlashCommand(argument) {
          const session = getMultiplayerSession();
          const targetArgument = parseCommandTarget(argument);
          if (targetArgument.type === "group") {
            return teamActions.requestBulkTeamState(TEAM_STATE_SPECTATE, { targetGroup: targetArgument.group });
          }
          const target = argument ? resolveNamedCommandPlayer(targetArgument.value, session) : { id: getLocalPlayerId(session), player: null };
          return target ? teamActions.requestTeamState(target.id, TEAM_STATE_SPECTATE) : false;
        }
        function handleTeamSlashCommand(commandName, argument) {
          const session = getMultiplayerSession();
          const targetTeam = commandName === "/blue" ? TEAM_STATE_BLUE : TEAM_STATE_RED;
          if (!argument) {
            return teamActions.requestTeamState(getLocalPlayerId(session), targetTeam, { requireTeamMode: true });
          }
          const targetArgument = parseCommandTarget(argument);
          if (targetArgument.type === "group") {
            return teamActions.requestBulkTeamState(targetTeam, { requireTeamMode: true, targetGroup: targetArgument.group });
          }
          if (!dependencies.isTeamMode(session)) {
            dependencies.showStatus(`${getTeamStateName(targetTeam)} is only available in team modes.`);
            return false;
          }
          const target = resolveNamedCommandPlayer(targetArgument.value, session);
          return target ? teamActions.requestTeamState(target.id, targetTeam, { requireTeamMode: true }) : false;
        }
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
        return {
          findPlayerByName,
          handleHostSlashCommand,
          handleJoinSlashCommand,
          handleSpecSlashCommand,
          handleTeamSlashCommand,
          normalizePlayerName,
          requestBulkTeamState: teamActions.requestBulkTeamState,
          requestTeamState: teamActions.requestTeamState,
          setTeamsLocked: teamActions.setTeamsLocked,
          showAllHostSettings,
          showQolboxCommandHelp,
          isSwitchingTeams: teamActions.isSwitchingTeams,
          switchTeamPlayers: teamActions.switchTeamPlayers
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
          const matchedCommandName = match[1];
          if (!matchedCommandName) {
            return false;
          }
          const commandName = `/${matchedCommandName.toLowerCase()}`;
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
        const nativePlayerJoined = readNativeProperty(session, HITBOX_NATIVE.session.playerJoined);
        if (typeof nativePlayerJoined !== "function") {
          return false;
        }
        const wrappedPlayerJoined = function wrappedQolboxPlayerJoined(...args) {
          const result = Reflect.apply(nativePlayerJoined, this, args);
          window.setTimeout(() => onPlayerJoined(this), 0);
          return result;
        };
        if (!replaceNativeReflectProperty(session, HITBOX_NATIVE.session.playerJoined, wrappedPlayerJoined)) {
          return false;
        }
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
          return sanitizeBlacklistNames(JSON.parse(getLocalStorageItem(BLACKLIST_STORAGE_KEY) || "[]"));
        } catch {
          return [];
        }
      }
      function saveBlacklistNames(names) {
        const sanitizedNames = sanitizeBlacklistNames(names);
        setLocalStorageItem(BLACKLIST_STORAGE_KEY, JSON.stringify(sanitizedNames));
        return sanitizedNames;
      }

      // src/features/lobby-blacklist.ts
      var BLACKLIST_CHAT_FILTER_FLAG = "__qolboxBlacklistChatFilterInstalled";
      function parseQuotedName(value) {
        const trimmed = value.trim();
        const match = trimmed.match(/^(["'])(.*)\1$/);
        return {
          quoted: Boolean(match),
          value: (match?.[2] ?? trimmed).replace(/\s+/g, " ").trim()
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
        return match?.[1]?.trim() || null;
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
          if (!replaceNativeReflectProperty(session, "vG", wrappedBlacklistChatLineFilter)) {
            return;
          }
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
              options.showStatus(`Automatically banned blacklisted player ${playerName || "Player"}.`, session);
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
          const commandName = trimmed.match(/^(clear|on|off)$/i)?.[1]?.toLowerCase();
          if (commandName === "clear") {
            return clearBlacklist();
          }
          if (commandName === "on") {
            return setBlacklistEnforcement(true);
          }
          if (commandName === "off") {
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
          const background = menu.querySelector(".background");
          if (background) {
            background.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
          } else {
            menu.remove();
          }
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
        function showQolboxChatStatus(message, session = getMultiplayerSession()) {
          writeChatLine(session, `* ${message}`);
        }
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
          const [, leadingSpace = "", commandName, rawTarget] = match;
          if (!commandName || !rawTarget) {
            return message;
          }
          const quotedTarget = rawTarget.match(/^(["'])(.*)\1$/);
          const targetName = quotedTarget?.[2] ?? rawTarget;
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

      // src/features/lobby-information.ts
      var ACCOUNT_RESPONSE_PATH = /\/scripts\/(?:login_auto_spice|login_register_multi)\.php(?:[?#]|$)/i;
      var ROOM_LIST_ITEM_SELECTOR = '.item[data-qolbox-room-list-menu="true"]';
      var PLAYER_INFO_ACTION_SELECTOR = '.item[data-qolbox-player-info-action="true"]';
      function parseFiniteNumber(value) {
        const number = Number(value);
        return Number.isFinite(number) ? number : null;
      }
      function isVisible(element) {
        if (!(element instanceof HTMLElement)) {
          return false;
        }
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.display !== "none" && style.visibility !== "hidden";
      }
      function getPlayerForRow(row) {
        const rows = Array.from(document.querySelectorAll(".lobbyContainer .playerElement"));
        const entries = getSessionPlayers();
        const rowName = row.querySelector(".name")?.textContent?.trim() || "";
        const sameIndex = entries[rows.indexOf(row)];
        if (sameIndex && String(readNativeProperty(sameIndex.player, "name") || "") === rowName) {
          return sameIndex;
        }
        const matchingRows = rows.filter((candidate) => candidate.querySelector(".name")?.textContent?.trim() === rowName);
        const matchingPlayers = entries.filter(
          (entry) => String(readNativeProperty(entry.player, "name") || "") === rowName
        );
        return matchingPlayers[matchingRows.indexOf(row)] || null;
      }
      function getLevelXpBounds(level) {
        if (!Number.isInteger(level) || level < 1) {
          return null;
        }
        const start = 100 * (level - 1) ** 2;
        const end = 100 * level ** 2;
        return { end, required: end - start, start };
      }
      function getPlayerInformation(playerId, player, knownAccountXp) {
        const session = getMultiplayerSession();
        const accountId = parseFiniteNumber(readNativeProperty(player, "VR"));
        const level = Math.max(0, Math.trunc(parseFiniteNumber(readNativeProperty(player, "level")) ?? 0));
        const local = isSamePlayerId(playerId, getLocalPlayerId(session));
        return {
          accountId: accountId !== null && accountId >= 0 ? accountId : null,
          exactXp: local && accountId !== null && knownAccountXp?.accountId === accountId ? knownAccountXp.xp : null,
          level,
          name: String(readNativeProperty(player, "name") || "Unnamed Player")
        };
      }
      function appendTextElement(parent, className, text) {
        const element = document.createElement("div");
        element.className = className;
        element.textContent = text;
        parent.append(element);
        return element;
      }
      function appendDetailRow(parent, label, value) {
        const row = appendTextElement(parent, "qolboxPlayerInfoRow", "");
        appendTextElement(row, "qolboxPlayerInfoLabel", label);
        appendTextElement(row, "qolboxPlayerInfoValue", value);
      }
      function closeNativePlayerMenu(menu) {
        const background = menu.querySelector(".background");
        if (background) {
          background.dispatchEvent(new MouseEvent("mouseup", { bubbles: true }));
        } else {
          menu.remove();
        }
      }
      function renderProgress(parent, info) {
        const group = appendTextElement(parent, "xpGroup", "");
        const bounds = getLevelXpBounds(info.level);
        const progressLabel = appendTextElement(group, "xpGained", "");
        const bar = appendTextElement(group, "barContainer", "");
        const inner = appendTextElement(bar, "barInner", "");
        const currentLevel = appendTextElement(group, "lvNow", `Lv${info.level}`);
        const nextLevel = appendTextElement(group, "lvNext", bounds ? `Lv${info.level + 1}` : "");
        const progress = appendTextElement(group, "xpSlash", "");
        if (!bounds) {
          progressLabel.textContent = `Level ${info.level}`;
          progress.textContent = "";
          nextLevel.textContent = "";
          bar.style.display = "none";
          inner.style.width = "0%";
          return;
        }
        if (info.exactXp === null) {
          progressLabel.textContent = `${bounds.start.toLocaleString()}–${(bounds.end - 1).toLocaleString()} total XP`;
          progress.textContent = "";
          bar.classList.add("qolboxPlayerInfoUnknownProgress");
          inner.style.width = "0%";
          return;
        }
        const earned = Math.max(0, Math.min(bounds.required, info.exactXp - bounds.start));
        progressLabel.textContent = `${info.exactXp.toLocaleString()} total XP`;
        progress.textContent = `${earned.toLocaleString()}/${bounds.required.toLocaleString()}`;
        inner.style.width = `${100 * earned / bounds.required}%`;
        currentLevel.textContent = `Lv${info.level}`;
      }
      function showPlayerInformation(info) {
        document.querySelector(".qolboxPlayerInfoOverlay")?.remove();
        const overlay = appendTextElement(document.querySelector("#appContainer") || document.body, "mouseBlockContainer qolboxPlayerInfoOverlay", "");
        appendTextElement(overlay, "behindBlocker", "");
        const panel = appendTextElement(overlay, "postGameContainer qolboxPlayerInfo", "");
        const closeCross = appendTextElement(panel, "crossButton", "");
        appendTextElement(panel, "title", "PLAYER INFO");
        appendTextElement(panel, "position", info.name);
        renderProgress(panel, info);
        const details = appendTextElement(panel, "qolboxPlayerInfoDetails", "");
        if (info.accountId !== null) {
          appendDetailRow(details, "Account ID", String(info.accountId));
        }
        const closeButton = appendTextElement(panel, "closeButton", "CLOSE");
        const close = () => overlay.remove();
        closeCross.addEventListener("click", close);
        closeButton.addEventListener("click", close);
        closeButton.tabIndex = 0;
        closeButton.setAttribute("role", "button");
        closeButton.focus({ preventScroll: true });
      }
      function createLobbyInformationController() {
        let hooksInstalled = false;
        let hiddenLobby = null;
        let knownAccountXp = null;
        let roomListOpenedFromSession = false;
        let roomListMenuItem = null;
        let selectedPlayerRow = null;
        const patchedRoomJoinSessions = /* @__PURE__ */ new WeakSet();
        const patchedXpSessions = /* @__PURE__ */ new WeakSet();
        function restoreLobbyBehindRoomList() {
          if (!hiddenLobby) {
            return;
          }
          hiddenLobby.element.style.display = hiddenLobby.display;
          hiddenLobby = null;
        }
        function rememberAccountXp(xp, accountId) {
          const parsedXp = parseFiniteNumber(xp);
          const parsedAccountId = parseFiniteNumber(accountId);
          if (parsedXp !== null && parsedXp >= 0 && parsedAccountId !== null && parsedAccountId >= 0) {
            knownAccountXp = { accountId: parsedAccountId, xp: Math.trunc(parsedXp) };
          }
        }
        function observeAccountResponse(response) {
          if (!response.ok || !ACCOUNT_RESPONSE_PATH.test(response.url)) {
            return;
          }
          response.clone().json().then((data) => {
            if (data && typeof data === "object" && Reflect.get(data, "r") === "success") {
              rememberAccountXp(Reflect.get(data, "xp"), Reflect.get(data, "id"));
            }
          }).catch(() => void 0);
        }
        function installAccountXpFetchObserver() {
          if (typeof window.fetch !== "function") {
            return;
          }
          const nativeFetch = window.fetch;
          window.fetch = function(...args) {
            const request = Reflect.apply(nativeFetch, this, args);
            request.then(observeAccountResponse, () => void 0);
            return request;
          };
        }
        function patchLocalXpUpdates() {
          const session = getMultiplayerSession();
          if (!session || patchedXpSessions.has(session)) {
            return;
          }
          const updateXp = readNativeProperty(session, "dG");
          if (typeof updateXp !== "function") {
            return;
          }
          const wrappedUpdateXp = function(...args) {
            const result = Reflect.apply(updateXp, this, args);
            const localPlayer = getSessionPlayers(session).find((entry) => isSamePlayerId(entry.id, getLocalPlayerId(session)))?.player;
            rememberAccountXp(args[1], readNativeProperty(localPlayer, "VR"));
            return result;
          };
          if (replaceNativeReflectProperty(session, "dG", wrappedUpdateXp)) {
            patchedXpSessions.add(session);
          }
        }
        function patchRoomListJoining() {
          const session = getMultiplayerSession();
          if (!session || patchedRoomJoinSessions.has(session)) {
            return;
          }
          const joinRoom = readNativeProperty(session, "CG");
          if (typeof joinRoom !== "function") {
            return;
          }
          const wrappedJoinRoom = function(...args) {
            if (roomListOpenedFromSession) {
              roomListOpenedFromSession = false;
              restoreLobbyBehindRoomList();
              const leaveRoom = readNativeProperty(this, "xJ");
              if (typeof leaveRoom === "function") {
                Reflect.apply(leaveRoom, this, []);
              }
            }
            return Reflect.apply(joinRoom, this, args);
          };
          if (replaceNativeReflectProperty(session, "CG", wrappedJoinRoom)) {
            patchedRoomJoinSessions.add(session);
          }
        }
        function closeHamburgerMenu(container) {
          const button = container.closest(".cornerButton")?.querySelector(".square");
          if (button && isVisible(container)) {
            button.click();
          }
        }
        function openRoomList(container) {
          const customGameButton = document.querySelector(".bigButton.custom");
          if (!customGameButton) {
            return;
          }
          const lobby = document.querySelector(".lobbyContainer");
          if (isVisible(lobby)) {
            hiddenLobby = { display: lobby.style.display, element: lobby };
            lobby.style.display = "none";
          }
          roomListOpenedFromSession = true;
          customGameButton.click();
          const roomList = document.querySelector(".roomListContainer");
          if (!isVisible(roomList)) {
            roomListOpenedFromSession = false;
            restoreLobbyBehindRoomList();
          }
          closeHamburgerMenu(container);
        }
        function patchRoomListMenu() {
          const menus = Array.from(document.querySelectorAll(".cornerButton .items"));
          const hasActiveRoom = getSessionPlayers().length > 0;
          if (!menus.length || !hasActiveRoom) {
            document.querySelectorAll(ROOM_LIST_ITEM_SELECTOR).forEach((item) => item.remove());
            roomListMenuItem = null;
            if (!hasActiveRoom) {
              roomListOpenedFromSession = false;
              restoreLobbyBehindRoomList();
            }
            return;
          }
          const items = menus.map((menu) => {
            let item = menu.querySelector(ROOM_LIST_ITEM_SELECTOR);
            if (!item) {
              item = document.createElement("div");
              item.className = "item";
              item.dataset.qolboxRoomListMenu = "true";
              item.dataset.qolboxIcon = "list";
              item.textContent = "Room List";
              item.addEventListener("click", (event) => {
                event.preventDefault();
                event.stopImmediatePropagation();
                openRoomList(menu);
              }, true);
              const directItems = Array.from(menu.querySelectorAll(":scope > .item"));
              const volume = directItems.find((candidate) => /^Volume:\s*\d+%$/.test(candidate.textContent?.trim() || ""));
              const audio = menu.querySelector(":scope > .qolboxAudioMenuGroup");
              const controls = directItems.find((candidate) => candidate.textContent?.trim() === "Change Controls");
              menu.insertBefore(item, volume || audio || controls || null);
            }
            return item;
          });
          roomListMenuItem = items.find(isVisible) || items[items.length - 1] || null;
        }
        function patchPlayerPopup(row, openDirectly = false) {
          const entry = getPlayerForRow(row);
          const menus = Array.from(document.querySelectorAll(".rightClickMenu"));
          const menu = menus.reverse().find(isVisible);
          const container = menu?.querySelector(".container");
          if (!entry || readNativeProperty(entry.player, "GR")) {
            return;
          }
          if (!menu || !container) {
            if (!openDirectly) return;
            showPlayerInformation(getPlayerInformation(entry.id, entry.player, knownAccountXp));
            return;
          }
          if (container.querySelector(PLAYER_INFO_ACTION_SELECTOR)) {
            return;
          }
          const action = document.createElement("div");
          action.className = "item";
          action.dataset.qolboxPlayerInfoAction = "true";
          action.dataset.qolboxIcon = "user";
          action.textContent = "Player Info";
          action.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopImmediatePropagation();
            closeNativePlayerMenu(menu);
            showPlayerInformation(getPlayerInformation(entry.id, entry.player, knownAccountXp));
          }, true);
          container.insertBefore(action, container.firstChild);
        }
        function handleDocumentClick(event) {
          const target = event.target instanceof Element ? event.target : null;
          const roomListClose = target?.closest(".roomListContainer .crossButton");
          if (roomListOpenedFromSession && roomListClose) {
            event.preventDefault();
            event.stopImmediatePropagation();
            const roomList = roomListClose.closest(".roomListContainer");
            if (roomList) {
              roomList.style.display = "none";
            }
            roomListOpenedFromSession = false;
            restoreLobbyBehindRoomList();
            const menuButton = roomListMenuItem?.closest(".cornerButton")?.querySelector(".square");
            menuButton?.focus({ preventScroll: true });
            return;
          }
          const row = target?.closest(".lobbyContainer .playerElement");
          if (row) {
            selectedPlayerRow = row;
            window.requestAnimationFrame(() => patchPlayerPopup(row, true));
          } else if (!target?.closest(".rightClickMenu")) {
            selectedPlayerRow = null;
          }
        }
        function installLobbyInformationHooks() {
          if (hooksInstalled) {
            return;
          }
          hooksInstalled = true;
          installAccountXpFetchObserver();
          document.addEventListener("click", handleDocumentClick, true);
        }
        function patchLobbyInformation() {
          if (roomListOpenedFromSession && !isVisible(document.querySelector(".roomListContainer"))) {
            roomListOpenedFromSession = false;
            restoreLobbyBehindRoomList();
          }
          patchRoomListMenu();
          if (selectedPlayerRow?.isConnected) patchPlayerPopup(selectedPlayerRow);
          patchRoomListJoining();
          patchLocalXpUpdates();
        }
        return {
          getKnownAccountXp: () => knownAccountXp ? { ...knownAccountXp } : null,
          installLobbyInformationHooks,
          patchLobbyInformation
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
        button.tabIndex = 0;
        button.dataset.qolboxMobileGrab = "true";
        if (typeof window.PointerEvent === "function") {
          button.addEventListener("pointerdown", handlers.onPointerStart, true);
        } else {
          button.addEventListener("touchstart", handlers.onTouchStart, {
            passive: false,
            capture: true
          });
        }
        button.addEventListener("keydown", (event) => {
          if ((event.key === "Enter" || event.key === " ") && !event.repeat) {
            event.preventDefault();
            event.stopPropagation();
            handlers.onKeyboardChange(true);
          }
        });
        button.addEventListener("keyup", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            event.stopPropagation();
            handlers.onKeyboardChange(false);
          }
        });
        button.addEventListener("blur", () => handlers.onKeyboardChange(false));
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
          const current = rects[index];
          const previous = rects[index - 1];
          if (!current || !previous) {
            continue;
          }
          const currentGap = current.top - previous.bottom;
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
          activePointerId = null;
          options.setPressed(false);
        }
        function installMobileGrabReleaseHooks() {
          if (releaseHooksInstalled) {
            return;
          }
          releaseHooksInstalled = true;
          if (typeof window.PointerEvent === "function") {
            window.addEventListener("pointerup", handleMobileGrabPointerEnd, true);
            window.addEventListener("pointercancel", handleMobileGrabPointerEnd, true);
          } else {
            window.addEventListener("touchend", handleMobileGrabTouchEnd, true);
            window.addEventListener("touchcancel", handleMobileGrabTouchEnd, true);
          }
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
          setPressed: mobileGrabInput.setMobileGrabPressed,
          shouldShow: () => shouldShowMobileGrabButton()
        });
        function hideMobileGrabButton() {
          mobileGrabPress.resetMobileGrabPress();
          hideMobileGrabButtonElement(mobileGrabButton);
        }
        function removeMobileGrabButton() {
          hideMobileGrabButton();
          mobileGrabButton = removeMobileGrabButtonElement(mobileGrabButton);
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
            onKeyboardChange: mobileGrabInput.setMobileGrabPressed,
            onPointerStart: mobileGrabPress.handleMobileGrabPointerStart,
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
          return Boolean(dependencies.isEnabled() && isMobileGameModeContext() && areNativeMobileAbilityButtonsVisible());
        }
        function syncMobileGrabButton() {
          if (!dependencies.isEnabled() || !isMobileGameModeContext()) {
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
          handleMobileGrabPointerStart: mobileGrabPress.handleMobileGrabPointerStart,
          hideMobileGrabButton,
          isMobileGameMode: isMobileGameModeContext,
          isMobileQolboxMenuContext: isMobileQolboxMenuContextValue,
          layoutMobileGrabButton,
          patchMobileGrabButton,
          removeMobileGrabButton,
          setMobileGrabPressed: mobileGrabInput.setMobileGrabPressed,
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
          if (item.textContent?.trim() !== "QOLBox") item.textContent = "QOLBox";
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
      var NATIVE_DISMISS_ACTION_SELECTOR = ".returnButton, .crossButton, .closeButton, .cancelButton, .backButton";
      var NATIVE_POPUP_TAB_ACTION_SELECTOR = "input, select, textarea, button, [data-qolbox-keyboard-action]";
      var MAP_VOTE_ACTION_SELECTOR = ".lobbyContainer .voteSpan";
      var NATIVE_KEYBOARD_ACTION_SELECTOR = [
        ".bigButton",
        ".cornerButton .square",
        ".cornerButton .items .item",
        ".roomListContainer .scrollBox tr",
        ".bottomButton",
        ".createWindowContainer .unlistedCheckContainer .checkbox",
        ".lobbyContainer .ffaButton",
        ".lobbyContainer .specButton",
        ".lobbyContainer .settingsButton",
        ".lobbyContainer .teamLockButton",
        MAP_VOTE_ACTION_SELECTOR,
        "#editorContainer .topMenu .topLabel",
        "#editorContainer .topMenu .item",
        "#editorContainer .sideBar .button",
        ".mouseBlockContainer .button",
        ".mouseBlockContainer .item",
        ".mapListContainer .searchButton",
        ".mapListContainer .mapsContainer > .element",
        ".mapListContainer .dropdownContainer > .element:not(.disabled)",
        NATIVE_DISMISS_ACTION_SELECTOR
      ].join(", ");
      var KEYBOARD_ACTION_ATTRIBUTE = "data-qolbox-keyboard-action";
      var UNAVAILABLE_POINTER_ACTION_SELECTOR = ':disabled, [disabled], [aria-disabled="true"], .disabled, .unlockedClient, .lockedClient, .beenDeleted';
      function isRenderedElement(element) {
        if (!(element instanceof HTMLElement)) {
          return false;
        }
        const style = window.getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
      }
      function isVisibleElement(element) {
        return isRenderedElement(element) && Number(window.getComputedStyle(element).opacity || 1) !== 0;
      }
      function getVisibleNativePopup() {
        const popups = Array.from(document.querySelectorAll(NATIVE_POPUP_SELECTOR)).filter(isVisibleElement).filter((popup) => !popup.closest(".qolboxMenuOverlay"));
        return popups[popups.length - 1] || null;
      }
      function isDisabledAction(element) {
        return element.classList.contains("disabled") || element.hasAttribute("disabled") || element.getAttribute("aria-disabled") === "true" || window.getComputedStyle(element).pointerEvents === "none";
      }
      function blockUnavailablePointerAction(event) {
        const action = event.target instanceof Element ? event.target.closest(UNAVAILABLE_POINTER_ACTION_SELECTOR) : null;
        if (!action) return;
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
      }
      function findEnabledAction(popup, selectors, includeTransparent = false) {
        for (const selector of selectors) {
          const action = popup.querySelector(selector);
          const actionable = action && (includeTransparent ? isRenderedElement(action) : isVisibleElement(action));
          if (actionable && !isDisabledAction(action)) {
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
      function getKeyboardActions(root = document) {
        return Array.from(root.querySelectorAll(NATIVE_KEYBOARD_ACTION_SELECTOR)).filter((element) => element instanceof HTMLElement);
      }
      function patchKeyboardAction(element) {
        element.setAttribute(KEYBOARD_ACTION_ATTRIBUTE, "true");
        element.tabIndex = isDisabledAction(element) || element.matches(MAP_VOTE_ACTION_SELECTOR) && !element.textContent ? -1 : 0;
        if (!element.hasAttribute("role")) {
          element.setAttribute(
            "role",
            element.matches(".createWindowContainer .unlistedCheckContainer .checkbox") ? "checkbox" : element.matches(".roomListContainer .scrollBox tr, .mapListContainer .mapsContainer > .element") ? "option" : element.matches(".cornerButton .items .item, #editorContainer .topMenu .item, .mapListContainer .dropdownContainer > .element") ? "menuitem" : "button"
          );
        }
        if (element.matches(".cornerButton .square")) {
          element.setAttribute("aria-label", "Menu");
        } else if (element.matches(".crossButton, .closeButton")) {
          element.setAttribute("aria-label", "Close");
        } else if (element.matches("#editorContainer .topMenu .topLabel")) {
          element.setAttribute("aria-haspopup", "menu");
        } else if (element.matches(".lobbyContainer .teamLockButton")) {
          element.setAttribute("aria-label", "Toggle team lock");
        } else if (element.matches(MAP_VOTE_ACTION_SELECTOR)) {
          element.setAttribute("aria-label", element === element.parentElement?.querySelector(MAP_VOTE_ACTION_SELECTOR) ? "Like map" : "Dislike map");
        } else if (element.matches(".createWindowContainer .unlistedCheckContainer .checkbox")) {
          element.setAttribute("aria-label", "Unlisted room");
          element.setAttribute("aria-checked", String(element.classList.contains("checked")));
        }
        if (element.matches(".roomListContainer .scrollBox tr")) {
          element.setAttribute("aria-selected", String(element.classList.contains("SELECTED")));
        }
      }
      function patchNativeKeyboardNavigation(root = document) {
        if (root instanceof HTMLElement && root.matches(NATIVE_KEYBOARD_ACTION_SELECTOR)) {
          patchKeyboardAction(root);
        }
        getKeyboardActions(root).forEach(patchKeyboardAction);
      }
      function getVisibleKeyboardActions(selector, root = document) {
        return Array.from(root.querySelectorAll(selector)).filter(isVisibleElement).filter((element) => !isDisabledAction(element));
      }
      function containPopupTab(event, popup) {
        if (event.key !== "Tab") return false;
        const actions = getVisibleKeyboardActions(NATIVE_POPUP_TAB_ACTION_SELECTOR, popup);
        if (!actions.length) return false;
        const currentIndex = actions.indexOf(document.activeElement);
        if (currentIndex >= 0 && (event.shiftKey ? currentIndex > 0 : currentIndex < actions.length - 1)) {
          return false;
        }
        actions[event.shiftKey ? actions.length - 1 : 0]?.focus({ preventScroll: true });
        return true;
      }
      function clickNativeAction(action) {
        if (action.matches(MAP_VOTE_ACTION_SELECTOR)) {
          if (!action.textContent) return;
          const session = readObjectProperty(window, "multiplayerSession");
          const vote = readObjectProperty(session, "EJ");
          if (typeof vote === "function") {
            Reflect.apply(vote, session, [action === action.parentElement?.querySelector(MAP_VOTE_ACTION_SELECTOR)]);
          }
          return;
        }
        const target = action.matches(".roomListContainer .scrollBox tr") ? action.querySelector("td") : action;
        target?.click();
      }
      function activateNativeAction(action, joinSelectedRoom) {
        if (!(joinSelectedRoom && action.matches(".roomListContainer .scrollBox tr.SELECTED"))) {
          clickNativeAction(action);
        }
        if (!joinSelectedRoom || !action.matches(".roomListContainer .scrollBox tr")) return;
        const joinButton = action.closest(".roomListContainer")?.querySelector(".bottomButton.right");
        if (joinButton && !isDisabledAction(joinButton)) joinButton.click();
      }
      function getNavigationActions(activeElement) {
        if (activeElement.matches(".bigButton")) {
          return getVisibleKeyboardActions(`.bigButton[${KEYBOARD_ACTION_ATTRIBUTE}]`);
        }
        const group = activeElement.closest(
          ".cornerButton .items, .roomListContainer .scrollBox, .mapListContainer .mapsContainer, .mapListContainer .dropdownContainer, .lobbyContainer, #editorContainer .topMenu .container, #editorContainer .sideBar"
        );
        if (group) {
          return getVisibleKeyboardActions(`[${KEYBOARD_ACTION_ATTRIBUTE}]`, group);
        }
        const popup = activeElement.closest(NATIVE_POPUP_SELECTOR);
        return popup ? getVisibleKeyboardActions(`[${KEYBOARD_ACTION_ATTRIBUTE}]`, popup) : [];
      }
      function moveNativeFocus(event, direction) {
        const activeElement = document.activeElement;
        if (!(activeElement instanceof HTMLElement) || !activeElement.hasAttribute(KEYBOARD_ACTION_ATTRIBUTE)) {
          return false;
        }
        if (activeElement.getAttribute("role") === "slider") {
          return false;
        }
        if (activeElement.matches(".roomListContainer .scrollBox tr") && event.key !== "ArrowUp" && event.key !== "ArrowDown") {
          return false;
        }
        const actions = getNavigationActions(activeElement);
        const currentIndex = actions.indexOf(activeElement);
        if (currentIndex < 0 || actions.length < 2) {
          return false;
        }
        const nextAction = actions[(currentIndex + direction + actions.length) % actions.length];
        if (!nextAction) {
          return false;
        }
        nextAction.focus({ preventScroll: false });
        return true;
      }
      function getNavigationSelector(opener) {
        if (opener?.matches(".bigButton.qp")) return ".quickMenuContainer";
        if (opener?.matches(".bigButton.custom")) return ".roomListContainer";
        return "";
      }
      function finishMainMenuHideTransition() {
        const mainMenu = document.querySelector(".mainMenuFancy");
        const actions = mainMenu?.querySelector(".rightContainer");
        if (!mainMenu || !actions || window.getComputedStyle(mainMenu).display === "none") return;
        const anime = readObjectProperty(window, "anime");
        const remove = readObjectProperty(anime, "remove");
        if (typeof remove === "function") Reflect.apply(remove, anime, [actions]);
        actions.style.display = "none";
        actions.style.opacity = "1";
      }
      function dismissOpenNavigation(returnFocusTo) {
        const editorMenuContainer = getVisibleKeyboardActions("#editorContainer .topMenu .container")[0];
        const editorMenu = editorMenuContainer?.closest(".topLabel");
        if (editorMenu) {
          editorMenu.click();
          editorMenu.focus({ preventScroll: true });
          return true;
        }
        const hamburgerItems = getVisibleKeyboardActions(".cornerButton .items")[0];
        const hamburgerButton = hamburgerItems?.closest(".cornerButton")?.querySelector(".square");
        if (hamburgerButton) {
          hamburgerButton.click();
          hamburgerButton.focus({ preventScroll: true });
          return true;
        }
        const pendingNavigationSelector = getNavigationSelector(returnFocusTo);
        const pendingNavigation = pendingNavigationSelector ? document.querySelector(pendingNavigationSelector) : null;
        const navigation = pendingNavigation && window.getComputedStyle(pendingNavigation).display !== "none" ? pendingNavigation : getVisibleKeyboardActions(".roomListContainer, .quickMenuContainer").pop();
        const navigationDismiss = navigation?.querySelector(NATIVE_DISMISS_ACTION_SELECTOR);
        if (navigationDismiss && !isDisabledAction(navigationDismiss)) {
          finishMainMenuHideTransition();
          navigationDismiss.click();
          if (returnFocusTo?.isConnected) returnFocusTo.focus({ preventScroll: true });
          return true;
        }
        const dismissAction = getVisibleKeyboardActions(NATIVE_DISMISS_ACTION_SELECTOR).pop();
        if (!dismissAction) return Boolean(pendingNavigation);
        dismissAction.click();
        if (returnFocusTo?.isConnected) returnFocusTo.focus({ preventScroll: true });
        return true;
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
          ".returnButton",
          ".crossButton",
          ".cancelButton",
          ".backButton",
          ".oneButtonWindow .button",
          ".button"
        ], true);
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
      function createPopupKeyboardController(options) {
        let hooksInstalled = false;
        let keyboardActionObserver = null;
        let lastNavigationOpener = null;
        let lastPopupFocus = null;
        let escapePopupFocus = null;
        let lastRoomFocus = null;
        let lastRoomText = "";
        const suppressedKeyups = /* @__PURE__ */ new Set();
        function getSelectedRoom() {
          const selected = getVisibleKeyboardActions(".roomListContainer .scrollBox tr.SELECTED")[0];
          if (selected) return selected;
          if (lastRoomFocus?.isConnected && isVisibleElement(lastRoomFocus)) return lastRoomFocus;
          return getVisibleKeyboardActions(".roomListContainer .scrollBox tr").find((row) => row.textContent === lastRoomText) ?? null;
        }
        function handlePopupKeyboard(event) {
          suppressedKeyups.delete(event.key);
          if (event.defaultPrevented || event.repeat || event.isComposing || event.altKey || event.ctrlKey || event.metaKey || document.querySelector(".qolboxMenuOverlay, dialog[open]")) {
            return;
          }
          const popup = getVisibleNativePopup();
          if (popup && isNativeKeyBindingActive(popup)) {
            return;
          }
          let handled = false;
          if (popup && containPopupTab(event, popup)) {
            handled = true;
          } else if (isEscapeKey(event) && popup) {
            escapePopupFocus = lastPopupFocus?.popup === popup ? lastPopupFocus : null;
            lastPopupFocus = null;
            handled = dismissRightClickMenu(popup);
            const action = handled ? null : getEscapeAction(popup);
            if (action) {
              action.click();
              handled = true;
            }
          } else if (isEscapeKey(event)) {
            handled = dismissOpenNavigation(lastNavigationOpener);
          } else if ((isEnterKey(event) || event.key === " ") && !isMultilineEditor(event.target) && document.activeElement instanceof HTMLElement && document.activeElement.hasAttribute(KEYBOARD_ACTION_ATTRIBUTE) && !isDisabledAction(document.activeElement)) {
            const activeElement = document.activeElement;
            const navigationWasOpen = getVisibleKeyboardActions(NATIVE_DISMISS_ACTION_SELECTOR).length > 0;
            if (activeElement.matches(".bigButton.qp, .bigButton.custom, .cornerButton .square")) {
              lastNavigationOpener = activeElement;
            }
            activateNativeAction(activeElement, isEnterKey(event));
            if (!navigationWasOpen && getVisibleKeyboardActions(NATIVE_DISMISS_ACTION_SELECTOR).length > 0) {
              lastNavigationOpener = activeElement;
            }
            handled = true;
          } else if (isEnterKey(event) && document.activeElement === document.body) {
            const selectedRoom = getSelectedRoom();
            if (selectedRoom) {
              activateNativeAction(selectedRoom, true);
              handled = true;
            }
          } else if (popup && isEnterKey(event) && !isMultilineEditor(event.target)) {
            const action = getEnterAction(popup);
            if (action) {
              action.click();
              handled = true;
            }
          } else if (popup && (isArrowLeftKey(event) || isArrowRightKey(event))) {
            const action = getArrowAction(popup, isArrowLeftKey(event) ? "left" : "right");
            if (action) {
              action.click();
              handled = true;
            }
          } else if (/^Arrow(?:Up|Down|Left|Right)$/.test(event.key)) {
            handled = moveNativeFocus(event, event.key === "ArrowUp" || event.key === "ArrowLeft" ? -1 : 1);
          }
          if (!handled) {
            return;
          }
          if (isEnterKey(event) || event.key === " ") suppressedKeyups.add(event.key);
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
        }
        function handlePopupKeyboardKeyup(event) {
          if (isEscapeKey(event) && escapePopupFocus) {
            const { opener, popup } = escapePopupFocus;
            escapePopupFocus = null;
            window.requestAnimationFrame(() => {
              if (isVisibleElement(popup)) return;
              const focusTarget = opener.isConnected ? opener : opener.matches(".roomListContainer .scrollBox tr") ? getSelectedRoom() : null;
              focusTarget?.focus({ preventScroll: true });
            });
          } else if (isEscapeKey(event)) {
            window.requestAnimationFrame(() => {
              if (document.activeElement !== document.body) return;
              getSelectedRoom()?.focus({ preventScroll: true });
            });
          }
          if (!suppressedKeyups.delete(event.key)) return;
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
        }
        function installPopupKeyboardHooks() {
          if (hooksInstalled) {
            return;
          }
          hooksInstalled = true;
          window.addEventListener("pointerdown", blockUnavailablePointerAction, true);
          window.addEventListener("click", blockUnavailablePointerAction, true);
          window.addEventListener("keydown", handlePopupKeyboard, true);
          window.addEventListener("keyup", handlePopupKeyboardKeyup, true);
          window.addEventListener("click", (event) => {
            const opener = event.target instanceof Element ? event.target.closest(".bigButton.qp, .bigButton.custom, .cornerButton .square") : null;
            if (opener) {
              lastNavigationOpener = opener;
            }
            if (event.target instanceof Element && event.target.closest(
              ".quickMenuContainer .returnButton, .roomListContainer .crossButton"
            )) finishMainMenuHideTransition();
            const vote = event.target instanceof Element ? event.target.closest(MAP_VOTE_ACTION_SELECTOR) : null;
            if (!vote) return;
            event.preventDefault();
            event.stopPropagation();
            clickNativeAction(vote);
          }, true);
          window.addEventListener("focusin", (event) => {
            if (!(event.target instanceof HTMLElement)) return;
            const popup = event.target.closest(NATIVE_POPUP_SELECTOR);
            if (popup && event.relatedTarget instanceof HTMLElement && !popup.contains(event.relatedTarget)) {
              lastPopupFocus = { opener: event.relatedTarget, popup };
            }
            if (event.target.matches(".roomListContainer .scrollBox tr")) {
              lastRoomFocus = event.target;
              lastRoomText = event.target.textContent ?? "";
              if (!event.target.classList.contains("SELECTED")) clickNativeAction(event.target);
            }
          }, true);
          patchNativeKeyboardNavigation();
          options.decorateActions();
          keyboardActionObserver = new MutationObserver((records) => {
            const roots = /* @__PURE__ */ new Set();
            for (const record of records) {
              if (record.target instanceof HTMLElement) roots.add(record.target);
              else record.addedNodes.forEach((node) => {
                if (node instanceof HTMLElement) roots.add(node);
              });
            }
            for (const root of roots) {
              if ([...roots].some((candidate) => candidate !== root && candidate.contains(root))) continue;
              patchNativeKeyboardNavigation(root);
              options.decorateActions(root);
            }
          });
          keyboardActionObserver.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ["class"],
            childList: true,
            subtree: true
          });
        }
        return {
          handlePopupKeyboard,
          installPopupKeyboardHooks,
          patchNativeKeyboardNavigation
        };
      }

      // src/settings/onboarding-storage.ts
      var ONBOARDING_COMPLETE_KEY = "vm.hitbox.qolboxOnboardingComplete";
      function loadOnboardingComplete() {
        return getLocalStorageItem(ONBOARDING_COMPLETE_KEY) === "true";
      }
      function saveOnboardingComplete() {
        setLocalStorageItem(ONBOARDING_COMPLETE_KEY, "true");
      }

      // src/settings/update-notice-storage.ts
      var LAST_VERSION_KEY = "vm.hitbox.qolboxLastVersion";
      var ACK_VERSION_KEY = "vm.hitbox.qolboxAcknowledgedVersion";
      function loadPendingUpdateNotice(currentVersion = QOLBOX_VERSION, existingInstallWithoutVersion = false) {
        const previousVersion = getLocalStorageItem(LAST_VERSION_KEY);
        const acknowledgedVersion = getLocalStorageItem(ACK_VERSION_KEY);
        if (!previousVersion) {
          if (existingInstallWithoutVersion) {
            return { previousVersion: "a pre-version-tracking build", currentVersion };
          }
          setLocalStorageItem(LAST_VERSION_KEY, currentVersion);
          setLocalStorageItem(ACK_VERSION_KEY, currentVersion);
          return null;
        }
        if (previousVersion === currentVersion || acknowledgedVersion === currentVersion) {
          if (previousVersion !== currentVersion) {
            setLocalStorageItem(LAST_VERSION_KEY, currentVersion);
          }
          return null;
        }
        return { previousVersion, currentVersion };
      }
      function acknowledgeUpdateNotice(currentVersion = QOLBOX_VERSION) {
        setLocalStorageItem(LAST_VERSION_KEY, currentVersion);
        setLocalStorageItem(ACK_VERSION_KEY, currentVersion);
      }

      // src/features/qolbox-menu-view.ts
      var QOLBOX_MENU_SIZE_KEY = "vm.hitbox.qolboxMenuSize.v1";
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
      function restoreQolboxMenuSize(panel) {
        try {
          const saved = JSON.parse(getLocalStorageItem(QOLBOX_MENU_SIZE_KEY) || "null");
          if (!saved || typeof saved.width !== "number" || typeof saved.height !== "number") return;
          panel.style.width = `${Math.max(320, Math.round(saved.width))}px`;
          panel.style.height = `${Math.max(240, Math.round(saved.height))}px`;
        } catch {
        }
      }
      function installQolboxMenuResizePersistence(menu, panel) {
        menu.addEventListener("pointerdown", (event) => {
          const bounds = panel.getBoundingClientRect();
          if (bounds.right - event.clientX > 18 || bounds.bottom - event.clientY > 18) return;
          const initialWidth = bounds.width;
          const initialHeight = bounds.height;
          window.addEventListener("pointerup", () => {
            const resized = panel.getBoundingClientRect();
            if (Math.abs(resized.width - initialWidth) < 1 && Math.abs(resized.height - initialHeight) < 1) return;
            setLocalStorageItem(QOLBOX_MENU_SIZE_KEY, JSON.stringify({
              height: Math.round(resized.height),
              width: Math.round(resized.width)
            }));
          }, { once: true });
        }, true);
      }
      function renderQolboxMenuPanel(menuId, markup) {
        const panel = findQolboxMenuPanel(menuId);
        if (!panel) {
          return;
        }
        panel.innerHTML = `<div class="qolboxMenuPersistentHeader"><h1 class="qolboxMenuTitle">QOLBox Menu</h1></div>${markup}`;
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
        menu.setAttribute("aria-label", "QOLBox");
        menu.innerHTML = '<div class="qolboxMenuPanel"></div>';
        const panel = menu.querySelector(".qolboxMenuPanel");
        if (panel) {
          restoreQolboxMenuSize(panel);
          installQolboxMenuResizePersistence(menu, panel);
        }
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
      function isQolboxMenuShortcut(event, menuKey) {
        return !event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey && (event.key === menuKey || event.code === menuKey);
      }
      function createQolboxMenuController(options) {
        let onboardingComplete = options.initialOnboardingComplete;
        let onboardingStepIndex = 0;
        let settingsDraft = null;
        let settingsErrors = {};
        let focusBeforeOpen = null;
        let settingsPage = "features";
        let releaseNotesPageIndex = 0;
        let referenceTopic = "commands";
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
          if (mode === "update" || mode === "patch-notes") {
            const pageCount = mode === "update" ? options.getUpdateNoticePageCount() : options.getPatchNotesPageCount();
            releaseNotesPageIndex = Math.max(
              0,
              Math.min(releaseNotesPageIndex, Math.max(1, pageCount) - 1)
            );
          }
          const markup = mode === "settings" ? options.getSettingsMenuMarkup(settingsDraft, settingsPage, settingsErrors) : mode === "update" ? options.getUpdateNoticeMarkup(releaseNotesPageIndex) : mode === "patch-notes" ? options.getPatchNotesMarkup(releaseNotesPageIndex) : mode === "reference" ? options.getReferenceMarkup(referenceTopic) : options.getOnboardingStepMarkup(onboardingStepIndex);
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
          if (focusBeforeOpen?.isConnected) {
            focusElementWithoutScroll(focusBeforeOpen);
          }
          focusBeforeOpen = null;
        }
        function completeOnboarding() {
          onboardingComplete = true;
          closeQolboxMenu();
          options.onCompleteOnboarding();
        }
        function openQolboxMenu(nextMode = "settings") {
          if (mode === "closed") {
            focusBeforeOpen = document.activeElement instanceof HTMLElement ? document.activeElement : null;
          }
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
          } else if (nextMode === "update" || nextMode === "patch-notes") {
            releaseNotesPageIndex = 0;
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
          if (key === THEME_QOLBOX_ACCENT || key === THEME_GAME_ACCENT) {
            return "appearance";
          }
          if (key === ADVANCED_COMMAND_ALIASES || key === ADVANCED_BLACKLIST_ENFORCEMENT) {
            return "commands";
          }
          return "advanced";
        }
        function getDraftThemeValue(key) {
          const input = document.querySelector(`#${options.menuId} [data-qolbox-theme-input="${key}"]`);
          return input?.value ?? settingsDraft?.theme[key];
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
          const theme = { ...settingsDraft.theme };
          for (const key of [THEME_QOLBOX_ACCENT, THEME_GAME_ACCENT]) {
            const value = getDraftThemeValue(key);
            const normalized = normalizeThemeColor(value);
            if (!normalized) {
              errors[key] = "Use a six-digit hex color, such as #FF6200.";
            } else {
              theme[key] = normalized;
            }
          }
          if (theme.linked) theme.gameAccent = theme.qolboxAccent;
          settingsErrors = errors;
          const firstError = [THEME_QOLBOX_ACCENT, THEME_GAME_ACCENT].find((key) => errors[key]) || ADVANCED_SETTING_DEFINITIONS.find((definition) => errors[definition.key])?.key;
          if (firstError) {
            settingsPage = getErrorPage(firstError);
            return null;
          }
          return { advanced: sanitized, theme };
        }
        function restoreQolboxDefaultsDraft() {
          if (!settingsDraft) return;
          settingsDraft.features = getDefaultFeatureSettings();
          settingsDraft.advanced = getDefaultAdvancedSettings();
          settingsDraft.theme = getDefaultThemeSettings();
          settingsErrors = {};
          renderQolboxMenu();
        }
        function saveSettingsDraft() {
          const validated = validateSettingsDraft();
          if (!settingsDraft || !validated) {
            renderQolboxMenu();
            return;
          }
          const featureDraft = { ...settingsDraft.features };
          options.onCommitSettingsDraft(featureDraft, validated.advanced, validated.theme);
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
          if (action?.startsWith("sound-bank-")) {
            void options.onCustomAction(action, actionElement).then((handled) => {
              if (handled && mode === "settings") renderQolboxMenu();
            });
            return;
          }
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
            case "draft-theme-mode":
              if (settingsDraft && ["system", "dark", "light"].includes(actionElement.dataset.mode || "")) {
                settingsDraft.theme[THEME_MODE] = actionElement.dataset.mode;
                renderQolboxMenu();
              }
              break;
            case "settings-page":
              if (isSettingsPage(actionElement.dataset.page)) {
                settingsPage = actionElement.dataset.page;
                renderQolboxMenu();
              }
              break;
            case "link-theme-from-qolbox":
            case "link-theme-from-game":
              if (settingsDraft) {
                const source = action === "link-theme-from-game" ? THEME_GAME_ACCENT : THEME_QOLBOX_ACCENT;
                const target = source === THEME_GAME_ACCENT ? THEME_QOLBOX_ACCENT : THEME_GAME_ACCENT;
                settingsDraft.theme[target] = settingsDraft.theme[source];
                settingsDraft.theme.linked = true;
                renderQolboxMenu();
              }
              break;
            case "unlink-theme":
              if (settingsDraft) {
                settingsDraft.theme.linked = false;
                renderQolboxMenu();
              }
              break;
            case "restore-qolbox-defaults":
              restoreQolboxDefaultsDraft();
              break;
            case "view-patch-notes":
              options.onOpenPatchNotes();
              openQolboxMenu("patch-notes");
              break;
            case "view-reference":
              openQolboxMenu("reference");
              break;
            case "reference-topic":
              if (isQolboxReferenceTopic(actionElement.dataset.topic)) {
                referenceTopic = actionElement.dataset.topic;
                renderQolboxMenu();
              }
              break;
            case "back-to-settings":
              mode = "settings";
              options.onMenuModeChanged();
              renderQolboxMenu();
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
              releaseNotesPageIndex = Math.max(0, releaseNotesPageIndex - 1);
              renderQolboxMenu();
              break;
            case "update-older":
              releaseNotesPageIndex = Math.min(
                Math.max(1, mode === "update" ? options.getUpdateNoticePageCount() : options.getPatchNotesPageCount()) - 1,
                releaseNotesPageIndex + 1
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
          return value === "features" || value === "commands" || value === "audio" || value === "appearance" || value === "advanced" || value === "about";
        }
        function isQolboxReferenceTopic(value) {
          return value === "commands" || value === "controls" || value === "sound-banks";
        }
        function handleQolboxMenuInput(event) {
          if (mode !== "settings" || !settingsDraft || !(event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement)) {
            return;
          }
          const themeKey = event.target.dataset.qolboxThemeInput || event.target.dataset.qolboxThemePicker;
          if (themeKey === THEME_QOLBOX_ACCENT || themeKey === THEME_GAME_ACCENT) {
            const normalized = normalizeThemeColor(event.target.value);
            const value = normalized || event.target.value;
            settingsDraft.theme[themeKey] = value;
            if (settingsDraft.theme.linked) {
              const otherKey = themeKey === THEME_QOLBOX_ACCENT ? THEME_GAME_ACCENT : THEME_QOLBOX_ACCENT;
              settingsDraft.theme[otherKey] = value;
            }
            const affectedKeys = settingsDraft.theme.linked ? [THEME_QOLBOX_ACCENT, THEME_GAME_ACCENT] : [themeKey];
            for (const key of affectedKeys) {
              const text = document.querySelector(`#${options.menuId} [data-qolbox-theme-input="${key}"]`);
              const picker = document.querySelector(`#${options.menuId} [data-qolbox-theme-picker="${key}"]`);
              if (text) text.value = value;
              if (picker && picker !== event.target && normalized) picker.value = normalized;
              if (settingsErrors[key]) delete settingsErrors[key];
            }
            return;
          }
          if (event.target.matches("[data-qolbox-sound-bank], [data-qolbox-sound-effect], [data-qolbox-sound-file], [data-qolbox-sound-manifest]")) {
            if (event.type !== "change") return;
            void options.onCustomInput(event.target).then((handled) => {
              if (handled && mode === "settings") renderQolboxMenu();
            });
            return;
          }
          const advancedKey = event.target.dataset.qolboxAdvancedInput;
          if (advancedKey) updateDraftAdvancedValue(advancedKey, event.target.value);
        }
        function handleQolboxMenuKey(event) {
          if (mode !== "closed" && isEscapeKey(event)) {
            event.preventDefault();
            event.stopImmediatePropagation();
            if (mode === "onboarding") {
              completeOnboarding();
              return;
            }
            closeQolboxMenu();
            return;
          }
          if (mode !== "closed" && isTabKey(event)) {
            const menu = document.getElementById(options.menuId);
            const controls = menu ? Array.from(menu.querySelectorAll(
              'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
            )) : [];
            if (controls.length) {
              const activeElement = document.activeElement;
              const currentIndex = controls.indexOf(activeElement);
              const nextIndex = event.shiftKey ? currentIndex <= 0 ? controls.length - 1 : currentIndex - 1 : currentIndex < 0 || currentIndex >= controls.length - 1 ? 0 : currentIndex + 1;
              event.preventDefault();
              event.stopImmediatePropagation();
              focusElementWithoutScroll(controls[nextIndex]);
            }
            return;
          }
          if (mode === "settings" && (isArrowLeftKey(event) || isArrowRightKey(event))) {
            const activeElement = document.activeElement;
            const tabs = Array.from(document.querySelectorAll(`#${options.menuId} [role="tab"]`));
            const currentIndex = activeElement instanceof HTMLElement ? tabs.indexOf(activeElement) : -1;
            if (currentIndex >= 0 && tabs.length) {
              const direction = isArrowLeftKey(event) ? -1 : 1;
              const nextTab = tabs[(currentIndex + direction + tabs.length) % tabs.length];
              event.preventDefault();
              event.stopImmediatePropagation();
              focusElementWithoutScroll(nextTab);
              nextTab?.click();
            }
            return;
          }
          if (mode === "reference" && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
            const activeElement = document.activeElement;
            const topics = Array.from(document.querySelectorAll(`#${options.menuId} .qolboxReferenceTopic`));
            const index = topics.indexOf(activeElement);
            if (index >= 0 && topics.length) {
              const nextIndex = (index + (event.key === "ArrowUp" ? topics.length - 1 : 1)) % topics.length;
              const nextTopic = topics[nextIndex]?.dataset.topic;
              if (isQolboxReferenceTopic(nextTopic)) {
                event.preventDefault();
                event.stopImmediatePropagation();
                referenceTopic = nextTopic;
                renderQolboxMenu();
                focusElementWithoutScroll(document.querySelector(`#${options.menuId} .qolboxReferenceTopic.active`));
              }
            }
            return;
          }
          if ((mode === "update" || mode === "patch-notes") && (isArrowLeftKey(event) || isArrowRightKey(event))) {
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

      // src/features/sound-bank.ts
      var SOUND_BANK_STATE_KEY = "vm.hitbox.soundBanks.v1";
      var SOUND_BANK_DATABASE = "qolbox-sound-banks";
      var SOUND_BANK_STORE = "sounds";
      var VANILLA_BANK_ID = "vanilla";
      var MAX_SOUND_BYTES = 15 * 1024 * 1024;
      var MAX_SOUND_MANIFEST_BYTES = 1024 * 1024;
      var SOUND_EFFECTS = [
        { label: "Bat hit", source: "bathit1.wav" },
        { label: "Bat swing", source: "batswing1.wav" },
        { label: "Canopy open", source: "canopy_open.mp3" },
        { label: "Canopy open alternate", source: "canopy_open_2.mp3" },
        { label: "Interface click", source: "click_03.wav" },
        { label: "Editor click", source: "click_06.wav" },
        { label: "Landing plink", source: "click_loud_plink_2.wav" },
        { label: "Digital squeak", source: "digi_squeak.mp3" },
        { label: "Electric sound", source: "elecsound1.mp3" },
        { label: "Force push", source: "forcepush.mp3" },
        { label: "Force push end", source: "forcepush_end.mp3" },
        { label: "Enemy force push", source: "forcepush_enemy.mp3" },
        { label: "Force push failed", source: "forcepush_fail.mp3" },
        { label: "Enemy force push failed", source: "forcepush_fail_enemy.mp3" },
        { label: "Ground impact", source: "groundsound1.wav" },
        { label: "Ground sound 1", source: "gs6.mp3" },
        { label: "Ground sound 2", source: "gs12.mp3" },
        { label: "Jump", source: "pop_drip_mid_q_2.wav" },
        { label: "Double jump", source: "pop_drip_mid_q_2_l.wav" },
        { label: "Notification", source: "pop_note.wav" },
        { label: "Prop impact", source: "prop1.mp3" },
        { label: "Rocket explosion", source: "rkt_explode.mp3" },
        { label: "Rocket fire", source: "rkt_fire.mp3" },
        { label: "Rocket ready", source: "rkt_ready.mp3" },
        { label: "Splat 1", source: "splat2.mp3" },
        { label: "Splat 2", source: "splat3.mp3" },
        { label: "Soft hollow impact", source: "ssfx_hollow_large_soft_1.wav" },
        { label: "Winner notification", source: "winnernotification.mp3" }
      ];
      var SOUND_EFFECT_SOURCES = new Set(SOUND_EFFECTS.map((effect) => effect.source));
      function escapeHtml(value) {
        return value.replace(/[&<>"']/g, (character) => ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;"
        })[character] || character);
      }
      function loadState() {
        try {
          const parsed = JSON.parse(getLocalStorageItem(SOUND_BANK_STATE_KEY) || "null");
          const banks = Array.isArray(parsed?.banks) ? parsed.banks.filter((bank) => bank && typeof bank.id === "string" && typeof bank.name === "string").map((bank) => ({
            id: bank.id,
            name: bank.name,
            sounds: Object.fromEntries(Object.entries(bank.sounds && typeof bank.sounds === "object" ? bank.sounds : {}).filter(([effect, fileName]) => SOUND_EFFECT_SOURCES.has(effect) && typeof fileName === "string"))
          })) : [];
          const parsedActive = parsed?.active;
          const active = typeof parsedActive === "string" && (parsedActive === VANILLA_BANK_ID || banks.some((bank) => bank.id === parsedActive)) ? parsedActive : VANILLA_BANK_ID;
          return { active, banks };
        } catch {
          return { active: VANILLA_BANK_ID, banks: [] };
        }
      }
      function saveState(state) {
        setLocalStorageItem(SOUND_BANK_STATE_KEY, JSON.stringify(state));
      }
      function openSoundDatabase() {
        return new Promise((resolve, reject) => {
          const request = indexedDB.open(SOUND_BANK_DATABASE, 1);
          request.onupgradeneeded = () => request.result.createObjectStore(SOUND_BANK_STORE, { keyPath: ["bankId", "effect"] });
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error || new Error("Could not open the sound bank database."));
        });
      }
      async function readStoredSound(bankId, effect) {
        const database = await openSoundDatabase();
        return new Promise((resolve, reject) => {
          const request = database.transaction(SOUND_BANK_STORE).objectStore(SOUND_BANK_STORE).get([bankId, effect]);
          request.onsuccess = () => resolve(request.result || null);
          request.onerror = () => reject(request.error || new Error("Could not read the custom sound."));
        }).finally(() => database.close());
      }
      async function writeStoredSound(sound) {
        const database = await openSoundDatabase();
        return new Promise((resolve, reject) => {
          const transaction = database.transaction(SOUND_BANK_STORE, "readwrite");
          transaction.objectStore(SOUND_BANK_STORE).put(sound);
          transaction.oncomplete = () => resolve();
          transaction.onerror = () => reject(transaction.error || new Error("Could not save the custom sound."));
        }).finally(() => database.close());
      }
      async function deleteStoredSound(bankId, effect) {
        const database = await openSoundDatabase();
        return new Promise((resolve, reject) => {
          const transaction = database.transaction(SOUND_BANK_STORE, "readwrite");
          const store = transaction.objectStore(SOUND_BANK_STORE);
          if (effect) {
            store.delete([bankId, effect]);
          } else {
            const request = store.openCursor();
            request.onsuccess = () => {
              const cursor = request.result;
              if (!cursor) return;
              if (cursor.value.bankId === bankId) cursor.delete();
              cursor.continue();
            };
          }
          transaction.oncomplete = () => resolve();
          transaction.onerror = () => reject(transaction.error || new Error("Could not remove the custom sound."));
        }).finally(() => database.close());
      }
      function getHowlSource(howl) {
        const rawSource = readNativeReflectProperty(howl, "_src");
        const source = Array.isArray(rawSource) ? rawSource[0] : rawSource;
        if (typeof source !== "string") return null;
        const fileName = source.split(/[?#]/, 1)[0]?.split("/").pop()?.toLowerCase() || "";
        return SOUND_EFFECT_SOURCES.has(fileName) ? fileName : null;
      }
      function getRemoteSoundUrl(value) {
        try {
          const url = new URL(value);
          return url.protocol === "https:" ? url.href : null;
        } catch {
          return null;
        }
      }
      function getManifestEffect(hint, url) {
        const hintedSource = hint.trim().toLowerCase();
        if (SOUND_EFFECT_SOURCES.has(hintedSource)) return hintedSource;
        try {
          const source = decodeURIComponent(new URL(url).pathname.split("/").pop() || "").toLowerCase();
          return SOUND_EFFECT_SOURCES.has(source) ? source : null;
        } catch {
          return null;
        }
      }
      function parseSoundBankManifest(file, text) {
        const fallbackName = file.name.replace(/\.[^.]+$/, "").trim() || "Imported Bank";
        const sounds = /* @__PURE__ */ new Map();
        const addSound = (hint, value) => {
          const url = typeof value === "string" ? getRemoteSoundUrl(value.trim()) : null;
          const effect = url ? getManifestEffect(hint, url) : null;
          if (!url) throw new Error("Sound bank URLs must be direct HTTPS audio URLs.");
          if (!effect) throw new Error(`Could not match “${hint || value}” to a Hitbox effect filename.`);
          sounds.set(effect, url);
        };
        let name = fallbackName;
        if (/^\s*(?:\[|\{)/.test(text)) {
          const parsed = JSON.parse(text);
          if (Array.isArray(parsed)) {
            for (const value of parsed) addSound("", value);
          } else if (parsed && typeof parsed === "object") {
            const manifest = parsed;
            if (typeof manifest.name === "string" && manifest.name.trim()) name = manifest.name.trim();
            const entries = manifest.sounds && typeof manifest.sounds === "object" && !Array.isArray(manifest.sounds) ? Object.entries(manifest.sounds) : Object.entries(manifest).filter(([key]) => key !== "name");
            for (const [effect, value] of entries) addSound(effect, value);
          } else {
            throw new Error("The sound bank manifest must contain URLs or an object of effect-to-URL mappings.");
          }
        } else {
          for (const line of text.split(/\r?\n/).map((value) => value.trim()).filter(Boolean)) {
            const assignment = line.match(/^([^=]+)=(https:\/\/.*)$/i);
            addSound(assignment?.[1] || "", assignment?.[2] || line);
          }
        }
        if (!sounds.size) throw new Error("The sound bank manifest contains no effects.");
        return { name: name.slice(0, 80), sounds };
      }
      function playAudio(url, volume = 1, rate = 1, loop = false) {
        const audio = new Audio(url);
        audio.loop = loop;
        audio.volume = Math.max(0, Math.min(1, volume));
        audio.playbackRate = Math.max(0.25, Math.min(4, rate));
        void audio.play().catch(() => void 0);
        return audio;
      }
      function getHowlPlaybackSettings(howl) {
        const howlVolume = Number(readNativeReflectProperty(howl, "_volume"));
        const howlRate = Number(readNativeReflectProperty(howl, "_rate"));
        const howlerVolume = Number(readNativeReflectProperty(readNativeReflectProperty(window, "Howler"), "_volume"));
        return {
          loop: readNativeReflectProperty(howl, "_loop") === true,
          rate: Number.isFinite(howlRate) ? howlRate : 1,
          volume: (Number.isFinite(howlVolume) ? howlVolume : 1) * (Number.isFinite(howlerVolume) ? howlerVolume : 1)
        };
      }
      function getEffectHowl(effect) {
        const howls = readNativeReflectProperty(readNativeReflectProperty(window, "Howler"), "_howls");
        return Array.isArray(howls) ? howls.find((howl) => getHowlSource(howl) === effect) : null;
      }
      function createSoundBankController() {
        const state = loadState();
        let replacementUrls = /* @__PURE__ */ new Map();
        let selectedEffect = SOUND_EFFECTS[0]?.source || "";
        let nextPlaybackId = -1;
        let playbacksByHowl = /* @__PURE__ */ new WeakMap();
        const activePlaybacks = /* @__PURE__ */ new Set();
        let refreshSequence = 0;
        let lastError = "";
        function stopAllReplacements() {
          for (const audio of activePlaybacks) {
            audio.pause();
            audio.removeAttribute("src");
          }
          activePlaybacks.clear();
          playbacksByHowl = /* @__PURE__ */ new WeakMap();
        }
        function getActiveBank() {
          return state.banks.find((bank) => bank.id === state.active) || null;
        }
        async function refreshReplacements() {
          const sequence = ++refreshSequence;
          const bank = getActiveBank();
          const nextUrls = /* @__PURE__ */ new Map();
          if (bank) {
            const records = await Promise.all(Object.keys(bank.sounds).map((effect) => readStoredSound(bank.id, effect)));
            if (sequence !== refreshSequence) return;
            for (const record of records) {
              if (record?.blob) nextUrls.set(record.effect, URL.createObjectURL(record.blob));
              else if (record?.url) nextUrls.set(record.effect, record.url);
            }
          }
          stopAllReplacements();
          for (const url of replacementUrls.values()) URL.revokeObjectURL(url);
          replacementUrls = nextUrls;
        }
        function playReplacement(howl) {
          const effect = getHowlSource(howl);
          const url = effect ? replacementUrls.get(effect) : null;
          if (!url || typeof howl !== "object" && typeof howl !== "function" || howl === null) return null;
          const settings = getHowlPlaybackSettings(howl);
          const audio = playAudio(url, settings.volume, settings.rate, settings.loop);
          const id = nextPlaybackId--;
          const playbacks = playbacksByHowl.get(howl) || /* @__PURE__ */ new Map();
          playbacks.set(id, audio);
          playbacksByHowl.set(howl, playbacks);
          activePlaybacks.add(audio);
          const finish = () => {
            playbacks.delete(id);
            activePlaybacks.delete(audio);
          };
          audio.addEventListener("ended", finish, { once: true });
          audio.addEventListener("error", finish, { once: true });
          return id;
        }
        function stopReplacement(howl, id) {
          if (typeof howl !== "object" && typeof howl !== "function" || howl === null) return false;
          const playbacks = playbacksByHowl.get(howl);
          if (!playbacks?.size) return false;
          const targets = typeof id === "number" ? [playbacks.get(id)].filter(Boolean) : [...playbacks.values()];
          if (!targets.length) return false;
          for (const audio of targets) {
            if (typeof id === "number" && !audio.loop) continue;
            audio.pause();
            activePlaybacks.delete(audio);
            for (const [playbackId, candidate] of playbacks) {
              if (candidate === audio) playbacks.delete(playbackId);
            }
          }
          return true;
        }
        function getMarkup() {
          const activeBank = getActiveBank();
          const bankOptions = [
            `<option value="${VANILLA_BANK_ID}"${state.active === VANILLA_BANK_ID ? " selected" : ""}>Vanilla</option>`,
            ...state.banks.map(
              (bank) => `<option value="${escapeHtml(bank.id)}"${state.active === bank.id ? " selected" : ""}>${escapeHtml(bank.name)}</option>`
            )
          ].join("");
          const effectOptions = SOUND_EFFECTS.map(
            (effect) => `<option value="${escapeHtml(effect.source)}"${selectedEffect === effect.source ? " selected" : ""}>${escapeHtml(effect.label)} — ${escapeHtml(effect.source)}</option>`
          ).join("");
          const replacements = activeBank ? Object.entries(activeBank.sounds).map(([effect, fileName]) => {
            const label = SOUND_EFFECTS.find((candidate) => candidate.source === effect)?.label || effect;
            return `<div class="qolboxSoundReplacement">
                <span><strong>${escapeHtml(label)}</strong><small>${escapeHtml(fileName)}</small></span>
                <div class="qolboxSoundReplacementActions">
                  <button class="qolboxMenuButton" type="button" data-qolbox-action="sound-bank-preview" data-qolbox-icon="play" data-effect="${escapeHtml(effect)}">Preview</button>
                  <button class="qolboxMenuButton" type="button" data-qolbox-action="sound-bank-remove" data-qolbox-icon="trash" data-effect="${escapeHtml(effect)}">Remove</button>
                </div>
              </div>`;
          }).join("") : "";
          return `<section class="qolboxSoundBanks" aria-labelledby="qolboxSoundBanksTitle">
          <div id="qolboxSoundBanksTitle" class="qolboxMenuFeatureName" data-qolbox-icon="music">Sound Banks</div>
          <div class="qolboxSoundBankControls">
            <label class="qolboxSoundBankField">
              <span>Active bank</span>
              <select class="qolboxMenuInput" data-qolbox-sound-bank>${bankOptions}</select>
            </label>
            <div class="qolboxSoundBankActions">
              <button class="qolboxMenuButton" type="button" data-qolbox-action="sound-bank-new" data-qolbox-icon="file-plus">New bank</button>
              <button class="qolboxMenuButton" type="button" data-qolbox-action="sound-bank-import" data-qolbox-icon="upload">Import</button>
              ${activeBank ? '<button class="qolboxMenuButton" type="button" data-qolbox-action="sound-bank-delete" data-qolbox-icon="trash">Delete bank</button>' : ""}
            </div>
            <input hidden type="file" accept=".json,.txt,application/json,text/plain" data-qolbox-sound-manifest>
          </div>
          ${activeBank ? `<div class="qolboxSoundBankReplace">
            <label class="qolboxSoundBankField">
              <span>Effect to replace</span>
              <select class="qolboxMenuInput" data-qolbox-sound-effect>${effectOptions}</select>
            </label>
            <button class="qolboxMenuButton primary" type="button" data-qolbox-action="sound-bank-choose" data-qolbox-icon="upload">Choose audio</button>
            <input hidden type="file" accept="audio/*,.mp3,.wav,.ogg,.m4a,.aac,.flac" data-qolbox-sound-file>
          </div>
          <div class="qolboxSoundReplacementHeader"><strong>Replacements</strong></div>
          <div class="qolboxSoundReplacementList">${replacements || '<span class="qolboxMenuFeatureSummary">No replaced effects yet.</span>'}</div>` : ""}
          ${lastError ? `<div class="qolboxMenuFieldError" role="alert">${escapeHtml(lastError)}</div>` : ""}
        </section>`;
        }
        async function handleAction(action, element) {
          if (!action.startsWith("sound-bank-")) return false;
          lastError = "";
          try {
            if (action === "sound-bank-new") {
              const name = window.prompt("Sound bank name", "My Sound Bank")?.trim();
              if (name) {
                const id = typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
                state.banks.push({ id, name: name.slice(0, 80), sounds: {} });
                state.active = id;
                saveState(state);
                await refreshReplacements();
              }
            } else if (action === "sound-bank-delete") {
              const bank = getActiveBank();
              if (bank && window.confirm(`Delete “${bank.name}” and its saved sounds?`)) {
                await deleteStoredSound(bank.id);
                state.banks = state.banks.filter((candidate) => candidate.id !== bank.id);
                state.active = VANILLA_BANK_ID;
                saveState(state);
                await refreshReplacements();
              }
            } else if (action === "sound-bank-import") {
              element.closest(".qolboxSoundBanks")?.querySelector("[data-qolbox-sound-manifest]")?.click();
              return false;
            } else if (action === "sound-bank-choose") {
              element.closest(".qolboxSoundBanks")?.querySelector("[data-qolbox-sound-file]")?.click();
              return false;
            } else if (action === "sound-bank-preview") {
              const effect = element.dataset.effect || "";
              const url = replacementUrls.get(effect);
              if (url) {
                const settings = getHowlPlaybackSettings(getEffectHowl(effect));
                const audio = playAudio(url, settings.volume, settings.rate);
                activePlaybacks.add(audio);
                const finish = () => activePlaybacks.delete(audio);
                audio.addEventListener("ended", finish, { once: true });
                audio.addEventListener("error", finish, { once: true });
              }
              return false;
            } else if (action === "sound-bank-remove") {
              const bank = getActiveBank();
              const effect = element.dataset.effect || "";
              if (bank && bank.sounds[effect]) {
                await deleteStoredSound(bank.id, effect);
                delete bank.sounds[effect];
                saveState(state);
                await refreshReplacements();
              }
            }
          } catch (error) {
            lastError = error instanceof Error ? error.message : "The sound bank action failed.";
          }
          return true;
        }
        async function handleInput(element) {
          if (element.matches("[data-qolbox-sound-bank]")) {
            state.active = element.value === VANILLA_BANK_ID || state.banks.some((bank2) => bank2.id === element.value) ? element.value : VANILLA_BANK_ID;
            saveState(state);
            await refreshReplacements();
            return true;
          }
          if (element.matches("[data-qolbox-sound-effect]")) {
            if (SOUND_EFFECT_SOURCES.has(element.value)) selectedEffect = element.value;
            return false;
          }
          if (element.matches("[data-qolbox-sound-manifest]") && element instanceof HTMLInputElement) {
            const file2 = element.files?.[0];
            if (!file2) return true;
            lastError = "";
            if (file2.size > MAX_SOUND_MANIFEST_BYTES) {
              lastError = "Choose a sound bank manifest no larger than 1 MB.";
              element.value = "";
              return true;
            }
            try {
              const manifest = parseSoundBankManifest(file2, await file2.text());
              const id = typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;
              try {
                await Promise.all([...manifest.sounds].map(([effect2, url]) => writeStoredSound({ bankId: id, effect: effect2, url })));
              } catch (error) {
                await deleteStoredSound(id).catch(() => void 0);
                throw error;
              }
              state.banks.push({ id, name: manifest.name, sounds: Object.fromEntries(manifest.sounds) });
              state.active = id;
              saveState(state);
              await refreshReplacements();
            } catch (error) {
              lastError = error instanceof Error ? error.message : "The sound bank could not be imported.";
            }
            element.value = "";
            return true;
          }
          if (!element.matches("[data-qolbox-sound-file]") || !(element instanceof HTMLInputElement)) return false;
          const file = element.files?.[0];
          const bank = getActiveBank();
          const effect = element.closest(".qolboxSoundBanks")?.querySelector("[data-qolbox-sound-effect]")?.value || "";
          if (!file || !bank || !SOUND_EFFECT_SOURCES.has(effect)) return true;
          lastError = "";
          if (file.size > MAX_SOUND_BYTES) {
            lastError = "Choose an audio file no larger than 15 MB.";
            return true;
          }
          try {
            await writeStoredSound({ bankId: bank.id, blob: file, effect });
            bank.sounds[effect] = file.name;
            saveState(state);
            await refreshReplacements();
          } catch (error) {
            lastError = error instanceof Error ? error.message : "The custom sound could not be saved.";
          }
          return true;
        }
        void refreshReplacements().catch(() => void 0);
        return {
          getMarkup,
          handleAction,
          handleInput,
          playReplacement,
          refreshReplacements,
          stopAllReplacements,
          stopReplacement
        };
      }

      // src/features/qolbox-menu-markup.ts
      var SETTINGS_PAGES = [
        { key: "features", title: "Features" },
        { key: "commands", title: "Commands" },
        { key: "audio", title: "Audio" },
        { key: "appearance", title: "Appearance" },
        { key: "advanced", title: "Advanced" },
        { key: "about", title: "About" }
      ];
      var REFERENCE_TOPICS = [
        { icon: "terminal", key: "commands", title: "Commands" },
        { icon: "keyboard", key: "controls", title: "Controls" },
        { icon: "music", key: "sound-banks", title: "Sound Banks" }
      ];
      var FEATURE_PAGE_KEYS = [
        FEATURE_FULLSCREEN,
        FEATURE_RESERVE,
        FEATURE_CHAT,
        FEATURE_GAME_START_ALERT,
        FEATURE_EDITOR_MAP_TRANSFER,
        FEATURE_EDITOR_FORCE_SAVE,
        FEATURE_MOBILE_GRAB
      ];
      var ADVANCED_TIMING_KEYS = [
        ADVANCED_RESERVE_RETRY_INTERVAL_MS,
        ADVANCED_ALERT_DELAY_MS,
        ADVANCED_ALERT_FLASH_INTERVAL_MS,
        ADVANCED_TYPING_DURATION_MS
      ];
      var ADVANCED_EDITOR_KEYS = [
        ADVANCED_EDITOR_MAP_READABLE_FILES
      ];
      var FEATURE_ICONS = {
        [FEATURE_AUDIO]: "volume-2",
        [FEATURE_CHAT]: "message-circle",
        [FEATURE_EDITOR_FORCE_SAVE]: "save",
        [FEATURE_EDITOR_MAP_TRANSFER]: "folder-open",
        [FEATURE_FULLSCREEN]: "maximize",
        [FEATURE_GAME_START_ALERT]: "bell-ring",
        [FEATURE_LOBBY_COMMANDS]: "terminal",
        [FEATURE_MOBILE_GRAB]: "mouse-pointer",
        [FEATURE_RESERVE]: "log-in"
      };
      var ADVANCED_ICONS = {
        [ADVANCED_ALERT_DELAY_MS]: "bell-ring",
        [ADVANCED_ALERT_FLASH_INTERVAL_MS]: "zap",
        [ADVANCED_BLACKLIST_ENFORCEMENT]: "shield",
        [ADVANCED_COMMAND_ALIASES]: "terminal",
        [ADVANCED_EDITOR_MAP_READABLE_FILES]: "download",
        [ADVANCED_RESERVE_RETRY_INTERVAL_MS]: "refresh-cw",
        [ADVANCED_TYPING_DURATION_MS]: "message-circle"
      };
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
              text: "QOLBox is a hitbox.io userscript with fullscreen layout, reserve spots in full lobbies, audio controls and sound banks, away-tab alerts, mobile Grab, readable chat, lobby commands, and an improved editor with multi-selection and map import/export."
            },
            {
              type: "info",
              title: "Interface and appearance",
              text: "Use Tab and arrow keys to move through menus, Esc to close them, and Tab or Right Arrow to complete slash commands. Room List stays available from lobby and game menus; click a lobby player for level progress and account details. Long map descriptions scroll, published-map votes are clickable, and Appearance can follow your system theme or customize and link the QOLBox and game accent colors."
            },
            {
              type: "info",
              title: "Editor workflow",
              text: "The editor adds Shift/Ctrl multi-selection, drag-area selection, group copy/paste/delete, mixed-value editing, exact colors, an eyedropper, mirroring, reliable outlines, and undo/redo shortcuts. Open the editor Help tab for the complete reference."
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
          if (!step) {
            return "";
          }
          const isFeatureStep = step.type === "feature";
          const isFirstStep = onboardingStepIndex === 0;
          const isFinalStep = onboardingStepIndex === steps.length - 1;
          const progress = steps.map((_, index) => `<span class="qolboxMenuDot${index === onboardingStepIndex ? " active" : ""}"></span>`).join("");
          if (isFirstStep) {
            return `
            <div class="qolboxMenuBody">
              <div class="qolboxMenuSectionTitle">${escapeMenuText(step.title)}</div>
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
            <div class="qolboxMenuSectionTitle">${escapeMenuText(step.title)}</div>
            <p class="qolboxMenuText">${escapeMenuText(step.text)}</p>
            ${isFeatureStep && step.featureKey ? getOnboardingToggleMarkup(step.featureKey) : isFinalStep ? getOnboardingSummaryMarkup() : ""}
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
              <button class="qolboxMenuTab${page.key === activePage ? " active" : ""}" role="tab" aria-controls="qolboxMenuPage" aria-selected="${page.key === activePage ? "true" : "false"}" tabindex="${page.key === activePage ? "0" : "-1"}" data-qolbox-action="settings-page" data-page="${page.key}">${escapeMenuText(page.title)}</button>
            `).join("")}
          </div>
        `;
        }
        function getFeatureRowMarkup(featureKey, draft) {
          const feature = getFeatureDefinition(options.featureDefinitions, featureKey);
          return `
          <div class="qolboxMenuFeatureRow">
            <div>
              <div class="qolboxMenuFeatureName" data-qolbox-icon="${FEATURE_ICONS[feature.key]}">${escapeMenuText(feature.title)}</div>
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
              <div class="qolboxMenuFeatureName" data-qolbox-icon="${ADVANCED_ICONS[key]}">${escapeMenuText(definition.title)}</div>
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
            ${FEATURE_PAGE_KEYS.map((featureKey) => getFeatureRowMarkup(featureKey, draft)).join("")}
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
        `;
        }
        function getAudioPageMarkup(draft) {
          return `
          <div class="qolboxMenuSettingsList">
            ${getFeatureRowMarkup(FEATURE_AUDIO, draft)}
          </div>
          ${options.getSoundBankMarkup()}
        `;
        }
        function getThemeColorMarkup(key, title, summary, value, error) {
          return `
          <label class="qolboxThemeColorControl">
            <span class="qolboxMenuFeatureName">${escapeMenuText(title)}</span>
            <span class="qolboxMenuFeatureSummary">${escapeMenuText(summary)}</span>
            <span class="qolboxThemeColorInputs">
              <input class="qolboxThemeColorPicker" type="color" value="${escapeMenuText(value)}" data-qolbox-theme-picker="${escapeMenuText(key)}" aria-label="Choose ${escapeMenuText(title.toLowerCase())}">
              <input class="qolboxMenuInput qolboxThemeHexInput${error ? " invalid" : ""}" type="text" value="${escapeMenuText(value)}" maxlength="7" spellcheck="false" autocomplete="off" data-qolbox-theme-input="${escapeMenuText(key)}" aria-label="${escapeMenuText(title)} hex color">
            </span>
            ${error ? `<span class="qolboxMenuFieldError">${escapeMenuText(error)}</span>` : ""}
          </label>
        `;
        }
        function getAppearancePageMarkup(draft, errors) {
          return `
          <div class="qolboxMenuFeatureRow compact qolboxThemeModeRow">
            <div>
              <div class="qolboxMenuFeatureName" data-qolbox-icon="palette">Color mode</div>
              <div class="qolboxMenuFeatureSummary">Follow your device or force dark or light.</div>
            </div>
            <div class="qolboxMenuToggleGroup qolboxThemeMode" role="group" aria-label="Color mode">
              ${["system", "dark", "light"].map((mode) => `
                <button class="qolboxMenuToggle${draft.theme.mode === mode ? " active" : ""}" type="button"
                  data-qolbox-action="draft-theme-mode" data-mode="${mode}" data-qolbox-icon="${mode === "system" ? "monitor" : mode === "dark" ? "moon" : "sun"}">
                  ${mode[0]?.toUpperCase()}${mode.slice(1)}
                </button>`).join("")}
            </div>
          </div>
          <div class="qolboxThemeControls${draft.theme.linked ? " linked" : ""}">
            ${getThemeColorMarkup(
            THEME_QOLBOX_ACCENT,
            "QOLBox accent",
            "QOLBox controls and highlights.",
            draft.theme.qolboxAccent,
            errors[THEME_QOLBOX_ACCENT]
          )}
            <div class="qolboxThemeLinkControls">
              ${draft.theme.linked ? '<button class="qolboxThemeLinkButton" type="button" data-qolbox-action="unlink-theme" data-qolbox-icon="unlink">Unlink</button>' : `
                  <button class="qolboxThemeLinkButton" type="button" data-qolbox-action="link-theme-from-qolbox" data-qolbox-icon="arrow-right">Use QOLBox</button>
                  <button class="qolboxThemeLinkButton" type="button" data-qolbox-action="link-theme-from-game" data-qolbox-icon="arrow-left">Use Game</button>
                `}
            </div>
            ${getThemeColorMarkup(
            THEME_GAME_ACCENT,
            "Game accent",
            "Hitbox buttons and blue interface chrome.",
            draft.theme.gameAccent,
            errors[THEME_GAME_ACCENT]
          )}
          </div>
        `;
        }
        function getAdvancedPageMarkup(draft, errors) {
          return `
          <div class="qolboxMenuSettingsList">
            ${ADVANCED_EDITOR_KEYS.map((key) => getAdvancedRowMarkup(key, draft, errors)).join("")}
            ${ADVANCED_TIMING_KEYS.map((key) => getAdvancedRowMarkup(key, draft, errors)).join("")}
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
            <div class="qolboxMenuFeatureSummary">Fullscreen layout, reserve spots, audio controls, away-tab alerts, mobile Grab, readable chat, lobby commands, and an improved editor with multi-selection, grouped editing, exact colors, reliable outlines, and map import/export.</div>
          </div>
          ${getCreditsMarkup()}
          <div class="qolboxMenuActions slim">
            <button class="qolboxMenuButton" data-qolbox-action="redo-onboarding">Redo Setup</button>
            <button class="qolboxMenuButton" data-qolbox-action="view-reference">Reference</button>
            <button class="qolboxMenuButton" data-qolbox-action="view-patch-notes">View Patch Notes</button>
          </div>
        `;
        }
        function getReferenceEntriesMarkup(topic) {
          if (topic === "commands") {
            return getQolboxCommandReferenceLines().slice(1).map((line) => {
              const [syntax, description] = line.split(" -- ", 2);
              return description ? `<section class="qolboxReferenceEntry command"><code>${escapeMenuText(syntax || "")}</code><p>${escapeMenuText(description)}</p></section>` : `<section class="qolboxReferenceEntry wide"><p>${escapeMenuText(line)}</p></section>`;
            }).join("");
          }
          if (topic === "controls") {
            return [
              ["Open QOLBox", `${options.menuKeyLabel} opens or closes this menu.`],
              ["Menus", "Tab and Shift+Tab move between controls. Arrow keys move through tabs and lists. Enter or Space activates the focused control. Esc closes the current menu, popup, or dropdown."],
              ["Room List", "Arrow keys change the selected room, Enter joins it, and Esc closes the browser or password prompt."],
              ["Command completion", "In chat, Tab or Right Arrow accepts the visible completion. Up and Down cycle matching commands."],
              ["Volume", "Drag vertically on Volume in Hitbox's hamburger menu for one-percent adjustments. Click it to cycle the normal preset levels."]
            ].map(([title, description]) => `<section class="qolboxReferenceEntry"><h2>${escapeMenuText(title || "")}</h2><p>${escapeMenuText(description || "")}</p></section>`).join("");
          }
          const effects = SOUND_EFFECTS.map((effect) => `<code>${escapeMenuText(effect.source)}</code>`).join("");
          const jsonManifest = escapeMenuText(JSON.stringify({
            name: "My Bank",
            sounds: { "bathit1.wav": "https://example.com/custom-hit.opus" }
          }, null, 2));
          return `
          <section class="qolboxReferenceEntry wide"><h2>JSON manifest</h2><pre>${jsonManifest}</pre></section>
          <section class="qolboxReferenceEntry wide"><h2>Plain-text manifest</h2><pre>bathit1.wav=https://example.com/custom-hit.opus</pre><p>One direct HTTPS audio URL per line also works when the URL filename is a recognized effect filename.</p></section>
          <section class="qolboxReferenceEntry wide"><h2>Effect filenames</h2><div class="qolboxReferenceCodes">${effects}</div></section>`;
        }
        function getReferenceMarkup(topic) {
          return `
          <div class="qolboxMenuBody qolboxReferenceBody">
            <div class="qolboxReferenceLayout">
              <nav class="qolboxReferenceTopics" aria-label="Reference topics" role="tablist" aria-orientation="vertical">
                ${REFERENCE_TOPICS.map((candidate) => `<button class="qolboxReferenceTopic${candidate.key === topic ? " active" : ""}" type="button" role="tab" data-qolbox-action="reference-topic" data-qolbox-icon="${candidate.icon}" data-topic="${candidate.key}" aria-selected="${candidate.key === topic}" tabindex="${candidate.key === topic ? "0" : "-1"}">${candidate.title}</button>`).join("")}
              </nav>
              <div class="qolboxReferenceDetail" role="tabpanel" tabindex="0">${getReferenceEntriesMarkup(topic)}</div>
            </div>
            <div class="qolboxMenuActions"><button class="qolboxMenuButton primary" data-qolbox-action="back-to-settings">Back</button></div>
          </div>`;
        }
        function getSettingsPageMarkup(draft, page, errors) {
          switch (page) {
            case "commands":
              return getCommandsPageMarkup(draft, errors);
            case "audio":
              return getAudioPageMarkup(draft);
            case "advanced":
              return getAdvancedPageMarkup(draft, errors);
            case "appearance":
              return getAppearancePageMarkup(draft, errors);
            case "about":
              return getAboutPageMarkup();
            case "features":
            default:
              return getFeaturePageMarkup(draft);
          }
        }
        function getSettingsMenuMarkup(draft, page, errors) {
          const pageTitle = SETTINGS_PAGES.find((candidate) => candidate.key === page)?.title || "Features";
          return `
          <div class="qolboxMenuBody settings">
            ${getSettingsTabsMarkup(page)}
            <div id="qolboxMenuPage" class="qolboxMenuPage" role="tabpanel" aria-label="${escapeMenuText(pageTitle)} settings">
              ${getSettingsPageMarkup(draft, page, errors)}
            </div>
            <div class="qolboxMenuActions">
              <button class="qolboxMenuButton" data-qolbox-action="restore-qolbox-defaults">QOLBox Defaults</button>
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
          const title = notice ? "QOLBox Updated" : "Patch Notes";
          const closeAction = notice ? "acknowledge-update" : "back-to-settings";
          const closeLabel = notice ? "OK" : "Back";
          if (releaseHistory.status === "loading") {
            return `
            <div class="qolboxMenuBody">
              <div class="qolboxMenuSectionTitle">${title}</div>
              ${notice ? getUpdateRangeMarkup(notice) : ""}
              <div class="qolboxMenuLoading" role="status" aria-live="polite">
                <span class="qolboxMenuSpinner" aria-hidden="true"></span>
                <span>Loading update notes from GitHub and GreasyFork...</span>
              </div>
              <div class="qolboxMenuActions">
                <button class="qolboxMenuButton primary" data-qolbox-action="${closeAction}">${notice ? "Skip" : closeLabel}</button>
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
            <div class="qolboxMenuSectionTitle">${title}</div>
            ${notice ? getUpdateRangeMarkup(notice) : ""}
            ${notes}
            <div class="qolboxMenuHeaderLine">
              <button class="qolboxMenuButton" data-qolbox-action="update-older" ${safePageIndex >= releaseNotes.length - 1 ? "disabled" : ""}>Older</button>
              <span class="qolboxMenuFeatureSummary">Version ${chronologicalPageNumber} of ${pageCount}</span>
              <button class="qolboxMenuButton" data-qolbox-action="update-newer" ${safePageIndex <= 0 ? "disabled" : ""}>Newer</button>
            </div>
            <div class="qolboxMenuActions">
              <button class="qolboxMenuButton primary" data-qolbox-action="${closeAction}">${closeLabel}</button>
            </div>
          </div>
        `;
        }
        return {
          getOnboardingStepMarkup,
          getOnboardingSteps,
          getReferenceMarkup,
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
        let patchNotesReleaseHistory = createInitialReleaseHistoryState(null);
        let patchNotesReleaseHistoryRefreshStarted = false;
        const { getOnboardingStepMarkup, getOnboardingSteps, getReferenceMarkup, getSettingsMenuMarkup, getUpdateNoticeMarkup } = createQolboxMenuMarkup({
          featureDefinitions: FEATURE_DEFINITIONS,
          getSoundBankMarkup: options.soundBanks.getMarkup,
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
            features,
            theme: options.getThemeSettings()
          };
        }
        const menuController = createQolboxMenuController({
          createSettingsDraft,
          getOnboardingStepMarkup,
          getOnboardingStepCount: () => getOnboardingSteps().length,
          getPatchNotesMarkup: (pageIndex) => getUpdateNoticeMarkup(null, patchNotesReleaseHistory, pageIndex),
          getPatchNotesPageCount: () => Math.max(1, patchNotesReleaseHistory.notes.length),
          getReferenceMarkup,
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
            options.scheduleUiWork({ features: true, passes: FULLSCREEN_SETTLE_PASSES });
          },
          onCommitSettingsDraft: (features, advanced, theme) => {
            options.setAllFeatureSettings(features);
            options.setAdvancedSettings(advanced);
            options.setThemeSettings(theme);
          },
          onCustomAction: options.soundBanks.handleAction,
          onCustomInput: options.soundBanks.handleInput,
          onMenuModeChanged: options.applyFeatureRootClasses,
          onOpenPatchNotes: refreshPatchNotesReleaseHistory,
          onSetFeatureEnabled: options.setFeatureEnabled
        });
        function scheduleFirstBootOnboarding() {
          if (!menuController.isOnboardingComplete()) {
            window.setTimeout(menuController.showFirstBootOnboarding, 0);
          }
        }
        function scheduleStartupQolboxNotice() {
          if (!menuController.isOnboardingComplete()) {
            scheduleFirstBootOnboarding();
            return;
          }
          if (!pendingUpdateNotice) {
            return;
          }
          refreshUpdateReleaseHistory();
          window.setTimeout(menuController.showUpdateNotice, 0);
        }
        function refreshUpdateReleaseHistory() {
          if (!pendingUpdateNotice || updateReleaseHistoryRefreshStarted) {
            return;
          }
          updateReleaseHistoryRefreshStarted = true;
          loadReleaseHistoryState(pendingUpdateNotice.previousVersion, pendingUpdateNotice.currentVersion, (nextHistory) => {
            updateReleaseHistory = nextHistory;
            if (menuController.getMode() === "update") {
              menuController.renderQolboxMenu();
            }
          }).then((nextHistory) => {
            updateReleaseHistory = nextHistory;
            if (menuController.getMode() === "update") {
              menuController.renderQolboxMenu();
            }
          }).catch(() => {
          });
        }
        function refreshPatchNotesReleaseHistory() {
          if (patchNotesReleaseHistoryRefreshStarted) return;
          patchNotesReleaseHistoryRefreshStarted = true;
          loadReleaseHistoryState(null, QOLBOX_VERSION, (nextHistory) => {
            patchNotesReleaseHistory = nextHistory;
            if (menuController.getMode() === "patch-notes") menuController.renderQolboxMenu();
          }).then((nextHistory) => {
            patchNotesReleaseHistory = nextHistory;
            if (menuController.getMode() === "patch-notes") menuController.renderQolboxMenu();
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
          #backgroundImage {
            background-position: center center !important;
            background-repeat: no-repeat !important;
            background-size: cover !important;
          }

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

          html.qolbox-feature-fullscreen #backgroundImage {
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

          html.qolbox-feature-fullscreen .physicsCountWindow {
            bottom: 17px !important;
            z-index: 1 !important;
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

          html.qolbox-feature-chat .inGameChat .content div:not(:has(> .name)) > .message {
            color: rgb(112, 169, 255);
          }

          html.qolbox-feature-chat .inGameChat .content div:has(> .message.link) > .message:not(.link) {
            color: #dfa032;
          }

          html.qolbox-feature-chat .inGameChat .content .qolboxInGameJukeboxTitle {
            font-style: italic;
          }

          html.qolbox-feature-chat .inGameChat .content .message.link {
            color: rgb(112, 169, 255);
            font-weight: 700;
            text-decoration: underline;
          }

          .qolboxChatCommandGhost {
            align-items: center;
            --qolbox-chat-command: #79bdff;
            --qolbox-chat-command-argument: #f2cd83;
            --qolbox-chat-command-suggestion: #b9c4d2;
            display: flex;
            overflow: hidden;
            pointer-events: none;
            position: absolute;
            white-space: pre;
            z-index: 1;
          }

          html:not(.qolbox-feature-lobbyCommands) .qolboxChatCommandGhost {
            display: none;
          }

          .qolboxChatCommandRichInput {
            caret-color: var(--qolbox-ui-text, #ebebeb);
            color: transparent !important;
          }

          .qolboxChatCommandName {
            color: var(--qolbox-chat-command);
          }

          .qolboxChatCommandArgument {
            color: var(--qolbox-chat-command-argument);
          }

          .qolboxChatCommandSuggestion {
            color: var(--qolbox-chat-command-suggestion);
          }

          html[data-qolbox-color-scheme="light"] .lobbyContainer .chatBox .input {
            color: var(--qolbox-ui-text, #171a1f) !important;
          }

          html[data-qolbox-color-scheme="light"] .lobbyContainer .qolboxChatCommandGhost {
            --qolbox-chat-command: #005ea8;
            --qolbox-chat-command-argument: #6b4d00;
            --qolbox-chat-command-suggestion: #596775;
          }
        `;
      }

      // src/features/global-style-menu.ts
      function getQolboxMenuGlobalStyleText() {
        return `
          .qolboxMenuOverlay,
          .qolboxMenuPanel {
            --qolbox-menu-border: rgb(82, 89, 101);
            --qolbox-menu-control: rgb(47, 51, 58);
            --qolbox-menu-input: rgb(31, 34, 39);
            --qolbox-menu-muted: #c4c9d1;
            --qolbox-menu-panel: rgba(22, 24, 28, 0.98);
            --qolbox-menu-separator: rgba(255, 255, 255, 0.12);
            --qolbox-menu-strong: #ffffff;
            --qolbox-menu-text: #f4f4f4;
          }

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

          html[data-qolbox-color-scheme="light"] .qolboxMenuOverlay,
          html[data-qolbox-color-scheme="light"] .qolboxMenuPanel {
            --qolbox-menu-border: #aeb6c2;
            --qolbox-menu-control: #e7eaf0;
            --qolbox-menu-input: #ffffff;
            --qolbox-menu-muted: #505862;
            --qolbox-menu-panel: rgba(244, 246, 248, 0.99);
            --qolbox-menu-separator: rgba(24, 28, 34, 0.16);
            --qolbox-menu-strong: #111419;
            --qolbox-menu-text: #171a1f;
          }

          html[data-qolbox-color-scheme="light"] .qolboxMenuOverlay {
            background: rgba(220, 225, 232, 0.76);
          }

          html.qolbox-menu-open .qolboxMenuOverlay {
            opacity: 1;
            pointer-events: auto;
          }

          .qolboxMenuPanel {
            background: var(--qolbox-menu-panel);
            border: 2px solid var(--qolbox-menu-border);
            border-radius: 4px;
            box-shadow: 0 8px 28px rgba(0, 0, 0, 0.55);
            box-sizing: border-box;
            color: var(--qolbox-menu-text);
            display: flex;
            flex-direction: column;
            max-height: calc(100vh - 20px);
            max-width: calc(100vw - 20px);
            min-width: min(320px, calc(100vw - 20px));
            overflow: hidden;
            resize: both;
            width: 470px;
          }

          .qolboxMenuBody.settings {
            overflow: hidden;
          }

          .qolboxMenuBody.settings .qolboxMenuPage {
            flex: 1 1 auto;
            overflow: auto;
          }

          .qolboxMenuBody.settings .qolboxMenuActions {
            margin-top: 0;
            padding-top: 4px;
          }

          .qolboxMenuBody {
            box-sizing: border-box;
            display: flex;
            flex: 1 1 auto;
            flex-direction: column;
            gap: 9px;
            min-height: 0;
            overflow: auto;
            padding: 14px;
          }

          .qolboxMenuPersistentHeader {
            flex: 0 0 auto;
            padding: 14px 14px 0;
          }

          .qolboxMenuTitle {
            color: var(--qolbox-menu-strong);
            font-size: 20px;
            font-weight: 700;
            letter-spacing: 0;
            line-height: 24px;
            margin: 0;
          }

          .qolboxMenuSectionTitle {
            color: var(--qolbox-menu-strong);
            font-size: 13px;
            font-weight: 700;
            line-height: 17px;
          }

          .qolboxMenuHeaderLine {
            align-items: center;
            display: flex;
            gap: 8px;
            justify-content: space-between;
          }

          .qolboxMenuText {
            color: var(--qolbox-menu-text);
            font-size: 13px;
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
            color: var(--qolbox-menu-muted);
            font-size: 11px;
            font-weight: 700;
            line-height: 14px;
            text-transform: uppercase;
          }

          .qolboxMenuVersionPill {
            background: var(--qolbox-menu-input);
            border: 1px solid var(--qolbox-menu-border);
            border-radius: 3px;
            color: var(--qolbox-menu-text);
            font-size: 13px;
            font-weight: 700;
            line-height: 16px;
            padding: 4px 7px;
          }

          .qolboxMenuVersionPill.current {
            border-color: rgb(var(--qolbox-accent-rgb, 255 98 0) / 0.8);
            color: var(--qolbox-accent, #ff6200);
          }

          .qolboxMenuVersionArrow {
            color: var(--qolbox-menu-muted);
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
            background: var(--qolbox-menu-separator);
            border-radius: 999px;
            height: 5px;
            width: 12px;
          }

          .qolboxMenuDot.active {
            background: var(--qolbox-accent, #ff6200);
          }

          .qolboxMenuToggleGroup {
            background: var(--qolbox-menu-input);
            border: 1px solid var(--qolbox-menu-border);
            border-radius: 3px;
            display: grid;
            grid-template-columns: 1fr 1fr;
            overflow: hidden;
          }

          .qolboxThemeMode {
            grid-template-columns: repeat(3, 1fr);
          }

          .qolboxThemeModeRow {
            grid-template-columns: minmax(0, 1fr) 220px;
          }

          .qolboxThemeMode .qolboxMenuToggle {
            font-size: 11px;
            padding: 0 5px;
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
            font-size: 13px;
            font-weight: 700;
            justify-content: center;
            letter-spacing: 0;
            line-height: 16px;
            min-height: 34px;
          }

          .qolboxMenuToggle {
            background: transparent;
            color: var(--qolbox-menu-text);
            padding: 0 8px;
          }

          .qolboxMenuToggle + .qolboxMenuToggle {
            border-left: 1px solid var(--qolbox-menu-separator);
          }

          .qolboxMenuToggle.active {
            background: var(--qolbox-accent, #ff6200);
            color: var(--qolbox-accent-contrast, #000000);
          }

          .qolboxMenuActions {
            display: flex;
            flex: 0 0 auto;
            flex-wrap: wrap;
            gap: 6px;
            justify-content: flex-end;
            margin-top: 4px;
          }

          .qolboxMenuActions.slim {
            margin-top: 0;
          }

          .qolboxMenuActions > [data-qolbox-action="restore-qolbox-defaults"] {
            margin-right: auto;
          }

          .qolboxMenuButton {
            background: var(--qolbox-menu-control);
            border: 1px solid var(--qolbox-menu-border);
            border-radius: 3px;
            color: var(--qolbox-menu-text);
            min-width: 76px;
            padding: 0 14px;
          }

          .qolboxMenuButton.primary {
            background: var(--qolbox-accent, #ff6200);
            color: var(--qolbox-accent-contrast, #000000);
          }

          .qolboxMenuButton:disabled {
            opacity: 0.45;
          }

          .qolboxMenuSettingsList {
            display: grid;
            gap: 6px;
          }

          .qolboxMenuTabs {
            border-bottom: 1px solid var(--qolbox-menu-separator);
            display: flex;
            flex-wrap: wrap;
            gap: 4px;
            justify-content: center;
            padding-bottom: 8px;
          }

          .qolboxMenuTab {
            background: var(--qolbox-menu-input);
            border: 1px solid var(--qolbox-menu-border);
            border-radius: 3px;
            color: var(--qolbox-menu-text);
            flex: 0 1 calc((100% - 8px) / 3);
            font-size: 12px;
            line-height: 14px;
            min-width: 0;
            padding: 0 6px;
          }

          .qolboxMenuTab.active {
            background: var(--qolbox-accent, #ff6200);
            border-color: var(--qolbox-accent, #ff6200);
            color: var(--qolbox-accent-contrast, #000000);
          }

          .qolboxMenuPage {
            align-content: start;
            display: grid;
            flex: 0 0 auto;
            gap: 8px;
          }

          .qolboxMenuChoiceGrid {
            display: grid;
            gap: 6px;
            grid-template-columns: 1fr 1fr;
          }

          .qolboxMenuChoice {
            appearance: none;
            background: var(--qolbox-menu-control);
            border: 1px solid var(--qolbox-menu-border);
            border-radius: 3px;
            color: var(--qolbox-menu-text);
            cursor: pointer;
            display: grid;
            font-family: inherit;
            gap: 3px;
            min-height: 62px;
            padding: 9px;
            text-align: left;
          }

          .qolboxMenuChoice.primary {
            border-color: var(--qolbox-accent, #ff6200);
          }

          .qolboxMenuChoice span {
            color: var(--qolbox-menu-strong);
            font-size: 14px;
            font-weight: 700;
            line-height: 16px;
          }

          .qolboxMenuChoice small {
            color: var(--qolbox-menu-muted);
            font-size: 11px;
            line-height: 14px;
          }

          .qolboxMenuFeatureRow {
            align-items: center;
            border-bottom: 1px solid var(--qolbox-menu-separator);
            display: grid;
            gap: 10px;
            grid-template-columns: minmax(0, 1fr) 116px;
            padding: 0 0 7px;
          }

          .qolboxMenuFeatureRow.compact {
            grid-template-columns: minmax(0, 1fr) 150px;
          }

          .qolboxMenuFeatureRow.compact.boolean {
            grid-template-columns: minmax(0, 1fr) 116px;
          }

          .qolboxMenuFeatureName {
            color: var(--qolbox-menu-strong);
            font-size: 13px;
            font-weight: 700;
            line-height: 16px;
          }

          .qolboxMenuFeatureSummary {
            color: var(--qolbox-menu-muted);
            font-size: 11px;
            line-height: 14px;
            margin-top: 1px;
          }

          .qolboxMenuFieldControl {
            display: grid;
            gap: 3px;
          }

          .qolboxSoundBanks {
            display: grid;
            gap: 8px;
          }

          .qolboxSoundBankControls,
          .qolboxSoundBankReplace {
            align-items: end;
            display: grid;
            gap: 8px;
            grid-template-columns: minmax(0, 1fr) auto;
          }

          .qolboxSoundBankReplace {
            border-top: 1px solid var(--qolbox-menu-separator);
            grid-template-columns: minmax(0, 1fr) auto;
            padding-top: 8px;
          }

          .qolboxSoundBankField {
            color: var(--qolbox-menu-muted);
            display: grid;
            font-size: 11px;
            gap: 4px;
            min-width: 0;
          }

          .qolboxSoundBankActions,
          .qolboxSoundReplacementActions {
            display: flex;
            gap: 6px;
          }

          .qolboxSoundBankControls .qolboxMenuButton,
          .qolboxSoundBankReplace .qolboxMenuButton {
            min-height: 34px;
          }

          .qolboxSoundReplacementHeader {
            align-items: center;
            color: var(--qolbox-menu-strong);
            display: flex;
            font-size: 11px;
            justify-content: space-between;
          }

          .qolboxSoundReplacementList {
            display: grid;
            gap: 5px;
          }

          .qolboxSoundReplacement {
            align-items: center;
            background: var(--qolbox-menu-input);
            border-radius: 3px;
            display: grid;
            gap: 8px;
            grid-template-columns: minmax(0, 1fr) auto;
            min-height: 44px;
            padding: 5px 6px 5px 9px;
          }

          .qolboxSoundReplacement > span {
            display: grid;
            min-width: 0;
          }

          .qolboxSoundReplacement strong,
          .qolboxSoundReplacement small {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .qolboxSoundReplacement strong {
            color: var(--qolbox-menu-strong);
            font-size: 12px;
          }

          .qolboxSoundReplacement small {
            color: var(--qolbox-menu-muted);
            font-size: 11px;
          }

          .qolboxSoundReplacement .qolboxMenuButton {
            height: 30px;
            min-width: 0;
            padding: 0 8px;
          }

          .qolboxThemeControls {
            align-items: end;
            display: grid;
            gap: 8px;
            grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
          }

          .qolboxThemeColorControl {
            display: grid;
            gap: 4px;
            min-width: 0;
          }

          .qolboxThemeLinkControls {
            display: grid;
            gap: 5px;
          }

          .qolboxThemeColorInputs {
            display: grid;
            gap: 5px;
            grid-template-columns: 34px minmax(0, 1fr);
          }

          .qolboxThemeColorPicker {
            appearance: none;
            background: var(--qolbox-menu-input);
            border: 1px solid var(--qolbox-menu-border);
            border-radius: 3px;
            box-sizing: border-box;
            cursor: pointer;
            height: 34px;
            padding: 3px;
            width: 34px;
          }

          .qolboxThemeColorPicker::-webkit-color-swatch-wrapper {
            padding: 0;
          }

          .qolboxThemeColorPicker::-webkit-color-swatch {
            border: 0;
            border-radius: 1px;
          }

          .qolboxThemeLinkButton {
            align-items: center;
            appearance: none;
            background: var(--qolbox-menu-control);
            border: 1px solid var(--qolbox-menu-border);
            border-radius: 3px;
            box-sizing: border-box;
            color: var(--qolbox-menu-text);
            cursor: pointer;
            display: inline-flex;
            font: inherit;
            font-size: 11px;
            font-weight: 700;
            height: 34px;
            justify-content: center;
            min-width: 82px;
            padding: 0 9px;
          }

          .qolboxThemeControls.linked .qolboxThemeLinkButton {
            border-color: var(--qolbox-accent, #ff6200);
          }

          .qolboxMenuInput {
            appearance: none;
            background: var(--qolbox-menu-input);
            border: 1px solid var(--qolbox-menu-border);
            border-radius: 3px;
            box-sizing: border-box;
            color: var(--qolbox-menu-text);
            font-family: inherit;
            font-size: 13px;
            height: 34px;
            line-height: 18px;
            margin: 0;
            min-height: 34px;
            min-width: 0;
            padding: 0 8px;
            width: 100%;
          }

          .qolboxMenuInput.invalid {
            border-color: #f05f57;
          }

          .qolboxMenuFieldError {
            color: #ffaaa4;
            font-size: 11px;
            line-height: 13px;
          }

          .qolboxMenuWarning,
          .qolboxMenuInfoBox {
            background: color-mix(in srgb, var(--qolbox-menu-control) 55%, transparent);
            border: 1px solid var(--qolbox-menu-separator);
            border-radius: 3px;
            color: var(--qolbox-menu-text);
            font-size: 11px;
            line-height: 14px;
            padding: 7px;
          }

          .qolboxMenuWarning {
            border-color: rgb(var(--qolbox-accent-rgb, 255 98 0) / 0.45);
          }

          .qolboxMenuNoteList {
            color: var(--qolbox-menu-text);
            font-size: 12px;
            line-height: 16px;
            margin: 5px 0 0;
            padding-left: 16px;
          }

          .qolboxMenuLoading {
            align-items: center;
            background: color-mix(in srgb, var(--qolbox-menu-control) 55%, transparent);
            border: 1px solid var(--qolbox-menu-separator);
            border-radius: 3px;
            color: var(--qolbox-menu-text);
            display: flex;
            font-size: 12px;
            gap: 9px;
            line-height: 16px;
            min-height: 58px;
            padding: 9px;
          }

          .qolboxMenuSpinner {
            animation: qolboxMenuSpin 0.8s linear infinite;
            border: 2px solid var(--qolbox-menu-separator);
            border-radius: 50%;
            border-top-color: var(--qolbox-accent, #ff6200);
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
            background: var(--qolbox-menu-input);
            border: 1px solid var(--qolbox-menu-border);
            border-radius: 3px;
            color: var(--qolbox-menu-text);
            display: flex;
            gap: 8px;
            font-size: 11px;
            font-weight: 700;
            line-height: 15px;
            min-height: 34px;
            padding: 0 9px;
            text-decoration: none;
          }

          .qolboxMenuCreditIcon {
            background: var(--qolbox-menu-separator);
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

          .qolboxReferenceBody {
            overflow: hidden;
          }

          .qolboxReferenceLayout {
            border: 1px solid var(--qolbox-menu-separator);
            display: grid;
            flex: 1 1 auto;
            grid-template-columns: 136px minmax(0, 1fr);
            min-height: 260px;
            overflow: hidden;
          }

          .qolboxReferenceTopics {
            border-right: 1px solid var(--qolbox-menu-separator);
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            min-width: 0;
            padding: 4px;
          }

          .qolboxReferenceTopic {
            align-items: center;
            background: transparent;
            border: 0;
            border-radius: 3px;
            box-sizing: border-box;
            color: var(--qolbox-menu-text);
            display: flex;
            font: inherit;
            line-height: 18px;
            min-height: 32px;
            padding: 0 8px;
            text-align: left;
            white-space: nowrap;
            width: 100%;
          }

          .qolboxReferenceTopic:hover {
            background: var(--qolbox-menu-control);
          }

          .qolboxReferenceTopic.active {
            background: var(--qolbox-accent, #ff6200);
            color: var(--qolbox-accent-contrast, #000000);
            font-weight: 700;
          }

          .qolboxReferenceDetail {
            min-width: 0;
            overflow: auto;
            padding: 4px 10px;
          }

          .qolboxReferenceEntry {
            align-items: baseline;
            border-bottom: 1px solid var(--qolbox-menu-separator);
            display: grid;
            gap: 10px;
            grid-template-columns: minmax(100px, 0.7fr) minmax(0, 1.3fr);
            padding: 8px 0;
          }

          .qolboxReferenceEntry:last-child {
            border-bottom: 0;
          }

          .qolboxReferenceEntry.wide {
            display: block;
          }

          .qolboxReferenceEntry.command {
            grid-template-columns: 170px minmax(0, 1fr);
          }

          .qolboxReferenceEntry.command > code {
            font-size: 10px;
            white-space: nowrap;
          }

          .qolboxReferenceEntry h2,
          .qolboxReferenceEntry p {
            font-size: 11px;
            line-height: 15px;
            margin: 0;
          }

          .qolboxReferenceEntry h2,
          .qolboxReferenceEntry > code {
            color: var(--qolbox-menu-strong);
            font-weight: 700;
          }

          .qolboxReferenceEntry p {
            color: var(--qolbox-menu-muted);
          }

          .qolboxReferenceEntry pre,
          .qolboxReferenceCodes code {
            background: var(--qolbox-menu-input);
            color: var(--qolbox-menu-text);
            font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
            font-size: 10px;
          }

          .qolboxReferenceEntry pre {
            margin: 6px 0 0;
            overflow: auto;
            padding: 8px;
            white-space: pre;
          }

          .qolboxReferenceCodes {
            display: flex;
            flex-wrap: wrap;
            gap: 4px;
            margin-top: 6px;
          }

          .qolboxReferenceCodes code {
            padding: 3px 5px;
          }

          @media (max-height: 620px) {
            .qolboxMenuPersistentHeader {
              padding: 9px 9px 0;
            }

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

            .qolboxThemeControls {
              align-items: stretch;
              grid-template-columns: 1fr;
            }

            .qolboxReferenceLayout {
              grid-template-columns: 1fr;
            }

            .qolboxReferenceTopics {
              border-bottom: 1px solid var(--qolbox-menu-separator);
              border-right: 0;
              display: grid;
              grid-template-columns: repeat(2, 1fr);
            }

            .qolboxSoundBankControls,
            .qolboxSoundBankReplace,
            .qolboxSoundReplacement {
              grid-template-columns: 1fr;
            }

            .qolboxSoundBankActions,
            .qolboxSoundReplacementActions {
              justify-content: stretch;
            }

            .qolboxSoundBankActions .qolboxMenuButton,
            .qolboxSoundReplacementActions .qolboxMenuButton {
              flex: 1;
            }

            .qolboxThemeLinkControls {
              justify-self: center;
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

          #editorContainer .sideBar .qolboxColorPicker:hover .tooltip {
            display: block;
          }

          #editorContainer.qolboxEditorPrecisionTool > canvas,
          #editorContainer.qolboxEditorMarquee > canvas {
            cursor: crosshair !important;
          }

          #editorContainer.qolboxEditorFillTool > canvas {
            cursor: url("./graphics/ui/format-color-fill.svg") 19 15, crosshair !important;
          }

          #editorContainer.qolboxColorPickerActive > canvas {
            cursor: var(--qolbox-editor-color-picker-cursor, crosshair) !important;
          }

          #editorContainer.qolboxEditorDragging > canvas {
            cursor: grabbing !important;
          }

          #editorContainer .sideBar > .qolboxHexInput {
            box-sizing: border-box;
            display: block;
            font-size: 8px;
            font-variant-numeric: tabular-nums;
            line-height: 10px;
            margin: 3px 0 2px;
            padding: 0;
            width: 36px;
          }

          #editorContainer .sideBar .qolboxHexPreview {
            margin-bottom: 0;
          }

          #editorContainer .paramContainer > .qolboxHexInput {
            font-size: 9px;
            font-variant-numeric: tabular-nums;
            width: 59px;
          }

          #editorContainer .qolboxHexInput[aria-invalid="true"] {
            color: #ffaaa4;
          }

          .editorPropertiesWindow .qolboxUngroupButton {
            cursor: pointer;
            font-family: inherit;
            font-size: 10px;
            font-weight: 700;
            line-height: 20px;
            margin: 0;
            min-height: 24px;
            padding: 1px 6px;
            position: absolute;
            right: 48px;
            top: 3px;
          }

          #editorContainer .qolboxEditorHelp .topLabel {
            box-sizing: border-box;
            cursor: pointer;
            height: 28px !important;
            line-height: 28px !important;
            min-height: 0;
            padding-bottom: 0;
            padding-top: 0;
          }

          .qolboxEditorHelpWindow {
            background: var(--qolbox-menu-panel) !important;
            color: var(--qolbox-menu-text) !important;
            cursor: auto;
            height: min(560px, calc(100vh - 40px));
            inset: 0;
            margin: auto;
            max-height: calc(100vh - 20px);
            max-width: calc(100vw - 20px);
            min-height: min(320px, calc(100vh - 20px));
            min-width: min(470px, calc(100vw - 20px));
            overflow: auto;
            padding: 0;
            position: fixed;
            resize: both;
            width: min(760px, calc(100vw - 40px));
          }

          #editorContainer .qolboxEditorHelp .topLabel[aria-expanded="true"] {
            background-color: var(--qolbox-game-accent, #4a7ab1);
            color: var(--qolbox-game-accent-contrast, #ffffff);
          }

          .qolboxEditorHelpWindow:not([open]) {
            display: none;
          }

          .qolboxEditorHelpWindow [hidden] {
            display: none !important;
          }

          .qolboxEditorHelpWindow::backdrop {
            background: rgba(0, 0, 0, 0.72);
          }

          .qolboxEditorHelpBody {
            height: 100%;
            overflow: hidden;
          }

          .qolboxEditorHelpWindow .contentDiv {
            display: grid;
            flex: 1 1 auto;
            grid-template-columns: minmax(7.5em, 30%) minmax(0, 1fr);
            min-height: 0;
            overscroll-behavior: contain;
            overflow: hidden;
          }

          .qolboxEditorHelpTopics {
            border-right: 1px solid var(--qolbox-menu-separator);
            display: flex;
            flex-direction: column;
            gap: 2px;
            overflow-y: auto;
            padding-right: 6px;
          }

          .qolboxEditorHelpTopic {
            background: transparent;
            border: 0;
            border-radius: 3px;
            color: var(--qolbox-menu-muted);
            cursor: pointer;
            flex: 0 0 auto;
            font: inherit;
            font-size: 12px;
            line-height: 15px;
            min-height: 30px;
            padding: 7px 8px;
            text-align: left;
            width: 100%;
          }

          .qolboxEditorHelpTopic:hover {
            background: var(--qolbox-menu-control);
          }

          .qolboxEditorHelpTopic[aria-selected="true"] {
            background: var(--qolbox-accent, #ff6200);
            color: var(--qolbox-accent-contrast, #000000);
          }

          .qolboxEditorHelpDetail {
            overflow-y: auto;
            padding: 8px 10px 8px 14px;
          }

          .qolboxEditorHelpEntry + .qolboxEditorHelpEntry {
            border-top: 1px solid var(--qolbox-menu-separator);
            margin-top: 12px;
            padding-top: 12px;
          }

          .qolboxEditorHelpDetail h2 {
            font-size: 16px;
            line-height: 20px;
            margin: 0 0 8px;
            text-wrap: balance;
          }

          .qolboxEditorHelpDetail p {
            color: var(--qolbox-menu-muted);
            font-size: 13px;
            line-height: 18px;
            margin: 0;
            text-wrap: pretty;
          }

          .qolboxEditorIntroProgress {
            align-self: center;
            color: var(--qolbox-menu-muted);
            font-size: 12px;
          }

          .qolboxEditorHelpBody.intro .qolboxEditorHelpClose {
            margin-right: auto;
          }

          #editorContainer .topMenu .container .qolboxMirrorItem {
            padding-right: 36px;
            position: relative;
          }

          #editorContainer .qolboxMirrorArrow {
            pointer-events: none;
            position: absolute;
            right: 12px;
          }

          #editorContainer .topMenu .container .qolboxMirrorSubmenu {
            left: 100%;
            top: -5px;
          }

          #editorContainer .qolboxMirrorItem:hover > .qolboxMirrorSubmenu,
          #editorContainer .qolboxMirrorItem:focus-within > .qolboxMirrorSubmenu,
          #editorContainer .qolboxMirrorItem.qolboxMirrorOpen > .qolboxMirrorSubmenu {
            display: block;
          }
        `;
      }

      // src/features/global-style-lobby-information.ts
      function getLobbyInformationGlobalStyleText() {
        return `
          .qolboxPlayerInfoOverlay {
            z-index: 2147483004;
          }

          .qolboxPlayerInfo.postGameContainer {
            box-shadow: none;
            height: 315px;
          }

          .qolboxPlayerInfo.postGameContainer .title {
            top: 20px;
          }

          .qolboxPlayerInfo.postGameContainer .position {
            top: 62px;
            overflow: hidden;
            padding: 0 28px;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .qolboxPlayerInfo.postGameContainer .xpGroup {
            top: 92px;
          }

          .qolboxPlayerInfo.postGameContainer .xpGroup .barInner {
            background-color: var(--qolbox-game-accent) !important;
          }

          .qolboxPlayerInfo.postGameContainer .xpGroup .qolboxPlayerInfoUnknownProgress {
            opacity: 0.48;
          }

          .qolboxPlayerInfoDetails {
            display: grid;
            font-size: 14px;
            font-style: normal;
            gap: 4px;
            left: 48px;
            position: absolute;
            right: 48px;
            top: 200px;
          }

          .qolboxPlayerInfoRow {
            display: grid;
            grid-template-columns: 105px minmax(0, 1fr);
            min-height: 18px;
          }

          .qolboxPlayerInfoLabel {
            color: #838385;
            text-align: left;
          }

          .qolboxPlayerInfoValue {
            color: #cccccc;
            overflow: hidden;
            text-align: right;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .qolboxPlayerInfo.postGameContainer .closeButton {
            bottom: 20px;
          }
        `;
      }

      // src/features/global-style-action-icons.ts
      function getActionIconographyGlobalStyleText() {
        return `
          .qolboxActionIcon {
            display: inline-block;
            flex: 0 0 auto;
            height: 1em;
            margin-right: 0.38em;
            pointer-events: none;
            vertical-align: -0.14em;
            width: 1em;
          }

          .qolboxIconOnlyAction {
            align-items: center;
            background-image: none !important;
            display: flex;
            justify-content: center;
          }

          .qolboxIconOnlyAction > .qolboxActionIcon {
            height: 18px;
            margin: 0;
            width: 18px;
          }

          .cornerButton .square.qolboxIconOnlyAction > .icon {
            display: none;
          }

          .cornerButton .square.qolboxIconOnlyAction > .qolboxActionIcon {
            height: 23px;
            transform: rotate(28deg);
            width: 23px;
          }

          .lobbyContainer .teamLockButton.qolboxIconOnlyAction > .qolboxActionIcon {
            height: 18px;
            width: 14px;
          }

          .lobbyContainer .teamLockButton.qolboxIconOnlyAction {
            right: calc(33.5% - 8px);
            width: 16px;
          }

          .lobbyContainer .teamLockButton.lockedClient,
          .lobbyContainer .teamLockButton.lockedHost {
            background-color: var(--qolbox-game-accent) !important;
            color: var(--qolbox-game-accent-contrast) !important;
          }

          .lobbyContainer .teamLockButton.lockedHost:hover {
            background-color: var(--qolbox-game-accent-hover) !important;
            color: var(--qolbox-game-accent-hover-contrast) !important;
          }

          .cosmeticWindow .optionsContainer .singleContainer:first-child {
            position: relative;
          }

          .cosmeticWindow .qolboxPlayerHexInput {
            background: var(--qolbox-ui-input, #303030);
            border: 1px solid var(--qolbox-ui-input-border, #6c6c6c);
            box-sizing: border-box;
            color: var(--qolbox-ui-text, #ebebeb);
            font: 10px/18px "Bai Jamjuree", sans-serif;
            height: 20px;
            padding: 0 3px;
            position: absolute;
            right: 0;
            text-align: center;
            top: 34px;
            width: 74px;
          }

          .cosmeticWindow .qolboxPlayerHexInput[aria-invalid="true"] {
            border-color: #be4242;
          }

          .mainMenuFancy .rightContainer .bigButton .qolboxMainActionText {
            align-items: center;
            column-gap: 0.16em;
            display: flex;
            justify-content: center;
          }

          .mainMenuFancy .rightContainer .bigButton .text > .qolboxActionIcon {
            height: 0.42em;
            margin: 0;
            position: static;
            transform: translateY(-0.02em);
            width: 0.42em;
          }

          .mainMenuFancy .rightContainer .bigButton .qolboxMainActionLabel {
            display: inline-block;
          }

          .mainMenuFancy .rightContainer .bigButton .bg.qp {
            width: 480px;
          }

          .mainMenuFancy .rightContainer .bigButton .bg.custom {
            width: 575px;
          }

          .mainMenuFancy .rightContainer .bigButton .bg.training {
            width: 592px;
          }

          .cornerButton .items {
            min-width: 180px;
            width: max-content;
          }

          .cornerButton .items .item {
            box-sizing: border-box;
            min-height: 34px;
            padding: 7px 8px;
            white-space: nowrap;
          }

          .cornerButton .items .qolboxActionIcon {
            filter: drop-shadow(1px 1px 1px #000);
          }

          .cornerButton .items .qolboxAudioMenuGroup {
            position: relative;
          }

          .cornerButton .items .qolboxAudioMenuArrow {
            display: inline-block;
            margin-left: 0.35em;
            transition: transform 100ms ease;
          }

          .cornerButton .items .qolboxAudioMenuGroup.open > .qolboxAudioMenuArrow {
            transform: rotate(90deg);
          }

          .cornerButton .items .qolboxAudioMenuOptions {
            display: none;
            font-weight: 400;
            opacity: 0.9;
          }

          .cornerButton .items .qolboxAudioMenuGroup.open > .qolboxAudioMenuOptions {
            display: block;
          }

          .cornerButton .items .qolboxAudioMenuOption {
            font-size: 0.9em;
            padding-left: 8px;
            padding-right: 20px;
          }

          .cornerButton .items.left .qolboxAudioMenuOption {
            padding-left: 20px;
            padding-right: 8px;
          }

          .cornerButton .items .qolboxAudioMenuOption.qolboxMusicMenuOption {
            display: block !important;
          }

          .lobbyContainer .settingsBox .settingsButton {
            font-size: 14px;
          }

          .roomListContainer .bottomButton.middle,
          .roomListContainer .bottomButton.news {
            width: 96px;
          }

          .roomListContainer .topBar > .qolboxActionIcon {
            margin-right: 0.45em;
            vertical-align: -0.16em;
          }

          .roomListContainer .tableHeader .element > .qolboxActionIcon {
            height: 0.85em;
            margin-right: 0.28em;
            vertical-align: -0.1em;
            width: 0.85em;
          }

          .mapListContainer .topBar > .qolboxActionIcon {
            margin-right: 0.45em;
            vertical-align: -0.16em;
          }

          .mapListContainer .dropdownContainer .element > .qolboxActionIcon,
          .mapListContainer .secondaryContainer .secondaryElement > .qolboxActionIcon {
            height: 0.9em;
            margin-right: 0.35em;
            vertical-align: -0.11em;
            width: 0.9em;
          }

          .mapListContainer .dropdownContainer .qolboxDropdownArrow {
            color: var(--qolbox-game-accent-contrast, #ffffff);
            margin: 0;
          }

          .roomListContainer .qolboxRoomPasswordIcon {
            color: inherit;
            height: 15px;
            margin: 0;
            vertical-align: -2px;
            width: 13px;
          }

          .qolboxStatusIcon {
            flex: 0 0 auto;
            height: 16px;
            margin: 0;
            width: 16px;
          }

          .qolboxStatusLines {
            align-items: center;
            column-gap: 8px;
            display: grid;
            grid-template-columns: 16px minmax(0, 1fr);
            justify-content: center;
            margin: 0 auto;
            max-width: 100%;
            width: max-content;
          }

          .qolboxStatusLine {
            display: contents;
          }

          .qolboxStatusSeparator {
            display: none;
          }

          .qolboxStatusIconSpacer {
            width: 16px;
          }

          .qolboxStatusLabel {
            min-width: 0;
            overflow-wrap: anywhere;
            text-align: left;
            white-space: normal;
          }

          .mapListContainer .thumb > .qolboxMapPreviewPlaceholder {
            display: block;
            height: 28px;
            margin: auto;
            opacity: 0.45;
            width: 28px;
          }

          #editorContainer .topMenu .topLabel > .qolboxActionIcon {
            vertical-align: -0.16em;
          }

          #editorContainer .topMenu .container .item > .qolboxActionIcon {
            margin-left: -8px;
          }

          .qolboxMenuButton .qolboxActionIcon,
          .qolboxMenuTab .qolboxActionIcon,
          .qolboxMenuChoice .qolboxActionIcon,
          .qolboxMenuFeatureName > .qolboxActionIcon {
            height: 14px;
            width: 14px;
          }

          .qolboxEditorHelpTopic .qolboxActionIcon {
            height: 14px;
            width: 14px;
          }

          .qolboxReferenceTopic > .qolboxActionIcon {
            height: 14px;
            margin-right: 6px;
            width: 14px;
          }

          @media (prefers-reduced-motion: reduce) {
            .cornerButton .items .qolboxAudioMenuArrow {
              transition: none;
            }
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

          :is(:disabled, [disabled], [aria-disabled="true"], .disabled, .unlockedClient, .lockedClient, .beenDeleted),
          :is(:disabled, [disabled], [aria-disabled="true"], .disabled, .unlockedClient, .lockedClient, .beenDeleted) *,
          :is([aria-readonly="true"], [readonly]),
          :is([aria-readonly="true"], [readonly]) * {
            cursor: not-allowed !important;
          }

          :is([aria-disabled="true"], .disabled, .unlockedClient, .lockedClient, .beenDeleted) {
            pointer-events: auto !important;
          }

          html[data-qolbox-color-scheme="light"]
          :is(:disabled, [disabled], [aria-disabled="true"], .disabled, .unlockedClient, .lockedClient, .beenDeleted) {
            filter: none !important;
            opacity: 0.58 !important;
          }

          .mainMenuFancy .rightContainer .bigButton:focus-visible {
            outline: none;
          }

          .mainMenuFancy .rightContainer .bigButton:focus-visible .bg {
            background-color: var(--qolbox-game-accent-focus, #5a8ac1);
          }

          .mapListContainer .mapsContainer .descriptionDiv span {
            max-height: 100%;
            overflow-y: auto;
          }

          .lobbyContainer .settingsBox .mapTextContainer .description {
            overflow-y: auto;
          }

          .lobbyContainer .voteSpan:not(:empty) {
            cursor: pointer;
          }

          ${getLobbyInformationGlobalStyleText()}

          ${getActionIconographyGlobalStyleText()}

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
        if (!replaceNativeReflectProperty(target, "emit", wrappedReserveEmit)) {
          return false;
        }
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
            socketHookInstalled = true;
          } catch {
            const ioValue = readNativeReflectProperty(window, "io");
            if (ioValue) {
              socketHookInstalled = replaceNativeReflectProperty(window, "io", patchIo(ioValue));
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
          options.clearReserveSelectedRoom();
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
            options.stopReserveSpot({ clearSelection: true, hideNative: true });
            return;
          }
          const cancelButton = options.getNativeConnectingWindows().map((windowElement) => windowElement.querySelector(".cancelButton")).find(Boolean);
          if (cancelButton) {
            clickReserveElement(cancelButton);
          }
          options.stopReserveSpot({ hideNative: true });
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
        function clearReserveSelectedRoom() {
          selectedRow = null;
          selectedSignature = "";
          selectedWasFull = false;
          selectedWasUnavailable = false;
        }
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
          clearReserveSelectedRoom,
          getReserveSelectedRoomRow,
          getReserveSelectedRoomState,
          rememberReserveSelectedRoom
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
        let roomFullSuppressedUntil = 0;
        let retryAudioSuppressedUntil = 0;
        let statusWatchTimer = 0;
        let countdownTimer = 0;
        let domEventsInstalled = false;
        function isReserveJoinedRoomFullSuppressed() {
          return Date.now() < roomFullSuppressedUntil;
        }
        function suppressReserveRoomFullAfterJoin() {
          roomFullSuppressedUntil = Date.now() + RESERVE_JOINED_ROOM_FULL_SUPPRESS_MS;
        }
        function isReserveRetryAudioSuppressed() {
          return Date.now() < retryAudioSuppressedUntil;
        }
        function suppressReserveRetryAudio() {
          retryAudioSuppressedUntil = Date.now() + RESERVE_RETRY_AUDIO_SUPPRESS_MS;
        }
        function clearReserveStatusWatchTimer() {
          window.clearTimeout(statusWatchTimer);
          statusWatchTimer = 0;
        }
        function scheduleReserveStatusWatch(delay = 250) {
          if (statusWatchTimer) {
            return;
          }
          statusWatchTimer = window.setTimeout(() => {
            statusWatchTimer = 0;
            handleReserveConnectingState();
            if (shouldContinueReserveStatusWatch()) {
              scheduleReserveStatusWatch(delay);
            }
          }, delay);
        }
        function clearReserveCountdownTimer() {
          window.clearTimeout(countdownTimer);
          countdownTimer = 0;
        }
        function scheduleReserveCountdownUpdate() {
          if (countdownTimer || !getReserveState()?.active) {
            return;
          }
          countdownTimer = window.setTimeout(() => {
            countdownTimer = 0;
            if (getReserveState()?.active) {
              updateReserveWaitingWindow();
              scheduleReserveCountdownUpdate();
            }
          }, RESERVE_COUNTDOWN_UPDATE_MS);
        }
        const {
          clearReserveSelectedRoom,
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
          clearReserveSelectedRoom,
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
        function installReserveDomEventHooks() {
          if (domEventsInstalled) {
            return;
          }
          domEventsInstalled = true;
          document.addEventListener("click", handleReserveRoomListClick, true);
          document.addEventListener("dblclick", handleReserveRoomListDoubleClick, true);
          document.addEventListener("click", handleReservePasswordSubmit, true);
          window.addEventListener("keyup", handleReservePasswordKey, true);
        }
        function shouldContinueReserveStatusWatch() {
          return Boolean(
            getReserveState()?.active || isReserveJoinedRoomFullSuppressed() || shouldWatchRecentReserveCapture()
          );
        }
        function patchReserveSpotFeature() {
          if (!options.isReserveEnabled()) {
            syncReserveJoinButtonLabel();
            return;
          }
          installReserveSocketCaptureHook();
          syncReserveJoinButtonLabel();
          syncReservePasswordPrompt();
          handleReserveConnectingState();
          installReserveDomEventHooks();
        }
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
          return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
        });
        const [red = 0, green = 0, blue = 0] = channels;
        return red * 0.2126 + green * 0.7152 + blue * 0.0722;
      }
      function getContrastRatio2(left, right) {
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
        return getContrastRatio2(dark, background) >= getContrastRatio2(light, background) ? dark : light;
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
            const effectiveCurrentColor = currentColor && currentColor.alpha < 1 ? blendRgbColors(currentColor, background) : currentColor;
            if (effectiveCurrentColor && getContrastRatio2(effectiveCurrentColor, background) >= MIN_SCORE_TEXT_CONTRAST) {
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
        if (!isCallable(nativeTypingPulse)) {
          return false;
        }
        const wrappedTypingPulse = function wrappedTypingPulse2(playerId, ...rest) {
          onTypingPulse(playerId);
          return Reflect.apply(nativeTypingPulse, this, [playerId, ...rest]);
        };
        if (!replaceNativeReflectProperty(lobbyUi, "$W", wrappedTypingPulse)) {
          return false;
        }
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
          const installed2 = installNativeTypingPulseHook(session, notePlayerTyping);
          if (installed2) {
            typingIndicatorSession = session;
          }
          return installed2;
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

      // src/features/editor-reference.ts
      var EDITOR_REFERENCE_SECTIONS = [
        ["Clipboard", [
          ["Copy selected objects", "Select one or more objects and press Ctrl+C. Every copyable object is copied together, preserving the spacing between them."],
          ["Delete selected objects", "Press Delete to remove every selected object in one undoable operation."],
          ["Paste copied objects", "Press Ctrl+V to paste the copied objects at their original spacing. The new copies are selected immediately."],
          ["Undo and redo", "Press Ctrl+Z to undo and Ctrl+Y to redo editor changes, including multi-object operations."]
        ]],
        ["Colors", [
          ["Background colors", "Open BG, then enter #RGB or #RRGGBB below Top Color or Bot Color to set an exact map background color."],
          ["Color picker", "Select one or more objects, press I, then click an object's fill or outline. The sampled color is applied to every compatible selected object and becomes the active paint color."],
          ["Exact paint colors", "Enter #RGB or #RRGGBB below Color or Stroke to set an exact color."],
          ["Mixed paint colors", "When selected objects use different colors, the Color and Stroke swatches split into equal slices for each distinct color and the matching hex field shows Mixed."]
        ]],
        ["Groups", [
          ["Merged groups", "Select bodies and choose Tools → Merge Shapes. The bodies remain separate internally, but normal selection, movement, rotation, clipboard actions, and compatible properties treat them as one group."],
          ["Subbody editing", "Ctrl-click a member of a merged group directly to select only that body. Its dashed red outline identifies the special selection; dragging and property changes affect only that subbody."],
          ["Ungroup a subbody", "With a subbody selected, choose Ungroup in Subbody Properties to detach it while leaving the rest of the group intact."]
        ]],
        ["Maps", [
          ["Editor Save", "Enable Editor Save in QOLBox Features to keep Hitbox's native Save action available after loading a map."],
          ["Export maps", "Choose File → Export to download the current map to your computer."],
          ["Import maps", "Choose File → Import to load a compact .hitboxmap file, readable JSON, or compatible text map from your computer. QOLBox validates the data and restores the previous map if loading fails."],
          ["Readable exports", "Enable Readable map exports in QOLBox Advanced settings to export formatted JSON instead of compact map data."]
        ]],
        ["Selection", [
          ["Area selection", "With Select active, drag from empty map space to select every object touched by the bright box. Hold Shift or Ctrl while dragging to toggle those objects instead."],
          ["Compatible properties", "When selected objects have different types, a property or paint change applies only to objects that support it; unsupported objects stay unchanged."],
          ["Mixed values", "Mixed means the selected objects currently have different values for that property. Enter or choose a value to apply it to every compatible object."],
          ["Modifier selection", "Shift-click or Ctrl-click an object to add it to the current selection or remove it."],
          ["Move selections", "Drag any selected object to move the complete selection by the same snapped offset."],
          ["Object IDs", "ID labels remain visible for every selected object that has one, making related objects easier to identify."]
        ]],
        ["Transform", [
          ["Mirror", "Select one or more objects, then open Tools → Mirror and choose Horizontal or Vertical. One object mirrors in place; a selection mirrors together around its shared center."],
          ["Relative values", "Enter =+3 or =-3 in a numeric property to change each compatible object by that amount while preserving the differences between their current values."]
        ]]
      ];

      // src/features/editor-help.ts
      var EDITOR_INTRO_COMPLETE_KEY = "vm.hitbox.qolboxEditorIntro.v3";
      function shouldShowEditorIntro() {
        try {
          return localStorage.getItem(EDITOR_INTRO_COMPLETE_KEY) !== "true";
        } catch {
          return false;
        }
      }
      function markEditorIntroComplete() {
        try {
          localStorage.setItem(EDITOR_INTRO_COMPLETE_KEY, "true");
        } catch {
        }
      }
      function positionEditorHelp(menu, settings) {
        const nativeMenu = settings.closest(".topMenu");
        menu.style.zoom = nativeMenu?.style.zoom || (nativeMenu ? getComputedStyle(nativeMenu).zoom : "");
        const left = settings.offsetLeft + settings.offsetWidth;
        menu.style.left = `${left}px`;
        const settingsBounds = settings.getBoundingClientRect();
        const menuBounds = menu.getBoundingClientRect();
        const scale = settings.offsetWidth ? settingsBounds.width / settings.offsetWidth : 1;
        if (Number.isFinite(scale) && scale > 0) {
          menu.style.left = `${left - (menuBounds.left - settingsBounds.right) / scale}px`;
        }
      }
      function installEditorHelp() {
        const editor = document.querySelector("#editorContainer");
        const settings = editor?.querySelector(".settingsMenu");
        if (!editor || !settings) return;
        const existing = editor.querySelector(".qolboxEditorHelp");
        const existingPanel = editor.querySelector(".qolboxEditorHelpWindow");
        if (existing && existingPanel) {
          positionEditorHelp(existing, settings);
          if (editor.offsetParent && existingPanel.dataset.qolboxIntroPending === "true") {
            existing.querySelector(":scope > .topLabel")?.click();
          }
          return;
        }
        existing?.remove();
        existingPanel?.remove();
        const menu = document.createElement("div");
        menu.className = "topMenu qolboxEditorHelp";
        const label = document.createElement("div");
        label.className = "topLabel";
        label.append(document.createTextNode("Help"));
        label.dataset.qolboxIcon = "circle-help";
        label.tabIndex = 0;
        label.setAttribute("role", "button");
        label.setAttribute("aria-haspopup", "dialog");
        label.setAttribute("aria-expanded", "false");
        menu.appendChild(label);
        const panel = document.createElement("dialog");
        panel.className = "qolboxMenuPanel qolboxEditorHelpWindow";
        panel.setAttribute("aria-label", "QOLBox Editor Help");
        const body = document.createElement("div");
        body.className = "qolboxMenuBody qolboxEditorHelpBody";
        const header = document.createElement("div");
        header.className = "qolboxMenuHeaderLine";
        const title = document.createElement("h1");
        title.className = "qolboxMenuTitle";
        title.textContent = "QOLBox Editor Help";
        header.appendChild(title);
        const close = document.createElement("button");
        close.className = "qolboxMenuButton qolboxEditorHelpClose";
        close.type = "button";
        close.textContent = "Close";
        close.setAttribute("aria-label", "Close editor help");
        const content = document.createElement("div");
        content.className = "contentDiv qolboxEditorHelpReference";
        content.setAttribute("aria-label", "QOLBox editor features");
        content.addEventListener("wheel", (event) => event.stopPropagation());
        const sections = EDITOR_REFERENCE_SECTIONS;
        const topics = document.createElement("div");
        topics.className = "qolboxEditorHelpTopics";
        topics.setAttribute("aria-label", "Editor features");
        topics.setAttribute("aria-orientation", "vertical");
        topics.setAttribute("role", "tablist");
        const detail = document.createElement("div");
        detail.className = "qolboxEditorHelpDetail";
        detail.id = "qolboxEditorHelpDetail";
        detail.setAttribute("role", "tabpanel");
        detail.tabIndex = 0;
        const topicButtons = [];
        let activeTopic = 0;
        let introActive = shouldShowEditorIntro();
        panel.dataset.qolboxIntroPending = String(introActive);
        let updateIntroControls = () => {
        };
        const selectTopic = (index, focus = false) => {
          activeTopic = Math.max(0, Math.min(sections.length - 1, index));
          const [, entries] = sections[activeTopic];
          const fragment = document.createDocumentFragment();
          for (const [entryTitle, description] of entries) {
            const entry = document.createElement("section");
            entry.className = "qolboxEditorHelpEntry";
            const heading = document.createElement("h2");
            heading.textContent = entryTitle;
            const text = document.createElement("p");
            text.textContent = description;
            entry.append(heading, text);
            fragment.appendChild(entry);
          }
          detail.replaceChildren(fragment);
          topicButtons.forEach((button2, buttonIndex) => {
            const selected = buttonIndex === activeTopic;
            button2.setAttribute("aria-selected", String(selected));
            button2.tabIndex = selected ? 0 : -1;
          });
          const button = topicButtons[activeTopic];
          if (button) {
            detail.setAttribute("aria-labelledby", button.id);
            if (focus) {
              button.focus({ preventScroll: true });
              button.scrollIntoView({ block: "nearest" });
            }
          }
          updateIntroControls();
        };
        sections.forEach(([topic], index) => {
          const button = document.createElement("button");
          button.className = "qolboxEditorHelpTopic";
          button.id = `qolboxEditorHelpTopic${index}`;
          button.type = "button";
          button.setAttribute("aria-controls", detail.id);
          button.setAttribute("role", "tab");
          button.textContent = topic;
          button.addEventListener("click", () => selectTopic(index));
          button.addEventListener("keydown", (event) => {
            let next2 = index;
            if (event.key === "ArrowUp") next2 = (index + sections.length - 1) % sections.length;
            else if (event.key === "ArrowDown") next2 = (index + 1) % sections.length;
            else if (event.key === "Home") next2 = 0;
            else if (event.key === "End") next2 = sections.length - 1;
            else return;
            event.preventDefault();
            selectTopic(next2, true);
          });
          topicButtons.push(button);
          topics.appendChild(button);
        });
        content.append(topics, detail);
        const actions = document.createElement("div");
        actions.className = "qolboxMenuActions";
        const progress = document.createElement("span");
        progress.className = "qolboxEditorIntroProgress";
        const back = document.createElement("button");
        back.className = "qolboxMenuButton qolboxEditorIntroBack";
        back.type = "button";
        back.textContent = "Back";
        const next = document.createElement("button");
        next.className = "qolboxMenuButton primary qolboxEditorIntroNext";
        next.type = "button";
        updateIntroControls = () => {
          body.classList.toggle("intro", introActive);
          title.textContent = introActive ? "Improved Editor" : "QOLBox Editor Help";
          close.textContent = introActive ? "Skip" : "Close";
          close.classList.toggle("primary", !introActive);
          progress.hidden = !introActive;
          back.hidden = !introActive;
          next.hidden = !introActive;
          progress.textContent = `${activeTopic + 1} of ${sections.length}`;
          back.disabled = activeTopic === 0;
          next.textContent = activeTopic === sections.length - 1 ? "Done" : "Next";
        };
        actions.append(close, progress, back, next);
        selectTopic(0);
        body.append(header, content, actions);
        panel.append(body);
        editor.append(menu, panel);
        positionEditorHelp(menu, settings);
        const setOpen = (open) => {
          if (open) {
            if (!panel.open) panel.showModal();
          } else if (panel.open) panel.close();
          label.setAttribute("aria-expanded", String(open));
          if (open) selectTopic(activeTopic, true);
          else label.focus();
        };
        label.addEventListener("click", () => {
          if (!panel.open && introActive) {
            panel.dataset.qolboxIntroPending = "false";
            markEditorIntroComplete();
          }
          setOpen(!panel.open);
        });
        label.addEventListener("keydown", (event) => {
          if (event.key !== "Enter" && event.key !== " ") return;
          event.preventDefault();
          setOpen(!panel.open);
        });
        const finishIntro = () => {
          if (introActive) {
            introActive = false;
            markEditorIntroComplete();
            updateIntroControls();
          }
          setOpen(false);
        };
        close.addEventListener("click", finishIntro);
        back.addEventListener("click", () => selectTopic(activeTopic - 1, true));
        next.addEventListener("click", () => {
          if (activeTopic < sections.length - 1) selectTopic(activeTopic + 1, true);
          else finishIntro();
        });
        panel.addEventListener("keydown", (event) => {
          if (event.key === "Escape") {
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

      // src/hitbox/editor-property-paths.ts
      var EDITOR_PROPERTY_PATHS = {
        "Activated by Capture Zone": [["Nr"]],
        "Angle": [["angle"]],
        "Angular Damping": [["angularDamping"]],
        "Apply Force: X": [["Dr"]],
        "Apply Force: Y": [["Lr"]],
        "Apply Torque": [["Ur"]],
        "Attach body ID": [["vl"]],
        "Blue Team Uses": [["Qn", 3]],
        "Bounciness": [["restitution"]],
        "Bullet": [["bullet"]],
        "Bullet Density": [["bullet", "density"]],
        "Bullet Explosion Radius": [["bullet", "M"]],
        "Bullet hit damage": [["bullet", "g"]],
        "Bullet Homing Speed": [["bullet", "S"]],
        "Bullet Max Age": [["bullet", "m"]],
        "Bullet Size": [["bullet", "u"]],
        "Bullet Speed": [["bullet", "o"]],
        "Bullets Bounce": [["bullet", "T"]],
        "Capture Time": [["Vu"]],
        "Circle Radius": [["ra"]],
        "Collide Category": [["Gr"]],
        "Collide connected": [["collideConnected"]],
        "Collide with A": [["Hr"]],
        "Collide with B": [["zr"]],
        "Collide with C": [["Yr"]],
        "Collide with D": [["qr"]],
        "Collide with Players": [["Vr"]],
        "Collide with Rockets": [["Kr"]],
        "Connect to": [["Da"]],
        "Density": [["density"]],
        "Distance Damping": [["ja"]],
        "Distance Length": [["Wa"]],
        "Draw Line": [["Ha"]],
        "FFA Uses": [["Qn", 1]],
        "Fire Rate": [["Cl"]],
        "Fixed Rotation": [["fixedRotation"]],
        "Force Zone": [["Ar"]],
        "Force Zone: X": [["Or"]],
        "Force Zone: Y": [["Rr"]],
        "Freeze players": [["Xr"]],
        "Friction": [["friction"]],
        "Health": [["Nl"], ["qe"]],
        "Initial Spawn Time": [["Hu"]],
        "Invisible": [["Qr"]],
        "Kill players": [["_r"]],
        "Linear Damping": [["linearDamping"]],
        "Motion Type": [["Pr"]],
        "Motor Max Speed": [["motorSpeed"]],
        "Motor Power": [["Ja"]],
        "Motor Type": [["za"]],
        "No Jump": [["Zr"]],
        "No Physics (Scenery)": [["Jr"]],
        "Objective": [["sa"]],
        "Objective Target": [["ha"]],
        "Offset X": [["x"]],
        "Offset Y": [["y"]],
        "Other Body ID": [["Da"]],
        "Override Density": [["density"]],
        "Parallax Amount": [["$r"]],
        "Quantity": [["Gu"]],
        "Range": [["range"]],
        "Red Team Uses": [["Qn", 2]],
        "Respawn Time": [["zu"]],
        "Sequence ID": [["Mr"]],
        "Spring Strength": [["Ua"]],
        "Starting Angular Velocity": [["angularVelocity"]],
        "Starting X Velocity": [["o"]],
        "Starting Y Velocity": [["l"]],
        "Team": [["N"]],
        "Unaffected by abilities/weapons": [["ia"]],
        "Width": [["width"]],
        "Wrap Position": [["Er"]],
        "X": [["x"]],
        "X Position": [["x"]],
        "Y": [["y"]],
        "Y Position": [["y"]],
        "Z Index": [["zIndex"]]
      };

      // src/hitbox/editor-zoom-safety.ts
      var EDITOR_ZOOM_STEP = 1.1;
      var FALLBACK_EDITOR_TEXTURE_SIZE = 4096;
      var MAX_EDITOR_GRID_TEXTURE_SIZE = 4096;
      var zoomRenderersByHost = /* @__PURE__ */ new WeakMap();
      var mapFitZoomRenderers = /* @__PURE__ */ new WeakSet();
      var pendingMapFitZoom = /* @__PURE__ */ new WeakMap();
      var callMethod = callNativeMethodSafely;
      function readDeviceTextureLimit(renderer) {
        const gl = readNativePath(renderer, ["Ag", "gl"]);
        const getParameter = readNativeProperty(gl, "getParameter");
        let limit = Infinity;
        if (!isNativeObject(gl) || typeof getParameter !== "function") return FALLBACK_EDITOR_TEXTURE_SIZE;
        for (const property of ["MAX_TEXTURE_SIZE", "MAX_RENDERBUFFER_SIZE"]) {
          const parameter = readNativeProperty(gl, property);
          if (typeof parameter !== "number") continue;
          try {
            const value = Number(Reflect.apply(getParameter, gl, [parameter]));
            if (Number.isFinite(value) && value > 0) limit = Math.min(limit, value);
          } catch {
          }
        }
        return Number.isFinite(limit) ? limit : FALLBACK_EDITOR_TEXTURE_SIZE;
      }
      function readGradientCanvasHeight(renderer) {
        const graphicsData = readNativePath(renderer, ["gg", "Ac", "geometry", "graphicsData"]);
        if (!Array.isArray(graphicsData)) return 0;
        for (const item of graphicsData) {
          const source = readNativePath(item, ["fillStyle", "texture", "baseTexture", "resource", "source"]);
          const width = Number(readNativeProperty(source, "width"));
          const height = Number(readNativeProperty(source, "height"));
          if (width === 64 && Number.isFinite(height) && height > 0 && typeof readNativeProperty(source, "getContext") === "function") {
            return height;
          }
        }
        return 0;
      }
      function shouldBlockEditorZoomIn(renderer) {
        const deviceLimit = readDeviceTextureLimit(renderer);
        const scale = Number(readNativePath(renderer, ["Bc", "scale"]));
        const resolution = Number(readNativePath(renderer, ["Ag", "resolution"])) || 1;
        const gradientHeight = readGradientCanvasHeight(renderer);
        return Number.isFinite(scale) && (scale * EDITOR_ZOOM_STEP - 1) * resolution > Math.min(deviceLimit, MAX_EDITOR_GRID_TEXTURE_SIZE) || gradientHeight * EDITOR_ZOOM_STEP > deviceLimit;
      }
      function installEditorZoomSafety(renderer) {
        const host = getRendererHost(renderer);
        if (!host || host.id !== "editorContainer") return;
        if (zoomRenderersByHost.has(host)) {
          zoomRenderersByHost.set(host, renderer);
          return;
        }
        zoomRenderersByHost.set(host, renderer);
        host.addEventListener("wheel", (event) => {
          const wheelEvent = event;
          const currentRenderer = zoomRenderersByHost.get(host);
          if (wheelEvent.deltaY >= 0 || !currentRenderer || !shouldBlockEditorZoomIn(currentRenderer)) return;
          wheelEvent.preventDefault();
          wheelEvent.stopImmediatePropagation();
        }, { capture: true, passive: false });
      }
      function installEditorMapFitZoom(renderer, onMapFit) {
        if (mapFitZoomRenderers.has(renderer)) return;
        const resetCamera = readNativeProperty(renderer, "Fg");
        const fitMap = readNativeProperty(renderer, "Qg");
        if (typeof resetCamera !== "function" || typeof fitMap !== "function") return;
        mapFitZoomRenderers.add(renderer);
        setNativeReflectProperty(renderer, "Fg", function(...args) {
          const zoom = Number(getLastRendererDrawArguments(this)?.[1]);
          if (Number.isFinite(zoom) && zoom > 0) pendingMapFitZoom.set(this, zoom);
          queueMicrotask(() => pendingMapFitZoom.delete(this));
          return Reflect.apply(resetCamera, this, args);
        });
        setNativeReflectProperty(renderer, "Qg", function(...args) {
          const result = Reflect.apply(fitMap, this, args);
          if (pendingMapFitZoom.has(this)) onMapFit();
          const zoom = pendingMapFitZoom.get(this);
          pendingMapFitZoom.delete(this);
          const draw = readNativeProperty(this, "Dg");
          if (zoom && typeof draw === "function") {
            const map = getLastRendererDrawArguments(this)?.[0] ?? args[0];
            callMethod(this, "Ig", [1 / zoom]);
            Reflect.apply(draw, this, [map, zoom]);
          }
          return result;
        });
      }

      // src/hitbox/editor-geometry.ts
      function polygonContainsPoint(points, x, y) {
        let inside = false;
        for (let index = 0, previous = points.length - 2; index < points.length; previous = index, index += 2) {
          const ax = points[previous] ?? 0;
          const ay = points[previous + 1] ?? 0;
          const bx = points[index] ?? 0;
          const by = points[index + 1] ?? 0;
          const cross = (x - ax) * (by - ay) - (y - ay) * (bx - ax);
          if (Math.abs(cross) < 1e-3 && (x - ax) * (x - bx) + (y - ay) * (y - by) <= 0) return true;
          if (ay > y !== by > y && x < (bx - ax) * (y - ay) / (by - ay) + ax) inside = !inside;
        }
        return inside;
      }
      function polygonsIntersect(left, right) {
        const vertices = (points) => Array.from({ length: points.length / 2 }, (_, index) => ({
          x: points[index * 2] ?? 0,
          y: points[index * 2 + 1] ?? 0
        }));
        const leftVertices = vertices(left);
        const rightVertices = vertices(right);
        if (leftVertices.some((point) => polygonContainsPoint(right, point.x, point.y)) || rightVertices.some((point) => polygonContainsPoint(left, point.x, point.y))) return true;
        const edgesCross = (firstStart, firstEnd, secondStart, secondEnd) => {
          const firstX = firstEnd.x - firstStart.x;
          const firstY = firstEnd.y - firstStart.y;
          const secondX = secondEnd.x - secondStart.x;
          const secondY = secondEnd.y - secondStart.y;
          const denominator = firstX * secondY - firstY * secondX;
          if (Math.abs(denominator) < 1e-6) return false;
          const offsetX = secondStart.x - firstStart.x;
          const offsetY = secondStart.y - firstStart.y;
          const firstDistance = (offsetX * secondY - offsetY * secondX) / denominator;
          const secondDistance = (offsetX * firstY - offsetY * firstX) / denominator;
          return firstDistance >= 0 && firstDistance <= 1 && secondDistance >= 0 && secondDistance <= 1;
        };
        return leftVertices.some((start, index) => {
          const end = leftVertices[(index + 1) % leftVertices.length];
          return rightVertices.some(
            (otherStart, otherIndex) => edgesCross(start, end, otherStart, rightVertices[(otherIndex + 1) % rightVertices.length])
          );
        });
      }
      function offsetPolygon(points, distance) {
        const vertices = Array.from({ length: points.length / 2 }, (_, index) => ({
          x: points[index * 2] ?? 0,
          y: points[index * 2 + 1] ?? 0
        }));
        if (vertices.length < 3) return [];
        const area = vertices.reduce((sum, point, index) => {
          const next = vertices[(index + 1) % vertices.length];
          return sum + point.x * next.y - next.x * point.y;
        }, 0);
        if (!Number.isFinite(area) || Math.abs(area) < 1e-6) return [];
        const normal = (from, to) => {
          const x = to.x - from.x;
          const y = to.y - from.y;
          const length = Math.hypot(x, y);
          if (!length) return null;
          return area > 0 ? { x: y / length, y: -x / length } : { x: -y / length, y: x / length };
        };
        return vertices.flatMap((point, index) => {
          const previous = vertices[(index + vertices.length - 1) % vertices.length];
          const next = vertices[(index + 1) % vertices.length];
          const previousNormal = normal(previous, point);
          const nextNormal = normal(point, next);
          if (!previousNormal || !nextNormal) return [point.x, point.y];
          const previousDirection = { x: point.x - previous.x, y: point.y - previous.y };
          const nextDirection = { x: next.x - point.x, y: next.y - point.y };
          const first = { x: point.x + previousNormal.x * distance, y: point.y + previousNormal.y * distance };
          const second = { x: point.x + nextNormal.x * distance, y: point.y + nextNormal.y * distance };
          const denominator = previousDirection.x * nextDirection.y - previousDirection.y * nextDirection.x;
          if (Math.abs(denominator) > 1e-6) {
            const t = ((second.x - first.x) * nextDirection.y - (second.y - first.y) * nextDirection.x) / denominator;
            const intersection = { x: first.x + previousDirection.x * t, y: first.y + previousDirection.y * t };
            if (Math.hypot(intersection.x - point.x, intersection.y - point.y) <= distance * 8) {
              return [intersection.x, intersection.y];
            }
          }
          const sum = { x: previousNormal.x + nextNormal.x, y: previousNormal.y + nextNormal.y };
          const length = Math.hypot(sum.x, sum.y) || 1;
          return [point.x + sum.x / length * distance, point.y + sum.y / length * distance];
        });
      }
      function rotatePoint(point, angle) {
        const cosine = Math.cos(angle);
        const sine = Math.sin(angle);
        return { x: point.x * cosine - point.y * sine, y: point.x * sine + point.y * cosine };
      }
      function getPointBounds(points) {
        if (!points.length) return null;
        const xs = points.map((point) => point.x);
        const ys = points.map((point) => point.y);
        const x = Math.min(...xs);
        const y = Math.min(...ys);
        return { height: Math.max(...ys) - y, width: Math.max(...xs) - x, x, y };
      }
      function getArea(start, end) {
        return {
          height: Math.abs(end.y - start.y),
          width: Math.abs(end.x - start.x),
          x: Math.min(start.x, end.x),
          y: Math.min(start.y, end.y)
        };
      }
      function areasIntersect(left, right) {
        return left.x <= right.x + right.width && left.x + left.width >= right.x && left.y <= right.y + right.height && left.y + left.height >= right.y;
      }
      function distanceToPolygon(points, point) {
        let distance = Infinity;
        for (let index = 0; index < points.length; index += 2) {
          const next = (index + 2) % points.length;
          const ax = points[index] ?? 0;
          const ay = points[index + 1] ?? 0;
          const bx = points[next] ?? 0;
          const by = points[next + 1] ?? 0;
          const dx = bx - ax;
          const dy = by - ay;
          const lengthSquared = dx * dx + dy * dy;
          const t = lengthSquared ? Math.max(0, Math.min(1, ((point.x - ax) * dx + (point.y - ay) * dy) / lengthSquared)) : 0;
          distance = Math.min(distance, Math.hypot(point.x - ax - dx * t, point.y - ay - dy * t));
        }
        return distance;
      }

      // src/hitbox/editor-selection-adapter.ts
      function isNativeFunction2(value) {
        return typeof value === "function";
      }
      var POINTER_LISTENER_MARKER = /* @__PURE__ */ Symbol("qolboxEditorSelectionCapture");
      var CAMERA_MOVE_MARKER = /* @__PURE__ */ Symbol("qolboxEditorCameraMoveGuard");
      var PROPERTY_HANDLER_MARKER = /* @__PURE__ */ Symbol("qolboxEditorSelectionProperty");
      var MIXED_OPTION_VALUE = "__qolbox_mixed__";
      var MARQUEE_DRAG_THRESHOLD_PX = 4;
      var EDITOR_OUTLINE_PADDING_PX = 5;
      var inputOwnershipWindows = /* @__PURE__ */ new WeakSet();
      var statesByRenderer = /* @__PURE__ */ new WeakMap();
      var originalCopyByWrapper = /* @__PURE__ */ new WeakMap();
      var originalDeleteByWrapper = /* @__PURE__ */ new WeakMap();
      var originalRotateByWrapper = /* @__PURE__ */ new WeakMap();
      var propertyPaths = /* @__PURE__ */ new WeakMap();
      var guardedMixedInputs = /* @__PURE__ */ new WeakSet();
      var relativeCommandInputs = /* @__PURE__ */ new WeakSet();
      var relativePropertyUpdates = /* @__PURE__ */ new WeakMap();
      var mergeGroupingWindows = /* @__PURE__ */ new WeakSet();
      var editorTopMenus = /* @__PURE__ */ new WeakSet();
      var activeSelectionState = null;
      var colorPickerShortcutInstalled = false;
      var nativeColorWheelDismissalInstalled = false;
      var nativeColorWheelOpener = null;
      var nativeTexturePanelOpener = null;
      var editorPointerControlModified = false;
      var editorPointerModified = false;
      var pendingPaintHex = /* @__PURE__ */ new Map();
      var editorHistoryShortcutKeys = /* @__PURE__ */ new Set();
      var COLOR_PICKER_SVG = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='%23ebebeb' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M11 7l6 6'/%3E%3Cpath d='M4 16l11.7-11.7a1 1 0 0 1 1.4 0l2.6 2.6a1 1 0 0 1 0 1.4L8 20H4v-4'/%3E%3C/svg%3E";
      var COLOR_PICKER_ICON = `url("${COLOR_PICKER_SVG}")`;
      var COLOR_PICKER_CURSOR = `url("${COLOR_PICKER_SVG}") 4 20, crosshair`;
      var COLOR_PICKER_CURSOR_PROPERTY = "--qolbox-editor-color-picker-cursor";
      var callMethod2 = callNativeMethodSafely;
      function setColorPickerActive(editor, button, active) {
        editor.classList.toggle("qolboxColorPickerActive", active);
        button.classList.toggle("selected", active);
        button.setAttribute("aria-pressed", String(active));
        if (active) editor.style.setProperty(COLOR_PICKER_CURSOR_PROPERTY, COLOR_PICKER_CURSOR);
        else editor.style.removeProperty(COLOR_PICKER_CURSOR_PROPERTY);
      }
      function syncEditorToolCursor(editor, sidebar) {
        const tool = sidebar.querySelector(".button.selected:not(.qolboxColorPicker)");
        editor.classList.toggle("qolboxEditorFillTool", Boolean(tool?.classList.contains("fill")));
        editor.classList.toggle(
          "qolboxEditorPrecisionTool",
          Boolean(tool && !tool.matches(".selectBody, .selectShape, .fill"))
        );
      }
      function installEditorColorPicker() {
        if (!nativeColorWheelDismissalInstalled) {
          nativeColorWheelDismissalInstalled = true;
          document.addEventListener("click", (event) => {
            const target = event.target instanceof Element ? event.target : null;
            const preview = target?.closest(".preview");
            if (preview) {
              nativeColorWheelOpener = preview;
              if (preview.classList.contains("bgTexPreview")) nativeTexturePanelOpener = preview;
              return;
            }
            const editor = document.querySelector("#editorContainer");
            const wheel = [...document.querySelectorAll(".reinvented-color-wheel")].find((candidate) => candidate.offsetParent);
            const wheelContainer = wheel?.closest(".colorWheelContainer, .bgColorWheel") ?? wheel;
            if (editor?.offsetParent && wheelContainer && target && !wheelContainer.contains(target)) {
              const backgroundClose = [...document.querySelectorAll(".bgColorWheel .crossButton")].find((button) => button.offsetParent);
              (backgroundClose ?? nativeColorWheelOpener)?.click();
            }
            const texturePanel = [...document.querySelectorAll("#editorContainer .textureContainer")].find((candidate) => candidate.offsetParent);
            if (editor?.offsetParent && texturePanel && target && !texturePanel.contains(target)) {
              (nativeTexturePanelOpener ?? editor.querySelector(".bgTexPreview"))?.click();
            }
          }, true);
        }
        if (!colorPickerShortcutInstalled) {
          colorPickerShortcutInstalled = true;
          window.addEventListener("keydown", (event) => {
            const key = event.key.toLowerCase();
            const active = document.activeElement;
            const editor = document.querySelector("#editorContainer");
            if (!event.ctrlKey && !event.metaKey || key !== "y" && key !== "z" || active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || active instanceof HTMLElement && active.isContentEditable || !editor?.offsetParent) return;
            event.preventDefault();
            event.stopImmediatePropagation();
            editorHistoryShortcutKeys.add(key);
            [...editor.querySelectorAll(".toolsMenu .item")].find((item) => item.textContent?.trim() === (key === "y" ? "Redo" : "Undo"))?.click();
          }, true);
          window.addEventListener("keyup", (event) => {
            const key = event.key.toLowerCase();
            if (editorHistoryShortcutKeys.delete(key)) {
              event.preventDefault();
              event.stopImmediatePropagation();
              return;
            }
            const active = document.activeElement;
            if (!["i", "u", "y"].includes(key) || event.altKey || event.ctrlKey || event.metaKey || active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement || active instanceof HTMLElement && active.isContentEditable) return;
            const editor = document.querySelector("#editorContainer");
            if (!editor?.offsetParent) return;
            event.preventDefault();
            event.stopImmediatePropagation();
            const button = editor.querySelector(key === "y" ? ".cap" : key === "u" ? ".fill" : ".qolboxColorPicker");
            if (button?.offsetParent && (key !== "i" || !button.classList.contains("selected"))) button.click();
          }, true);
        }
        for (const sidebar of document.querySelectorAll("#editorContainer .sideBar")) {
          installEditorHexInputs(sidebar);
          if (sidebar.querySelector(".qolboxColorPicker")) continue;
          const colorLabel = [...sidebar.querySelectorAll(".sideLabel")].find((label) => label.textContent?.trim() === "Color");
          const editor = sidebar.closest("#editorContainer");
          const selectButton = sidebar.querySelector(".selectBody");
          if (!colorLabel || !editor || !selectButton) continue;
          const button = document.createElement("div");
          button.className = "button qolboxColorPicker";
          button.style.backgroundImage = COLOR_PICKER_ICON;
          button.setAttribute("aria-label", "Color Picker (I)");
          button.setAttribute("aria-pressed", "false");
          const tooltip = document.createElement("div");
          tooltip.className = "tooltip";
          tooltip.textContent = "Color Picker (I)";
          button.appendChild(tooltip);
          colorLabel.before(button);
          button.addEventListener("click", () => {
            const activate = !button.classList.contains("selected");
            if (!selectButton.classList.contains("selected")) selectButton.click();
            if (activate) {
              sidebar.querySelectorAll(".button.selected").forEach((tool) => tool.classList.remove("selected"));
            }
            setColorPickerActive(editor, button, activate);
            syncEditorToolCursor(editor, sidebar);
          });
          sidebar.addEventListener("pointerdown", (event) => {
            if (event.target instanceof Element && event.target.closest(".qolboxColorPicker") === button) return;
            setColorPickerActive(editor, button, false);
          }, true);
          new MutationObserver(() => {
            if (sidebar.querySelector(".button.selected:not(.qolboxColorPicker)")) {
              setColorPickerActive(editor, button, false);
            }
            syncEditorToolCursor(editor, sidebar);
          }).observe(sidebar, { attributeFilter: ["class"], attributes: true, subtree: true });
          syncEditorToolCursor(editor, sidebar);
        }
      }
      function installEditorTopMenuDismissal() {
        for (const menu of document.querySelectorAll(
          "#editorContainer .fileMenu, #editorContainer .toolsMenu, #editorContainer .settingsMenu"
        )) {
          if (editorTopMenus.has(menu)) continue;
          editorTopMenus.add(menu);
          menu.addEventListener("pointerleave", () => {
            const dropdown = menu.querySelector(":scope > .container");
            if (dropdown?.offsetParent) menu.click();
          });
        }
      }
      function parseHexColor(value) {
        const match = /^#?([\da-f]{3}|[\da-f]{6})$/i.exec(value.trim());
        if (!match?.[1]) return null;
        const hex = match[1].length === 3 ? [...match[1]].map((character) => character.repeat(2)).join("") : match[1];
        return Number.parseInt(hex, 16);
      }
      function setHexInputValue(input, colors) {
        if (!input || document.activeElement === input) return;
        const unique = [...new Set(colors)];
        input.value = unique.length === 1 ? unique[0].toUpperCase() : "";
        input.dataset.qolboxValue = input.value;
        input.placeholder = unique.length > 1 ? "Mixed" : "";
        input.removeAttribute("aria-invalid");
      }
      function previewColorHex(selector) {
        const preview = document.querySelector(`#editorContainer ${selector}`);
        const match = preview && getComputedStyle(preview).backgroundColor.match(/[\d.]+/g);
        if (!match || match.length < 3) return null;
        return colorHex(Number(match[0]) << 16 | Number(match[1]) << 8 | Number(match[2]));
      }
      function updatePaintHexInputsFromPreviews() {
        const fill = previewColorHex(".fillPreview");
        const stroke = previewColorHex(".strokeColorPreview");
        setHexInputValue(
          document.querySelector("#editorContainer .qolboxFillHex"),
          fill ? [fill] : []
        );
        setHexInputValue(
          document.querySelector("#editorContainer .qolboxStrokeHex"),
          stroke ? [stroke] : []
        );
      }
      function applyPaintHex(property, color) {
        const state = activeSelectionState;
        const paintTool = state && readNativeProperty(state.tool, "Av");
        if (!state || !isNativeObject(paintTool)) {
          const preview = document.querySelector(
            `#editorContainer .${property === "color" ? "fillPreview" : "strokeColorPreview"}`
          );
          if (!preview) return false;
          preview.style.backgroundColor = colorHex(color);
          pendingPaintHex.set(property, color);
          return true;
        }
        const values = Object.fromEntries(getCopyableValues(paintTool));
        state.selecting = true;
        try {
          callMethod2(paintTool, "bk", [{ ...values, [property]: color }]);
        } finally {
          state.selecting = false;
        }
        for (const record of state.records) {
          const paint = getPaint(record);
          if (!paint || !Reflect.has(paint, property)) continue;
          setNativeReflectProperty(paint, property, color);
          callMethod2(record.wrapper, "fv", [paint]);
        }
        callMethod2(state.tool, "Eb");
        state.paintValues = getCopyableValues(paintTool);
        redrawSelection(state);
        updatePaintPreviews(state);
        return true;
      }
      function getActiveEditorContext() {
        const renderers = getKnownFullscreenRenderers(window).filter(
          (renderer2) => getRendererView(renderer2)?.parentElement?.id === "editorContainer"
        );
        const renderer = renderers.find((candidate) => getRendererView(candidate)?.parentElement?.offsetParent) ?? renderers[renderers.length - 1];
        if (!renderer) return null;
        const state = statesByRenderer.get(renderer) ?? null;
        const map = readNativeProperty(state?.tool, "Bv") ?? getLastRendererDrawArguments(renderer)?.[0];
        const settings = readNativePath(map, ["settings", 0]);
        return isNativeObject(map) && isNativeObject(settings) ? { map, renderer, settings, state } : null;
      }
      function applyBackgroundHex(property, color) {
        const context = getActiveEditorContext();
        if (!context) return false;
        const { renderer, settings, state } = context;
        setNativeReflectProperty(settings, property, color);
        const label = property === "Kn" ? "Top Color" : "Bot Color";
        const container = [...document.querySelectorAll("#editorContainer .paramContainer")].find((candidate) => candidate.querySelector(".label")?.textContent?.trim() === label);
        container?.querySelector(".paramColorBox")?.style.setProperty("background-color", colorHex(color));
        if (state) callMethod2(state.tool, "Eb");
        const draw = readNativeProperty(renderer, "Dg");
        const args = getLastRendererDrawArguments(renderer);
        if (isNativeFunction2(draw) && args) Reflect.apply(draw, renderer, args);
        callMethod2(renderer, "render");
        if (state) redrawSelection(state);
        return true;
      }
      function addHexInput(parent, className, label, apply) {
        const input = document.createElement("input");
        input.className = `input qolboxHexInput ${className}`;
        input.type = "text";
        input.maxLength = 7;
        input.placeholder = "";
        input.setAttribute("aria-label", `${label} hex color`);
        input.setAttribute("autocomplete", "off");
        input.setAttribute("spellcheck", "false");
        const commit = () => {
          const color = parseHexColor(input.value);
          if (color == null || !apply(color)) {
            input.setAttribute("aria-invalid", "true");
            return;
          }
          input.value = colorHex(color).toUpperCase();
          input.dataset.qolboxValue = input.value;
          input.removeAttribute("aria-invalid");
        };
        input.addEventListener("change", commit);
        input.addEventListener("keydown", (event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            input.blur();
          } else if (event.key === "Escape") {
            event.preventDefault();
            input.value = input.dataset.qolboxValue ?? "";
            input.blur();
          }
        });
        parent.appendChild(input);
        return input;
      }
      function installEditorHexInputs(sidebar) {
        for (const [selector, className, label, property] of [
          [".fillPreview", "qolboxFillHex", "Fill", "color"],
          [".strokeColorPreview", "qolboxStrokeHex", "Stroke", "la"]
        ]) {
          if (sidebar.querySelector(`.${className}`)) continue;
          const preview = sidebar.querySelector(selector);
          if (preview) {
            preview.classList.add("qolboxHexPreview");
            preview.after(addHexInput(sidebar, className, label, (color) => applyPaintHex(property, color)));
          }
        }
        for (const [label, className, property] of [
          ["Top Color", "qolboxBackgroundTopHex", "Kn"],
          ["Bot Color", "qolboxBackgroundBottomHex", "Xn"]
        ]) {
          if (sidebar.querySelector(`.${className}`)) continue;
          const container = [...sidebar.querySelectorAll(".paramContainer")].find((candidate) => candidate.querySelector(".label")?.textContent?.trim() === label);
          if (container) addHexInput(container, className, label, (color) => applyBackgroundHex(property, color));
        }
        if (activeSelectionState) updateHexInputs(activeSelectionState);
        else {
          updatePaintHexInputsFromPreviews();
          updateBackgroundHexInputs();
        }
      }
      function isColorPickerActive() {
        return Boolean(document.querySelector("#editorContainer.qolboxColorPickerActive .qolboxColorPicker.selected"));
      }
      function isSelectionOutlineTarget(state, event) {
        const target = readNativeProperty(event, "target");
        if (!isNativeObject(target)) return false;
        for (let current = target; isNativeObject(current); current = readNativeProperty(current, "parent")) {
          if (current === state.nativeOutline) return true;
        }
        return false;
      }
      function isEditorBackgroundTarget(state, event) {
        const target = readNativeProperty(event, "target");
        if (!isNativeObject(target) || isSelectionOutlineTarget(state, event)) return false;
        return ["td", "Ym", "Vc", "_y"].every((property) => readNativeProperty(target, property) == null);
      }
      function getSelection(tool) {
        const selection = readNativeProperty(tool, "vb");
        return Array.isArray(selection) ? selection : null;
      }
      function isSelectionTool(candidate) {
        return Boolean(
          isNativeObject(candidate) && Array.isArray(readNativeProperty(candidate, "vb")) && isNativeObject(readNativeProperty(candidate, "Cb")) && "wk" in candidate && "gk" in candidate && "yk" in candidate && typeof readNativeProperty(candidate, "ab") === "function" && typeof readNativeProperty(candidate, "wb") === "function" && typeof readNativeProperty(candidate, "Iv") === "function" && typeof readNativeProperty(candidate, "Fv") === "function"
        );
      }
      function getOriginalPointerEvent(event) {
        return readNativeProperty(readNativeProperty(event, "data"), "originalEvent");
      }
      function hasSelectionModifier(event) {
        const original = getOriginalPointerEvent(event);
        return Boolean(
          editorPointerModified || readNativeProperty(event, "ctrlKey") || readNativeProperty(event, "metaKey") || readNativeProperty(event, "shiftKey") || readNativeProperty(original, "ctrlKey") || readNativeProperty(original, "metaKey") || readNativeProperty(original, "shiftKey")
        );
      }
      function hasControlModifier(event) {
        const original = getOriginalPointerEvent(event);
        return Boolean(
          editorPointerControlModified || readNativeProperty(event, "ctrlKey") || readNativeProperty(event, "metaKey") || readNativeProperty(original, "ctrlKey") || readNativeProperty(original, "metaKey")
        );
      }
      function wrapperMatchesModel(wrapper, model) {
        return callMethod2(wrapper, "yv", [model]) === true;
      }
      function findWrapperRecord(records, wrapper) {
        return records.find((record) => wrapperMatchesModel(wrapper, record.model)) ?? null;
      }
      function setRecords(state, records) {
        const selection = getSelection(state.tool);
        if (!selection) return;
        selection.splice(0, selection.length, ...records.map((record) => record.wrapper));
        state.records = records;
        if (state.specialBodyId != null && !records.some((record) => Number(readNativeProperty(record.model, "id")) === state.specialBodyId)) {
          state.specialBodyId = null;
        }
        records.forEach((record) => installGroupOperations(state, record.wrapper));
      }
      function installGroupOperations(state, wrapper) {
        installGroupCopy(state, wrapper);
        installGroupDelete(state, wrapper);
        installGroupRotation(state, wrapper);
      }
      function getBodyGroup(state, body) {
        const bodies = readNativePath(state.tool, ["Bv", "pl"]);
        const id = Number(readNativeProperty(body, "id"));
        const ids = state.bodyGroups.get(id);
        if (!ids || !Array.isArray(bodies)) return null;
        const group = [...ids].flatMap((memberId) => bodies[memberId] ?? []);
        if (group.length !== ids.size) {
          ids.forEach((memberId) => state.bodyGroups.delete(memberId));
          return null;
        }
        return group.length > 1 ? new Set(group) : null;
      }
      function mergeBodyGroups(state, ...bodies) {
        const ids = bodies.map((body) => Number(readNativeProperty(body, "id"))).filter(Number.isInteger);
        const group = new Set(ids.flatMap((id) => [...state.bodyGroups.get(id) ?? [id]]));
        group.forEach((id) => state.bodyGroups.set(id, group));
        return group;
      }
      function forgetGroupedBody(state, body) {
        const id = Number(readNativeProperty(body, "id"));
        const group = state.bodyGroups.get(id);
        if (!group) return;
        state.bodyGroups.delete(id);
        group.delete(id);
        if (group.size < 2) group.forEach((memberId) => state.bodyGroups.delete(memberId));
      }
      function getBodyRecords(state, bodies) {
        const wanted = new Set(bodies);
        const records = /* @__PURE__ */ new Map();
        const selectedBody = readNativeProperty(state.tool, "yk");
        const shapeMode = readNativeProperty(state.tool, "wk");
        setNativeReflectProperty(state.tool, "yk", -1);
        setNativeReflectProperty(state.tool, "wk", false);
        try {
          for (const target of getSelectionTargets(state)) {
            const record = selectNatively(state, { data: { global: { x: 0, y: 0 } }, target }, true, target, true);
            if (record?.type === "body" && wanted.has(record.model)) records.set(record.model, record);
          }
        } finally {
          setNativeReflectProperty(state.tool, "yk", selectedBody);
          setNativeReflectProperty(state.tool, "wk", shapeMode);
        }
        return bodies.flatMap((body) => records.get(body) ?? []);
      }
      function expandBodyGroup(state, record) {
        const group = record.type === "body" ? getBodyGroup(state, record.model) : null;
        return group ? getBodyRecords(state, [record.model, ...[...group].filter((body) => body !== record.model)]) : [record];
      }
      function getCompleteBodyGroup(state, records = state.records) {
        const group = records[0]?.type === "body" ? getBodyGroup(state, records[0].model) : null;
        return group && group.size === records.length && records.every((record) => record.type === "body" && group.has(record.model)) ? records : null;
      }
      function getBodyGroupCenter(state, records) {
        const positions = records.map((record) => getRecordPosition(state, record));
        if (positions.some((position) => !position)) return null;
        return {
          x: positions.reduce((sum, position) => sum + position.x, 0) / positions.length,
          y: positions.reduce((sum, position) => sum + position.y, 0) / positions.length
        };
      }
      function orbitBodies(records, center, angle) {
        for (const record of records) {
          const position = rotatePoint({
            x: Number(readNativeProperty(record.model, "x")) - center.x,
            y: Number(readNativeProperty(record.model, "y")) - center.y
          }, angle);
          setNativeReflectProperty(record.model, "x", center.x + position.x);
          setNativeReflectProperty(record.model, "y", center.y + position.y);
        }
      }
      function installGroupRotation(state, wrapper) {
        if (originalRotateByWrapper.has(wrapper)) return;
        const original = readNativeProperty(wrapper, "Ib");
        const body = readNativeProperty(wrapper, "pv");
        const bodies = readNativePath(state.tool, ["Bv", "pl"]);
        if (!isNativeFunction2(original) || !isNativeObject(body) || !Array.isArray(bodies) || !bodies.includes(body)) return;
        const wrapped = function(value) {
          const group = getBodyGroup(state, body);
          const angle = -Number(value);
          if (state.specialBodyId === Number(readNativeProperty(body, "id")) || !group || !Number.isFinite(angle) || !angle) return Reflect.apply(original, this, [value]);
          const members = [...group];
          const center = {
            x: members.reduce((sum, member) => sum + Number(readNativeProperty(member, "x")), 0) / members.length,
            y: members.reduce((sum, member) => sum + Number(readNativeProperty(member, "y")), 0) / members.length
          };
          for (const member of members) {
            const position = rotatePoint({
              x: Number(readNativeProperty(member, "x")) - center.x,
              y: Number(readNativeProperty(member, "y")) - center.y
            }, angle);
            setNativeReflectProperty(member, "x", center.x + position.x);
            setNativeReflectProperty(member, "y", center.y + position.y);
            if (member !== body) {
              const memberAngle = Number(readNativeProperty(member, "angle")) || 0;
              setNativeReflectProperty(member, "angle", memberAngle + angle);
            }
          }
          return Reflect.apply(original, this, [value]);
        };
        if (setNativeReflectProperty(wrapper, "Ib", wrapped)) originalRotateByWrapper.set(wrapper, original);
      }
      function installGroupCopy(state, wrapper) {
        if (originalCopyByWrapper.has(wrapper)) return;
        const original = readNativeProperty(wrapper, "bv");
        if (!isNativeFunction2(original)) return;
        const wrapped = function(...args) {
          if (state.records.length < 2 || state.records[0]?.wrapper !== this) {
            return Reflect.apply(original, this, args);
          }
          const copies = state.records.map((record) => {
            const copy = originalCopyByWrapper.get(record.wrapper) ?? readNativeProperty(record.wrapper, "bv");
            return isNativeFunction2(copy) ? Reflect.apply(copy, record.wrapper, args) : void 0;
          });
          if (!copies.every(isNativeObject)) return void 0;
          const records = [...state.records];
          const group = records[0]?.type === "body" ? getBodyGroup(state, records[0].model) : null;
          const preserveGroup = Boolean(group && group.size === records.length && records.every((record) => group.has(record.model)));
          return {
            vv(map) {
              if (!isNativeObject(map)) return;
              const before = new Set(getEditorModels(map));
              copies.forEach((copy, index) => {
                const position = getRecordPosition(state, records[index]);
                callMethod2(copy, "vv", [map, position && { x: position.x + 1, y: position.y + 1 }, -1]);
              });
              const inserted = getEditorModels(map).filter((model) => !before.has(model));
              callMethod2(state.tool, "Eb");
              requestAnimationFrame(() => selectInsertedModels(state, inserted, preserveGroup));
            }
          };
        };
        if (setNativeReflectProperty(wrapper, "bv", wrapped)) originalCopyByWrapper.set(wrapper, original);
      }
      function installGroupDelete(state, wrapper) {
        if (originalDeleteByWrapper.has(wrapper)) return;
        const original = readNativeProperty(wrapper, "delete");
        if (!isNativeFunction2(original)) return;
        const wrapped = function(...args) {
          const records = [...state.records];
          if (state.records.length < 2 || state.records[0]?.wrapper !== this) {
            const result2 = Reflect.apply(original, this, args);
            const record = records.find((candidate) => candidate.wrapper === this);
            if (record?.type === "body") forgetGroupedBody(state, record.model);
            return result2;
          }
          let result;
          for (const record of records) {
            const remove = originalDeleteByWrapper.get(record.wrapper) ?? readNativeProperty(record.wrapper, "delete");
            if (isNativeFunction2(remove)) result = Reflect.apply(remove, record.wrapper, args);
          }
          records.filter((record) => record.type === "body").forEach((record) => forgetGroupedBody(state, record.model));
          return result;
        };
        if (setNativeReflectProperty(wrapper, "delete", wrapped)) originalDeleteByWrapper.set(wrapper, original);
      }
      function inferSelectionRecord(state, wrapper) {
        const existing = state.records.find(
          (record) => record.wrapper === wrapper || wrapperMatchesModel(wrapper, record.model)
        );
        if (existing) return { ...existing, wrapper };
        const model = readNativeProperty(wrapper, "pv");
        const bodies = readNativeProperty(readNativeProperty(state.tool, "Bv"), "pl");
        if (!isNativeObject(model) || !Array.isArray(bodies)) return null;
        if (bodies.includes(model)) return { model, type: "body", wrapper };
        if (bodies.some((body) => {
          const shapes = readNativeProperty(body, "Sa");
          return Array.isArray(shapes) && shapes.includes(model);
        })) return { model, type: "shape", wrapper };
        return null;
      }
      function syncRecords(state) {
        const selection = getSelection(state.tool);
        if (!selection?.length) {
          const changed2 = state.records.length > 0;
          state.records = [];
          return changed2;
        }
        const records = selection.flatMap((wrapper) => inferSelectionRecord(state, wrapper) ?? []);
        const map = readNativeProperty(state.tool, "Bv");
        if (isNativeObject(map)) {
          const models = new Set(getEditorModels(map));
          if (records.some((record) => !models.has(record.model))) {
            clearEditorSelection(state);
            return true;
          }
        }
        const changed = records.length !== state.records.length || records.some(
          (record, index) => record.wrapper !== state.records[index]?.wrapper || record.model !== state.records[index]?.model
        );
        state.records = records;
        if (state.specialBodyId != null && !records.some((record) => Number(readNativeProperty(record.model, "id")) === state.specialBodyId)) {
          state.specialBodyId = null;
        }
        records.forEach((record) => installGroupOperations(state, record.wrapper));
        return changed;
      }
      function getRecordConstructor(record) {
        return readNativeReflectProperty(record.model, "constructor");
      }
      function getEditorModels(map) {
        const models = Reflect.ownKeys(map).flatMap((key) => {
          const value = readNativeReflectProperty(map, key);
          return Array.isArray(value) ? value.filter(isNativeObject) : [];
        });
        return [...models, ...models.flatMap((model) => {
          const shapes = readNativeProperty(model, "Sa");
          return Array.isArray(shapes) ? shapes.filter(isNativeObject) : [];
        })];
      }
      function getRecordPosition(state, record) {
        let model = record.model;
        if (record.type === "shape") {
          const bodies = readNativePath(state.tool, ["Bv", "pl"]);
          const parent = Array.isArray(bodies) ? bodies.find((body) => readNativeProperty(body, "Sa")?.includes(record.model)) : null;
          if (isNativeObject(parent)) model = parent;
        }
        const x = Number(readNativeProperty(model, "x"));
        const y = Number(readNativeProperty(model, "y"));
        return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
      }
      function getCompatibleRecords(state) {
        const [primary] = state.records;
        if (!primary) return [];
        const recordConstructor = getRecordConstructor(primary);
        const shapeKind = readNativeProperty(primary.model, "na");
        const objectKind = readNativeProperty(primary.model, "type");
        return state.records.filter(
          (record) => record.type === primary.type && getRecordConstructor(record) === recordConstructor && Object.is(readNativeProperty(record.model, "na"), shapeKind) && Object.is(readNativeProperty(record.model, "type"), objectKind)
        );
      }
      function getPaint(record) {
        if (record.type === "shape") return record.model;
        const shapes = readNativeProperty(readNativeProperty(record.wrapper, "pv"), "Sa");
        const paint = Array.isArray(shapes) ? shapes[0] : null;
        return isNativeObject(paint) ? paint : null;
      }
      function getPaintToolInput(paint) {
        return readNativeProperty(paint, "aa") == null ? { ...Object.fromEntries(getCopyableValues(paint)), aa: 0 } : paint;
      }
      function getRenderedView(state, record) {
        if (record.type === "body") {
          return callMethod2(
            readNativeProperty(state.renderer, "pg"),
            "Od",
            [readNativeProperty(record.model, "id")]
          );
        }
        return callMethod2(state.renderer, "$g", [readNativeProperty(state.tool, "Bv"), record.model]);
      }
      function getOutlineMode(record) {
        return record.type === "body" || record.type === "shape" ? "rendered" : "bounds";
      }
      function renderedShapeContainsPoint(state, record, event) {
        if (getOutlineMode(record) !== "rendered") return true;
        const point = getEventPoint(event);
        const visual = readNativeProperty(getRenderedView(state, record), "Ic");
        const parent = readNativeProperty(state.nativeOutline, "parent");
        const parentTransform = readNativeProperty(parent, "worldTransform");
        if (!point || !isNativeObject(visual) || !isNativeObject(parent) || !isNativeObject(parentTransform)) return true;
        const local = callMethod2(parentTransform, "applyInverse", [point]);
        const x = Number(readNativeProperty(local, "x"));
        const y = Number(readNativeProperty(local, "y"));
        if (![x, y].every(Number.isFinite)) return true;
        const contours = getRenderedPolygonContours(
          visual,
          parent,
          Array.isArray(readNativeProperty(readNativeProperty(record.wrapper, "pv"), "Sa"))
        );
        return !contours.length || contours.some((points) => polygonContainsPoint(points, x, y));
      }
      function refreshWrapperViews(state) {
        let changed = false;
        for (const record of state.records) {
          const view = getRenderedView(state, record);
          if (isNativeObject(view) && callMethod2(record.wrapper, "Bb") !== view) {
            callMethod2(record.wrapper, "gv", [view]);
            changed = true;
          }
        }
        return changed;
      }
      function readBounds(source, method = "getBounds", args = [false]) {
        const bounds = callMethod2(source, method, args);
        if (!isNativeObject(bounds)) return null;
        const x = Number(readNativeProperty(bounds, "x"));
        const y = Number(readNativeProperty(bounds, "y"));
        const width = Number(readNativeProperty(bounds, "width"));
        const height = Number(readNativeProperty(bounds, "height"));
        return [x, y, width, height].every(Number.isFinite) ? { height, width, x, y } : null;
      }
      function getRenderedPolygonContours(visual, parent, requireEveryGraphic) {
        const parentTransform = readNativeProperty(parent, "worldTransform");
        if (!isNativeObject(visual) || !isNativeObject(parentTransform)) return [];
        const contours = [];
        let unsupportedShape = false;
        const visit = (display) => {
          if (!isNativeObject(display)) return;
          const transform = readNativeProperty(display, "worldTransform");
          const data = readNativeProperty(readNativeProperty(display, "geometry"), "graphicsData");
          if (Array.isArray(data)) {
            for (const item of data) {
              const points = readNativePath(item, ["shape", "points"]);
              if (!Array.isArray(points) || points.length < 6 || points.length % 2) {
                unsupportedShape = true;
                continue;
              }
              if (!isNativeObject(transform)) {
                unsupportedShape = true;
                continue;
              }
              const transformed = Array.from({ length: points.length / 2 }).flatMap((_, index) => {
                const worldPoint = callMethod2(transform, "apply", [{
                  x: Number(points[index * 2]),
                  y: Number(points[index * 2 + 1])
                }]);
                const parentPoint = callMethod2(parentTransform, "applyInverse", [worldPoint]);
                return [Number(readNativeProperty(parentPoint, "x")), Number(readNativeProperty(parentPoint, "y"))];
              });
              const contour = transformed.every(Number.isFinite) ? transformed : [];
              if (contour.length) contours.push(contour);
              else unsupportedShape = true;
            }
          }
          const children = readNativeProperty(display, "children");
          if (Array.isArray(children)) children.forEach(visit);
        };
        visit(visual);
        return unsupportedShape && requireEveryGraphic ? [] : contours;
      }
      function getWrapperOutlineGeometry(wrapper, parent, mode) {
        const display = callMethod2(wrapper, "Bb");
        const visual = readNativeProperty(display, "Ic");
        callMethod2(visual, "getBounds", [false]);
        const bounds = readBounds(visual, "getLocalBounds", []);
        const worldTransform = readNativeProperty(visual, "worldTransform");
        const parentTransform = readNativeProperty(parent, "worldTransform");
        if (!bounds || !isNativeObject(worldTransform) || !isNativeObject(parentTransform)) return null;
        const transform = (point) => callMethod2(parentTransform, "applyInverse", [callMethod2(worldTransform, "apply", [point])]);
        const center = { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
        const centerPoint = transform(center);
        const xPoint = transform({ x: center.x + 1, y: center.y });
        const yPoint = transform({ x: center.x, y: center.y + 1 });
        if (![centerPoint, xPoint, yPoint].every(isNativeObject)) return null;
        const centerX = Number(readNativeProperty(centerPoint, "x"));
        const centerY = Number(readNativeProperty(centerPoint, "y"));
        const xVector = {
          x: Number(readNativeProperty(xPoint, "x")) - centerX,
          y: Number(readNativeProperty(xPoint, "y")) - centerY
        };
        const xScale = Math.hypot(xVector.x, xVector.y);
        const yScale = Math.hypot(Number(readNativeProperty(yPoint, "x")) - centerX, Number(readNativeProperty(yPoint, "y")) - centerY);
        if (![centerX, centerY, xScale, yScale].every(Number.isFinite) || xScale <= 0 || yScale <= 0) return null;
        const halfWidth = bounds.width / 2 + EDITOR_OUTLINE_PADDING_PX / xScale;
        const halfHeight = bounds.height / 2 + EDITOR_OUTLINE_PADDING_PX / yScale;
        const corners = [
          [-halfWidth, -halfHeight],
          [halfWidth, -halfHeight],
          [halfWidth, halfHeight],
          [-halfWidth, halfHeight]
        ];
        const points = corners.flatMap(([offsetX, offsetY]) => {
          const point = transform({ x: center.x + offsetX, y: center.y + offsetY });
          return [Number(readNativeProperty(point, "x")), Number(readNativeProperty(point, "y"))];
        });
        const shapeContours = mode === "rendered" ? getRenderedPolygonContours(
          visual,
          parent,
          Array.isArray(readNativeProperty(readNativeProperty(wrapper, "pv"), "Sa"))
        ) : [];
        return {
          bounds,
          center: { x: centerX, y: centerY },
          contours: shapeContours.map((points2) => offsetPolygon(points2, EDITOR_OUTLINE_PADDING_PX)).filter((points2) => points2.length >= 6),
          points,
          rotation: Math.atan2(xVector.y, xVector.x),
          scale: { x: xScale, y: yScale }
        };
      }
      function mirrorNumber(value) {
        const number = Number(value);
        return Number.isFinite(number) ? -number : null;
      }
      function mirrorProperty(model, property) {
        const value = mirrorNumber(readNativeProperty(model, property));
        if (value != null) setNativeReflectProperty(model, property, value);
      }
      function mirrorPoint(point, axis) {
        if (!isNativeObject(point)) return;
        mirrorProperty(point, axis === "horizontal" ? "x" : "y");
      }
      function mirrorShape(shape, axis) {
        mirrorPoint(shape, axis);
        const vertices = readNativeProperty(shape, "ca");
        if (!Array.isArray(vertices)) return;
        vertices.forEach((vertex) => mirrorPoint(vertex, axis));
        vertices.reverse();
      }
      function mirrorDirectionalProperties(model, axis) {
        for (const property of axis === "horizontal" ? ["o", "Or", "Dr"] : ["l", "Rr", "Lr"]) {
          if (Reflect.has(model, property)) mirrorProperty(model, property);
        }
        for (const property of ["angularVelocity", "Ur"]) {
          if (Reflect.has(model, property)) mirrorProperty(model, property);
        }
      }
      function setReflectedPosition(model, axis, center) {
        const property = axis === "horizontal" ? "x" : "y";
        const value = Number(readNativeProperty(model, property));
        if (Number.isFinite(value)) setNativeReflectProperty(model, property, 2 * center[property] - value);
      }
      function getParentBody(state, shape) {
        const bodies = readNativePath(state.tool, ["Bv", "pl"]);
        return Array.isArray(bodies) ? bodies.find((body) => readNativeProperty(body, "Sa")?.includes(shape)) ?? null : null;
      }
      function reflectWorldPoint(point, axis, center) {
        return axis === "horizontal" ? { x: 2 * center.x - point.x, y: point.y } : { x: point.x, y: 2 * center.y - point.y };
      }
      function mirrorSelectedShape(state, shape, axis, center) {
        const body = getParentBody(state, shape);
        if (!body) return;
        const bodyPosition = {
          x: Number(readNativeProperty(body, "x")),
          y: Number(readNativeProperty(body, "y"))
        };
        const angle = Number(readNativeProperty(body, "angle")) || 0;
        const localPosition = {
          x: Number(readNativeProperty(shape, "x")) || 0,
          y: Number(readNativeProperty(shape, "y")) || 0
        };
        const worldPosition = rotatePoint(localPosition, angle);
        const reflectedPosition = reflectWorldPoint({
          x: bodyPosition.x + worldPosition.x,
          y: bodyPosition.y + worldPosition.y
        }, axis, center);
        const nextLocal = rotatePoint({
          x: reflectedPosition.x - bodyPosition.x,
          y: reflectedPosition.y - bodyPosition.y
        }, -angle);
        setNativeReflectProperty(shape, "x", nextLocal.x);
        setNativeReflectProperty(shape, "y", nextLocal.y);
        const vertices = readNativeProperty(shape, "ca");
        if (!Array.isArray(vertices)) return;
        for (const vertex of vertices) {
          if (!isNativeObject(vertex)) continue;
          const local = {
            x: Number(readNativeProperty(vertex, "x")),
            y: Number(readNativeProperty(vertex, "y"))
          };
          const world = rotatePoint(local, angle);
          const reflected = rotatePoint(axis === "horizontal" ? { x: -world.x, y: world.y } : { x: world.x, y: -world.y }, -angle);
          setNativeReflectProperty(vertex, "x", reflected.x);
          setNativeReflectProperty(vertex, "y", reflected.y);
        }
        vertices.reverse();
      }
      function getBodyById(state, id) {
        const bodies = readNativePath(state.tool, ["Bv", "pl"]);
        return Array.isArray(bodies) ? bodies.find((body) => readNativeProperty(body, "id") === id) ?? null : null;
      }
      function getJointPointWorldPosition(state, model, property) {
        const point = readNativeProperty(model, property);
        if (!isNativeObject(point)) return null;
        const local = { x: Number(readNativeProperty(point, "x")), y: Number(readNativeProperty(point, "y")) };
        if (![local.x, local.y].every(Number.isFinite)) return null;
        const bodyId = property === "Oa" ? readNativeProperty(model, "Da") : property === "Ra" ? readNativeProperty(model, "La") : -1;
        const body = getBodyById(state, bodyId);
        if (!body) return local;
        const rotated = rotatePoint(local, Number(readNativeProperty(body, "angle")) || 0);
        return {
          x: Number(readNativeProperty(body, "x")) + rotated.x,
          y: Number(readNativeProperty(body, "y")) + rotated.y
        };
      }
      function setJointPointWorldPosition(state, model, property, world) {
        const point = readNativeProperty(model, property);
        if (!isNativeObject(point)) return;
        const bodyId = property === "Oa" ? readNativeProperty(model, "Da") : property === "Ra" ? readNativeProperty(model, "La") : -1;
        const body = getBodyById(state, bodyId);
        const local = body ? rotatePoint({
          x: world.x - Number(readNativeProperty(body, "x")),
          y: world.y - Number(readNativeProperty(body, "y"))
        }, -(Number(readNativeProperty(body, "angle")) || 0)) : world;
        setNativeReflectProperty(point, "x", local.x);
        setNativeReflectProperty(point, "y", local.y);
      }
      function getBodyMirrorBounds(body, shapes) {
        const x = Number(readNativeProperty(body, "x"));
        const y = Number(readNativeProperty(body, "y"));
        if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
        const angle = Number(readNativeProperty(body, "angle")) || 0;
        const points = shapes.flatMap((shape) => {
          const shapePosition = {
            x: Number(readNativeProperty(shape, "x")) || 0,
            y: Number(readNativeProperty(shape, "y")) || 0
          };
          const vertices = readNativeProperty(shape, "ca");
          const polygon = Array.isArray(vertices) ? vertices.flatMap((vertex) => {
            const vertexX = Number(readNativeProperty(vertex, "x"));
            const vertexY = Number(readNativeProperty(vertex, "y"));
            if (!Number.isFinite(vertexX) || !Number.isFinite(vertexY)) return [];
            const point = rotatePoint({ x: shapePosition.x + vertexX, y: shapePosition.y + vertexY }, angle);
            return [{ x: x + point.x, y: y + point.y }];
          }) : [];
          if (polygon.length) return polygon;
          const center = rotatePoint(shapePosition, angle);
          const radius = Math.abs(Number(readNativeProperty(shape, "ra")));
          return Number.isFinite(radius) && radius > 0 ? [{ x: x + center.x - radius, y: y + center.y - radius }, { x: x + center.x + radius, y: y + center.y + radius }] : [{ x: x + center.x, y: y + center.y }];
        });
        return getPointBounds(points.length ? points : [{ x, y }]);
      }
      function getJointPointProperties(type) {
        return type === "lineJoint" ? ["Oa", "Ra", "Va"] : type === "springJoint" || type === "rotateJoint" ? ["Oa", "Ra"] : [];
      }
      function getMirrorBounds(state, record) {
        if (record.type === "body") {
          const shapes = readNativeProperty(record.model, "Sa");
          return getBodyMirrorBounds(record.model, Array.isArray(shapes) ? shapes.filter(isNativeObject) : []);
        }
        if (record.type === "shape") {
          const body = getParentBody(state, record.model);
          return body ? getBodyMirrorBounds(body, [record.model]) : null;
        }
        const jointPoints = getJointPointProperties(record.type).flatMap((property) => getJointPointWorldPosition(state, record.model, property) ?? []);
        if (jointPoints.length) return getPointBounds(jointPoints);
        const x = Number(readNativeProperty(record.model, "x"));
        const y = Number(readNativeProperty(record.model, "y"));
        return Number.isFinite(x) && Number.isFinite(y) ? { height: 0, width: 0, x, y } : null;
      }
      function getMirrorCenter(state, records) {
        const bounds = records.map((record) => getMirrorBounds(state, record));
        if (!bounds.length || bounds.some((value) => !value)) return null;
        const present = bounds.filter((value) => value != null);
        return {
          x: (Math.min(...present.map((value) => value.x)) + Math.max(...present.map((value) => value.x + value.width))) / 2,
          y: (Math.min(...present.map((value) => value.y)) + Math.max(...present.map((value) => value.y + value.height))) / 2
        };
      }
      function mirrorSelection(state, axis) {
        syncRecords(state);
        const records = [...state.records];
        const center = getMirrorCenter(state, records);
        if (!center) return false;
        callMethod2(state.tool, "Eb");
        const bodyRecords = records.filter((record) => record.type === "body");
        const selectedBodies = new Set(bodyRecords.map((record) => record.model));
        const jointPoints = /* @__PURE__ */ new Map();
        for (const record of records) {
          const properties = getJointPointProperties(record.type);
          if (!properties.length || jointPoints.has(record.model)) continue;
          const points = /* @__PURE__ */ new Map();
          for (const property of properties) {
            const point = getJointPointWorldPosition(state, record.model, property);
            if (point) points.set(property, point);
          }
          jointPoints.set(record.model, points);
        }
        for (const record of bodyRecords) {
          setReflectedPosition(record.model, axis, center);
          const shapes = readNativeProperty(record.model, "Sa");
          if (Array.isArray(shapes)) shapes.filter(isNativeObject).forEach((shape) => mirrorShape(shape, axis));
          mirrorProperty(record.model, "angle");
          mirrorDirectionalProperties(record.model, axis);
        }
        const mirrored = new Set(selectedBodies);
        for (const record of records) {
          if (mirrored.has(record.model)) continue;
          if (record.type === "shape") {
            const parent = getParentBody(state, record.model);
            if (!parent || selectedBodies.has(parent)) continue;
            mirrorSelectedShape(state, record.model, axis, center);
          } else if (!jointPoints.has(record.model)) {
            setReflectedPosition(record.model, axis, center);
            if (Reflect.has(record.model, "angle")) {
              const angle = Number(readNativeProperty(record.model, "angle")) || 0;
              setNativeReflectProperty(record.model, "angle", axis === "horizontal" ? Math.PI - angle : -angle);
            }
            mirrorDirectionalProperties(record.model, axis);
          }
          mirrored.add(record.model);
        }
        for (const [model, points] of jointPoints) {
          for (const [property, point] of points) {
            setJointPointWorldPosition(state, model, property, reflectWorldPoint(point, axis, center));
          }
        }
        callMethod2(state.tool, "Eb");
        restoreSelection(state, records);
        return true;
      }
      function installEditorMirrorMenu(windowObject) {
        const toolsMenu = document.querySelector("#editorContainer .toolsMenu");
        const container = toolsMenu?.querySelector(":scope > .container");
        if (!toolsMenu || !container || container.querySelector(".qolboxMirrorItem")) return;
        const item = document.createElement("div");
        item.className = "item qolboxMirrorItem";
        item.dataset.qolboxIcon = "mirror";
        item.textContent = "Mirror";
        item.setAttribute("aria-label", "Mirror");
        item.setAttribute("aria-haspopup", "menu");
        item.setAttribute("aria-expanded", "false");
        const arrow = document.createElement("span");
        arrow.className = "qolboxMirrorArrow";
        arrow.textContent = "›";
        item.appendChild(arrow);
        const submenu = document.createElement("div");
        submenu.className = "container qolboxMirrorSubmenu";
        submenu.setAttribute("role", "menu");
        for (const [label, axis] of [["Horizontal", "horizontal"], ["Vertical", "vertical"]]) {
          const action = document.createElement("div");
          action.className = "item";
          action.textContent = label;
          action.addEventListener("click", () => {
            for (const renderer of getKnownFullscreenRenderers(windowObject)) {
              const state = statesByRenderer.get(renderer);
              if (state && mirrorSelection(state, axis)) break;
            }
            item.classList.remove("qolboxMirrorOpen");
            item.setAttribute("aria-expanded", "false");
          });
          submenu.appendChild(action);
        }
        item.appendChild(submenu);
        item.addEventListener("click", (event) => {
          if (event.target !== item) return;
          event.preventDefault();
          event.stopPropagation();
          const open = item.classList.toggle("qolboxMirrorOpen");
          item.setAttribute("aria-expanded", String(open));
        });
        new MutationObserver(() => {
          if (container.style.display === "none") {
            item.classList.remove("qolboxMirrorOpen");
            item.setAttribute("aria-expanded", "false");
          }
        }).observe(container, { attributeFilter: ["style"], attributes: true });
        const resetZoom = container.querySelector(".item:nth-child(2)");
        if (resetZoom) resetZoom.before(item);
        else container.appendChild(item);
      }
      function toOutlineLocalPoint(geometry, x, y) {
        const cosine = Math.cos(geometry.rotation);
        const sine = Math.sin(geometry.rotation);
        const offsetX = x - geometry.center.x;
        const offsetY = y - geometry.center.y;
        return {
          x: (offsetX * cosine + offsetY * sine) / geometry.scale.x,
          y: (-offsetX * sine + offsetY * cosine) / geometry.scale.y
        };
      }
      function getOutlineTopRight(geometry) {
        if (geometry.contours.length) {
          return geometry.contours.flatMap(
            (points) => Array.from({ length: points.length / 2 }, (_, index) => {
              const parent2 = { x: points[index * 2] ?? 0, y: points[index * 2 + 1] ?? 0 };
              return { local: toOutlineLocalPoint(geometry, parent2.x, parent2.y), parent: parent2 };
            })
          ).reduce(
            (best, point) => point.local.x - point.local.y > best.local.x - best.local.y ? point : best
          );
        }
        const parent = { x: geometry.points[2] ?? 0, y: geometry.points[3] ?? 0 };
        return { local: toOutlineLocalPoint(geometry, parent.x, parent.y), parent };
      }
      function getLabelPlacement(geometry) {
        if (!geometry.contours.length) {
          const anchor2 = getOutlineTopRight(geometry).parent;
          return {
            rotation: geometry.rotation,
            x: anchor2.x - 16 * Math.cos(geometry.rotation) + 13 * Math.sin(geometry.rotation),
            y: anchor2.y - 16 * Math.sin(geometry.rotation) - 13 * Math.cos(geometry.rotation)
          };
        }
        const candidates = geometry.contours.flatMap(
          (points, contourIndex) => Array.from({ length: points.length / 2 }, (_, index) => {
            const parent = { x: points[index * 2] ?? 0, y: points[index * 2 + 1] ?? 0 };
            return { contourIndex, index, local: toOutlineLocalPoint(geometry, parent.x, parent.y), parent };
          })
        );
        const anchor = candidates.reduce(
          (best, point) => point.local.x - point.local.y > best.local.x - best.local.y ? point : best
        );
        const contour = geometry.contours[anchor.contourIndex];
        const pointCount = contour.length / 2;
        const neighbours = [
          (anchor.index + pointCount - 1) % pointCount,
          (anchor.index + 1) % pointCount
        ].map((index) => {
          const parent = { x: contour[index * 2] ?? 0, y: contour[index * 2 + 1] ?? 0 };
          return { local: toOutlineLocalPoint(geometry, parent.x, parent.y), parent };
        });
        const neighbour = neighbours.reduce(
          (best, point) => Math.abs(point.local.x - anchor.local.x) > Math.abs(best.local.x - anchor.local.x) ? point : best
        );
        let rotation = Math.atan2(anchor.parent.y - neighbour.parent.y, anchor.parent.x - neighbour.parent.x);
        if (Math.cos(rotation) < 0) rotation += Math.PI;
        return {
          rotation,
          x: anchor.parent.x - 16 * Math.cos(rotation) + 13 * Math.sin(rotation),
          y: anchor.parent.y - 16 * Math.sin(rotation) - 13 * Math.cos(rotation)
        };
      }
      function getOutlineSignature(geometry) {
        if (!geometry) return "";
        const points = geometry.contours.length ? geometry.contours.flatMap((contour) => [contour.length, ...contour]) : geometry.points;
        return [
          geometry.center.x,
          geometry.center.y,
          geometry.rotation,
          geometry.scale.x,
          geometry.scale.y,
          ...points
        ].map((value) => Math.round(value * 1e3) / 1e3).join(",");
      }
      function clearGraphics(graphics) {
        callMethod2(graphics, "clear");
        callMethod2(graphics, "removeChildren");
      }
      function clearExtraLabels(state) {
        for (const label of state.extraLabels) {
          callMethod2(readNativeProperty(label, "parent"), "removeChild", [label]);
          callMethod2(label, "destroy");
        }
        state.extraLabels = [];
      }
      function clearExtraOutline(state) {
        clearExtraLabels(state);
        if (!state.extraOutline) return;
        clearGraphics(state.extraOutline);
        callMethod2(readNativeProperty(state.extraOutline, "parent"), "removeChild", [state.extraOutline]);
        state.extraOutline = null;
      }
      function drawExtraLabels(state, records) {
        const children = readNativeProperty(state.nativeOutline, "children");
        const template = Array.isArray(children) ? children[2] : null;
        const currentConstructor = readNativeReflectProperty(template, "constructor");
        if (isNativeObject(template) && typeof currentConstructor === "function") {
          state.labelConstructor = currentConstructor;
          state.labelStyle = readNativeProperty(template, "style");
        }
        const Text = state.labelConstructor;
        if (typeof Text !== "function") return;
        const labeled = records.filter(({ record }) => readNativeProperty(record.model, "id") != null);
        while (state.extraLabels.length > labeled.length) {
          const label = state.extraLabels.pop();
          callMethod2(readNativeProperty(label, "parent"), "removeChild", [label]);
          callMethod2(label, "destroy");
        }
        while (state.extraLabels.length < labeled.length) {
          let label;
          try {
            label = Reflect.construct(Text, ["", state.labelStyle]);
          } catch {
            return;
          }
          if (!isNativeObject(label)) return;
          callMethod2(readNativeProperty(state.renderer, "Cg"), "addChild", [label]);
          state.extraLabels.push(label);
        }
        labeled.forEach(({ geometry, record }, index) => {
          const label = state.extraLabels[index];
          const placement = getLabelPlacement(geometry);
          setNativeReflectProperty(label, "text", String(readNativeProperty(record.model, "id")));
          setNativeReflectProperty(label, "x", placement.x);
          setNativeReflectProperty(label, "y", placement.y);
          setNativeReflectProperty(label, "rotation", placement.rotation);
        });
      }
      function drawDashedPolygon(graphics, points, scale) {
        const dash = 6 / scale;
        const step = 10 / scale;
        for (let index = 0; index < points.length; index += 2) {
          const next = (index + 2) % points.length;
          const startX = points[index] ?? 0;
          const startY = points[index + 1] ?? 0;
          const endX = points[next] ?? 0;
          const endY = points[next + 1] ?? 0;
          const length = Math.hypot(endX - startX, endY - startY);
          for (let offset = 0; offset < length; offset += step) {
            const from = offset / length;
            const to = Math.min(offset + dash, length) / length;
            callMethod2(graphics, "moveTo", [startX + (endX - startX) * from, startY + (endY - startY) * from]);
            callMethod2(graphics, "lineTo", [startX + (endX - startX) * to, startY + (endY - startY) * to]);
          }
        }
      }
      function drawPrimaryOutline(state) {
        const primary = state.records[0];
        const parent = readNativeProperty(state.nativeOutline, "parent");
        if (!primary || !isNativeObject(parent)) return;
        const geometry = getWrapperOutlineGeometry(primary.wrapper, parent, "bounds");
        if (!geometry || !geometry.points.every(Number.isFinite)) return;
        const { bounds, center, rotation, scale } = geometry;
        const topRight = getOutlineTopRight(geometry).local;
        const labelPlacement = getLabelPlacement(geometry);
        const halfWidth = bounds.width / 2 + EDITOR_OUTLINE_PADDING_PX / scale.x;
        const halfHeight = bounds.height / 2 + EDITOR_OUTLINE_PADDING_PX / scale.y;
        const special = state.specialBodyId === Number(readNativeProperty(primary.model, "id"));
        callMethod2(state.nativeOutline, "clear");
        const outlineScale = Math.max(scale.x, scale.y);
        callMethod2(state.nativeOutline, "lineStyle", [1 / outlineScale, special ? 16731469 : readNativeProperty(primary.wrapper, "kv") ? 5307581 : 16777215, 1]);
        if (special) {
          drawDashedPolygon(state.nativeOutline, [
            -halfWidth,
            -halfHeight,
            halfWidth,
            -halfHeight,
            halfWidth,
            halfHeight,
            -halfWidth,
            halfHeight
          ], outlineScale);
        } else if (geometry.contours.length) {
          for (const contour of geometry.contours) {
            const local = Array.from({ length: contour.length / 2 }).flatMap((_, index) => {
              const point = toOutlineLocalPoint(
                geometry,
                contour[index * 2] ?? 0,
                contour[index * 2 + 1] ?? 0
              );
              return [point.x, point.y];
            });
            callMethod2(state.nativeOutline, "drawPolygon", [local]);
          }
        } else {
          callMethod2(state.nativeOutline, "drawRect", [-halfWidth, -halfHeight, halfWidth * 2, halfHeight * 2]);
        }
        setNativeReflectProperty(state.nativeOutline, "x", center.x);
        setNativeReflectProperty(state.nativeOutline, "y", center.y);
        setNativeReflectProperty(state.nativeOutline, "rotation", rotation);
        callMethod2(readNativeProperty(state.nativeOutline, "scale"), "set", [scale.x, scale.y]);
        state.outlineSignature = getOutlineSignature(geometry);
        const children = readNativeProperty(state.nativeOutline, "children");
        if (!Array.isArray(children)) return;
        const label = children[2];
        const Text = readNativeReflectProperty(label, "constructor");
        if (isNativeObject(label) && typeof Text === "function") {
          state.labelConstructor = Text;
          state.labelStyle = readNativeProperty(label, "style");
        }
        children.forEach((child, index) => {
          const [xOffset, yOffset] = index === 1 ? [9, 9] : index ? [16, 13] : [0, 0];
          callMethod2(readNativeProperty(child, "scale"), "set", [1 / scale.x, 1 / scale.y]);
          if (index === 2 && geometry.contours.length) {
            const point = toOutlineLocalPoint(geometry, labelPlacement.x, labelPlacement.y);
            setNativeReflectProperty(child, "x", point.x);
            setNativeReflectProperty(child, "y", point.y);
            setNativeReflectProperty(child, "rotation", labelPlacement.rotation - rotation);
          } else {
            setNativeReflectProperty(child, "x", topRight.x - xOffset / scale.x);
            setNativeReflectProperty(child, "y", topRight.y - yOffset / scale.y);
            if (index === 2) setNativeReflectProperty(child, "rotation", 0);
          }
        });
      }
      function drawExtraOutlines(state) {
        if (state.records.length < 2) {
          clearExtraOutline(state);
          return;
        }
        let graphics = state.extraOutline;
        if (!graphics) {
          const Graphics = readNativeReflectProperty(state.nativeOutline, "constructor");
          if (typeof Graphics !== "function") return;
          try {
            graphics = Reflect.construct(Graphics, []);
          } catch {
            return;
          }
          if (!isNativeObject(graphics)) return;
          callMethod2(readNativeProperty(state.renderer, "Cg"), "addChild", [graphics]);
          state.extraOutline = graphics;
        }
        clearGraphics(graphics);
        const parent = readNativeProperty(graphics, "parent");
        if (!isNativeObject(parent)) return;
        const outlined = [];
        for (const record of state.records.slice(1)) {
          const geometry = getWrapperOutlineGeometry(record.wrapper, parent, "bounds");
          if (!geometry?.points.every(Number.isFinite)) continue;
          callMethod2(graphics, "lineStyle", [1, 16777215, 1]);
          for (const contour of geometry.contours.length ? geometry.contours : [geometry.points]) {
            callMethod2(graphics, "drawPolygon", [contour]);
          }
          outlined.push({ geometry, record });
        }
        drawExtraLabels(state, outlined);
      }
      function redrawSelection(state) {
        syncRecords(state);
        if (!state.records.length) {
          state.outlineSignature = "";
          clearExtraOutline(state);
          return;
        }
        state.redrawing = true;
        try {
          Reflect.apply(state.originalNb, state.tool, []);
          refreshWrapperViews(state);
          const installedNb = readNativeProperty(state.tool, "nb");
          setNativeReflectProperty(state.tool, "nb", () => void 0);
          try {
            Reflect.apply(state.originalIv, state.tool, []);
          } finally {
            setNativeReflectProperty(state.tool, "nb", installedNb);
          }
          drawPrimaryOutline(state);
          drawExtraOutlines(state);
          Reflect.apply(state.originalNb, state.tool, []);
        } finally {
          state.redrawing = false;
        }
      }
      function clearEditorSelection(state) {
        setRecords(state, []);
        state.paintValues.clear();
        state.pointerDownRecords = null;
        state.outlineSignature = "";
        clearMarquee(state);
        clearGraphics(state.nativeOutline);
        clearExtraOutline(state);
        Reflect.apply(state.originalNb, state.tool, []);
        const close = document.querySelector(".editorPropertiesWindow .closeButton");
        if (close?.offsetParent) close.click();
      }
      function restoreSelection(state, records) {
        setNativeReflectProperty(state.tool, "xb", false);
        state.specialBodyId = null;
        if (!records.length) {
          clearEditorSelection(state);
          return;
        }
        setRecords(state, records);
        const primary = records[0];
        Reflect.apply(state.originalFv, state.tool, [primary.type, primary.model]);
        const paint = getPaint(primary);
        if (paint) {
          state.selecting = true;
          try {
            callMethod2(readNativeProperty(state.tool, "Av"), "bk", [getPaintToolInput(paint)]);
          } finally {
            state.selecting = false;
          }
        }
        redrawSelection(state);
        rememberPaintValues(state);
        patchPropertyControls(state);
      }
      function startGroupDrag(state, event) {
        const global = readNativeProperty(readNativeProperty(event, "data"), "global");
        const pointer = readNativeProperty(state.tool, "Cb");
        if (isNativeObject(pointer)) {
          setNativeReflectProperty(pointer, "x", Number(readNativeProperty(global, "x")));
          setNativeReflectProperty(pointer, "y", Number(readNativeProperty(global, "y")));
        }
        setNativeReflectProperty(state.tool, "mk", false);
        setNativeReflectProperty(state.tool, "xb", true);
        state.dragStart = getEventPoint(event);
        state.records.forEach((record) => callMethod2(record.wrapper, "wv"));
        getRendererView(state.renderer)?.parentElement?.classList.remove("qolboxEditorDragging");
      }
      function getEventPoint(event) {
        const global = readNativePath(event, ["data", "global"]);
        const x = Number(readNativeProperty(global, "x"));
        const y = Number(readNativeProperty(global, "y"));
        return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : null;
      }
      function clearMarquee(state) {
        getRendererView(state.renderer)?.parentElement?.classList.remove("qolboxEditorMarquee");
        const graphics = state.marquee?.graphics;
        state.marquee = null;
        if (!graphics) return;
        callMethod2(readNativeProperty(graphics, "parent"), "removeChild", [graphics]);
        callMethod2(graphics, "destroy");
      }
      function cancelMarquee(state) {
        const records = state.marquee?.records;
        if (!records) return;
        clearMarquee(state);
        restoreSelection(state, records);
      }
      function startMarquee(state, event, records) {
        const start = getEventPoint(event);
        const Graphics = readNativeReflectProperty(state.nativeOutline, "constructor");
        if (!start || typeof Graphics !== "function") return;
        let graphics;
        try {
          graphics = Reflect.construct(Graphics, []);
        } catch {
          return;
        }
        if (!isNativeObject(graphics)) return;
        callMethod2(readNativeProperty(state.renderer, "Cg"), "addChild", [graphics]);
        state.marquee = { graphics, modified: hasSelectionModifier(event), records, start };
        const editor = getRendererView(state.renderer)?.parentElement;
        editor?.classList.remove("qolboxEditorDragging");
      }
      function drawMarquee(state, event) {
        const marquee = state.marquee;
        const end = getEventPoint(event);
        if (!marquee || !end) return false;
        const area = getArea(marquee.start, end);
        callMethod2(marquee.graphics, "clear");
        if (Math.hypot(area.width, area.height) < MARQUEE_DRAG_THRESHOLD_PX) {
          getRendererView(state.renderer)?.parentElement?.classList.remove("qolboxEditorMarquee");
          Reflect.apply(state.originalNb, state.tool, []);
          return true;
        }
        getRendererView(state.renderer)?.parentElement?.classList.add("qolboxEditorMarquee");
        callMethod2(marquee.graphics, "lineStyle", [1, 16777215, 0.85]);
        callMethod2(marquee.graphics, "beginFill", [16777215, 0.12]);
        callMethod2(marquee.graphics, "drawRect", [area.x, area.y, area.width, area.height]);
        callMethod2(marquee.graphics, "endFill");
        Reflect.apply(state.originalNb, state.tool, []);
        return true;
      }
      function getSelectionTargets(state) {
        const targets = [];
        const visit = (display) => {
          if (!isNativeObject(display)) return;
          if (readNativeProperty(display, "objectType") != null) targets.push(display);
          const children = readNativeProperty(display, "children");
          if (Array.isArray(children)) children.forEach(visit);
        };
        visit(readNativeProperty(state.renderer, "Cg"));
        return targets;
      }
      function getMarqueeTargets(state, area) {
        return getSelectionTargets(state).filter((target) => {
          const bounds = readBounds(target);
          return bounds && areasIntersect(area, bounds);
        });
      }
      function renderedShapeIntersectsArea(state, record, area) {
        if (getOutlineMode(record) !== "rendered") return true;
        const visual = readNativeProperty(getRenderedView(state, record), "Ic");
        const parent = readNativeProperty(state.nativeOutline, "parent");
        if (!isNativeObject(visual) || !isNativeObject(parent)) return true;
        const contours = getRenderedPolygonContours(
          visual,
          parent,
          Array.isArray(readNativeProperty(readNativeProperty(record.wrapper, "pv"), "Sa"))
        );
        const rectangle = [
          area.x,
          area.y,
          area.x + area.width,
          area.y,
          area.x + area.width,
          area.y + area.height,
          area.x,
          area.y + area.height
        ];
        return !contours.length || contours.some((points) => polygonsIntersect(points, rectangle));
      }
      function getHitBody(state, event, records) {
        const direct = readNativePath(event, ["target", "sd", "Kc"]);
        if (isNativeObject(direct)) return direct;
        return records.find(
          (record) => record.type === "body" && renderedShapeContainsPoint(state, record, event)
        )?.model ?? null;
      }
      function selectNatively(state, event, modified, target = readNativeProperty(event, "target"), quiet = false) {
        let capturedType = "";
        let capturedModel = null;
        const previousCtrlKey = readNativeProperty(event, "ctrlKey");
        const previousTarget = readNativeProperty(event, "target");
        const previousClickedBody = readNativeProperty(state.tool, "gk");
        const previousClickTime = readNativeProperty(state.tool, "fk");
        const installedIv = readNativeProperty(state.tool, "Iv");
        const paintTool = readNativeProperty(state.tool, "Av");
        const originalPaint = readNativeProperty(paintTool, "bk");
        const captureProperties = function(type, model) {
          if (typeof type === "string" && isNativeObject(model)) {
            capturedType = type;
            capturedModel = model;
          }
          return quiet ? void 0 : Reflect.apply(state.originalFv, this, [type, model]);
        };
        state.selecting = true;
        if (modified) setNativeReflectProperty(state.tool, "gk", -1);
        setNativeReflectProperty(state.tool, "Fv", captureProperties);
        if (quiet) setNativeReflectProperty(state.tool, "Iv", () => void 0);
        if (isNativeObject(paintTool) && isNativeFunction2(originalPaint)) {
          setNativeReflectProperty(paintTool, "bk", function(paint) {
            if (quiet) return void 0;
            return Reflect.apply(originalPaint, this, [isNativeObject(paint) ? getPaintToolInput(paint) : paint]);
          });
        }
        setNativeReflectProperty(event, "ctrlKey", false);
        setNativeReflectProperty(event, "target", target);
        try {
          Reflect.apply(state.originalAb, state.tool, [event]);
        } finally {
          setNativeReflectProperty(event, "target", previousTarget);
          setNativeReflectProperty(event, "ctrlKey", previousCtrlKey);
          setNativeReflectProperty(state.tool, "Iv", installedIv);
          setNativeReflectProperty(state.tool, "Fv", state.originalFv);
          if (isNativeObject(paintTool) && isNativeFunction2(originalPaint)) {
            setNativeReflectProperty(paintTool, "bk", originalPaint);
          }
          if (quiet) {
            setNativeReflectProperty(state.tool, "gk", previousClickedBody);
            setNativeReflectProperty(state.tool, "fk", previousClickTime);
          }
          state.selecting = false;
        }
        const [wrapper] = getSelection(state.tool) ?? [];
        return wrapper && capturedModel ? { model: capturedModel, type: capturedType, wrapper } : null;
      }
      function selectGroupedBodyNatively(state, event) {
        if (!hasControlModifier(event)) return null;
        const body = readNativePath(event, ["target", "sd", "Kc"]);
        if (!isNativeObject(body) || !getBodyGroup(state, body)) return null;
        const selectedBody = readNativeProperty(state.tool, "yk");
        const shapeMode = readNativeProperty(state.tool, "wk");
        setNativeReflectProperty(state.tool, "yk", -1);
        setNativeReflectProperty(state.tool, "wk", false);
        try {
          const selected = selectNatively(state, event, false);
          return selected?.type === "body" && selected.model === body ? selected : null;
        } finally {
          setNativeReflectProperty(state.tool, "yk", selectedBody);
          setNativeReflectProperty(state.tool, "wk", shapeMode);
        }
      }
      function selectShapeNatively(state) {
        const event = state.lastPointerEvent;
        const body = readNativePath(event, ["target", "sd", "Kc"]);
        const id = Number(readNativeProperty(body, "id"));
        if (!isNativeObject(body) || !Number.isInteger(id)) return false;
        callMethod2(state.tool, "Mb", [id]);
        getSelection(state.tool)?.splice(0);
        setNativeReflectProperty(state.tool, "yk", id);
        setNativeReflectProperty(state.tool, "wk", false);
        setNativeReflectProperty(state.tool, "gk", -1);
        const selected = selectNatively(state, event, false);
        setNativeReflectProperty(state.tool, "xb", false);
        if (selected?.type !== "shape") return false;
        state.specialBodyId = null;
        setRecords(state, [selected]);
        redrawSelection(state);
        rememberPaintValues(state);
        patchPropertyControls(state);
        return true;
      }
      function selectInsertedModels(state, models, groupBodies = false) {
        if (!models.length) return;
        const inserted = new Set(models);
        const records = [];
        const selectedBody = readNativeProperty(state.tool, "yk");
        const shapeMode = readNativeProperty(state.tool, "wk");
        setNativeReflectProperty(state.tool, "yk", -1);
        setNativeReflectProperty(state.tool, "wk", false);
        try {
          for (const target of getSelectionTargets(state)) {
            const record = selectNatively(state, { data: { global: { x: 0, y: 0 } }, target }, true, target, true);
            if (record && inserted.has(record.model) && !records.some((candidate) => candidate.model === record.model)) records.push(record);
          }
        } finally {
          setNativeReflectProperty(state.tool, "yk", selectedBody);
          setNativeReflectProperty(state.tool, "wk", shapeMode);
        }
        if (records.length) {
          if (groupBodies) mergeBodyGroups(state, ...records.filter((record) => record.type === "body").map((record) => record.model));
          restoreSelection(state, records);
        }
      }
      function getPaintSample(state, event) {
        const point = getEventPoint(event);
        const parent = readNativeProperty(state.nativeOutline, "parent");
        if (!point || !isNativeObject(parent)) return null;
        for (const target of getSelectionTargets(state).reverse()) {
          const paint = readNativePath(target, ["td", "Hc"]);
          const bounds = readBounds(target);
          if (!isNativeObject(paint) || !bounds || !areasIntersect(bounds, { ...point, height: 0, width: 0 })) continue;
          const contains = callMethod2(target, "containsPoint", [readNativePath(event, ["data", "global"])]);
          const strokeWidth = Number(readNativeProperty(paint, "aa"));
          const visual = readNativeProperty(target, "Ic");
          const contours = getRenderedPolygonContours(visual, parent, false);
          const edgeDistance = contours.length ? Math.min(...contours.map((contour) => distanceToPolygon(contour, point))) : Math.min(point.x - bounds.x, bounds.x + bounds.width - point.x, point.y - bounds.y, bounds.y + bounds.height - point.y);
          if (contains === false && !(strokeWidth > 0 && edgeDistance <= Math.max(2, strokeWidth / 2))) continue;
          const property = strokeWidth > 0 && edgeDistance <= Math.max(2, strokeWidth / 2) ? "la" : "color";
          const color = Number(readNativeProperty(paint, property));
          return Number.isInteger(color) && color >= 0 && color <= 16777215 ? { color, property } : null;
        }
        return null;
      }
      function sampleColor(state, event) {
        const sample = getPaintSample(state, event);
        const paintTool = readNativeProperty(state.tool, "Av");
        if (!sample || !isNativeObject(paintTool)) return;
        const values = Object.fromEntries(getCopyableValues(paintTool));
        state.selecting = true;
        try {
          callMethod2(paintTool, "bk", [{ ...values, [sample.property]: sample.color }]);
        } finally {
          state.selecting = false;
        }
        let changed = false;
        for (const record of state.records) {
          const paint = getPaint(record);
          if (!paint || !Reflect.has(paint, sample.property)) continue;
          if (Number(readNativeProperty(paint, sample.property)) === sample.color) continue;
          setNativeReflectProperty(paint, sample.property, sample.color);
          callMethod2(record.wrapper, "fv", [paint]);
          changed = true;
        }
        if (changed) callMethod2(state.tool, "Eb");
        state.paintValues = getCopyableValues(paintTool);
        redrawSelection(state);
        updatePaintPreviews(state);
      }
      function applyMarqueeSelection(state, event, marquee) {
        const end = getEventPoint(event);
        if (!end) return;
        if (Math.hypot(end.x - marquee.start.x, end.y - marquee.start.y) < MARQUEE_DRAG_THRESHOLD_PX) {
          if (marquee.modified) restoreSelection(state, marquee.records);
          else clearEditorSelection(state);
          return;
        }
        const candidates = [];
        const area = getArea(marquee.start, end);
        for (const target of getMarqueeTargets(state, area)) {
          const record = selectNatively(state, event, true, target, true);
          if (record && renderedShapeIntersectsArea(state, record, area) && !findWrapperRecord(candidates, record.wrapper)) candidates.push(record);
        }
        const expanded = candidates.flatMap((candidate) => expandBodyGroup(state, candidate));
        const records = marquee.modified ? [...marquee.records] : [];
        for (const candidate of expanded.filter(
          (record, index) => expanded.findIndex((other) => other.model === record.model) === index
        )) {
          const existing = records.findIndex(
            (record) => record.model === candidate.model || wrapperMatchesModel(candidate.wrapper, record.model)
          );
          if (existing >= 0) {
            if (marquee.modified) records.splice(existing, 1);
          } else {
            records.push(candidate);
          }
        }
        restoreSelection(state, records);
      }
      function handleSelectionStart(state, event) {
        state.lastPointerEvent = event;
        if (!state.pointerDownRecords) syncRecords(state);
        const oldRecords = [...state.pointerDownRecords ?? state.records];
        const specialBodyId = state.specialBodyId;
        if (readNativeProperty(state.tool, "yb") === true && isColorPickerActive()) {
          setRecords(state, oldRecords);
          state.samplingColor = true;
          getRendererView(state.renderer)?.parentElement?.classList.remove("qolboxEditorDragging");
          sampleColor(state, event);
          return void 0;
        }
        const hitBody = getHitBody(state, event, oldRecords);
        if (specialBodyId === Number(readNativeProperty(hitBody, "id")) && !hasSelectionModifier(event)) {
          state.specialDragStart = getEventPoint(event);
          startGroupDrag(state, event);
          return void 0;
        }
        const special = selectGroupedBodyNatively(state, event);
        if (special) {
          state.specialBodyId = Number(readNativeProperty(special.model, "id"));
          setRecords(state, [special]);
          startGroupDrag(state, event);
          redrawSelection(state);
          rememberPaintValues(state);
          patchPropertyControls(state);
          return void 0;
        }
        const modified = hasSelectionModifier(event);
        const selected = selectNatively(state, event, modified);
        if (selected && Number(readNativeProperty(selected?.model, "id")) === specialBodyId && !modified) {
          state.specialBodyId = specialBodyId;
          state.specialDragStart = getEventPoint(event);
          setRecords(state, [selected]);
          startGroupDrag(state, event);
          redrawSelection(state);
          patchPropertyControls(state);
          return void 0;
        }
        if (selected && !isSelectionOutlineTarget(state, event) && !renderedShapeContainsPoint(state, selected, event)) {
          restoreSelection(state, oldRecords);
          if (readNativeProperty(state.tool, "yb") === true) startMarquee(state, event, oldRecords);
          return void 0;
        }
        if (!selected) {
          if (readNativeProperty(state.tool, "yb") === true && isEditorBackgroundTarget(state, event)) {
            startMarquee(state, event, oldRecords);
          } else {
            syncRecords(state);
          }
          return void 0;
        }
        state.specialBodyId = null;
        const selectedRecords = expandBodyGroup(state, selected);
        const selectedModels = new Set(selectedRecords.map((record) => record.model));
        const existing = oldRecords.filter((record) => selectedModels.has(record.model));
        if (modified && existing.length) {
          restoreSelection(state, oldRecords.filter((record) => !selectedModels.has(record.model)));
          return void 0;
        }
        const records = modified ? [...selectedRecords, ...oldRecords.filter((record) => !selectedModels.has(record.model))] : existing.length && selectedRecords.length === 1 && oldRecords.length > 1 ? [...selectedRecords, ...oldRecords.filter((record) => !selectedModels.has(record.model))] : selectedRecords;
        setRecords(state, records);
        startGroupDrag(state, event);
        redrawSelection(state);
        rememberPaintValues(state);
        patchPropertyControls(state);
        return void 0;
      }
      function handleSelectionMove(state, event) {
        if (drawMarquee(state, event)) return void 0;
        if (readNativeProperty(state.tool, "xb") === true) {
          const point = getEventPoint(event);
          if (!state.dragStart || point && Math.hypot(point.x - state.dragStart.x, point.y - state.dragStart.y) >= MARQUEE_DRAG_THRESHOLD_PX) getRendererView(state.renderer)?.parentElement?.classList.add("qolboxEditorDragging");
        }
        syncRecords(state);
        if (state.records.length < 2) return Reflect.apply(state.originalWb, state.tool, [event]);
        const [primary, ...secondary] = state.records;
        if (!primary) return void 0;
        const originalMove = readNativeProperty(primary.wrapper, "mv");
        if (typeof originalMove !== "function") return Reflect.apply(state.originalWb, state.tool, [event]);
        const ownMove = Object.getOwnPropertyDescriptor(primary.wrapper, "mv");
        const installedIv = readNativeProperty(state.tool, "Iv");
        const installedNb = readNativeProperty(state.tool, "nb");
        let delta;
        const captureMove = function(value) {
          delta = value;
          return Reflect.apply(originalMove, this, [value]);
        };
        setNativeReflectProperty(primary.wrapper, "mv", captureMove);
        setNativeReflectProperty(state.tool, "Iv", () => void 0);
        setNativeReflectProperty(state.tool, "nb", () => void 0);
        try {
          Reflect.apply(state.originalWb, state.tool, [event]);
        } finally {
          if (ownMove) Object.defineProperty(primary.wrapper, "mv", ownMove);
          else Reflect.deleteProperty(primary.wrapper, "mv");
          setNativeReflectProperty(state.tool, "Iv", installedIv);
          setNativeReflectProperty(state.tool, "nb", installedNb);
        }
        if (isNativeObject(delta)) secondary.forEach((record) => callMethod2(record.wrapper, "mv", [delta]));
        redrawSelection(state);
        return void 0;
      }
      function handleSelectionEnd(state, event, original) {
        state.pointerDownRecords = null;
        state.dragStart = null;
        if (state.samplingColor) {
          state.samplingColor = false;
          setNativeReflectProperty(state.tool, "xb", false);
          return void 0;
        }
        const marquee = state.marquee;
        if (!marquee) {
          const result = Reflect.apply(original, state.tool, [event]);
          getRendererView(state.renderer)?.parentElement?.classList.remove("qolboxEditorDragging");
          const start = state.specialDragStart;
          state.specialDragStart = null;
          const end = getEventPoint(event);
          const special = state.records.find((record) => Number(readNativeProperty(record.model, "id")) === state.specialBodyId);
          if (start && end && special && Math.hypot(end.x - start.x, end.y - start.y) < MARQUEE_DRAG_THRESHOLD_PX) {
            restoreSelection(state, expandBodyGroup(state, special));
          }
          return result;
        }
        clearMarquee(state);
        applyMarqueeSelection(state, event, marquee);
        Reflect.apply(state.originalNb, state.tool, []);
        return void 0;
      }
      function installRendererRefresh(state) {
        const original = readNativeProperty(state.renderer, "render");
        if (typeof original !== "function") return;
        const wrapped = function(...args) {
          const result = Reflect.apply(original, this, args);
          const recordsChanged = syncRecords(state);
          if (!state.records.length) {
            const hadExtraOutline = Boolean(state.extraOutline);
            clearExtraOutline(state);
            if (hadExtraOutline) Reflect.apply(original, this, args);
          } else {
            const viewsChanged = refreshWrapperViews(state);
            const parent = readNativeProperty(state.nativeOutline, "parent");
            const primary = state.records[0];
            const geometryChanged = isNativeObject(parent) && getOutlineSignature(getWrapperOutlineGeometry(primary.wrapper, parent, "bounds")) !== state.outlineSignature;
            if (!state.redrawing && !state.selecting && !state.refreshPending && (recordsChanged || viewsChanged || geometryChanged)) {
              state.refreshPending = true;
              queueMicrotask(() => {
                state.refreshPending = false;
                redrawSelection(state);
              });
            }
          }
          return result;
        };
        setNativeReflectProperty(state.renderer, "render", wrapped);
      }
      function installPaintSync(state) {
        const paintTool = readNativeProperty(state.tool, "Av");
        const emitter = readNativeProperty(paintTool, "Pk");
        const original = readNativeProperty(emitter, "Tk");
        if (!isNativeObject(emitter) || typeof original !== "function") return;
        const wrapped = function(...args) {
          const currentValues = getCopyableValues(paintTool);
          const changedKeys = new Set([...currentValues].flatMap(
            ([key, value]) => !copyableEqual(state.paintValues.get(key), value) ? [key] : []
          ));
          const strokeWidth = document.querySelector("#editorContainer .strokeThicknessInput");
          if (strokeWidth?.dataset.qolboxMixed === "true" && document.activeElement === strokeWidth && currentValues.has("aa")) {
            changedKeys.add("aa");
          }
          const result = Reflect.apply(original, this, args);
          if (!state.selecting && changedKeys.size) {
            for (const record of state.records.slice(1)) {
              const paint = getPaint(record);
              if (!paint) continue;
              for (const key of changedKeys) {
                if (Reflect.has(paint, key)) setNativeReflectProperty(paint, key, currentValues.get(key));
              }
              callMethod2(record.wrapper, "fv", [paint]);
            }
            redrawSelection(state);
          }
          state.paintValues = currentValues;
          updatePaintPreviews(state);
          return result;
        };
        setNativeReflectProperty(emitter, "Tk", wrapped);
      }
      function isCopyable(value) {
        return value === null || ["boolean", "number", "string", "undefined"].includes(typeof value) || Array.isArray(value) && value.every((item) => item === null || ["boolean", "number", "string"].includes(typeof item));
      }
      function cloneCopyable(value) {
        return Array.isArray(value) ? [...value] : value;
      }
      function getCopyableValues(model) {
        const values = /* @__PURE__ */ new Map();
        let current = model;
        for (let depth = 0; current && current !== Object.prototype && depth < 8; depth += 1) {
          for (const key of Reflect.ownKeys(current)) {
            if (key === "constructor" || values.has(key)) continue;
            const value = readNativeReflectProperty(model, key);
            if (isCopyable(value)) values.set(key, cloneCopyable(value));
          }
          current = Object.getPrototypeOf(current);
        }
        return values;
      }
      function copyableEqual(left, right) {
        return Array.isArray(left) && Array.isArray(right) ? left.length === right.length && left.every((value, index) => Object.is(value, right[index])) : Object.is(left, right);
      }
      function getPathValue(source, path) {
        let value = source;
        for (const key of path) {
          if (!isNativeObject(value) || !Reflect.has(value, key)) return void 0;
          value = readNativeReflectProperty(value, key);
        }
        return value;
      }
      function hasPropertyPath(source, path) {
        let value = source;
        for (const key of path) {
          if (!isNativeObject(value) || !Reflect.has(value, key)) return false;
          value = readNativeReflectProperty(value, key);
        }
        return true;
      }
      function setPathValue(source, path, value) {
        let parent = source;
        for (const key2 of path.slice(0, -1)) parent = readNativeReflectProperty(parent, key2);
        const key = path[path.length - 1];
        if (isNativeObject(parent) && key != null) setNativeReflectProperty(parent, key, value);
      }
      function snapshotProperty(state, path, force, kind) {
        const records = getCompatibleRecords(state).filter((record) => hasPropertyPath(record.model, path));
        if (records.length < 2) return null;
        const model = state.records[0]?.model;
        if (!model) return null;
        const value = getPathValue(model, path);
        return isCopyable(value) ? {
          force,
          kind,
          model,
          path,
          records,
          state,
          value: cloneCopyable(value),
          values: new Map(records.map((record) => [record.model, cloneCopyable(getPathValue(record.model, path))]))
        } : null;
      }
      function syncChangedProperties(snapshot) {
        const { force, kind, model, path, records, state, value } = snapshot;
        if (state.records[0]?.model !== model) return;
        const after = getPathValue(model, path);
        if (!isCopyable(after) || !force && copyableEqual(value, after)) return;
        const group = path.length === 1 && path[0] === "angle" ? getCompleteBodyGroup(state, records) : null;
        const angle = group ? Number(after) - Number(value) : 0;
        const center = group && Number.isFinite(angle) ? getBodyGroupCenter(state, group) : null;
        if (center && angle) orbitBodies(group, center, angle);
        for (const record of records.slice(1)) {
          if (kind === "connect") {
            setPathValue(record.model, path, after);
            const anchor = readNativeProperty(record.model, "Oa");
            if (isNativeObject(anchor)) {
              const body = Number(after) === -1 ? readNativePath(state.tool, ["Bv", "pl", Number(readNativeProperty(record.model, "La"))]) : null;
              setNativeReflectProperty(anchor, "x", Number(readNativeProperty(body, "x")) || 0);
              setNativeReflectProperty(anchor, "y", Number(readNativeProperty(body, "y")) || 0);
            }
            continue;
          }
          const current = getPathValue(record.model, path);
          if (group && typeof current === "number") {
            setPathValue(record.model, path, current + angle);
            continue;
          }
          if (Array.isArray(current) && Array.isArray(after)) current.splice(0, current.length, ...after);
          else setPathValue(record.model, path, after);
        }
        redrawSelection(state);
      }
      function applyRelativeProperty(snapshot, amount) {
        const { model, path, records, state } = snapshot;
        if (state.records[0]?.model !== model) return;
        const delta = path.length === 1 && path[0] === "angle" ? amount * Math.PI / 180 : amount;
        const group = path.length === 1 && path[0] === "angle" ? getCompleteBodyGroup(state, records) : null;
        const center = group && delta ? getBodyGroupCenter(state, group) : null;
        if (center) orbitBodies(group, center, delta);
        for (const record of records) {
          const current = snapshot.values.get(record.model);
          if (typeof current === "number") setPathValue(record.model, path, current + delta);
        }
      }
      function getPropertyPath(control, model) {
        const title = control.closest(".row")?.querySelector(".title")?.textContent ?? "";
        if (title === "Poly point x" || title === "Poly point y") {
          const matching = [...document.querySelectorAll(".editorPropertiesWindow input, .editorPropertiesWindow select")].filter((candidate) => candidate.closest(".row")?.querySelector(".title")?.textContent === title);
          const index = matching.indexOf(control);
          return index >= 0 && hasPropertyPath(model, ["ca", index, title.endsWith("x") ? "x" : "y"]) ? ["ca", index, title.endsWith("x") ? "x" : "y"] : null;
        }
        return EDITOR_PROPERTY_PATHS[title]?.find((path) => hasPropertyPath(model, path)) ?? null;
      }
      function getComparablePropertyValue(control, model, path) {
        const value = getPathValue(model, path);
        return control.closest(".row")?.querySelector(".title")?.textContent === "Connect to" ? Number(value) === -1 ? -1 : 0 : value;
      }
      function setMixedControl(control, mixed) {
        if (mixed && control instanceof HTMLInputElement && control.dataset.qolboxMixed !== "true") {
          control.dataset.qolboxPrimaryValue = control.value;
        }
        if (mixed) control.dataset.qolboxMixed = "true";
        else delete control.dataset.qolboxMixed;
        if (control instanceof HTMLInputElement) {
          if (mixed) {
            guardMixedInputValue(control);
            control.value = "";
            control.placeholder = "Mixed";
          } else if (control.placeholder === "Mixed") {
            control.placeholder = "";
            delete control.dataset.qolboxPrimaryValue;
          }
          return;
        }
        if (!(control instanceof HTMLSelectElement)) return;
        const existing = [...control.options].find((option2) => option2.value === MIXED_OPTION_VALUE);
        if (!mixed) {
          existing?.remove();
          return;
        }
        const option = existing ?? new Option("Mixed", MIXED_OPTION_VALUE, true, true);
        option.disabled = true;
        if (!existing) control.add(option, 0);
        control.value = MIXED_OPTION_VALUE;
      }
      function installRelativePropertyCommands(input, state, path) {
        if (relativeCommandInputs.has(input)) return;
        relativeCommandInputs.add(input);
        input.addEventListener("focus", () => {
          input.dataset.qolboxCommandBase = input.dataset.qolboxPrimaryValue ?? input.value;
        });
        const commit = (event) => {
          const match = /^=([+-])\s*(\d+(?:\.\d*)?|\.\d+)$/i.exec(input.value.trim());
          if (!match) return;
          const modelValue = getPathValue(state.records[0]?.model ?? {}, path);
          const base = typeof modelValue === "number" ? path.length === 1 && path[0] === "angle" ? modelValue * 180 / Math.PI : modelValue : Number(input.dataset.qolboxPrimaryValue ?? input.dataset.qolboxCommandBase);
          const amount = Number(match[2]);
          if (!Number.isFinite(base) || !Number.isFinite(amount)) return;
          const tab = event instanceof KeyboardEvent && event.key === "Tab";
          if (!tab) {
            event.preventDefault();
            event.stopImmediatePropagation();
          }
          const next = String(base + (match[1] === "-" ? -amount : amount));
          input.value = next;
          const delta = match[1] === "-" ? -amount : amount;
          relativePropertyUpdates.set(input, delta);
          try {
            input.dispatchEvent(new Event("input", { bubbles: true }));
          } finally {
            relativePropertyUpdates.delete(input);
          }
          if (input.dataset.qolboxMixed === "true") input.dataset.qolboxPrimaryValue = next;
          input.dataset.qolboxCommandBase = next;
        };
        input.addEventListener("change", commit, true);
        input.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === "Tab") commit(event);
        }, true);
      }
      function guardMixedInputValue(input) {
        if (guardedMixedInputs.has(input)) return;
        const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
        if (!descriptor?.get || !descriptor.set) return;
        guardedMixedInputs.add(input);
        Object.defineProperty(input, "value", {
          configurable: true,
          get: descriptor.get,
          set(value) {
            descriptor.set?.call(this, this.dataset.qolboxMixed === "true" && document.activeElement !== this ? "" : value);
          }
        });
      }
      function updateMixedPropertyControls(state) {
        const records = getCompatibleRecords(state);
        for (const control of document.querySelectorAll(".editorPropertiesWindow input, .editorPropertiesWindow select")) {
          const path = propertyPaths.get(control);
          if (!path) continue;
          const values = records.filter((record) => hasPropertyPath(record.model, path)).map((record) => getComparablePropertyValue(control, record.model, path));
          setMixedControl(control, values.length > 1 && values.some((value) => !copyableEqual(values[0], value)));
        }
      }
      function colorHex(value) {
        const color = Number(value);
        return Number.isFinite(color) ? `#${(color >>> 0).toString(16).padStart(6, "0").slice(-6)}` : null;
      }
      function setPaintPreview(selector, colors) {
        const preview = document.querySelector(`#editorContainer ${selector}`);
        if (!preview || !colors.length) return;
        const unique = [...new Set(colors)].sort();
        preview.dataset.qolboxMixedColors = unique.join(",");
        if (unique.length === 1) {
          preview.style.backgroundColor = unique[0] ?? "";
          preview.style.backgroundImage = "";
          preview.style.backgroundPosition = "";
          preview.style.backgroundRepeat = "";
          preview.style.backgroundSize = "";
          return;
        }
        const rowCount = unique.length < 3 ? 1 : Math.max(2, Math.floor(Math.sqrt(unique.length)));
        const columns = Math.ceil(unique.length / rowCount);
        const rows = Array.from(
          { length: Math.ceil(unique.length / columns) },
          (_, index) => unique.slice(index * columns, (index + 1) * columns)
        );
        let used = 0;
        preview.style.backgroundColor = "";
        preview.style.backgroundImage = rows.map((row) => `linear-gradient(to right, ${row.map(
          (color, index) => `${color} ${index * 100 / row.length}% ${(index + 1) * 100 / row.length}%`
        ).join(", ")})`).join(",");
        preview.style.backgroundPosition = rows.map((row) => {
          const height = row.length / unique.length;
          const position = height === 1 ? 0 : used / unique.length / (1 - height) * 100;
          used += row.length;
          return `0 ${position}%`;
        }).join(",");
        preview.style.backgroundRepeat = "no-repeat";
        preview.style.backgroundSize = rows.map((row) => `100% ${row.length * 100 / unique.length}%`).join(",");
      }
      function updatePaintPreviews(state) {
        const paints = state.records.map(getPaint).filter((paint) => Boolean(paint));
        const strokeWidths = paints.filter((paint) => Reflect.has(paint, "aa")).map((paint) => readNativeProperty(paint, "aa"));
        const strokeWidth = document.querySelector("#editorContainer .strokeThicknessInput");
        if (strokeWidth) {
          setMixedControl(strokeWidth, strokeWidths.length > 1 && strokeWidths.some((value) => !copyableEqual(strokeWidths[0], value)));
        }
        setPaintPreview(".fillPreview", paints.flatMap((paint) => colorHex(readNativeProperty(paint, "color")) ?? []));
        setPaintPreview(".strokeColorPreview", paints.flatMap(
          (paint) => Number(readNativeProperty(paint, "aa")) > 0 ? colorHex(readNativeProperty(paint, "la")) ?? [] : []
        ));
        updateHexInputs(state);
      }
      function updateHexInputs(state) {
        const paints = state.records.map(getPaint).filter((paint) => Boolean(paint));
        const paintTool = readNativeProperty(state.tool, "Av");
        const sources = paints.length ? paints : isNativeObject(paintTool) ? [paintTool] : [];
        setHexInputValue(
          document.querySelector("#editorContainer .qolboxFillHex"),
          sources.flatMap((paint) => colorHex(readNativeProperty(paint, "color")) ?? [])
        );
        setHexInputValue(
          document.querySelector("#editorContainer .qolboxStrokeHex"),
          sources.flatMap((paint) => colorHex(readNativeProperty(paint, "la")) ?? [])
        );
        updateBackgroundHexInputs();
      }
      function updateBackgroundHexInputs() {
        const settings = getActiveEditorContext()?.settings;
        if (!settings) return;
        setHexInputValue(
          document.querySelector("#editorContainer .qolboxBackgroundTopHex"),
          colorHex(readNativeProperty(settings, "Kn")) ? [colorHex(readNativeProperty(settings, "Kn"))] : []
        );
        setHexInputValue(
          document.querySelector("#editorContainer .qolboxBackgroundBottomHex"),
          colorHex(readNativeProperty(settings, "Xn")) ? [colorHex(readNativeProperty(settings, "Xn"))] : []
        );
      }
      function rememberPaintValues(state) {
        const paintTool = readNativeProperty(state.tool, "Av");
        if (isNativeObject(paintTool)) state.paintValues = getCopyableValues(paintTool);
        updatePaintPreviews(state);
      }
      function patchPropertyControls(state) {
        patchSubbodyHeader(state);
        const controls = document.querySelectorAll(".editorPropertiesWindow input, .editorPropertiesWindow select");
        for (const control of controls) {
          const model = state.records[0]?.model;
          const path = model && getPropertyPath(control, model);
          if (!path) continue;
          propertyPaths.set(control, path);
          if (control instanceof HTMLInputElement && typeof getPathValue(model, path) === "number") {
            installRelativePropertyCommands(control, state, path);
          }
          for (const property of ["oninput", "onchange", "onclick"]) {
            const original = control[property];
            if (typeof original !== "function" || readNativeReflectProperty(original, PROPERTY_HANDLER_MARKER)) continue;
            const wrapped = function(event) {
              if (this instanceof HTMLInputElement && this.value.trimStart().startsWith("=") && !relativePropertyUpdates.has(this)) return void 0;
              const mixed = this.dataset.qolboxMixed === "true";
              const kind = this.closest(".row")?.querySelector(".title")?.textContent === "Connect to" ? "connect" : null;
              const snapshot = snapshotProperty(state, path, mixed, kind);
              const relative = this instanceof HTMLInputElement ? relativePropertyUpdates.get(this) : void 0;
              if (snapshot && relative != null) {
                callMethod2(state.tool, "Eb");
                applyRelativeProperty(snapshot, relative);
              }
              const result = Reflect.apply(original, this, [event]);
              if (snapshot) {
                if (relative != null) {
                  redrawSelection(state);
                } else syncChangedProperties(snapshot);
              }
              updateMixedPropertyControls(state);
              return result;
            };
            Object.defineProperty(wrapped, PROPERTY_HANDLER_MARKER, { value: true });
            setNativeReflectProperty(control, property, wrapped);
          }
        }
        updateMixedPropertyControls(state);
      }
      function patchSubbodyHeader(state) {
        const title = document.querySelector(".editorPropertiesWindow .topBar");
        if (!title || state.specialBodyId == null) return;
        const text = [...title.childNodes].find((node) => node.nodeType === Node.TEXT_NODE);
        if (text) text.textContent = "Subbody";
        else title.prepend(document.createTextNode("Subbody"));
        if (title.querySelector(".qolboxUngroupButton")) return;
        const record = state.records.find((candidate) => Number(readNativeProperty(candidate.model, "id")) === state.specialBodyId);
        if (!record || !getBodyGroup(state, record.model)) return;
        const button = document.createElement("button");
        button.className = "qolboxUngroupButton";
        button.type = "button";
        button.textContent = "Ungroup";
        button.addEventListener("pointerdown", (event) => event.stopPropagation());
        button.addEventListener("click", (event) => {
          event.stopPropagation();
          forgetGroupedBody(state, record.model);
          restoreSelection(state, [record]);
        });
        title.appendChild(button);
      }
      function installEditorMergeGrouping(windowObject) {
        if (!isNativeObject(windowObject) || mergeGroupingWindows.has(windowObject)) return;
        const documentObject = readNativeProperty(windowObject, "document");
        const addEventListener = readNativeProperty(documentObject, "addEventListener");
        if (!isNativeObject(documentObject) || !isNativeFunction2(addEventListener)) return;
        mergeGroupingWindows.add(windowObject);
        Reflect.apply(addEventListener, documentObject, ["click", (event) => {
          const control = callMethod2(readNativeProperty(event, "target"), "closest", [".editorPropertiesWindow *"]);
          const panel = callMethod2(control, "closest", [".editorPropertiesWindow"]);
          const title = callMethod2(panel, "querySelector", [".topBar"]);
          if (String(readNativeProperty(control, "textContent") ?? "").trim().toLowerCase() !== "merge" || !String(readNativeProperty(title, "textContent") ?? "").includes("Merge Shapes")) return;
          const inputs = callMethod2(panel, "querySelectorAll", ["input"]);
          const state = activeSelectionState;
          const bodies = state && readNativePath(state.tool, ["Bv", "pl"]);
          const source = Array.isArray(bodies) ? bodies[Number(readNativeProperty(readNativeProperty(inputs, 0), "value"))] : null;
          const target = Array.isArray(bodies) ? bodies[Number(readNativeProperty(readNativeProperty(inputs, 1), "value"))] : null;
          if (!state || !isNativeObject(source) || !isNativeObject(target) || source === target) return;
          callMethod2(event, "preventDefault");
          callMethod2(event, "stopImmediatePropagation");
          mergeBodyGroups(state, source, target);
        }, true]);
      }
      function installSelectionTool(renderer, tool) {
        if (statesByRenderer.has(renderer)) return;
        const root = readNativeProperty(renderer, "Cg");
        const children = readNativeProperty(root, "children");
        const nativeOutline = Array.isArray(children) ? children[children.length - 1] : null;
        const originalAb = readNativeProperty(tool, "ab");
        const originalWb = readNativeProperty(tool, "wb");
        const originalIv = readNativeProperty(tool, "Iv");
        const originalNb = readNativeProperty(tool, "nb");
        const originalPb = readNativeProperty(tool, "pb");
        const originalUb = readNativeProperty(tool, "ub");
        const originalFv = readNativeProperty(tool, "Fv");
        if (!isNativeObject(nativeOutline) || !isNativeFunction2(originalAb) || !isNativeFunction2(originalWb) || !isNativeFunction2(originalIv) || !isNativeFunction2(originalNb) || !isNativeFunction2(originalPb) || !isNativeFunction2(originalUb) || !isNativeFunction2(originalFv)) return;
        const state = {
          bodyGroups: /* @__PURE__ */ new Map(),
          dragStart: null,
          extraLabels: [],
          extraOutline: null,
          nativeOutline,
          originalAb,
          originalFv,
          originalIv,
          originalNb,
          originalPb,
          originalUb,
          originalWb,
          outlineSignature: "",
          labelConstructor: null,
          labelStyle: null,
          lastPointerEvent: null,
          marquee: null,
          paintValues: /* @__PURE__ */ new Map(),
          pointerDownRecords: null,
          records: [],
          redrawing: false,
          refreshPending: false,
          renderer,
          samplingColor: false,
          selecting: false,
          specialBodyId: null,
          specialDragStart: null,
          tool
        };
        statesByRenderer.set(renderer, state);
        activeSelectionState = state;
        if (pendingPaintHex.size) {
          const paintTool = readNativeProperty(tool, "Av");
          if (isNativeObject(paintTool)) {
            callMethod2(paintTool, "bk", [{
              ...Object.fromEntries(getCopyableValues(paintTool)),
              ...Object.fromEntries(pendingPaintHex)
            }]);
            pendingPaintHex.clear();
            state.paintValues = getCopyableValues(paintTool);
          }
        }
        window.addEventListener("blur", () => {
          cancelMarquee(state);
          state.dragStart = null;
          state.samplingColor = false;
          state.specialDragStart = null;
          getRendererView(state.renderer)?.parentElement?.classList.remove("qolboxEditorDragging");
        });
        setNativeReflectProperty(tool, "ab", function(event) {
          return handleSelectionStart(state, event);
        });
        setNativeReflectProperty(tool, "wb", function(event) {
          return handleSelectionMove(state, event);
        });
        setNativeReflectProperty(tool, "ub", function(event) {
          return handleSelectionEnd(state, event, state.originalUb);
        });
        setNativeReflectProperty(tool, "pb", function(event) {
          return handleSelectionEnd(state, event, state.originalPb);
        });
        setNativeReflectProperty(tool, "Iv", function() {
          if (state.selecting) return Reflect.apply(state.originalIv, state.tool, []);
          redrawSelection(state);
          return void 0;
        });
        installRendererRefresh(state);
        installPaintSync(state);
      }
      function discoverSelectionTool(renderer, listener, callback) {
        const descriptor = Object.getOwnPropertyDescriptor(Array.prototype, "forEach");
        if (!descriptor) return;
        const stop = {};
        const captureForEach = function() {
          const tool = Array.isArray(this) ? this.find(isSelectionTool) : null;
          if (tool) installSelectionTool(renderer, tool);
          throw stop;
        };
        try {
          Object.defineProperty(Array.prototype, "forEach", { ...descriptor, value: captureForEach });
          Reflect.apply(callback, readNativeProperty(listener, "context"), [{
            data: { button: 0, global: { x: 0, y: 0 } }
          }]);
        } catch (error) {
          if (error !== stop) return;
        } finally {
          Object.defineProperty(Array.prototype, "forEach", descriptor);
        }
      }
      function installPointerCapture(renderer) {
        if (statesByRenderer.has(renderer)) return;
        const events = readNativeProperty(readNativeProperty(renderer, "Cg"), "_events");
        const rawListeners = readNativeProperty(events, "pointerdown");
        const listeners = Array.isArray(rawListeners) ? rawListeners : [rawListeners];
        for (const listener of listeners) {
          const original = readNativeProperty(listener, "fn");
          if (!isNativeObject(listener) || typeof original !== "function" || readNativeReflectProperty(original, POINTER_LISTENER_MARKER)) continue;
          discoverSelectionTool(renderer, listener, original);
          const wrapped = function(...args) {
            const descriptor = Object.getOwnPropertyDescriptor(Array.prototype, "forEach");
            if (!descriptor) return Reflect.apply(original, this, args);
            const nativeForEach = Array.prototype.forEach;
            const captureForEach = function(callback, thisArg) {
              const tool = Array.isArray(this) ? this.find(isSelectionTool) : null;
              if (tool) {
                if (!statesByRenderer.has(renderer)) installSelectionTool(renderer, tool);
                const state = statesByRenderer.get(renderer);
                if (state) {
                  if (!state.pointerDownRecords) {
                    syncRecords(state);
                    state.pointerDownRecords = [...state.records];
                  }
                }
                const cameraTool = this[0];
                const moveCamera = readNativeProperty(cameraTool, "wb");
                if (statesByRenderer.has(renderer) && isNativeFunction2(moveCamera) && !readNativeReflectProperty(moveCamera, CAMERA_MOVE_MARKER)) {
                  const guardedMoveCamera = function(event) {
                    const buttons = Number(readNativeProperty(getOriginalPointerEvent(event), "buttons"));
                    if (buttons & 2) return Reflect.apply(moveCamera, this, [event]);
                    return void 0;
                  };
                  Object.defineProperty(guardedMoveCamera, CAMERA_MOVE_MARKER, { value: true });
                  setNativeReflectProperty(cameraTool, "wb", guardedMoveCamera);
                }
              }
              return Reflect.apply(nativeForEach, this, [callback, thisArg]);
            };
            try {
              Object.defineProperty(Array.prototype, "forEach", { ...descriptor, value: captureForEach });
              return Reflect.apply(original, this, args);
            } finally {
              Object.defineProperty(Array.prototype, "forEach", descriptor);
            }
          };
          Object.defineProperty(wrapped, POINTER_LISTENER_MARKER, { value: true });
          setNativeReflectProperty(listener, "fn", wrapped);
        }
      }
      function installEditorInputOwnership(windowObject) {
        if (!isNativeObject(windowObject) || inputOwnershipWindows.has(windowObject)) return;
        const addEventListener = readNativeProperty(windowObject, "addEventListener");
        const KeyboardEventConstructor = readNativeProperty(windowObject, "KeyboardEvent");
        if (!isNativeFunction2(addEventListener) || !isNativeFunction2(KeyboardEventConstructor)) return;
        inputOwnershipWindows.add(windowObject);
        Reflect.apply(addEventListener, windowObject, ["pointerdown", (event) => {
          const target = readNativeProperty(event, "target");
          const button = Number(readNativeProperty(event, "button"));
          const editor = callMethod2(target, "closest", ["#editorContainer"]);
          const editorCanvas = String(readNativeProperty(target, "tagName")).toUpperCase() === "CANVAS" && isNativeObject(editor);
          const editorPointer = button === 0 && editorCanvas;
          editorPointerModified = editorPointer && Boolean(
            readNativeProperty(event, "ctrlKey") || readNativeProperty(event, "metaKey") || readNativeProperty(event, "shiftKey")
          );
          editorPointerControlModified = editorPointer && Boolean(
            readNativeProperty(event, "ctrlKey") || readNativeProperty(event, "metaKey")
          );
          if (editorCanvas && button === 2) {
            callMethod2(readNativeProperty(editor, "classList"), "add", ["qolboxEditorDragging"]);
          }
          if (!editorPointer) return;
          const releaseControl = Reflect.construct(KeyboardEventConstructor, ["keyup", {
            bubbles: true,
            code: "ControlLeft",
            key: "Control"
          }]);
          callMethod2(windowObject, "dispatchEvent", [releaseControl]);
        }, true]);
        const stopDragging = () => {
          document.querySelector("#editorContainer")?.classList.remove("qolboxEditorDragging");
        };
        for (const event of ["pointerup", "pointercancel"]) {
          Reflect.apply(addEventListener, windowObject, [event, stopDragging, true]);
        }
        Reflect.apply(addEventListener, windowObject, ["blur", (event) => {
          if (readNativeProperty(event, "target") === windowObject) stopDragging();
        }, true]);
        Reflect.apply(addEventListener, windowObject, ["dblclick", (event) => {
          const target = readNativeProperty(event, "target");
          if (String(readNativeProperty(target, "tagName")).toUpperCase() === "CANVAS" && isNativeObject(callMethod2(target, "closest", ["#editorContainer"])) && activeSelectionState && selectShapeNatively(activeSelectionState)) callMethod2(event, "preventDefault");
        }, true]);
      }
      function patchEditorSelectionControls(windowObject = window) {
        installEditorInputOwnership(windowObject);
        installEditorColorPicker();
        installEditorTopMenuDismissal();
        installEditorMirrorMenu(windowObject);
        installEditorHelp();
        installEditorMergeGrouping(windowObject);
        for (const renderer of getKnownFullscreenRenderers(windowObject)) {
          if (getRendererView(renderer)?.parentElement?.id !== "editorContainer") continue;
          installEditorZoomSafety(renderer);
          installEditorMapFitZoom(renderer, () => statesByRenderer.get(renderer)?.bodyGroups.clear());
          installPointerCapture(renderer);
          activeSelectionState = statesByRenderer.get(renderer) ?? activeSelectionState;
        }
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
        const {
          decorateActions,
          patchHamburgerAudioGroup,
          removeHamburgerAudioGroup
        } = createActionIconographyController();
        const { patchEditorMapFileTransfer, removeEditorMapFileTransfer } = createEditorMapFileTransferController({
          isEditorMapTransferEnabled: featureGates.isEditorMapTransferEnabled,
          isForceSaveEnabled: featureGates.isEditorForceSaveEnabled,
          useReadableMapFiles: () => areAdvancedEditorMapReadableFilesEnabled(getAdvancedSettings())
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
          onScheduleLayoutRefresh: () => scheduleAppUiWork({ features: true, passes: FULLSCREEN_SETTLE_PASSES })
        });
        const {
          applyPersistentFeatures,
          disableFeatureSideEffects
        } = createFeatureSideEffectsController({
          applyGameVolume: () => applyGameVolume(),
          applyJukeboxState: () => applyJukeboxState(),
          decorateActions: () => decorateActions(),
          cleanupGameVolumeMenu: () => cleanupGameVolumeMenu(),
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
          patchEditorSelectionControls: () => patchEditorSelectionControls(),
          patchInGameChatScroll,
          patchGameVolumeMenu: () => patchGameVolumeMenu(),
          patchJukeboxKnob: () => patchJukeboxKnob(),
          patchJukeboxMenu: () => patchJukeboxMenu(),
          patchHamburgerAudioGroup: () => patchHamburgerAudioGroup(),
          patchLobbyMusicController: () => patchLobbyMusicController(),
          patchLobbyBlacklist: () => patchLobbyBlacklist(),
          patchLobbyInformation: () => patchLobbyInformation(),
          patchMobileGrabButton: () => patchMobileGrabButton(),
          patchMobileQolboxHamburgerEntry: () => patchMobileQolboxHamburgerEntry(),
          patchReserveSpotFeature: () => patchReserveSpotFeature(),
          patchSlashCommands: () => patchSlashCommands(),
          patchSwitchTeamsButton: () => patchSwitchTeamsButton(),
          patchTypingIndicatorHooks: () => patchTypingIndicatorHooks(),
          removeEditorMapFileTransfer: () => removeEditorMapFileTransfer(),
          removeJukeboxMenuItem: () => removeJukeboxMenuItem(),
          removeHamburgerAudioGroup: () => removeHamburgerAudioGroup(),
          removeMobileGrabButton: () => removeMobileGrabButton(),
          removeSwitchTeamsButton: () => removeSwitchTeamsButton(),
          restoreChatTabOrder: () => restoreChatTabOrder(),
          restoreJukeboxState: () => restoreJukeboxState(),
          featureGates,
          stopReserveSpot: (options) => stopReserveSpot(options),
          stopCustomSounds: () => soundBanks.stopAllReplacements(),
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
        const { applyThemeSettings: applyThemeSettings2, getThemeSettings, setThemeSettings } = createThemeSettingsController();
        const { applyFeatureRootClasses, ensureGlobalStyle: ensureBaseGlobalStyle } = createQolboxShellFeatureBundle({
          isMenuClosed: () => qolboxMenuController.isClosed(),
          isFeatureActive: featureGates.shouldRunFeature
        });
        function ensureGlobalStyle() {
          const ready = ensureBaseGlobalStyle();
          if (ready) applyThemeSettings2();
          return ready;
        }
        const {
          clearFullscreenStyleSnapshots,
          getActiveRenderCanvas,
          getActiveRenderMode,
          getBaseGameSize,
          getFullscreenDimensions,
          getLayoutProbe,
          getRelativeContainerBounds,
          isRenderProbeAligned,
          restoreFullscreenStyles,
          restoreNativeLayoutSizeFallback,
          setImportantStyle,
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
          layoutRelativeHud,
          refreshObservedResizeTargets,
          resizeKnownFullscreenRenderers: resizeKnownFullscreenRenderers2,
          setFullscreenResizeObserver,
          syncSpectateControlsBottomWithJukebox
        } = createFullscreenLayoutFeatureBundle({
          clearFullscreenStyleSnapshots,
          ensureGlobalStyle,
          getFullscreenDimensions,
          getRelativeContainerBounds,
          isFullscreenEnabled: featureGates.isFullscreenEnabled,
          makeScoreRowsOpaque,
          restoreFullscreenStyles,
          restoreNativeLayoutSizeFallback,
          setImportantStyle,
          syncScoreRowsFromPlayers,
          syncTypingIndicators
        });
        const soundBanks = createSoundBankController();
        const qolboxMenuController = createQolboxMenuFeatureBundle({
          applyFeatureRootClasses,
          applyPersistentFeatures,
          ensureGlobalStyle,
          getAdvancedSettings,
          getThemeSettings,
          isFeatureEnabled,
          scheduleUiWork: scheduleAppUiWork,
          soundBanks,
          setAdvancedSettings,
          setAllFeatureSettings,
          setFeatureEnabled,
          setThemeSettings
        });
        const { getOnboardingSteps, installQolboxMenuHooks, openQolboxMenu, renderQolboxMenu, scheduleFirstBootOnboarding } = qolboxMenuController;
        const { handlePopupKeyboard, installPopupKeyboardHooks } = createPopupKeyboardController({ decorateActions });
        const { installLobbyInformationHooks, patchLobbyInformation } = createLobbyInformationController();
        const {
          applyGameVolume,
          cleanupGameVolumeMenu,
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
          setJukeboxState
        } = createAudioFeatureBundle({
          focusActiveRenderCanvas,
          getActiveRenderCanvas,
          getActiveRenderMode,
          isAudioEnabled: featureGates.isAudioEnabled,
          isChatInput,
          playCustomSound: soundBanks.playReplacement,
          stopCustomSound: soundBanks.stopReplacement,
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
        const { installFullscreenHooks, scheduleUiWork } = createFullscreenOrchestrationBundle({
          applyFeatureRootClasses,
          applyPersistentFeatures,
          enforceFullscreenLayout,
          ensureGlobalStyle,
          getFullscreenDimensions,
          getLayoutProbe,
          installChatCommandAliasHooks,
          installChatEscapeHooks,
          installGameStartIndicatorHooks,
          installGameplayBackgroundFocusHooks,
          installQolboxMenuHooks,
          installReserveSocketCaptureHook,
          installTabFocusHooks,
          isAudioEnabled: featureGates.isAudioEnabled,
          isFullscreenEnabled: featureGates.isFullscreenEnabled,
          isGameStartAlertEnabled: featureGates.isGameStartAlertEnabled,
          isMenuGameplayOverlap,
          isRenderProbeAligned,
          isReserveEnabled: featureGates.isReserveEnabled,
          patchLobbyMusicController,
          refreshObservedResizeTargets,
          resizeKnownFullscreenRenderers: resizeKnownFullscreenRenderers2,
          setFullscreenResizeObserver,
          shouldWaitForNativeLayoutSeed,
          syncSpectateControlsBottomWithJukebox,
          syncNonFullscreenHud: () => {
            if (featureGates.isChatEnabled()) {
              syncAllScoreRowsFromPlayers();
              syncTypingIndicators();
            }
          },
          updateGameStartIndicator
        });
        installMapListPreviewThrottling();
        runQolboxStartupSequence({
          applyFeatureRootClasses,
          ensureGlobalStyle,
          installFullscreenHooks,
          installLobbyInformationHooks,
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

  const schedulePageAppFailureCheck = installPageAppStatusWatch();
  installReleaseHistoryBridge();
  injectPageFunction(runQolboxPageApp, 'QOLBox.page.js');
  schedulePageAppFailureCheck();
})();
