import { parsePalette } from "../theme/palette.ts";
import type { Palette } from "../theme/palette.ts";

declare global {
  var gdocsDarkModePalette: unknown;
}

/**
 * Code that leaves `palette` for the page script, which runs right after it in
 * the same user script registration and world.
 */
export const paletteAssignment = (palette: Palette): string =>
  `globalThis.gdocsDarkModePalette = ${JSON.stringify(palette)};`;

/** Takes the palette `paletteAssignment` left, or `undefined` when there is none. */
export const takePalette = (): Palette | undefined => {
  const palette = parsePalette(globalThis.gdocsDarkModePalette);
  globalThis.gdocsDarkModePalette = undefined;

  return palette;
};
