# QOLBox Source

This directory is the source project for the generated installable userscript at `QOLbox.user.js`.

## Commands

```powershell
npm install
npm run typecheck
npm run build
npm run check
```

`npm run build` bundles the TypeScript source into one userscript and prepends the metadata header from `src/userscript.meta.txt`.

## Project Structure

The app bootstrap and controller wiring lives in strict TypeScript at `src/app/qolbox-app.ts` while feature code is split into focused modules. Do not edit the generated `QOLbox.user.js` directly; update source files and rebuild it.

Source modules currently cover:

- `src/main.ts`: userscript entrypoint that delegates to game-page or top-level page bootstrapping.
- `src/app/qolbox-app.ts`: game-page app bootstrap that wires feature bundles, feature gates, scheduled UI work, and startup sequencing together.
- `src/boot/page-entry.ts`: top-level Hitbox page detection and routing that owns passthrough/title-relay hook installation outside `game2.html` and stops game-page bootstrap there.
- `src/boot/startup-sequence.ts`: final QOLBox startup ordering for root classes, style injection, menu hooks, feature-gated reserve/audio hooks, fullscreen hooks, onboarding scheduling, and configured initial settle passes.
- `src/config/qolbox-constants.ts`: shared QOLBox UI text, selectors, timing values, reserve/status regexes, fallback colors, and page detection.
- `src/config/qolbox-version.ts`: current QOLBox version label plus verified external project links used by metadata and menus.
- `src/config/qolbox-release-notes.ts`: public release-history fetching, de-duplication, upgrade-range selection, cache handling, and minimal update-notice fallback text.
- `src/types/scheduled-work.ts`: shared scheduled UI work request type used by startup, settings, menu, fullscreen layout, and audio controls.
- `src/utils/object-properties.ts`: low-level reflectable-object guards plus safe object property read/write helpers used when browser/native objects must be accessed by dynamic property name.
- `src/settings/audio-storage.ts`: persistent audio values and numeric normalization.
- `src/settings/advanced-settings.ts`: persisted advanced-setting definitions, validation, defaults, and typed accessors for retry, alias, alert, and typing options.
- `src/settings/advanced-settings-controller.ts`: mutable advanced-setting state plus injected apply/render/layout-refresh callbacks for the QOLBox settings menu.
- `src/settings/blacklist-storage.ts`: persisted exact-name blacklist storage, normalization, de-duplication, and entry caps.
- `src/features/audio-levels.ts`: audio curve math, jukebox angle/volume conversions, transform parsing, and keyboard adjustment targets through shared object guards.
- `src/features/audio-feature-bundle.ts`: audio feature construction bundle for game volume, jukebox controls, YouTube sync, and lobby music suppression.
- `src/features/game-volume-control.ts`: persisted game-volume updates and adapter-backed Howler volume scaling/retry sound suppression.
- `src/features/game-volume-menu-item.ts`: game-volume menu row lookup, display text, cursor styling, and slider accessibility attributes.
- `src/features/game-volume-menu-control.ts`: game-volume menu row patching and click/context/wheel/key interactions.
- `src/features/jukebox-control.ts`: jukebox menu coordination, saved-state coordination, knob visual application, and adapter-backed YouTube player volume synchronization.
- `src/features/jukebox-dom-helpers.ts`: jukebox dynamic DOM/event property reads, patched-window flag writes, style/dataset guards, and best-effort pointer capture.
- `src/features/jukebox-keyboard-focus.ts`: jukebox focusin/focusout opening, gameplay Tab focus routing, and radio close behavior.
- `src/features/jukebox-knob-interaction.ts`: jukebox knob drag/wheel/key volume changes, global drag listeners, pointer capture, and interaction focus handling.
- `src/features/jukebox-menu-control.ts`: jukebox settings-menu item insertion, label/title refresh, click routing, and removal.
- `src/features/jukebox-knob-view.ts`: jukebox knob lookup, current-angle readback, SVG bar/arc drawing, and slider accessibility.
- `src/features/jukebox-state.ts`: persisted jukebox mute/percent state, default/effective percent reads, menu labels, mute toggles, and state patching.
- `src/features/lobby-music-control.ts`: lobby music start suppression decisions while gameplay/editor layers are active.
- `src/features/lobby-commands-feature-bundle.ts`: lobby command feature construction bundle for command status output, team-mode detection, actions, dispatcher, SWITCH button, and slash-command patching.
- `src/features/gameplay-alert-feature-bundle.ts`: gameplay-state and away-tab alert construction bundle for shared play/lobby predicates and game-start title alerts.
- `src/features/gameplay-state.ts`: shared gameplay/lobby/spectator/page-focus predicates used by fullscreen, reserve, focus capture, and tab alerts.
- `src/features/input-focus-feature-bundle.ts`: input/focus construction bundle for render-canvas focus, chat controls, touch-prompt detection, chat command aliasing, and gameplay-background click capture.
- `src/settings/feature-settings.ts`: feature keys, displayed definitions, and saved enable/disable state.
- `src/settings/feature-gates.ts`: named feature-enable predicates backed by the saved feature settings and onboarding completion gate.
- `src/settings/feature-settings-controller.ts`: mutable feature settings state, toggle persistence, onboarding gate checks, and injected feature-toggle side-effect flow.
- `src/settings/onboarding-storage.ts`: first-start completion storage.
- `src/settings/update-notice-storage.ts`: last-seen and acknowledged-version storage used to show update notices once per installed version.
- `src/dom/dom-helpers.ts`: shared visibility, text escaping, tab-order helpers, safe focus, and mutation-target queries.
- `src/dom/element-guards.ts`: structural DOM guards for focusable, tabbable, styled, dataset-backed, and canvas-size-like elements used by browser code and regression mocks.
- `src/dom/settings-menu-dom.ts`: vanilla settings menu container and Change Controls item lookup.
- `src/hitbox/native-access.ts`: runtime-safe access primitives for unknown native objects and function-backed native Reflect targets.
- `src/hitbox/auto-join-adapter.ts`: observed direct-link auto-join metadata matching and one-person-room detection.
- `src/hitbox/native-game-adapter.ts`: observed native game-object readiness, availability, base render size, and fullscreen layout-size reads.
- `src/hitbox/howler-audio-adapter.ts`: observed Howler/Howl sound instance and prototype wrapping for game-volume scaling and reserve retry sound suppression.
- `src/hitbox/youtube-player-native.ts`: YouTube/native callable, constructable, record, and wrapper-flag guards.
- `src/hitbox/youtube-player-options-wrapper.ts`: YouTube `YT.Player` options wrapping for `onReady` player tracking and deferred state application.
- `src/hitbox/youtube-player-adapter.ts`: observed YouTube iframe ready-callback and player-constructor wrapping for jukebox volume synchronization.
- `src/hitbox/lobby-music-adapter.ts`: observed native lobby-music controller start/stop wrapping and suppression helpers.
- `src/hitbox/session-adapter.ts`: read-only access to observed native lobby/player/session state through shared native-access reads.
- `src/hitbox/player-join-hooks.ts`: observed player-list join hook wrapping used by automatic blacklist enforcement.
- `src/hitbox/player-appearance-adapter.ts`: observed player display-name and color-candidate discovery for commands, typing indicators, and score-row repair.
- `src/hitbox/world-state-adapter.ts`: observed gameplay player-entity and camera-state reads for world-positioned typing bubbles.
- `src/hitbox/reserve-socket-emit-patcher.ts`: shared reserve socket `emit` wrapper installation for live sockets and socket prototypes.
- `src/hitbox/reserve-socket-adapter.ts`: Socket.io factory/prototype wrapping, captured native reserve join emit replay, and retry reconnect handling behind predicate/callback hooks.
- `src/hitbox/team-state.ts`: shared observed numeric player-team states.
- `src/hitbox/mobile-controls-adapter.ts`: native mobile/touch prompt detection, input-state access, and mobile-control hook wrapping through shared native-access writes.
- `src/hitbox/scoreboard-adapter.ts`: read-only access to the observed gameplay score/player list.
- `src/hitbox/renderer-discovery.ts`: observed Pixi/Hitbox renderer candidate discovery, renderer view lookup, and host lookup.
- `src/hitbox/renderer-adapter.ts`: fullscreen renderer resize plumbing through shared native-access writes and renderer discovery.
- `src/hitbox/fullscreen-metric-overrides.ts`: observed `a8` fullscreen metric descriptor capture, pinning, accessor overrides, and metric restoration.
- `src/hitbox/fullscreen-metrics-adapter.ts`: native fullscreen metric pinning orchestration and resize wrapping for the observed `a8` game object through shared native-access writes.
- `src/hitbox/lobby-actions.ts`: native team-selection and host team-move commands.
- `src/hitbox/host-settings-adapter.ts`: native host-setting discovery and extended settings output.
- `src/hitbox/chat-adapter.ts`: safe native chat status output.
- `src/hitbox/chat-send-adapter.ts`: native chat-send interception, wrapper markers, and vanilla `/help` settings-row correction.
- `src/hitbox/typing-pulse-adapter.ts`: observed native lobby typing-pulse hook installation and wrapper markers.
- `src/hitbox/match-actions.ts`: native end/start match actions.
- `src/hitbox/game-start-hooks.ts`: native in-game start-event hook wrapping for observed remote start handlers and local start requests through shared native-access helpers.
- `src/hitbox/editor-map-adapter.ts`: guarded native editor map import/export access, including current visible map capture and editor refresh.
- `src/features/first-boot-onboarding.ts`: first-start onboarding scheduling and DOMContentLoaded deferral.
- `src/features/lobby-command-actions.ts`: slash-command action facade for `/red`, `/blue`, play-command delegation, team action delegation, and command-output delegation.
- `src/features/lobby-command-play-actions.ts`: `/join` and `/spec` play-state command decisions, all-target handling, and already-playing status.
- `src/features/lobby-command-help.ts`: QOLBox `/help` chat-output lines and writer.
- `src/features/lobby-command-output-actions.ts`: QOLBox command output actions for `/settings all` and appended help rows.
- `src/features/lobby-command-player-targets.ts`: command player-name formatting/normalization, matching tiers, ambiguity results, and the quoted `all` target escape.
- `src/features/lobby-command-player-resolver.ts`: named command-player resolution with missing/ambiguous status messages.
- `src/features/lobby-command-team-state-text.ts`: command team-state names and bulk team-action status wording.
- `src/features/lobby-command-team-targets.ts`: eligible player filtering for bulk `all` moves and SWITCH red/blue swaps.
- `src/features/lobby-command-team-state-request.ts`: shared team-state request routing for local self changes versus host player moves.
- `src/features/lobby-command-team-actions.ts`: team-state movement validation, bulk/SWITCH command orchestration, and related status messages.
- `src/features/qolbox-chat-status.ts`: QOLBox command/status chat output prefixing.
- `src/features/slash-command-interceptor.ts`: QOLBox slash-command dispatch gating, `/rec` aliasing, and native-help augmentation decisions through the chat-send adapter.
- `src/features/lobby-command-dispatcher.ts`: slash command routing plus native `/end` and `/restart` orchestration, including handled-command chat draft cleanup.
- `src/features/lobby-command-host-actions.ts`: `/host playername` validation, host-transfer dispatch, and host-status output.
- `src/features/lobby-blacklist.ts`: `/blacklist` command handling, stored-name matching/removal, and automatic host-side ban enforcement.
- `src/features/switch-teams-button.ts`: stable vanilla-row SWITCH control insertion and click binding.
- `src/features/team-mode-detector.ts`: read-only native/UI/team-state team-mode detection.
- `src/features/player-popup-dismissal.ts`: Escape and outside-click dismissal for native player context menus.
- `src/features/mobile-feature-bundle.ts`: mobile feature controller construction bundle for the mobile Grab button and mobile hamburger-menu QOLBox entry.
- `src/features/mobile-grab-button.ts`: mobile Grab button DOM creation, visibility sync, layout handoff, and native mobile-control hook wiring.
- `src/features/mobile-grab-button-element.ts`: mobile Grab button element creation, event attachment, hiding, and removal.
- `src/features/mobile-grab-context.ts`: mobile-control context detection, native/fallback ability-button lookup, visible ability-button checks, and mobile QOLBox menu context detection.
- `src/features/mobile-grab-events.ts`: guarded touch/pointer event reads and event stopping helpers for the mobile Grab control.
- `src/features/mobile-grab-input.ts`: mobile Grab pressed-state ownership, native input-state writes, desktop-safe release behavior, and keyboard fallback dispatch.
- `src/features/mobile-grab-layout.ts`: mobile Grab button fallback sizing, native ability-button spacing, visible viewport clamping, and CSS position application.
- `src/features/mobile-grab-press.ts`: mobile Grab touch/pointer press routing, active-touch tracking, release hook installation, and blur release behavior.
- `src/features/mobile-qolbox-menu-entry.ts`: mobile hamburger-dropdown QOLBox entry insertion and removal.
- `src/features/qolbox-menu-feature-bundle.ts`: QOLBox menu/onboarding construction bundle for markup, dialog lifecycle, onboarding storage, and first-boot scheduling.
- `src/features/qolbox-menu-markup.ts`: compact onboarding/settings menu text, toggle rows, and setup replay markup.
- `src/features/qolbox-menu-keyboard.ts`: QOLBox menu shortcut modifier and key matching.
- `src/features/qolbox-menu-view.ts`: QOLBox menu overlay creation, panel rendering, event wiring, and first-control focus.
- `src/features/qolbox-menu-controller.ts`: QOLBox onboarding/settings dialog lifecycle, keyboard open/close handling, click routing, and DOM removal on close.
- `src/features/popup-keyboard-controls.ts`: Esc/Enter/arrow-key handling for visible native Hitbox popups without stealing text-editor input.
- `src/features/qolbox-shell-feature-bundle.ts`: QOLBox shell construction bundle for global CSS injection and feature/root class synchronization.
- `src/features/render-canvas-focus.ts`: active render-canvas focus return and browser scroll reset helpers through shared DOM tabbable-element guards.
- `src/features/reserve-action-controls.ts`: reserve/JOIN button label, disabled-state synchronization, visible selected-room clearing, and password-prompt reserve-label state through shared dataset guards.
- `src/features/reserve-captured-join.ts`: captured native join payload state, direct-link auto-reserve detection, recent-capture watch predicate, and adapter-backed retry emit decisions.
- `src/features/reserve-countdown-timer.ts`: reserve waiting-popup countdown refresh timeout loop.
- `src/features/reserve-dom-event-hooks.ts`: one-time reserve room-list/password-window event listener installation.
- `src/features/reserve-feature-patch.ts`: reserve patch-cycle orchestration and native-status watch continuation decisions.
- `src/features/reserve-feature-bundle.ts`: reserve controller construction bundle for selection, lifecycle, visible action controls, status, retry, socket, popup, and interaction wiring.
- `src/features/reserve-interaction-events.ts`: reserve interaction event target lookup, key reads, native event suppression, and safe native element clicks.
- `src/features/reserve-interaction-handlers.ts`: reserve room-list click/double-click, password-submit/Enter, and waiting-popup Cancel behavior.
- `src/features/reserve-retry-audio-suppression.ts`: timestamp guard for silencing repeated reserve retry sounds.
- `src/features/reserve-retry-scheduler.ts`: reserve retry timeout scheduling, countdown refresh, success handoff, and retry count updates.
- `src/features/reserve-room-list.ts`: reserve room-list row parsing through shared object guards, full/unavailable/password detection, and reserve button lookup.
- `src/features/reserve-room-full-suppression.ts`: timestamp guard for suppressing late native `room_full` popups after a successful reserve join.
- `src/features/reserve-selection-state.ts`: selected reserve-room memory, room-identity recovery after list rebuilds, and remembered full/unavailable state.
- `src/features/reserve-status-watch-timer.ts`: reserve native-status watch timeout loop and rescheduling guard.
- `src/features/reserve-join-payload.ts`: reserve socket join-payload detection, named payload field reads through shared object guards, and retry-safe payload cloning.
- `src/features/reserve-lifecycle.ts`: reserve state ownership, start/stop transitions, terminal/unavailable states, and successful-join handoff.
- `src/features/reserve-connecting-state.ts`: reserve native connecting-state decisions for room_full, successful joins, room-closed, wrong-password, and retry startup.
- `src/features/reserve-native-status.ts`: native connecting-window text extraction, reserve status filtering, and native popup hiding through shared DOM style guards.
- `src/features/reserve-waiting-window.ts`: reserve waiting popup DOM creation, native status mirroring, retry countdown text, terminal-message rendering, and visibility toggling.
- `src/features/global-style.ts`: global stylesheet assembly and injection for imported feature style sections.
- `src/features/global-style-fullscreen.ts`: fullscreen root/app/render-layer/canvas, chat focus-outline, and fullscreen score-row CSS.
- `src/features/global-style-reserve.ts`: reserve waiting-popup, disabled reserve button, spinner, status, countdown, and terminal-message CSS.
- `src/features/global-style-menu.ts`: QOLBox menu/onboarding/settings overlay, panel, buttons, toggles, feature rows, credits, compact-height, and reduced-motion CSS.
- `src/features/global-style-typing.ts`: score-row and world-positioned typing-indicator layer/icon CSS.
- `src/features/global-style-mobile-grab.ts`: mobile Grab button icon, sizing, display-default, transform, and z-index CSS.
- `src/features/global-style-chat.ts`: readable/scrollable in-game chat hover styles and reading-state fade suppression.
- `src/features/global-style-editor-map.ts`: editor map import/export status-message CSS.
- `src/features/editor-map-file-transfer.ts`: editor File menu Import/Export item insertion, local file parsing, download creation, and status feedback.
- `src/features/game-start-shared.ts`: shared game-start tab-title prefixes, favicon, and title-prefix stripping.
- `src/features/game-start-display.ts`: away-game alert title/favicon mutation, original favicon restoration, and cross-frame title/favicon relay.
- `src/features/game-start-focus-hooks.ts`: one-time game-start alert focus/blur/visibility/pointer listener installation.
- `src/features/game-start-local-transition.ts`: short-lived local start/join transition tracker used to suppress false away-tab alerts from the user's own actions.
- `src/features/game-start-timers.ts`: game-start indicator/watch/end-watch/flash timeout handle ownership, clearing, and callback reset behavior.
- `src/features/game-start-indicator.ts`: away-game tab alert gating, focus/lobby/play state decisions, local-transition suppression wiring, and native start-hook coordination.
- `src/features/top-level-page.ts`: non-`game2.html` iframe input passthrough and top-level title/favicon relay through shared message-data object guards.
- `src/features/feature-root-classes.ts`: feature-gated root CSS class toggling and QOLBox menu-open class state.
- `src/features/feature-side-effects.ts`: feature disable cleanup and persistent feature patch orchestration backed by named QOLBox feature gates.
- `src/features/fullscreen-cleanup.ts`: fullscreen inline-style restoration, editor dataset cleanup through shared DOM guards, and native fullscreen cleanup orchestration.
- `src/features/fullscreen-foundation-bundle.ts`: fullscreen foundation construction bundle for render-state reads, native-layout fallback, style snapshots, geometry, and native game/metrics adapters.
- `src/features/fullscreen-game-ready-hook.ts`: fullscreen settle scheduling when the native game adapter reports the game object is ready.
- `src/features/fullscreen-hook-installer.ts`: one-time fullscreen hook installation for game readiness, menu/chat/focus hooks, feature-gated audio/reserve/tab-alert hooks, resize/page/fullscreen listeners, mutation observation, and ResizeObserver setup.
- `src/features/fullscreen-layout-feature-bundle.ts`: fullscreen layout construction bundle for HUD positioning, frame fitting, cleanup, game-ready scheduling, resize-target observation, and renderer resize handoff.
- `src/features/fullscreen-orchestration-bundle.ts`: fullscreen orchestration construction bundle for refresh control, coalesced work scheduling, mutation observation, and hook installation.
- `src/features/fullscreen-hud-layout.ts`: fullscreen score panel layout, typing-indicator HUD syncing, and spectator-control layout handoff.
- `src/features/fullscreen-inline-style.ts`: shared fullscreen inline-style reads, property removal, and property-value helpers.
- `src/features/fullscreen-spectate-controls-layout.ts`: fullscreen spectator controls positioning, reset behavior, and jukebox offset following.
- `src/features/fullscreen-container-layout.ts`: fullscreen document/body, app container, relative container, and background image positioning.
- `src/features/fullscreen-editor-frame-layout.ts`: editor native canvas size detection, scaled editor frame calculation, editor canvas fitting, object-count counter positioning, jukebox-clearance tracking, and editor dataset markers.
- `src/features/fullscreen-frame-layout.ts`: fullscreen frame orchestration, editor-frame delegation, container layout handoff, render-frame handoff, and UI zoom application.
- `src/features/fullscreen-render-frame-layout.ts`: fullscreen render layer/canvas fitting for gameplay/menu layers plus editor canvas handoff.
- `src/features/fullscreen-types.ts`: shared fullscreen geometry/probe shape definitions used to keep layout math and probe alignment decoupled.
- `src/features/fullscreen-geometry.ts`: centered fullscreen dimensions, UI zoom/backing-size wrapper methods, and layout probe alignment delegation.
- `src/features/fullscreen-probe-alignment.ts`: fullscreen expected backing-size calculations, render/native probe alignment checks, and refresh signature building.
- `src/features/fullscreen-mutation-observer.ts`: fullscreen DOM mutation classification for layout work, feature patching, spectator jukebox sync, and game-start indicator refreshes.
- `src/features/fullscreen-native-layout-fallback.ts`: native layout seed waiting and unfullscreen size fallback restoration through structural style/canvas-size guards.
- `src/features/fullscreen-refresh-controller.ts`: fullscreen refresh orchestration, layout signature tracking, native resize fallback decisions, and fullscreen-disabled cleanup handoff.
- `src/features/fullscreen-resize-target-observer.ts`: ResizeObserver ownership and fullscreen layout-target observation refreshes.
- `src/features/fullscreen-render-state.ts`: viewport reads, native base-size adapter use, active render mode/canvas lookup, editor canvas detection, and fullscreen layout probes through shared DOM canvas guards.
- `src/features/fullscreen-style-manager.ts`: fullscreen style snapshotting, important-style application, and original inline-style restoration through shared structural style guards.
- `src/features/fullscreen-work-scheduler.ts`: coalesced fullscreen/UI work scheduling, hidden-tab timeout fallback, feature patch passes, and multi-pass layout settles.
- `src/features/chat-keyboard-events.ts`: guarded chat/control key detection for Escape, Tab, and Enter.
- `src/features/chat-input-elements.ts`: chat input element/value guards and active chat-input lookup.
- `src/features/chat-input-controls.ts`: chat Esc cancel, `/rec` alias key handling, prompt restoration, and chat Tab-order patching.
- `src/features/in-game-chat-scroll.ts`: hover/reading state and wheel handling for retained in-game chat history without stealing chat/menu input.
- `src/features/gameplay-background-focus-events.ts`: gameplay background-focus event property guards, focusable-target checks, and forwarded pointer-event construction.
- `src/features/gameplay-background-focus.ts`: gameplay void/background click capture, focus restoration, UI-exclusion checks, and active render-canvas pointer forwarding.
- `src/features/score-row-color-values.ts`: lives/score RGB parsing, color matching, and score-row background-color reads.
- `src/features/score-row-colors.ts`: adapter-backed player/team fallback colors, row-name normalization, score-row color repair, and opacity locking.
- `src/features/typing-feature-bundle.ts`: typing/score feature construction bundle for score-row colors, gameplay-canvas world typing positions, and typing indicator hooks.
- `src/features/typing-expiration-tracker.ts`: remote typing pulse expiry timestamps, timeout ownership, and expiry callbacks.
- `src/features/typing-score-indicators.ts`: score-row typing indicator DOM matching, creation, and cleanup.
- `src/features/typing-world-indicators.ts`: world-positioned typing-bubble DOM layer ownership, live position updates, and animation-frame follow loop.
- `src/features/typing-indicators.ts`: local-player suppression, score/world indicator coordination, typing expiry delegation, and typing-pulse adapter coordination.
- `src/features/world-typing-position.ts`: adapter-backed world-to-screen projection for in-game typing bubbles.

The larger controllers that remain, such as jukebox, mobile Grab, lobby commands, game-start alerts, reserve orchestration, and `src/app/qolbox-app.ts`, are intentional feature owners or composition points. Split them only when a new boundary improves ownership or safety instead of merely reducing line count.
