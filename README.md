# gdocs-dark-mode

A Chrome extension that themes Google Docs, including the document page, with the gg dark palette.

Docs draws its pages on `<canvas>`, so CSS cannot reach them. The extension recolours each canvas draw call instead: white paper becomes the theme background, black text becomes the theme foreground, and greys keep their contrast. Coloured text snaps to the nearest palette hue, and highlights become the theme's tints. Images are untouched. Toolbars, menus and dialogs are themed through Google's own colour tokens.

## Install

```sh
pnpm install
pnpm run build
```

Open `chrome://extensions`, turn on **Developer mode**, choose **Load unpacked**, and select `dist/`. Pin the extension so its icon shows.

Click the icon to switch dark mode on or off; open Docs tabs reload with the change. After rebuilding, reload the extension on `chrome://extensions`.

## Updating the theme

The palette comes from `@gjermundgaraba/gg-theme`. Bump its version in `pnpm-workspace.yaml`, run `pnpm install && pnpm run build`, and reload the extension.

## When Docs breaks it

`pnpm run verify` loads the extension into Playwright's Chromium, opens a document, and checks that the page is themed. With a coding agent, run `/fix-docs-breakage`; see `AGENTS.md` for how the pieces fit together.

## Debugging

In a Docs tab's console, run `localStorage.setItem("gdocs-dark-mode:debug", "1")` and reload. `gdocsDarkMode.report()` then shows what the extension recoloured and anything it could not read.
