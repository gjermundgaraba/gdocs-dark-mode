import { defaultPalette, parsePalette } from "../theme/palette.ts";
import type { Palette } from "../theme/palette.ts";

const enabledKey = "enabled";

/** The storage key the palette is saved under; watch it to react to changes. */
export const paletteKey = "palette";

/** Whether dark mode is on, kept in extension storage. On until switched off. */
export const readEnabled = async (): Promise<boolean> => {
  const stored = await chrome.storage.local.get(enabledKey);

  return stored[enabledKey] !== false;
};

export const writeEnabled = async (enabled: boolean): Promise<void> => {
  await chrome.storage.local.set({ [enabledKey]: enabled });
};

/** The saved palette, or the default when none is saved or it does not parse. */
export const readPalette = async (): Promise<Palette> => {
  const stored = await chrome.storage.local.get(paletteKey);

  return parsePalette(stored[paletteKey]) ?? defaultPalette;
};

export const writePalette = async (palette: Palette): Promise<void> => {
  await chrome.storage.local.set({ [paletteKey]: palette });
};

export const resetPalette = async (): Promise<void> => {
  await chrome.storage.local.remove(paletteKey);
};
