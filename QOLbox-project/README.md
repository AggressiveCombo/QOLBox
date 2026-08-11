# QOLBox source

QOLBox is a TypeScript userscript for [hitbox.io](https://hitbox.io). It adds:

- sharp native-resolution fullscreen that preserves Hitbox's renderer, UI, and browser-zoom behavior;
- reserve/retry behavior for full custom rooms;
- consolidated game, music, and jukebox audio controls with persistent mute settings, fine volume dragging, and saved custom sound banks;
- readable chat, typing indicators, lobby/host commands, and inline slash-command completion;
- in-room server browsing and player details from Hitbox's exposed account/session data;
- an away-tab game-start alert;
- a mobile Grab button;
- editor multi-selection, grouped-body tools, exact editor and player color controls, and map import/export;
- clear action and Room List category icons across Hitbox and QOLBox menus;
- separate or linked custom accent colors plus system-aware dark/light modes for QOLBox and Hitbox; and
- first-run/settings UI covering both configurable and always-on improvements, with global defaults, a complete categorized reference, and in-menu patch-note history.

The installable `QOLBox.user.js` is generated. Edit `src/`, not the bundle.
Third-party icon licenses are recorded in `THIRD_PARTY_NOTICES.md`.

## Development

Requires Node.js 20 or newer.

```powershell
npm ci
npm run check
```

Useful commands:

- `npm run build` — build the development or release userscript from `src/userscript.meta.txt`.
- `npm run typecheck` — run strict TypeScript checks without emitting files.
- `npm run version:dev -- 3.0.0` — set a `-dev` version and remove production update URLs.
- `npm run version:release -- 3.0.0` — set a release version and exact GreasyFork update URLs.

To check the installed version in game, press `F8`, open **About**, and read the version beside **QOLBox**. Development builds end in `-dev`.

Open **About → Reference** for command syntax, controls, sound-bank manifests, and all recognized sound-effect filenames. The editor has its own **Help** menu for editor workflows and formats.
The first editor visit opens a one-time guided tour of QOLBox's editor improvements; the same material remains available from **Help** afterward.

### Sound bank manifests

**Audio → Sound Banks → Import** accepts JSON or plain-text manifests containing direct HTTPS audio URLs. JSON maps Hitbox effect filenames to URLs:

```json
{
  "name": "My Bank",
  "sounds": {
    "bathit1.wav": "https://example.com/custom-hit.opus",
    "rkt_fire.mp3": "https://example.com/custom-rocket.opus"
  }
}
```

Plain text accepts `effect-filename=https://…` per line. A line containing only a URL also works when its filename is already a recognized Hitbox effect filename.

## Structure

- `src/app/` wires the application and feature bundles.
- `src/boot/` selects top-level versus game-page startup.
- `src/config/` owns versions, constants, and release notes.
- `src/features/` contains user-facing behavior and UI.
- `src/hitbox/` isolates access to observed game internals.
- `src/settings/` owns persisted settings and validation.

The Hitbox adapters depend on minified game internals and therefore require revalidation after upstream game changes.
