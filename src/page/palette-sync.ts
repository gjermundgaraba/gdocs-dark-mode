import { readPalette } from "../settings/settings.ts";
import { paletteCacheKey, paletteEvent } from "./palette-cache.ts";

const syncPalette = async (): Promise<void> => {
  const json = JSON.stringify(await readPalette());

  try {
    globalThis.localStorage.setItem(paletteCacheKey, json);
  } finally {
    document.dispatchEvent(new CustomEvent(paletteEvent, { detail: json }));
  }
};

syncPalette().catch((error: unknown) => {
  console.error("gdocs-dark-mode:", error);
});
