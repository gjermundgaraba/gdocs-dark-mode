# gdocs-dark-mode

A Chrome extension (Manifest V3, loaded unpacked) that themes Google Docs, including the document page, with the gg dark palette from `@gjermundgaraba/gg-theme`, or with colours the user sets on its options page.

# Commands

The toolchain is Vite+ (`vp`) with pnpm. `vp check` formats, lints and type-checks; `vp test` runs the unit tests.

- `pnpm run ready`: check, test and build. Run it before handing work back.
- `pnpm run build`: build the unpacked extension into `dist/`.
- `pnpm run verify [--url <doc>] [--headed]`: build, load `dist/` into Playwright's Chromium, open a document (the public one by default) with diagnostics on, and run the end-to-end checks. Output goes to `.cache/verify/`.
- `pnpm run verify-options [--url <doc>] [--headed]`: build, then import a `tokens.json` and edit a colour on the options page, save, check a document uses the palette, reset it, check a refresh with nothing changed leaves documents alone, and switch dark mode off. Output goes to `.cache/verify-options/`.
- `pnpm run inspect [--url <doc>] [--headed]`: list Google's dark-mode tokens against `googleDarkModeTokens`, light interface elements, and canvases. Output goes to `.cache/inspect/`.
- `pnpm run render-icons`: redraw the toolbar icons in `src/extension/icons/` from the default theme.

Each Playwright script starts from a new profile and turns on "Allow User Scripts" the way a user would. The scripts cannot sign in to Google, so they only open documents anyone with the link can view.

In Amp orbs, `.agents/setup` installs the dependencies and Playwright's Chromium, and `.agents/resume` sets `vm.overcommit_memory=1`: oxlint's allocator reserves more address space than an orb has memory, and under the default heuristic overcommit `vp check` panics before linting.

When a Docs update breaks the extension, follow `.agents/skills/fix-docs-breakage/SKILL.md`. For Chrome extension APIs, read the `chrome-extensions` skill: Google's, from the `modern-web-guidance` dev dependency, which pnpm links into `.agents/skills` and `.claude/skills` on install. Its rules are written for extensions in general; where this file documents a different choice, such as running bundled code as a user script, this file wins.

# Architecture

- `src/docs/docs.ts` holds every fact observed about how Docs is built: URL, class names, selectors, fixed-meaning canvas colours, and the dark-mode tokens Google's stylesheet sets. `src/ui/docs-css.ts` maps those tokens to theme colours; nothing else names a Docs internal.
- `src/theme/palette.ts` defines the 14 colours a user can set, under gg-theme's `tokens.json` names, parses them from untrusted data and from a `tokens.json`, and takes the default from gg-theme's dark palette at build time. Changing the default means bumping `@gjermundgaraba/gg-theme` in `pnpm-workspace.yaml` and rebuilding.
- `src/theme/theme.ts` builds a `Theme`: the palette plus the tiers (wash, tint, soft, quiet) gg-theme's own `deriveTiers` (`@gjermundgaraba/gg-theme/derive`) derives from it, all `#rrggbb` under `tokens.json`'s names, so a custom palette gets the tiers gg-theme would publish for it. `src/theme/checks.ts` reviews a palette: its theme, errors that block saving, and contrast warnings.
- `src/settings/settings.ts` owns `chrome.storage.local`: whether dark mode is on, and the saved palette. No saved palette means the default, so saving the default removes it. `readPalette` returns the palette documents get: the saved one while it is usable, else the default.
- `src/color/color.ts` holds the colour maths: canvas colour parsing, OKLab, contrast.
- `src/remap/remap.ts` is the pure policy that maps a canvas colour and its role (ink or paper) to a theme colour. Its property tests in `tests/remap.test.ts` pin the readability guarantees.
- `src/page/` runs in the Docs page's own world at document start, as a user script. Its registration puts the palette in code that runs just before `main.ts` (`palette-global.ts`), so the page is themed once, before Docs draws. `canvas-hook.ts` patches the 2D context's draw methods, and `diagnostics.ts` is debug-only bookkeeping.
- `src/ui/docs-css.ts` renders the interface stylesheet, which overrides Google's Material colour tokens with theme colours. The page script injects it, so it follows the saved palette.
- `src/options/` is the options page: `editor.ts` is the pure model (draft, saved palette, what to show), `page-style.ts` themes the page from the draft, and `options.ts` wires the DOM. Import reads `palette.dark` from a gg-theme `tokens.json` once; it is a snapshot, not a link to the file. Until user scripts are allowed, the page explains how to allow them and rechecks every second; once they are, it asks the worker to refresh.
- `src/background/` is the service worker. Dark mode is on exactly while the page script is registered with the palette, so the page never asks. One refresh, run one at a time, brings the registration in line with the settings, reloads open documents if it changed, and sets the icon. It runs when the worker starts, on browser startup, on every storage change (the options page only writes settings), and when the options page asks. A toolbar click refreshes first and flips dark mode only if that changed nothing, so the first click after allowing user scripts turns the theme on instead of off.
- `src/extension/` holds the manifest, the built file names, the static icons (on and off), the user-scripts check, and the message the options page sends.
- `scripts/` holds the build and the Playwright tooling. Scripts share their browser setup through `scripts/browser.ts`, which drives the extension through its options page, and print results through `scripts/checks.ts`.

# Platform behaviour the code relies on

- Docs draws each page onto `<canvas class="kix-canvas-tile-content">` tiles on the main thread, with a 2D context: the page is a white `fillRect`, text is `fillText`, underlines are `stroke`, table borders are `strokeRect`, and images are `drawImage`.
- Canvas reports `fillStyle`/`strokeStyle` as `#rrggbb` when opaque and `rgba(r, g, b, a)` otherwise, so the hook reads the normalised value back and the remapper parses only those two shapes.
- The text selection is a `fillRect` in `rgba(78, 143, 248, 0.5)`, drawn under the text. The caret is a DOM element, `.kix-cursor-caret`, with an inline black border.
- Docs has an unreleased dark mode: the `docsDarkMode` class switches Google's stylesheet to dark values for its `--gm3-sys-color-*` and `--ws-sys-color-*` tokens and swaps icon sprites. It does not touch the canvas. Light values are `var()` fallbacks, not declarations, so overrides on `html:root` apply everywhere and outrank Google's `.docsDarkMode` rule.
- User scripts (`chrome.userScripts`) can run in the page's main world (`world: "MAIN"`) at `document_start`, before any page script and before Docs creates its canvases, and a registration can put inline code ahead of a file. That is how the page script gets the palette synchronously; main-world scripts cannot read extension storage.
- From Chrome 138 user scripts run only once the user turns on "Allow User Scripts" on the extension's details page. Until then `chrome.userScripts` is `undefined`; it appears in already open extension pages and the running worker once the switch is on, but nothing tells the extension, hence the options page's polling and refresh request. Headless Chromium fires no `visibilitychange` when switching tabs, so the page polls instead of waiting for one.
- Chrome clears user scripts when the extension updates, and Playwright's `--load-extension` installs the extension afresh on every launch. Whether they survive a normal browser restart is unverified, so the worker re-syncs whenever it starts.
- Playwright can turn the toggle on by clicking `#allow-user-scripts` on `chrome://extensions/?id=<extension id>`.
- Playwright's Chromium loads unpacked extensions with `--load-extension`; branded Chrome no longer does.

# Linting and formatting

Lint comes from `@clanker-stuff/oxlint-config` through `oxlint.config.ts`, and formatting from Ultracite's preset. Fix the code rather than add a lint exception, and use no inline suppressions. The one override turns off `typescript/unbound-method` for the two files that patch DOM prototypes, which must hold the original methods.

Comments must be public-API JSDoc, directives, or links to upstream sources. Put other explanations in names, types, or this file.
