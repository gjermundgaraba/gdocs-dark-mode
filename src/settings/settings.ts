import { reviewPalette } from "../theme/checks.ts";
import { defaultPalette, parsePalette } from "../theme/palette.ts";
import type { Palette } from "../theme/palette.ts";

/** The storage key whether dark mode is on is saved under. */
export const enabledKey = "enabled";

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

/**
 * The palette documents are themed with: the saved one, or the default when
 * none is saved or the saved one could no longer be saved, as after a gg-theme
 * update that cannot derive its tiers.
 */
export const readPalette = async (): Promise<Palette> => {
  const stored = await chrome.storage.local.get(paletteKey);
  const saved = parsePalette(stored[paletteKey]);

  return saved !== undefined && reviewPalette(saved).theme !== undefined
    ? saved
    : defaultPalette;
};

export const writePalette = async (palette: Palette): Promise<void> => {
  await chrome.storage.local.set({ [paletteKey]: palette });
};

export const resetPalette = async (): Promise<void> => {
  await chrome.storage.local.remove(paletteKey);
};
