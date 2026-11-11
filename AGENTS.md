# gdocs-dark-mode

A Chrome extension (Manifest V3, loaded unpacked) that themes Google Docs, including the document page, with the gg dark palette from `@gjermundgaraba/gg-theme`, or with colours the user sets on its options page.

# Commands

The toolchain is Vite+ (`vp`) with pnpm. `vp check` formats, lints and type-checks; `vp test` runs the unit tests.

- `pnpm run ready`: check, test and build. Run it before handing work back.
- `pnpm run build`: build the unpacked extension into `dist/`.
- `pnpm run verify [--url <doc>] [--headed]`: build, load `dist/` into Playwright's Chromium, open a document with diagnostics on, and run the end-to-end checks. Output goes to `.cache/verify/`.
- `pnpm run verify-options [--url <doc>] [--headed]`: build, then in a throwaway profile import a `tokens.json` and edit a colour on the options page, save, check a document uses the palette from its first draw, and reset. Output goes to `.cache/verify-options/`.
- `pnpm run inspect [--url <doc>] [--headed]`: list Google's dark-mode tokens against `googleDarkModeTokens`, light interface elements, and canvases. Output goes to `.cache/inspect/`.
- `pnpm run sign-in`: open the shared profile in plain Chromium for a Google sign-in, so verify can open the private reference document.

When a Docs update breaks the extension, follow `.agents/skills/fix-docs-breakage/SKILL.md`.

# Architecture

- `src/docs/docs.ts` holds every fact about how Docs is built: URL, class names, selectors, fixed-meaning canvas colours, and Google's dark-mode tokens. Nothing else names a Docs internal.
- `src/theme/palette.ts` defines the 14 colours a user can set, under gg-theme's `tokens.json` names, parses them from untrusted data and from a `tokens.json`, and takes the default from gg-theme's dark palette at build time. Changing the default means bumping `@gjermundgaraba/gg-theme` in `pnpm-workspace.yaml` and rebuilding.
- `src/theme/theme.ts` builds a `Theme` from a palette. The tiers (wash, tint, soft, quiet) come from gg-theme's own `deriveTiers` (`@gjermundgaraba/gg-theme/derive`), so a custom palette gets the tiers gg-theme would publish for it. `src/theme/checks.ts` sorts a palette's problems into errors, which block saving, and contrast warnings.
- `src/settings/settings.ts` owns `chrome.storage.local`: whether dark mode is on, and the saved palette. No saved palette means the default, so saving the default removes it.
- `src/color/color.ts` holds the colour maths: canvas colour parsing, OKLab, contrast.
- `src/remap/remap.ts` is the pure policy that maps a canvas colour and its role (ink or paper) to a theme colour. Its property tests in `tests/remap.test.ts` pin the readability guarantees.
- `src/page/` runs in the Docs page at document start. `main.ts` runs in the page's own world: it themes with the default palette at once, then swaps in the saved one when it arrives. `canvas-hook.ts` patches the 2D context's draw methods, and `diagnostics.ts` is debug-only bookkeeping. `bridge.ts` runs in the isolated world, which can read extension storage, and hands the saved palette over through `palette-handoff.ts`.
- `src/ui/docs-css.ts` renders the interface stylesheet, which overrides Google's Material colour tokens with theme colours. The page script injects it, so it follows the saved palette.
- `src/options/` is the options page: `editor.ts` is the pure model (draft, saved palette, what to show), `page-style.ts` themes the page from the draft, and `options.ts` wires the DOM. Import reads `palette.dark` from a gg-theme `tokens.json` once; it is a snapshot, not a link to the file.
- `src/background/` is the service worker. Dark mode is on exactly while the page script and the bridge are registered, so there is no runtime on/off check in the page. Toggling re-registers and reloads open documents; saving a palette redraws the icon and reloads open documents.
- `scripts/` holds the build and the Playwright tooling. Scripts share their browser setup through `scripts/browser.ts`, which drives the extension through its options page, and print results through `scripts/checks.ts`.

# Platform behaviour the code relies on

- Docs draws each page onto `<canvas class="kix-canvas-tile-content">` tiles on the main thread, with a 2D context: the page is a white `fillRect`, text is `fillText`, underlines are `stroke`, table borders are `strokeRect`, and images are `drawImage`.
- Canvas reports `fillStyle`/`strokeStyle` as `#rrggbb` when opaque and `rgba(r, g, b, a)` otherwise, so the hook reads the normalised value back and the remapper parses only those two shapes.
- The text selection is a `fillRect` in `rgba(78, 143, 248, 0.5)`, drawn under the text. The caret is a DOM element, `.kix-cursor-caret`, with an inline black border.
- Docs has an unreleased dark mode: the `docsDarkMode` class switches Google's stylesheet to dark values for its `--gm3-sys-color-*` and `--ws-sys-color-*` tokens and swaps icon sprites. It does not touch the canvas. Light values are `var()` fallbacks, not declarations, so overrides on `html:root` apply everywhere and outrank Google's `.docsDarkMode` rule.
- Registered content scripts can run in the page's main world (`world: "MAIN"`) at `document_start`, before Docs creates its canvases. Main-world scripts cannot read extension storage, and the two worlds' scripts start in no fixed order, so the bridge leaves the palette in an attribute on `<html>` and the page script takes it whenever it starts. The bridge's storage read is asynchronous, so nothing guarantees the palette arrives before Docs draws; `verify` checks that it did (`drawsBeforePalette` is 0).
- Chromium keeps persisted dynamic content scripts across restarts and versions. One naming a file a later build removed makes every registration fail at startup, until the extension is reloaded. `launchWithExtension` therefore reloads the extension in a throwaway launch first, as Reload on `chrome://extensions` does.
- Playwright does not see the service worker that starts after `chrome.runtime.reload()`, and extension pages stay blocked in that session, so the scripts relaunch instead.
- Playwright's Chromium loads unpacked extensions with `--load-extension`; branded Chrome no longer does.

# Linting and formatting

Lint comes from `@clanker-stuff/oxlint-config` through `oxlint.config.ts`, and formatting from Ultracite's preset. Fix the code rather than add a lint exception, and use no inline suppressions. The one override turns off `typescript/unbound-method` for the two files that patch DOM prototypes, which must hold the original methods.

Comments must be public-API JSDoc, directives, or links to upstream sources. Put other explanations in names, types, or this file.
