---
name: fix-docs-breakage
description: Diagnose and repair the gdocs-dark-mode Chrome extension after a Google Docs update breaks it, such as a white or partly white page, colours drawn unthemed, or a light toolbar or menu. Use when asked to fix, check, or repair the extension against the current Google Docs.
disable-model-invocation: true
---

# Fix Docs Breakage

Google Docs changes without notice. The extension depends on a few facts about how Docs is built, and all of them live in `src/docs/docs.ts`. Find which fact stopped being true, update it, and prove the fix on a live document. Read `AGENTS.md` first for the architecture.

## 1. Reproduce

1. Run `pnpm install`, then `pnpm run verify`. It builds `dist/`, opens a document in Playwright's Chromium with the extension and diagnostics on, and prints seven PASS/FAIL checks. It writes `report.json`, `page.png` and `selection.png` to `.cache/verify/`. Look at both screenshots.
2. `verify` opens the reference document when `scripts/reference-doc.ts` has its URL, and the public document otherwise. Pass `--url <document>` to open the document the user reported, and `--headed` to watch.
3. The reference document is private, so it needs a signed-in profile. If `verify` lands on a Google sign-in page, ask the user to run `! pnpm run sign-in`, sign in, and quit Chromium. Google may refuse sign-in in this browser. If it does, say so and continue on the public document, and state which features that leaves unverified: the editing toolbar, comments, suggestions, and spelling marks.
4. Run `pnpm run inspect` (it takes the same flags). It lists Google tokens that appeared or disappeared, interface elements still light, and every canvas, in `.cache/inspect/inspect.json`.

If every check passes and the screenshots look right, ask the user what they see and on which document before changing anything.

## 2. Classify

| Symptom | Likely cause | Where to fix |
| --- | --- | --- |
| `hook reaches the page canvas` fails, and `otherCanvasDraws` shows draws on a canvas with a new class | Docs renamed its page tiles | `pageCanvasClass` in `src/docs/docs.ts` |
| Hook fails, no draws anywhere, `offscreenTransfers` > 0 | Docs draws in a worker, which a page script cannot patch | Stop and report to the user; this needs a new design (see below) |
| Hook fails, `inspect` lists no page canvases | Docs stopped drawing pages on canvas | Stop and report to the user with what `inspect` shows |
| `every colour recognised` fails | Canvas reports a colour syntax `parseCanvasColor` cannot read | `src/color/color.ts`, with a test in `tests/color.test.ts` |
| `Docs draws a light page` fails: the commonest opaque paper is dark | Docs now draws dark itself, perhaps when it sees `docsDarkMode` | Stop and report to the user (see below) |
| `dark-mode class kept on <html>` fails | Docs rewrites `<html>`'s class | `src/page/main.ts`; keep the class without fighting Docs in a loop |
| `saved palette applied before the first draw` fails | `palette` is `waiting`: the bridge did not run or the attribute was lost. `drawsBeforePalette` > 0: Docs now draws before the bridge runs | `src/page/palette-handoff.ts` and `src/background/registration.ts`; a fact about Docs goes in `docs.ts` |
| `blank page is BG` fails while the hook works | The page fill is a new colour, or Docs fills the page another way | `report.json` → `colors`; usually a `knownCanvasColors` entry |
| A colour has the wrong meaning, such as the selection showing a hue instead of SelectionBG | Docs changed the colour of a fixed-meaning element | `knownCanvasColors` in `src/docs/docs.ts` |
| Toolbar, menu or dialog areas are light | Google added or renamed colour tokens, or an element sets its colour outside the tokens | `inspect` → new tokens: add them to `googleDarkModeTokens` and map them in `src/ui/docs-css.ts`. A light element with no token behind it: add its selector to `docs.ts` and a rule to `renderDocsCss` |
| The caret is invisible | The caret's inline style changed | `ownCaretSelector` in `src/docs/docs.ts` |

To find what a live element or draw call does, write a throwaway Playwright script in `.cache/` modelled on `scripts/inspect.ts`. Use `launchWithExtension` and `openWithDiagnostics` from `scripts/browser.ts`, and run it with `pnpm exec vpx`. Check the facts in a live document instead of guessing them from Docs' minified source.

## 3. Fix

- Facts about Docs belong in `src/docs/docs.ts`; nothing else names a Docs class, selector, URL or colour.
- Fix a single wrong colour with a `knownCanvasColors` entry. Change the mapping policy in `src/remap/remap.ts` only when a whole class of colours is wrong, and keep its property tests passing.
- Add every newly observed canvas colour, with its role and where it was seen, to `tests/fixtures/observed-canvas-colors.ts`.
- When Google's token list changes, update `googleDarkModeTokens`; `tests/docs-css.test.ts` then requires a mapping for each token.

Stop and report to the user, with options, instead of patching around it, when:

- Docs moves page drawing into a worker or off canvas.
- Docs ships its own dark canvas. One option is to drop the canvas hook and theme only the interface; another is to detect Google's dark page and remap from it.
- A fix would need the hook to patch more than the 2D context's draw methods.

## 4. Verify and report

1. Run `pnpm run ready` (format, lint, type check, tests, build). Fix the code instead of adding lint exceptions.
2. Run `pnpm run verify` on the reference document and on the public one (`--url` with `publicDocUrl`). Every check must pass, and the screenshots must look right.
3. Run `pnpm run verify-options`, which checks a custom palette reaches the document.
4. Tell the user to reload the extension at `chrome://extensions` and reload their Docs tabs.

Report the cause, the files changed, what verify showed on each document, and anything left unverified. Do not commit unless asked.

## The reference document

If it needs rebuilding, create a Google Doc, keep it private, and put its URL in `scripts/reference-doc.ts`. Starting at the top of page 1, so the drag-select in `verify` covers text:

- A Title, Subtitle, Headings 1 to 3, and body text.
- Text in red, blue, green and grey (`#666666`); a yellow highlight; and white text on a dark blue (`#1155cc`) highlight.
- A link, a bulleted list, a numbered list and a checklist.
- A 3×3 table with a shaded header row (`#f3f3f3`), one cell shaded light blue (`#cfe2f3`), and one dark cell with white text.
- An image, a horizontal line, and a page break, so there is a page 2.
- An open comment and a suggested edit.
