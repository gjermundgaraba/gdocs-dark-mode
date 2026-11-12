import {
  checkPalette,
  contrast,
  hueNames,
  toOklch,
} from "@gjermundgaraba/gg-theme/derive";

import type { Palette } from "./palette.ts";
import { createTheme } from "./theme.ts";
import type { Theme } from "./theme.ts";

export interface PaletteReview {
  /** The palette's theme, or `undefined` when it has errors. */
  readonly theme: Theme | undefined;
  /** Problems that make the palette unusable; saving is refused. */
  readonly errors: readonly string[];
  /** Colour pairs below their readability minimum; saving is allowed. */
  readonly warnings: readonly string[];
}

const textContrast = 4.5;

const below = (
  label: string,
  foreground: string,
  background: string,
  minimum: number
): string[] => {
  const ratio = contrast(foreground, background);

  return ratio < minimum
    ? [`${label} contrast is ${ratio.toFixed(2)}; need ${minimum}`]
    : [];
};

const extensionRules = (theme: Theme): string[] => [
  ...below("fg/selection-bg", theme.fg, theme["selection-bg"], textContrast),
  ...hueNames.flatMap((ink) =>
    hueNames.flatMap((highlight) => {
      const [soft, tint] = [theme[`soft-${ink}`], theme[`tint-${highlight}`]];

      return below(
        `soft-${ink}/tint-${highlight} (${soft} on ${tint})`,
        soft,
        tint,
        textContrast
      );
    })
  ),
];

const lightness = (hex: string): number => toOklch(hex)[0];

const rejected = (error: string): PaletteReview => ({
  theme: undefined,
  errors: [error],
  warnings: [],
});

/**
 * A palette's theme and everything wrong with it as a dark theme for Docs.
 * Errors: BG is not darker than FG, or gg-theme cannot derive a readable
 * tier. Warnings: gg-theme's own contrast rules, FG on the selection, and
 * coloured text (Soft) on every highlight (Tint), which is how Docs' coloured
 * text on highlights is drawn.
 */
export const reviewPalette = (palette: Palette): PaletteReview => {
  if (lightness(palette.bg) >= lightness(palette.fg)) {
    return rejected("This is a dark theme, so bg must be darker than fg.");
  }

  let theme: Theme;

  try {
    theme = createTheme(palette);
  } catch (error) {
    return rejected(error instanceof Error ? error.message : String(error));
  }

  return {
    theme,
    errors: [],
    warnings: [...checkPalette("dark", palette), ...extensionRules(theme)],
  };
};
