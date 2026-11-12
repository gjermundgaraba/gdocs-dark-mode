import { hueNames } from "@gjermundgaraba/gg-theme/derive";
import type { HueName } from "@gjermundgaraba/gg-theme/derive";

import {
  contrast,
  hueDistance,
  mix,
  parseCanvasColor,
  parseHex,
  rgb,
  toCss,
  toOklch,
  translucentOver,
  withAlpha,
} from "../color/color.ts";
import type { Rgba } from "../color/color.ts";
import type { CanvasColorMeaning, KnownCanvasColor } from "../docs/docs.ts";
import type { Theme } from "../theme/theme.ts";

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

interface HueInks {
  readonly oklchHueAngle: number;
  readonly soft: Rgba;
  readonly tint: Rgba;
}

interface Inks {
  readonly bg: Rgba;
  readonly fg: Rgba;
  readonly selectionBg: Rgba;
  readonly hues: readonly [HueInks, ...HueInks[]];
}

const inksOf = (theme: Theme): Inks => {
  const hueInks = (hue: HueName): HueInks => ({
    oklchHueAngle: toOklch(parseHex(theme[hue])).h,
    soft: parseHex(theme[`soft-${hue}`]),
    tint: parseHex(theme[`tint-${hue}`]),
  });

  const [first, ...rest] = hueNames;

  return {
    bg: parseHex(theme.bg),
    fg: parseHex(theme.fg),
    selectionBg: parseHex(theme["selection-bg"]),
    hues: [hueInks(first), ...rest.map(hueInks)],
  };
};

const nearestHue = (inks: Inks, color: Rgba): HueInks => {
  const { h } = toOklch(color);
  const distance = (hue: HueInks): number => hueDistance(h, hue.oklchHueAngle);
  let [best] = inks.hues;

  for (const hue of inks.hues) {
    if (distance(hue) < distance(best)) {
      best = hue;
    }
  }

  return best;
};

const greyWithContrastAgainstBg = (inks: Inks, ratio: number): Rgba => {
  if (ratio >= contrast(inks.fg, inks.bg)) {
    return inks.fg;
  }

  let [low, high] = [0, 1];

  for (let step = 0; step < 24; step += 1) {
    const middle = (low + high) / 2;

    if (contrast(mix(inks.bg, inks.fg, middle), inks.bg) < ratio) {
      low = middle;
    } else {
      high = middle;
    }
  }

  return mix(inks.bg, inks.fg, high);
};

const mapColor = (inks: Inks, color: Rgba, role: Role): Rgba => {
  if (toOklch(color).c < greyMaxChroma) {
    return greyWithContrastAgainstBg(inks, contrast(color, white));
  }

  const hue = nearestHue(inks, color);

  if (role === "ink") {
    return hue.soft;
  }

  return contrast(color, black) >= contrast(color, white) ? hue.tint : hue.soft;
};

const mapMeaning = (
  inks: Inks,
  meaning: CanvasColorMeaning,
  color: Rgba
): Rgba => {
  switch (meaning) {
    case "selection": {
      return translucentOver(inks.selectionBg, inks.bg, color.a);
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
  const inks = inksOf(theme);

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
      return toCss(mapMeaning(inks, meaning, color));
    }

    return toCss(withAlpha(mapColor(inks, color, role), color.a));
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
