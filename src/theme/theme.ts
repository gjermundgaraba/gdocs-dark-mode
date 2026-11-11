import { deriveTiers } from "@gjermundgaraba/gg-theme/derive";
import type { HueName } from "@gjermundgaraba/gg-theme/derive";

import { parseHex } from "../color/color.ts";
import type { Rgba } from "../color/color.ts";
import { defaultPalette } from "./palette.ts";
import type { Palette } from "./palette.ts";

export interface HueTiers {
  /** The palette colour itself. */
  readonly base: Rgba;
  /** Calmer than base; gg-theme makes it readable as text on BG, Surface and Washes. */
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
  readonly hues: Readonly<Record<HueName, HueTiers>>;
}

const tier = (tiers: Readonly<Record<string, string>>, name: string): Rgba => {
  const color = tiers[name];

  if (color === undefined) {
    throw new Error(`gg-theme derived no ${name} tier`);
  }

  return parseHex(color);
};

/**
 * A dark theme built from `palette`, with its tiers derived by gg-theme's own
 * code, so a custom palette gets the same tints and soft colours gg-theme
 * would publish for it. Throws when a tier cannot be made readable; check a
 * palette with `paletteProblems` before saving it.
 */
export const createTheme = (palette: Palette): Theme => {
  const tiers = deriveTiers("dark", palette);

  const hueTiers = (hue: HueName): HueTiers => ({
    base: parseHex(palette[hue]),
    soft: tier(tiers, `soft-${hue}`),
    quiet: tier(tiers, `quiet-${hue}`),
    wash: tier(tiers, `wash-${hue}`),
    tint: tier(tiers, `tint-${hue}`),
  });

  return {
    bg: parseHex(palette.bg),
    wash: tier(tiers, "wash"),
    surface: parseHex(palette.surface),
    overlay: parseHex(palette.overlay),
    fgDim: parseHex(palette["fg-dim"]),
    fg: parseHex(palette.fg),
    selectionBg: parseHex(palette["selection-bg"]),
    hues: {
      accent: hueTiers("accent"),
      red: hueTiers("red"),
      green: hueTiers("green"),
      yellow: hueTiers("yellow"),
      blue: hueTiers("blue"),
      magenta: hueTiers("magenta"),
      cyan: hueTiers("cyan"),
      orange: hueTiers("orange"),
    },
  };
};

/** The gg dark theme the extension ships with. */
export const defaultTheme: Theme = createTheme(defaultPalette);
