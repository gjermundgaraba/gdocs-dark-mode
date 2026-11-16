# gdocs-dark-mode

A Chrome extension (Manifest V3, loaded unpacked) that themes Google Docs, including the document page, with the gg dark palette from `@gjermundgaraba/gg-theme`, or with colours the user sets on its options page.

# Commands

The toolchain is Vite+ (`vp`) with pnpm. `vp check` formats, lints and type-checks; `vp test` runs the unit tests.

- `pnpm run ready`: check, test and build. Run it before handing work back.
- `pnpm run build`: build the unpacked extension into `dist/`.
- `pnpm run verify [--url <doc>] [--headed]`: build, load `dist/` into Playwright's Chromium, open a document (the public one by default) with diagnostics on, and run the end-to-end checks. Output goes to `.cache/verify/`.
- `pnpm run verify-options [--url <doc>] [--headed]`: build, then import a `tokens.json` and edit a colour on the options page, save, check a document uses the palette, also with its cached copy cleared (switched in place before Docs draws, no extra reload), reset it and check the reloaded document started with the new palette cached, check a settings write that changes nothing and an extension reload both leave documents alone, and switch dark mode off. Output goes to `.cache/verify-options/`.
- `pnpm run inspect [--url <doc>] [--headed]`: list Google's dark-mode tokens against `googleDarkModeTokens`, light interface elements, and canvases. Output goes to `.cache/inspect/`.
- `pnpm run render-icons`: redraw the toolbar icons in `src/extension/icons/` from the default theme.

Each Playwright script starts from a new profile with the extension loaded and its options page open. The scripts cannot sign in to Google, so they only open documents anyone with the link can view.

In Amp orbs, `.agents/setup` installs the dependencies and Playwright's Chromium, and `.agents/resume` sets `vm.overcommit_memory=1`: oxlint's allocator reserves more address space than an orb has memory, and under the default heuristic overcommit `vp check` panics before linting.

When a Docs update breaks the extension, follow `.agents/skills/fix-docs-breakage/SKILL.md`. For Chrome extension APIs, read the `chrome-extensions` skill: Google's, from the `modern-web-guidance` dev dependency, which pnpm links into `.agents/skills` and `.claude/skills` on install. Its rules are written for extensions in general; where this file documents a different choice, this file wins.

# Architecture

- `src/docs/docs.ts` holds every fact observed about how Docs is built: URL, class names, selectors, fixed-meaning canvas colours, and the dark-mode tokens Google's stylesheet sets. `src/ui/docs-css.ts` maps those tokens to theme colours; nothing else names a Docs internal.
- `src/theme/palette.ts` defines the 14 colours a user can set, under gg-theme's `tokens.json` names, parses them from untrusted data and from a `tokens.json`, and takes the default from gg-theme's dark palette at build time. Changing the default means bumping `@gjermundgaraba/gg-theme` in `pnpm-workspace.yaml` and rebuilding.
- `src/theme/theme.ts` builds a `Theme`: the palette plus the tiers (wash, tint, soft, quiet) gg-theme's own `deriveTiers` (`@gjermundgaraba/gg-theme/derive`) derives from it, all `#rrggbb` under `tokens.json`'s names, so a custom palette gets the tiers gg-theme would publish for it. `src/theme/checks.ts` reviews a palette: its theme, errors that block saving, and contrast warnings.
- `src/settings/settings.ts` owns the settings in `chrome.storage.local`: whether dark mode is on, and the saved palette. No saved palette means the default, so saving the default removes it. `readPalette` returns the palette documents get: the saved one while it is usable, else the default.
- `src/color/color.ts` holds the colour maths: canvas colour parsing, OKLab, contrast.
- `src/remap/remap.ts` is the pure policy that maps a canvas colour and its role (ink or paper) to a theme colour. Its property tests in `tests/remap.test.ts` pin the readability guarantees.
- `src/page/` holds two content scripts, both registered at document start. `main.ts` runs in the Docs page's own world: it themes the page with the palette cached in docs.google.com's `localStorage` (`palette-cache.ts`), or the default when there is none, so it has a palette before Docs draws. `palette-sync.ts` runs in the isolated world, reads the palette from extension storage, rewrites the cache and hands the palette to `main.ts` in a `CustomEvent`. If it differs from the cached one, `main.ts` switches to it in place when the page canvas has not drawn yet, and otherwise reloads the tab, but only once the cache holds the new palette, so a failed cache write leaves the page on the old palette instead of reloading in a loop. Diagnostics record the draws made before it arrived (`drawsBeforePaletteArrived`) and whether it differed (`paletteChangedOnArrival`). `canvas-hook.ts` patches the 2D context's draw methods, and `diagnostics.ts` is debug-only bookkeeping.
- `src/ui/docs-css.ts` renders the interface stylesheet, which overrides Google's Material colour tokens with theme colours. The page script injects it, so it follows the saved palette.
- `src/options/` is the options page: `editor.ts` is the pure model (draft, saved palette, what to show), `page-style.ts` themes the page from the draft, and `options.ts` wires the DOM. Import reads `palette.dark` from a gg-theme `tokens.json` once; it is a snapshot, not a link to the file.
- `src/background/` is the service worker. Dark mode is on exactly while the page scripts are registered, so the page never asks. One refresh brings the registration in line with the settings, reloads open documents if they were loaded with another palette or with dark mode in the other state, writing the new palette into their cache first so they draw with it from the start, and sets the icon. The palette documents were last reloaded with is kept in storage, so restoring a registration Chrome cleared on an extension update reloads nothing: documents already open keep the page script they loaded with. The refresh runs when the worker starts, on browser startup, and when a setting changes (the options page only writes settings). A toolbar click flips the saved setting in the same queue as the refreshes, so rapid clicks each see the previous one, and the setting change triggers the refresh.
- `src/extension/` holds the manifest, the built file names, and the static icons (on and off).
- `scripts/` holds the build and the Playwright tooling. Scripts share their browser setup through `scripts/browser.ts`, which drives the extension through its options page, and print results through `scripts/checks.ts`.

# Platform behaviour the code relies on

- Docs draws each page onto `<canvas class="kix-canvas-tile-content">` tiles on the main thread, with a 2D context: the page is a white `fillRect`, text is `fillText`, underlines are `stroke`, table borders are `strokeRect`, and images are `drawImage`.
- Canvas reports `fillStyle`/`strokeStyle` as `#rrggbb` when opaque and `rgba(r, g, b, a)` otherwise, so the hook reads the normalised value back and the remapper parses only those two shapes.
- The text selection is a `fillRect` in `rgba(78, 143, 248, 0.5)`, drawn under the text. The caret is a DOM element, `.kix-cursor-caret`, with an inline black border.
- Docs has an unreleased dark mode: the `docsDarkMode` class switches Google's stylesheet to dark values for its `--gm3-sys-color-*` and `--ws-sys-color-*` tokens and swaps icon sprites. It does not touch the canvas. Light values are `var()` fallbacks, not declarations, so overrides on `html:root` apply everywhere and outrank Google's `.docsDarkMode` rule.
- Content scripts registered with `chrome.scripting.registerContentScripts` can run in the page's main world (`world: "MAIN"`) at `document_start`, before any page script and before Docs creates its canvases, but only from packaged files, and main-world scripts cannot read extension storage. Hence the `localStorage` cache, which the main world reads synchronously and which, unlike a cookie, is not sent with Google's requests; Google's own scripts can read it, and it holds only colours.
- An isolated-world script's `chrome.storage.local` read at `document_start` has so far always answered before Docs' first page draw, even with the cache empty, so the in-place switch is what normally runs and the reload is a fallback. A `resize` event does not make Docs redraw its tiles; only a real viewport or zoom change does, so the fallback reloads.
- The extension uses `chrome.userScripts` for nothing: the Chrome Web Store allows that API only for code the user supplies.
- Chrome clears dynamically registered content scripts when the extension updates, and Playwright's `--load-extension` installs the extension afresh on every launch. The worker re-syncs whenever it starts, so it restores the registration after an update, and after a restart if one ever clears it; documents that loaded while it was missing are not reloaded.
- Playwright can reload the extension the way an update does by turning on `#devMode` on `chrome://extensions` and clicking `extensions-detail-view #dev-reload-button` on the details page; after `chrome.runtime.reload()` an extension loaded with `--load-extension` does not come back.
- Playwright's Chromium loads unpacked extensions with `--load-extension`; branded Chrome no longer does.

# Linting and formatting

Lint comes from `@clanker-stuff/oxlint-config` through `oxlint.config.ts`, and formatting from Ultracite's preset. Fix the code rather than add a lint exception, and use no inline suppressions. The one override turns off `typescript/unbound-method` for the two files that patch DOM prototypes, which must hold the original methods.

Comments must be public-API JSDoc, directives, or links to upstream sources. Put other explanations in names, types, or this file.
