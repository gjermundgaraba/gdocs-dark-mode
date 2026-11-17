import {
  contrast,
  fromOklch,
  mix,
  parseHex,
  toHex,
  toOklch,
} from "../color/color.ts";
import type { Rgba } from "../color/color.ts";
import { defaultPalette, hueNames } from "./palette.ts";
import type { HueName, Palette } from "./palette.ts";

/** The derived colours' names: `wash`, and per hue `wash-*`, `tint-*`, `soft-*` and `quiet-*`. */
export type TierName =
  | "wash"
  | `${"wash" | "tint" | "soft" | "quiet"}-${HueName}`;

/** Derived colours as `#rrggbb`. */
export type Tiers = Readonly<Record<TierName, string>>;

/**
 * A palette and the tiers derived from it, all `#rrggbb`: `wash` (between BG
 * and Surface), and per hue `soft-*` (text readable on BG, Surface and the
 * washes), `quiet-*` (borders, receding text), `wash-*` (faint backgrounds)
 * and `tint-*` (highlights).
 */
export type Theme = Palette & Tiers;

/** WCAG's minimum contrast for text. */
export const textContrast = 4.5;

/** WCAG's minimum contrast for borders and other non-text marks. */
export const nonTextContrast = 3;

const softChromaScale = 0.6;
const softMaxLightness = 0.8;
const quietLightnessStep = -0.08;
const quietChromaScale = 0.6;
const washChroma = 0.03;
const tintChroma = 0.065;
const lightnessStep = 0.005;

const tierNames: readonly TierName[] = [
  "wash",
  ...hueNames.flatMap((hue) =>
    (["wash", "tint", "soft", "quiet"] as const).map(
      (tier) => `${tier}-${hue}` as const
    )
  ),
];

const isComplete = (tiers: Partial<Tiers>): tiers is Tiers =>
  tierNames.every((name) => tiers[name] !== undefined);

const tint = (surface: Rgba, hue: Rgba, chroma: number): string =>
  toHex(fromOklch({ l: toOklch(surface).l, c: chroma, h: toOklch(hue).h }));

const lightenUntilReadable = (
  label: string,
  source: Rgba,
  backgrounds: readonly Rgba[],
  minimum: number
): Rgba => {
  const { c, h } = toOklch(source);
  let { l } = toOklch(source);
  let color = fromOklch({ l, c, h });

  while (
    backgrounds.some((background) => contrast(color, background) < minimum)
  ) {
    l += lightnessStep;

    if (l >= 1) {
      throw new Error(`${label} cannot reach ${minimum} contrast`);
    }

    color = fromOklch({ l, c, h });
  }

  return color;
};

const deriveTiers = (palette: Palette): Tiers => {
  const [bg, surface] = [parseHex(palette.bg), parseHex(palette.surface)];
  const wash = mix(bg, surface, 0.5);
  const tiers: Partial<Record<TierName, string>> = { wash: toHex(wash) };
  const textBackgrounds = [bg, surface, wash];

  for (const hue of hueNames) {
    const hueWash = tint(wash, parseHex(palette[hue]), washChroma);
    tiers[`wash-${hue}`] = hueWash;
    tiers[`tint-${hue}`] = tint(wash, parseHex(palette[hue]), tintChroma);
    textBackgrounds.push(parseHex(hueWash));
  }

  for (const hue of hueNames) {
    const { l, c, h } = toOklch(parseHex(palette[hue]));

    const soft = lightenUntilReadable(
      `soft-${hue}`,
      fromOklch({
        l: Math.min(l, softMaxLightness),
        c: c * softChromaScale,
        h,
      }),
      textBackgrounds,
      textContrast
    );

    const quiet = lightenUntilReadable(
      `quiet-${hue}`,
      fromOklch({
        l: toOklch(soft).l + quietLightnessStep,
        c: toOklch(soft).c * quietChromaScale,
        h,
      }),
      [bg],
      nonTextContrast
    );

    tiers[`soft-${hue}`] = toHex(soft);
    tiers[`quiet-${hue}`] = toHex(quiet);
  }

  if (!isComplete(tiers)) {
    throw new Error("a tier was not derived");
  }

  return tiers;
};

/**
 * A dark theme built from `palette`. Throws when a soft or quiet tier cannot
 * be made readable; `reviewPalette` reports that instead.
 */
export const createTheme = (palette: Palette): Theme => ({
  ...palette,
  ...deriveTiers(palette),
});

/** The theme the extension ships with. */
export const defaultTheme: Theme = createTheme(defaultPalette);
