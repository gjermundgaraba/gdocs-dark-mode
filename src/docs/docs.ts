/**
 * Everything this extension knows about how Google Docs is built.
 *
 * These are the values a Docs update can invalidate. Each one was observed in a
 * live document; when the extension breaks, start here (see the
 * fix-docs-breakage skill).
 */

/** Where the extension runs: Docs documents only, not Sheets or Slides on the same host. */
export const documentUrlPattern = "https://docs.google.com/document/*";

/** The class on the `<canvas>` tiles Docs draws each page onto. */
export const pageCanvasClass = "kix-canvas-tile-content";

/**
 * Docs' own, unreleased dark mode. On any ancestor it switches Google's
 * stylesheet to dark values for its colour custom properties, swaps icon sprites
 * for light ones, and sets `color-scheme: dark`. It does not touch the canvas.
 */
export const darkModeClass = "docsDarkMode";

/** The page container behind each canvas tile, visible where a tile is cleared. */
export const pageSelector = ".kix-page-paginated";

/**
 * Your own text caret, a DOM element over the canvas with an inline black
 * border. Collaborators' carets carry their own colours and are left alone.
 */
export const ownCaretSelector =
  '.kix-cursor-caret[style*="border-color: rgb(0, 0, 0)"]';

/** What a colour Docs draws with means, when the colour alone says more than its role. */
export type CanvasColorMeaning = "selection";

export interface KnownCanvasColor {
  /** Exactly as canvas serialises it. */
  readonly css: string;
  readonly meaning: CanvasColorMeaning;
}

/** The text selection is drawn under the text, at half opacity. */
export const knownCanvasColors: readonly KnownCanvasColor[] = [
  { css: "rgba(78, 143, 248, 0.5)", meaning: "selection" },
];

/** The hues of Google's extended colour tokens, `--ws-sys-color-extended-<hue>-*`. */
export const googleExtendedHues = [
  "blue",
  "cyan",
  "green",
  "grey",
  "orange",
  "pink",
  "purple",
  "red",
  "yellow",
] as const;

export type GoogleExtendedHue = (typeof googleExtendedHues)[number];

/**
 * The colour custom properties Google's `.docsDarkMode` rule sets, as listed
 * from a live document by `pnpm run inspect` (without the `-rgb` twins, which
 * the stylesheet emits for every token). The stylesheet must override each
 * one, or Google's own dark value shows through. Gen AI gradients, gems and
 * premium colours are left as Google draws them, so only names under
 * `googleThemedTokenPrefixes` are listed.
 */
export const googleDarkModeTokens = [
  "--gm3-sys-color-background",
  "--gm3-sys-color-error",
  "--gm3-sys-color-error-container",
  "--gm3-sys-color-inverse-on-surface",
  "--gm3-sys-color-inverse-primary",
  "--gm3-sys-color-inverse-surface",
  "--gm3-sys-color-on-background",
  "--gm3-sys-color-on-error",
  "--gm3-sys-color-on-error-container",
  "--gm3-sys-color-on-primary",
  "--gm3-sys-color-on-primary-container",
  "--gm3-sys-color-on-primary-fixed",
  "--gm3-sys-color-on-primary-fixed-variant",
  "--gm3-sys-color-on-secondary",
  "--gm3-sys-color-on-secondary-container",
  "--gm3-sys-color-on-secondary-fixed",
  "--gm3-sys-color-on-secondary-fixed-variant",
  "--gm3-sys-color-on-surface",
  "--gm3-sys-color-on-surface-variant",
  "--gm3-sys-color-on-tertiary",
  "--gm3-sys-color-on-tertiary-container",
  "--gm3-sys-color-on-tertiary-fixed",
  "--gm3-sys-color-on-tertiary-fixed-variant",
  "--gm3-sys-color-outline",
  "--gm3-sys-color-outline-variant",
  "--gm3-sys-color-primary",
  "--gm3-sys-color-primary-container",
  "--gm3-sys-color-primary-fixed",
  "--gm3-sys-color-primary-fixed-dim",
  "--gm3-sys-color-secondary",
  "--gm3-sys-color-secondary-container",
  "--gm3-sys-color-secondary-fixed",
  "--gm3-sys-color-secondary-fixed-dim",
  "--gm3-sys-color-scrim",
  "--gm3-sys-color-shadow",
  "--gm3-sys-color-surface",
  "--gm3-sys-color-surface-bright",
  "--gm3-sys-color-surface-container",
  "--gm3-sys-color-surface-container-high",
  "--gm3-sys-color-surface-container-highest",
  "--gm3-sys-color-surface-container-low",
  "--gm3-sys-color-surface-container-lowest",
  "--gm3-sys-color-surface-dim",
  "--gm3-sys-color-surface-variant",
  "--gm3-sys-color-tertiary",
  "--gm3-sys-color-tertiary-container",
  "--gm3-sys-color-tertiary-fixed",
  "--gm3-sys-color-tertiary-fixed-dim",
  ...googleExtendedHues.flatMap((hue) => [
    `--ws-sys-color-extended-${hue}-fill`,
    `--ws-sys-color-extended-${hue}-outline`,
    `--ws-sys-color-extended-${hue}-tonal`,
    `--ws-sys-color-extended-on-${hue}-fill`,
    `--ws-sys-color-extended-on-${hue}-outline`,
    `--ws-sys-color-extended-on-${hue}-tonal`,
  ]),
] as const;

/** The custom property families the stylesheet themes. */
export const googleThemedTokenPrefixes = [
  "--gm3-sys-color-",
  "--ws-sys-color-extended-",
] as const;
