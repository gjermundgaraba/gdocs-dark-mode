import { hueNames } from "@gjermundgaraba/gg-theme/derive";
import tokens from "@gjermundgaraba/gg-theme/tokens" with { type: "json" };

import { isHexColor } from "../color/color.ts";

/**
 * The colours a user can set, under gg-theme's `tokens.json` names. Everything
 * else the extension paints with is derived from them.
 */
export const paletteKeys = [
  "bg",
  "surface",
  "overlay",
  "fg",
  "fg-dim",
  "selection-bg",
  ...hueNames,
] as const;

export type PaletteKey = (typeof paletteKeys)[number];

/** `#rrggbb` colours, lower-case, under `paletteKeys`. */
export type Palette = Readonly<Record<PaletteKey, string>>;

const isObject = (value: unknown): value is object =>
  value !== null && typeof value === "object" && !Array.isArray(value);

const field = (value: unknown, name: string): unknown =>
  isObject(value) && Object.hasOwn(value, name)
    ? Object.getOwnPropertyDescriptor(value, name)?.value
    : undefined;

const isComplete = (
  palette: Partial<Record<PaletteKey, string>>
): palette is Palette => paletteKeys.every((key) => palette[key] !== undefined);

/**
 * Reads a palette from untrusted data: an object with a `#rrggbb` string for
 * every key. Extra keys are ignored; anything missing or malformed gives
 * `undefined`.
 */
export const parsePalette = (value: unknown): Palette | undefined => {
  const palette: Partial<Record<PaletteKey, string>> = {};

  for (const key of paletteKeys) {
    const color = field(value, key);

    if (isHexColor(color)) {
      palette[key] = color.toLowerCase();
    }
  }

  return isComplete(palette) ? palette : undefined;
};

/** The gg dark palette the extension ships with. */
export const defaultPalette: Palette = (() => {
  const palette = parsePalette(tokens.palette.dark);

  if (palette === undefined) {
    throw new Error("gg-theme's dark palette is missing a colour");
  }

  return palette;
})();

/**
 * Reads the dark palette from a gg-theme `tokens.json`, the file
 * `@gjermundgaraba/gg-theme/tokens` publishes.
 */
export const paletteFromTokensFile = (
  text: string
): Palette | { readonly error: string } => {
  let json: unknown;

  try {
    json = JSON.parse(text);
  } catch {
    return { error: "The file is not valid JSON." };
  }

  const dark = field(field(json, "palette"), "dark");

  if (dark === undefined) {
    return {
      error:
        "The file has no palette.dark, so it is not a gg-theme tokens.json.",
    };
  }

  return (
    parsePalette(dark) ?? {
      error: `palette.dark needs a #rrggbb colour for each of: ${paletteKeys.join(", ")}.`,
    }
  );
};

export const samePalette = (x: Palette, y: Palette): boolean =>
  paletteKeys.every((key) => x[key] === y[key]);
