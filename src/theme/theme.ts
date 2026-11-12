import { deriveTiers } from "@gjermundgaraba/gg-theme/derive";
import type { Tiers } from "@gjermundgaraba/gg-theme/derive";

import { defaultPalette } from "./palette.ts";
import type { Palette } from "./palette.ts";

/**
 * A palette and the tiers gg-theme derives from it, all `#rrggbb` under
 * `tokens.json`'s names: `wash` (between BG and Surface), and per hue `soft-*`
 * (text readable on BG, Surface and the washes), `quiet-*` (borders, receding
 * text), `wash-*` (faint backgrounds) and `tint-*` (highlights).
 */
export type Theme = Palette & Tiers;

/**
 * A dark theme built from `palette` by gg-theme's own derivation, so a custom
 * palette gets the tiers gg-theme would publish for it. Throws when a tier
 * cannot be made readable; `reviewPalette` reports that instead.
 */
export const createTheme = (palette: Palette): Theme => ({
  ...palette,
  ...deriveTiers("dark", palette),
});

/** The gg dark theme the extension ships with. */
export const defaultTheme: Theme = createTheme(defaultPalette);
