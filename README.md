# QOLBox

QOLBox is a userscript for [hitbox.io](https://hitbox.io) that adds sharp fullscreen rendering, reserve spots in full lobbies, readable chat and command completion, lobby tools, persistent audio controls and sound banks, custom themes and light mode, mobile `Grab`, alerts, and an improved multi-selection editor with map import/export.

## Install

- Install from [GreasyFork](https://greasyfork.org/en/scripts/568667-qolbox).
- Or install the generated userscript directly from GitHub: [`QOLBox.user.js`](https://github.com/AggressiveCombo/QOLBox/raw/main/QOLbox-project/QOLBox.user.js).
- GitHub releases are available at <https://github.com/AggressiveCombo/QOLBox/releases>.

## Use

- Desktop: press `F8` to open QOLBox settings.
- Mobile: open the site's hamburger menu and choose `QOLBox`.
- First-time setup lets you choose which QOLBox features are enabled.
- To verify the installed version, open `F8` → **About**. Development builds end in `-dev`.

## Source

The TypeScript source project lives in [`QOLbox-project`](QOLbox-project/). The generated installable userscript is [`QOLBox.user.js`](QOLbox-project/QOLBox.user.js).

```powershell
cd QOLbox-project
npm ci
npm run check
```
