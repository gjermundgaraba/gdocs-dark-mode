import { contrast, parseHex, toOklch } from "../color/color.ts";
import { hueNames } from "./palette.ts";
import type { Palette, PaletteKey } from "./palette.ts";
import { createTheme, nonTextContrast, textContrast } from "./theme.ts";
import type { Theme, TierName } from "./theme.ts";

export interface PaletteReview {
  /** The palette's theme, or `undefined` when it has errors. */
  readonly theme: Theme | undefined;
  /** Problems that make the palette unusable; saving is refused. */
  readonly errors: readonly string[];
  /** Colour pairs below their readability minimum; saving is allowed. */
  readonly warnings: readonly string[];
}

type ThemeKey = PaletteKey | TierName;

const fgOnWashContrast = 7;

const textColors = [
  "fg-dim",
  ...hueNames.filter((hue) => hue !== "accent"),
] as const;

const pairs: ReadonlyArray<[ThemeKey, ThemeKey, number]> = [
  ["accent", "bg", nonTextContrast],
  ["fg", "bg", textContrast],
  ["overlay", "bg", nonTextContrast],
  ["fg", "overlay", nonTextContrast],
  ["fg-dim", "surface", textContrast],
  ["fg", "selection-bg", textContrast],
  ...textColors.flatMap((color): Array<[ThemeKey, ThemeKey, number]> =>
    (["bg", "surface", "selection-bg"] as const).map((background) => [
      color,
      background,
      textContrast,
    ])
  ),
  ...hueNames.flatMap((hue): Array<[ThemeKey, ThemeKey, number]> => [
    ["fg", `wash-${hue}`, fgOnWashContrast],
    ["fg", `tint-${hue}`, fgOnWashContrast],
    ...textColors.map((color): [ThemeKey, ThemeKey, number] => [
      color,
      `tint-${hue}`,
      textContrast,
    ]),
    ...hueNames.map((ink): [ThemeKey, ThemeKey, number] => [
      `soft-${ink}`,
      `tint-${hue}`,
      textContrast,
    ]),
  ]),
  ["fg", "wash", fgOnWashContrast],
];

const contrastWarnings = (theme: Theme): string[] =>
  pairs.flatMap(([foreground, background, minimum]) => {
    const ratio = contrast(
      parseHex(theme[foreground]),
      parseHex(theme[background])
    );

    return ratio < minimum
      ? [
          `${foreground}/${background} (${theme[foreground]} on ${theme[background]}) contrast is ${ratio.toFixed(2)}; need ${minimum}`,
        ]
      : [];
  });

const lightness = (hex: string): number => toOklch(parseHex(hex)).l;

const rejected = (error: string): PaletteReview => ({
  theme: undefined,
  errors: [error],
  warnings: [],
});

/**
 * A palette's theme and everything wrong with it as a dark theme for Docs.
 * Errors: BG is not darker than FG, or a soft or quiet tier cannot be made
 * readable. Warnings: text below 4.5:1 on its backgrounds (FG below 7:1 on
 * the washes and tints), marks below 3:1, and coloured text (Soft) on every
 * highlight (Tint), which is how Docs' coloured text on highlights is drawn.
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

  return { theme, errors: [], warnings: contrastWarnings(theme) };
};
