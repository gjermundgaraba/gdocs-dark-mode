import { parsePalette } from "../theme/palette.ts";
import type { Palette } from "../theme/palette.ts";

/**
 * The `localStorage` key on docs.google.com that holds the palette documents
 * were last themed with, so the page script can read it before Docs draws.
 * Extension storage stays the source of truth; this is a copy of it.
 */
export const paletteCacheKey = "gdocs-dark-mode:palette";

/**
 * The event the palette script dispatches on `document` once it has read the
 * palette from extension storage, with the palette as JSON in `detail`.
 */
export const paletteEvent = "gdocs-dark-mode:palette";

/** Reads a palette from JSON text, or `undefined` when it is not one. */
export const parsePaletteJson = (text: string | null): Palette | undefined => {
  if (text === null) {
    return undefined;
  }

  try {
    return parsePalette(JSON.parse(text));
  } catch {
    return undefined;
  }
};

/** The cached palette, or `undefined` when there is none or it cannot be read. */
export const readCachedPalette = (): Palette | undefined => {
  try {
    return parsePaletteJson(globalThis.localStorage.getItem(paletteCacheKey));
  } catch {
    return undefined;
  }
};
