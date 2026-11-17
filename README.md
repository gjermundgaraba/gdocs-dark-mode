# gdocs-dark-mode

A Chrome extension that gives Google Docs, including the document page, a dark theme in neutral greys or your own colours.

Docs draws its pages on `<canvas>`, so CSS cannot reach them. The extension recolours each canvas draw call instead: white paper becomes the theme background, black text becomes the theme foreground, and greys keep their contrast. Coloured text snaps to the nearest palette hue, and highlights become the theme's tints. Images are untouched. Toolbars, menus and dialogs are themed through Google's own colour tokens.

## Install

```sh
pnpm install
pnpm run build
```

Open `chrome://extensions`, turn on **Developer mode**, choose **Load unpacked**, and select `dist/`. Pin the extension so its icon shows.

Click the icon to switch dark mode on or off; open Docs tabs reload with the change. After rebuilding, reload the extension on `chrome://extensions`.

## Colours

Right-click the icon and choose **Options**. Set each colour with its picker or as `#rrggbb`. **Export** saves the colours shown to a JSON file, and **Import** reads one back as unsaved changes. The washes, tints and soft text colours are derived from these. Problems that make a palette unusable block saving; low contrast shows as a warning. Saving reloads open Docs tabs. **Use default** goes back to the built-in palette, which then follows changes to the default in later versions.

## Changing the default palette

The default palette is `defaultPalette` in `src/theme/palette.ts`. Change it, run `pnpm run render-icons && pnpm run build`, and reload the extension. The toolbar icon is drawn in the default theme's colours, hence `render-icons`.

## Publishing

Bump `version` in `package.json` (the Chrome Web Store rejects an upload whose version is not higher than the last), then run `pnpm run package` and upload `gdocs-dark-mode-<version>.zip` in the developer dashboard.

## When Docs breaks it

`pnpm run verify` loads the extension into Playwright's Chromium, opens a document, and checks that the page is themed. `pnpm run verify-options` checks the options page end to end. With a coding agent, run `/fix-docs-breakage`; see `AGENTS.md` for how the pieces fit together.

## Debugging

In a Docs tab's console, run `localStorage.setItem("gdocs-dark-mode:debug", "1")` and reload. `gdocsDarkMode.report()` then shows what the extension recoloured and anything it could not read.
