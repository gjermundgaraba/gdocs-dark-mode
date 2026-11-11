import { checkPalette, hueNames } from "@gjermundgaraba/gg-theme/derive";

import { contrast, luminance, toHex } from "../color/color.ts";
import type { Rgba } from "../color/color.ts";
import type { Palette } from "./palette.ts";
import { createTheme } from "./theme.ts";
import type { Theme } from "./theme.ts";

export interface PaletteProblems {
  /** Problems that make the palette unusable; saving is refused. */
  readonly errors: readonly string[];
  /** Colour pairs below their readability minimum; saving is allowed. */
  readonly warnings: readonly string[];
}

const textContrast = 4.5;

const below = (
  label: string,
  foreground: Rgba,
  background: Rgba,
  minimum: number
): string[] => {
  const ratio = contrast(foreground, background);

  return ratio < minimum
    ? [`${label} contrast is ${ratio.toFixed(2)}; need ${minimum}`]
    : [];
};

const extensionRules = (theme: Theme): string[] => [
  ...below("fg/selection-bg", theme.fg, theme.selectionBg, textContrast),
  ...hueNames.flatMap((ink) =>
    hueNames.flatMap((highlight) =>
      below(
        `soft-${ink}/tint-${highlight} (${toHex(theme.hues[ink].soft)} on ${toHex(theme.hues[highlight].tint)})`,
        theme.hues[ink].soft,
        theme.hues[highlight].tint,
        textContrast
      )
    )
  ),
];

/**
 * Everything wrong with a palette as a dark theme for Docs. Errors: BG is not
 * darker than FG, or gg-theme cannot derive a readable tier. Warnings:
 * gg-theme's own contrast rules, FG on the selection, and coloured text (Soft)
 * on every highlight (Tint), which is how Docs' coloured text on highlights is
 * drawn.
 */
export const paletteProblems = (palette: Palette): PaletteProblems => {
  let theme: Theme;

  try {
    theme = createTheme(palette);
  } catch (error) {
    return {
      errors: [error instanceof Error ? error.message : String(error)],
      warnings: [],
    };
  }

  if (luminance(theme.bg) >= luminance(theme.fg)) {
    return {
      errors: ["This is a dark theme, so bg must be darker than fg."],
      warnings: [],
    };
  }

  return {
    errors: [],
    warnings: [
      ...checkPalette("dark", palette).map((problem) =>
        problem.replace(/^dark\./u, "")
      ),
      ...extensionRules(theme),
    ],
  };
};
