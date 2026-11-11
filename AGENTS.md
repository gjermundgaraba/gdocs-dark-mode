# gdocs-dark-mode

A Chrome extension (Manifest V3, loaded unpacked) that themes Google Docs, including the document page, with the gg dark palette from `@gjermundgaraba/gg-theme`.

# Commands

The toolchain is Vite+ (`vp`) with pnpm. `vp check` formats, lints and type-checks; `vp test` runs the unit tests.

- `pnpm run ready`: check, test and build. Run it before handing work back.
- `pnpm run build`: build the unpacked extension into `dist/`.
- `pnpm run verify [--url <doc>] [--headed]`: build, load `dist/` into Playwright's Chromium, open a document with diagnostics on, and run the end-to-end checks. Output goes to `.cache/verify/`.
- `pnpm run inspect [--url <doc>] [--headed]`: list Google's dark-mode tokens against `googleDarkModeTokens`, light interface elements, and canvases. Output goes to `.cache/inspect/`.
- `pnpm run sign-in`: open the shared profile in plain Chromium for a Google sign-in, so verify can open the private reference document.

When a Docs update breaks the extension, follow `.agents/skills/fix-docs-breakage/SKILL.md`.

# Architecture

- `src/docs/docs.ts` holds every fact about how Docs is built: URL, class names, selectors, fixed-meaning canvas colours, and Google's dark-mode tokens. Nothing else names a Docs internal.
- `src/theme/theme.ts` reads the theme's `tokens.json` at build time. Changing the palette means bumping `@gjermundgaraba/gg-theme` in `pnpm-workspace.yaml` and rebuilding.
- `src/color/color.ts` holds the colour maths: canvas colour parsing, OKLab, contrast.
- `src/remap/remap.ts` is the pure policy that maps a canvas colour and its role (ink or paper) to a theme colour. Its property tests in `tests/remap.test.ts` pin the readability guarantees.
- `src/page/` runs in the Docs page's own world at document start: `canvas-hook.ts` patches the 2D context's draw methods, `diagnostics.ts` is debug-only bookkeeping, and `main.ts` wires them up.
- `src/ui/docs-css.ts` renders the interface stylesheet, which overrides Google's Material colour tokens with theme colours.
- `src/background/` is the service worker. Dark mode is on exactly while the page script and stylesheet are registered, so there is no runtime on/off check in the page. Toggling re-registers and reloads open documents.
- `scripts/` holds the build and the Playwright tooling. Scripts share their browser setup through `scripts/browser.ts`.

# Platform behaviour the code relies on

- Docs draws each page onto `<canvas class="kix-canvas-tile-content">` tiles on the main thread, with a 2D context: the page is a white `fillRect`, text is `fillText`, underlines are `stroke`, table borders are `strokeRect`, and images are `drawImage`.
- Canvas reports `fillStyle`/`strokeStyle` as `#rrggbb` when opaque and `rgba(r, g, b, a)` otherwise, so the hook reads the normalised value back and the remapper parses only those two shapes.
- The text selection is a `fillRect` in `rgba(78, 143, 248, 0.5)`, drawn under the text. The caret is a DOM element, `.kix-cursor-caret`, with an inline black border.
- Docs has an unreleased dark mode: the `docsDarkMode` class switches Google's stylesheet to dark values for its `--gm3-sys-color-*` and `--ws-sys-color-*` tokens and swaps icon sprites. It does not touch the canvas. Light values are `var()` fallbacks, not declarations, so overrides on `html:root` apply everywhere and outrank Google's `.docsDarkMode` rule.
- Registered content scripts can run in the page's main world (`world: "MAIN"`) at `document_start`, before Docs creates its canvases.
- Playwright's Chromium loads unpacked extensions with `--load-extension`; branded Chrome no longer does.

# Linting and formatting

Lint comes from `@clanker-stuff/oxlint-config` through `oxlint.config.ts`, and formatting from Ultracite's preset. Fix the code rather than add a lint exception, and use no inline suppressions. The one override turns off `typescript/unbound-method` for the two files that patch DOM prototypes, which must hold the original methods.

Comments must be public-API JSDoc, directives, or links to upstream sources. Put other explanations in names, types, or this file.
