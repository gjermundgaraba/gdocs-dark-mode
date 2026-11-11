import type { HueName } from "@gjermundgaraba/gg-theme/derive";

import { mix, rgb, toHex, toRgbTriplet } from "../color/color.ts";
import type { Rgba } from "../color/color.ts";
import { ownCaretSelector, pageSelector } from "../docs/docs.ts";
import type { Theme } from "../theme/theme.ts";

const black = rgb(0, 0, 0);

const materialTokens = (theme: Theme) => {
  const { accent } = theme.hues;
  const { green } = theme.hues;
  const { red } = theme.hues;
  const surfaceBright = mix(theme.surface, theme.overlay, 0.25);

  const stepsBelowBg = (steps: number): Rgba =>
    mix(theme.bg, theme.surface, -steps);

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
    "on-surface-variant": theme.fgDim,
    "inverse-surface": theme.fg,
    "inverse-on-surface": theme.bg,
    "inverse-primary": accent.tint,
    outline: theme.overlay,
    "outline-variant": theme.surface,
    primary: accent.base,
    "on-primary": theme.bg,
    "primary-container": accent.tint,
    "on-primary-container": theme.fg,
    "primary-fixed": accent.soft,
    "primary-fixed-dim": accent.quiet,
    "on-primary-fixed": theme.bg,
    "on-primary-fixed-variant": theme.bg,
    secondary: accent.soft,
    "on-secondary": theme.bg,
    "secondary-container": theme.selectionBg,
    "on-secondary-container": theme.fg,
    "secondary-fixed": accent.soft,
    "secondary-fixed-dim": accent.quiet,
    "on-secondary-fixed": theme.bg,
    "on-secondary-fixed-variant": theme.bg,
    tertiary: green.soft,
    "on-tertiary": theme.bg,
    "tertiary-container": green.tint,
    "on-tertiary-container": theme.fg,
    "tertiary-fixed": green.soft,
    "tertiary-fixed-dim": green.quiet,
    "on-tertiary-fixed": theme.bg,
    "on-tertiary-fixed-variant": theme.bg,
    error: red.soft,
    "on-error": theme.bg,
    "error-container": red.tint,
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
} as const satisfies Record<string, HueName | "grey">;

interface ExtendedTiers {
  readonly solidChip: Rgba;
  readonly highlight: Rgba;
  readonly textOnHighlight: Rgba;
  readonly border: Rgba;
  readonly textOnBg: Rgba;
}

const extendedTiers = (theme: Theme, hue: HueName | "grey"): ExtendedTiers =>
  hue === "grey"
    ? {
        solidChip: theme.fgDim,
        highlight: theme.surface,
        textOnHighlight: theme.fg,
        border: theme.overlay,
        textOnBg: theme.fgDim,
      }
    : {
        solidChip: theme.hues[hue].soft,
        highlight: theme.hues[hue].tint,
        textOnHighlight: theme.hues[hue].base,
        border: theme.hues[hue].quiet,
        textOnBg: theme.hues[hue].soft,
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
  tokens: Readonly<Record<string, Rgba>>
): string[] =>
  Object.entries(tokens).flatMap(([name, color]) => [
    `  --${prefix}-${name}: ${toHex(color)};`,
    `  --${prefix}-${name}-rgb: ${toRgbTriplet(color)};`,
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
    "/* gdocs-dark-mode — generated from @gjermundgaraba/gg-theme. Do not edit. */",
    "",
    "html:root {",
    "  color-scheme: dark;",
    ...declarations("gm3-sys-color", materialTokens(theme)),
    ...declarations("ws-sys-color", extendedTokens(theme)),
    "}",
    "",
    `${pageSelector} {`,
    `  background-color: ${toHex(theme.bg)};`,
    "}",
    "",
    `${ownCaretSelector} {`,
    `  border-color: ${toHex(theme.fg)} !important;`,
    "}",
    "",
  ].join("\n");
