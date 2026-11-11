import tokens from "@gjermundgaraba/gg-theme/tokens" with { type: "json" };

import { parseHex } from "../color/color.ts";
import type { Rgba } from "../color/color.ts";

export const hueNames = [
  "accent",
  "red",
  "orange",
  "yellow",
  "green",
  "cyan",
  "blue",
  "magenta",
] as const;

export type HueName = (typeof hueNames)[number];

export interface HueTiers {
  /** The palette colour itself: vivid, readable as text on BG, Surface and Tints. */
  readonly base: Rgba;
  /** Calmer than base; readable as text on BG, Surface and Washes. */
  readonly soft: Rgba;
  /** Receding: borders and de-emphasised text. */
  readonly quiet: Rgba;
  /** A faint background. */
  readonly wash: Rgba;
  /** A highlight background. */
  readonly tint: Rgba;
}

export interface Theme {
  readonly bg: Rgba;
  readonly wash: Rgba;
  readonly surface: Rgba;
  readonly overlay: Rgba;
  readonly fgDim: Rgba;
  readonly fg: Rgba;
  readonly selectionBg: Rgba;
  /** The light theme's accent, for the rare control drawn on an inverse (light) surface. */
  readonly inverseAccent: Rgba;
  readonly hues: Readonly<Record<HueName, HueTiers>>;
}

const palette = tokens.palette.dark;
const tiers = tokens.tiers.dark;

const hueTiers = (hue: HueName): HueTiers => ({
  base: parseHex(palette[hue]),
  soft: parseHex(tiers[`soft-${hue}`]),
  quiet: parseHex(tiers[`quiet-${hue}`]),
  wash: parseHex(tiers[`wash-${hue}`]),
  tint: parseHex(tiers[`tint-${hue}`]),
});

/**
 * The gg dark theme, read from `@gjermundgaraba/gg-theme`'s tokens at build
 * time. The package checks contrast when it is generated: FG on every Tint is
 * at least 7:1, each base hue is at least 4.5:1 on BG, Surface, SelectionBG and
 * every Tint, and each Soft hue is at least 4.5:1 on BG, Surface and every
 * Wash. The remapper and stylesheet rely on those guarantees when they pick a tier.
 */
export const theme: Theme = {
  bg: parseHex(palette.bg),
  wash: parseHex(tiers.wash),
  surface: parseHex(palette.surface),
  overlay: parseHex(palette.overlay),
  fgDim: parseHex(palette["fg-dim"]),
  fg: parseHex(palette.fg),
  selectionBg: parseHex(palette["selection-bg"]),
  inverseAccent: parseHex(tokens.palette.light.accent),
  hues: {
    accent: hueTiers("accent"),
    red: hueTiers("red"),
    orange: hueTiers("orange"),
    yellow: hueTiers("yellow"),
    green: hueTiers("green"),
    cyan: hueTiers("cyan"),
    blue: hueTiers("blue"),
    magenta: hueTiers("magenta"),
  },
};
