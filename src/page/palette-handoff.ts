import { parsePalette } from "../theme/palette.ts";
import type { Palette } from "../theme/palette.ts";

const attribute = "data-gdocs-dark-mode-palette";

/**
 * Leaves the saved palette on `<html>` for the page script. The two run in
 * different worlds at document start in no fixed order, so the palette is
 * state the page script reads whenever it starts, not an event it could miss.
 */
export const offerPalette = (palette: Palette): void => {
  document.documentElement.setAttribute(attribute, JSON.stringify(palette));
};

const readOffer = (raw: string): Palette | undefined => {
  try {
    return parsePalette(JSON.parse(raw));
  } catch {
    return undefined;
  }
};

/**
 * Calls `receive` once with the offered palette, now if it is already on
 * `<html>` or as soon as it appears, and then removes it. A malformed offer
 * arrives as `undefined`.
 */
export const takePalette = (
  receive: (palette: Palette | undefined) => void
): void => {
  const root = document.documentElement;

  const take = (): boolean => {
    const raw = root.getAttribute(attribute);

    if (raw === null) {
      return false;
    }

    root.removeAttribute(attribute);
    receive(readOffer(raw));

    return true;
  };

  if (take()) {
    return;
  }

  const observer = new MutationObserver(() => {
    if (take()) {
      observer.disconnect();
    }
  });

  observer.observe(root, { attributes: true, attributeFilter: [attribute] });
};
