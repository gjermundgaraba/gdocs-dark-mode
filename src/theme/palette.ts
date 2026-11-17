import { isHexColor } from "../color/color.ts";

/** The hues coloured text and highlights snap to, `accent` first. */
export const hueNames = [
  "accent",
  "red",
  "green",
  "yellow",
  "blue",
  "magenta",
  "cyan",
  "orange",
] as const;

export type HueName = (typeof hueNames)[number];

/**
 * The colours a user can set. Everything else the extension paints with is
 * derived from them.
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

/**
 * The palette the extension ships with: neutral greys and the pastel hues of
 * Google's own dark themes, so the default looks at home in Docs.
 */
export const defaultPalette: Palette = {
  bg: "#202124",
  surface: "#303134",
  overlay: "#80868b",
  fg: "#e8eaed",
  "fg-dim": "#9aa0a6",
  "selection-bg": "#2b374b",
  accent: "#8ab4f8",
  red: "#f28b82",
  green: "#81c995",
  yellow: "#fdd663",
  blue: "#8ab4f8",
  magenta: "#d7aefb",
  cyan: "#78d9ec",
  orange: "#fcad70",
};

/**
 * The file Export writes and Import reads: a JSON object with a `#rrggbb`
 * colour under each of `paletteKeys`, in that order.
 */
export const paletteToFile = (palette: Palette): string =>
  `${JSON.stringify(
    Object.fromEntries(paletteKeys.map((key) => [key, palette[key]])),
    undefined,
    2
  )}\n`;

/** Reads a file `paletteToFile` wrote, or explains why it cannot. */
export const paletteFromFile = (
  text: string
): Palette | { readonly error: string } => {
  let json: unknown;

  try {
    json = JSON.parse(text);
  } catch {
    return { error: "The file is not valid JSON." };
  }

  const missing = paletteKeys.filter((key) => !isHexColor(field(json, key)));

  return (
    parsePalette(json) ?? {
      error: `The file needs a #rrggbb colour for: ${missing.join(", ")}.`,
    }
  );
};

export const samePalette = (x: Palette, y: Palette): boolean =>
  paletteKeys.every((key) => x[key] === y[key]);
