import {
  contrast,
  hueDistance,
  mix,
  parseCanvasColor,
  rgb,
  toCss,
  toOklch,
  translucentOver,
  withAlpha,
} from "../color/color.ts";
import type { Rgba } from "../color/color.ts";
import type { CanvasColorMeaning, KnownCanvasColor } from "../docs/docs.ts";
import { hueNames } from "../theme/theme.ts";
import type { HueName, Theme } from "../theme/theme.ts";

/**
 * What a colour is drawn for: `ink` is text, strokes and hairlines; `paper` is
 * the page, highlights, shading and other filled areas.
 */
export type Role = "ink" | "paper";

export interface Remapper {
  /**
   * The theme colour to draw instead of `css`, serialised the way canvas does.
   * `undefined` means `css` is not a colour this remapper can read; draw it as is.
   */
  readonly remap: (css: string, role: Role) => string | undefined;
}

const greyMaxChroma = 0.02;

const white = rgb(255, 255, 255);
const black = rgb(0, 0, 0);

const nearestHue = (theme: Theme, color: Rgba): HueName => {
  const { h } = toOklch(color);
  let best: HueName = "accent";
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const hue of hueNames) {
    const distance = hueDistance(h, toOklch(theme.hues[hue].base).h);

    if (distance < bestDistance) {
      best = hue;
      bestDistance = distance;
    }
  }

  return best;
};

const greyWithContrastAgainstBg = (theme: Theme, ratio: number): Rgba => {
  if (ratio >= contrast(theme.fg, theme.bg)) {
    return theme.fg;
  }

  let [low, high] = [0, 1];

  for (let step = 0; step < 24; step += 1) {
    const middle = (low + high) / 2;

    if (contrast(mix(theme.bg, theme.fg, middle), theme.bg) < ratio) {
      low = middle;
    } else {
      high = middle;
    }
  }

  return mix(theme.bg, theme.fg, high);
};

const mapColor = (theme: Theme, color: Rgba, role: Role): Rgba => {
  if (toOklch(color).c < greyMaxChroma) {
    return greyWithContrastAgainstBg(theme, contrast(color, white));
  }

  const tiers = theme.hues[nearestHue(theme, color)];

  if (role === "ink") {
    return tiers.soft;
  }

  return contrast(color, black) >= contrast(color, white)
    ? tiers.tint
    : tiers.soft;
};

const mapMeaning = (
  theme: Theme,
  meaning: CanvasColorMeaning,
  color: Rgba
): Rgba => {
  switch (meaning) {
    case "selection": {
      return translucentOver(theme.selectionBg, theme.bg, color.a);
    }
  }
};

/**
 * Maps the colours Docs draws on its page canvas onto the theme. Docs paints a
 * light document, a white page with dark text, and every colour is mapped by
 * its `Role`.
 *
 * Greys keep the contrast they had against the white page, now measured
 * against BG along the BG→FG ramp: white becomes BG, black becomes FG (the most
 * contrast the theme has), and a grey stays as readable as its author saw it.
 * Ink and paper follow the same rule, so white text on black shading stays
 * legible.
 *
 * Coloured values snap to the nearest palette hue. Ink takes the hue's Soft
 * tier, which the theme guarantees is readable on BG; `tests/remap.test.ts`
 * checks it also reads on every Tint. Paper that dark text would sit on becomes
 * the hue's Tint; paper dark enough for white text becomes its Soft tier, which
 * BG text reads on.
 *
 * Alpha is kept. A colour in `knownColors` maps by its meaning instead: the
 * selection composites to exactly SelectionBG over the page and stays
 * translucent, so images under it still show.
 */
export const createRemapper = (
  theme: Theme,
  knownColors: readonly KnownCanvasColor[]
): Remapper => {
  const meanings = new Map(
    knownColors.map(({ css, meaning }) => [css, meaning])
  );

  const caches: Record<Role, Map<string, string | undefined>> = {
    ink: new Map(),
    paper: new Map(),
  };

  const compute = (css: string, role: Role): string | undefined => {
    const color = parseCanvasColor(css);

    if (color === undefined) {
      return undefined;
    }

    const meaning = meanings.get(css);

    if (meaning !== undefined) {
      return toCss(mapMeaning(theme, meaning, color));
    }

    return toCss(withAlpha(mapColor(theme, color, role), color.a));
  };

  return {
    remap: (css, role) => {
      const cache = caches[role];

      if (cache.has(css)) {
        return cache.get(css);
      }

      const mapped = compute(css, role);
      cache.set(css, mapped);

      return mapped;
    },
  };
};
