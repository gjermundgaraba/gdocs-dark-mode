import { mix, parseHex, toHex, toRgbTriplet } from "../color/color.ts";
import { ownCaretSelector, pageSelector } from "../docs/docs.ts";
import type { GoogleExtendedHue } from "../docs/docs.ts";
import type { HueName } from "../theme/palette.ts";
import type { Theme } from "../theme/theme.ts";

const black = "#000000";

const mixed = (from: string, to: string, amount: number): string =>
  toHex(mix(parseHex(from), parseHex(to), amount));

const materialTokens = (theme: Theme) => {
  const surfaceBright = mixed(theme.surface, theme.overlay, 0.25);

  const stepsBelowBg = (steps: number): string =>
    mixed(theme.bg, theme.surface, -steps);

  return {
    background: theme.bg,
    "on-background": theme.fg,
    surface: theme.bg,
    "surface-dim": theme.bg,
    "surface-bright": surfaceBright,
    "surface-container-lowest": stepsBelowBg(0.6),
    "surface-container-low": stepsBelowBg(0.4),
    "surface-container": theme.wash,
    "surface-container-high": theme.surface,
    "surface-container-highest": surfaceBright,
    "surface-variant": theme.surface,
    "on-surface": theme.fg,
    "on-surface-variant": theme["fg-dim"],
    "inverse-surface": theme.fg,
    "inverse-on-surface": theme.bg,
    "inverse-primary": theme["tint-accent"],
    outline: theme.overlay,
    "outline-variant": theme.surface,
    primary: theme.accent,
    "on-primary": theme.bg,
    "primary-container": theme["tint-accent"],
    "on-primary-container": theme.fg,
    "primary-fixed": theme["soft-accent"],
    "primary-fixed-dim": theme["quiet-accent"],
    "on-primary-fixed": theme.bg,
    "on-primary-fixed-variant": theme.bg,
    secondary: theme["soft-accent"],
    "on-secondary": theme.bg,
    "secondary-container": theme["selection-bg"],
    "on-secondary-container": theme.fg,
    "secondary-fixed": theme["soft-accent"],
    "secondary-fixed-dim": theme["quiet-accent"],
    "on-secondary-fixed": theme.bg,
    "on-secondary-fixed-variant": theme.bg,
    tertiary: theme["soft-green"],
    "on-tertiary": theme.bg,
    "tertiary-container": theme["tint-green"],
    "on-tertiary-container": theme.fg,
    "tertiary-fixed": theme["soft-green"],
    "tertiary-fixed-dim": theme["quiet-green"],
    "on-tertiary-fixed": theme.bg,
    "on-tertiary-fixed-variant": theme.bg,
    error: theme["soft-red"],
    "on-error": theme.bg,
    "error-container": theme["tint-red"],
    "on-error-container": theme.fg,
    scrim: black,
    shadow: black,
  };
};

const googleExtendedColorHues = {
  blue: "blue",
  cyan: "cyan",
  green: "green",
  grey: "grey",
  orange: "orange",
  pink: "accent",
  purple: "magenta",
  red: "red",
  yellow: "yellow",
} as const satisfies Record<GoogleExtendedHue, HueName | "grey">;

interface ExtendedTiers {
  readonly solidChip: string;
  readonly highlight: string;
  readonly textOnHighlight: string;
  readonly border: string;
  readonly textOnBg: string;
}

const extendedTiers = (theme: Theme, hue: HueName | "grey"): ExtendedTiers =>
  hue === "grey"
    ? {
        solidChip: theme["fg-dim"],
        highlight: theme.surface,
        textOnHighlight: theme.fg,
        border: theme.overlay,
        textOnBg: theme["fg-dim"],
      }
    : {
        solidChip: theme[`soft-${hue}`],
        highlight: theme[`tint-${hue}`],
        textOnHighlight: theme[hue],
        border: theme[`quiet-${hue}`],
        textOnBg: theme[`soft-${hue}`],
      };

const extendedTokens = (theme: Theme) =>
  Object.fromEntries(
    Object.entries(googleExtendedColorHues).flatMap(([name, hue]) => {
      const tiers = extendedTiers(theme, hue);

      return [
        [`extended-${name}-fill`, tiers.solidChip],
        [`extended-on-${name}-fill`, theme.bg],
        [`extended-${name}-tonal`, tiers.highlight],
        [`extended-on-${name}-tonal`, tiers.textOnHighlight],
        [`extended-${name}-outline`, tiers.border],
        [`extended-on-${name}-outline`, tiers.textOnBg],
      ];
    })
  );

const declarations = (
  prefix: string,
  tokens: Readonly<Record<string, string>>
): string[] =>
  Object.entries(tokens).flatMap(([name, color]) => [
    `  --${prefix}-${name}: ${color};`,
    `  --${prefix}-${name}-rgb: ${toRgbTriplet(parseHex(color))};`,
  ]);

/**
 * The stylesheet for Docs' interface: toolbars, menus, sidebars and dialogs.
 *
 * Docs colours its interface from Material 3 custom properties
 * (`--gm3-sys-color-*`, `--ws-sys-color-*`) read through `var()` with light
 * fallbacks, and its dark-mode class switches them to Google's dark values.
 * This sets them to the theme instead, on `html:root`, which outranks Google's
 * `.docsDarkMode` rule, so they hold whether or not that class is present.
 * Every colour also gets the `-rgb` triplet form Google uses for translucent
 * state layers. The chrome and the gutter around pages use the "low"
 * containers, a step below BG, so the BG page stands out.
 */
export const renderDocsCss = (theme: Theme): string =>
  [
    "/* gdocs-dark-mode — generated from the saved palette. Do not edit. */",
    "",
    "html:root {",
    "  color-scheme: dark;",
    ...declarations("gm3-sys-color", materialTokens(theme)),
    ...declarations("ws-sys-color", extendedTokens(theme)),
    "}",
    "",
    `${pageSelector} {`,
    `  background-color: ${theme.bg};`,
    "}",
    "",
    `${ownCaretSelector} {`,
    `  border-color: ${theme.fg} !important;`,
    "}",
    "",
  ].join("\n");
