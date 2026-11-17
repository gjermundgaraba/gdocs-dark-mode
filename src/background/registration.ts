import { documentUrlPattern } from "../docs/docs.ts";
import { files } from "../extension/files.ts";
import { paletteCacheKey } from "../page/palette-cache.ts";
import { parsePalette, samePalette } from "../theme/palette.ts";
import type { Palette } from "../theme/palette.ts";

const pageScripts: chrome.scripting.RegisteredContentScript[] = [
  {
    id: "docs-dark-mode",
    matches: [documentUrlPattern],
    js: [files.page],
    runAt: "document_start",
    world: "MAIN",
    allFrames: false,
  },
  {
    id: "docs-dark-mode-palette",
    matches: [documentUrlPattern],
    js: [files.paletteSync],
    runAt: "document_start",
    world: "ISOLATED",
    allFrames: false,
  },
];

const fingerprint = (
  scripts: readonly chrome.scripting.RegisteredContentScript[]
): string =>
  JSON.stringify([
    scripts.length,
    ...pageScripts.map(({ id }) => {
      const script = scripts.find((candidate) => candidate.id === id);

      return (
        script && {
          js: script.js,
          matches: script.matches,
          runAt: script.runAt,
          world: script.world,
        }
      );
    }),
  ]);

/** Whether `registered` is exactly the page scripts this version registers. */
export const pageScriptsRegistered = (
  registered: readonly chrome.scripting.RegisteredContentScript[]
): boolean => fingerprint(registered) === fingerprint(pageScripts);

/**
 * Registers the page scripts while dark mode is `enabled` and nothing
 * otherwise, so dark mode is on exactly while they are registered and the
 * page never has to ask.
 */
export const syncPageScript = async (enabled: boolean): Promise<void> => {
  const registered = await chrome.scripting.getRegisteredContentScripts();

  if (fingerprint(registered) === fingerprint(enabled ? pageScripts : [])) {
    return;
  }

  if (registered.length > 0) {
    await chrome.scripting.unregisterContentScripts();
  }

  if (enabled) {
    await chrome.scripting.registerContentScripts(pageScripts);
  }
};

/** The storage key under which the palette open documents were last reloaded with is kept. */
export const documentsPaletteKey = "documentsPalette";

const readDocumentsPalette = async (): Promise<Palette | undefined> => {
  const stored = await chrome.storage.local.get(documentsPaletteKey);

  return parsePalette(stored[documentsPaletteKey]);
};

const writeDocumentsPalette = async (
  palette: Palette | undefined
): Promise<void> => {
  await (palette === undefined
    ? chrome.storage.local.remove(documentsPaletteKey)
    : chrome.storage.local.set({ [documentsPaletteKey]: palette }));
};

const cachePalette = (key: string, json: string): void => {
  localStorage.setItem(key, json);
};

const reloadDocuments = async (palette: Palette | undefined): Promise<void> => {
  const tabs = await chrome.tabs.query({ url: documentUrlPattern });
  const ids = tabs.flatMap(({ id }) => (id === undefined ? [] : [id]));

  if (palette !== undefined) {
    await Promise.allSettled(
      ids.map(
        async (tabId) =>
          await chrome.scripting.executeScript({
            target: { tabId },
            func: cachePalette,
            args: [paletteCacheKey, JSON.stringify(palette)],
          })
      )
    );
  }

  await Promise.allSettled(
    ids.map(async (id) => {
      await chrome.tabs.reload(id);
    })
  );
};

/**
 * Reloads open documents when they were last loaded with another palette, or
 * with dark mode in the other state, first leaving the new palette in their
 * cache so they draw with it from their first paint. Registrations Chrome
 * cleared on an extension update and the worker restored change nothing they
 * show, so they reload nothing. Returns whether it reloaded them.
 */
export const syncOpenDocuments = async (
  palette: Palette | undefined
): Promise<boolean> => {
  const loadedWith = await readDocumentsPalette();

  if (
    loadedWith === undefined || palette === undefined
      ? loadedWith === palette
      : samePalette(loadedWith, palette)
  ) {
    return false;
  }

  await reloadDocuments(palette);
  await writeDocumentsPalette(palette);

  return true;
};
