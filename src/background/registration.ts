import { documentUrlPattern } from "../docs/docs.ts";
import { files } from "../extension/files.ts";
import { paletteAssignment } from "../page/palette-global.ts";
import { parsePalette, samePalette } from "../theme/palette.ts";
import type { Palette } from "../theme/palette.ts";

/** The id of the user script registered while dark mode is on. */
export const scriptId = "docs-dark-mode";

const pageScript = (
  palette: Palette
): chrome.userScripts.RegisteredUserScript => ({
  id: scriptId,
  matches: [documentUrlPattern],
  js: [{ code: paletteAssignment(palette) }, { file: files.page }],
  runAt: "document_start",
  world: "MAIN",
  allFrames: false,
});

const fingerprint = (
  scripts: readonly chrome.userScripts.RegisteredUserScript[]
): string => JSON.stringify(scripts.map(({ id, js }) => ({ id, js })));

/**
 * Registers the page script with `palette`, or nothing when it is
 * `undefined`, so dark mode is on exactly while the script is registered and
 * the page never has to ask.
 */
export const syncPageScript = async (
  palette: Palette | undefined
): Promise<void> => {
  const wanted = palette === undefined ? [] : [pageScript(palette)];

  if (
    fingerprint(await chrome.userScripts.getScripts()) === fingerprint(wanted)
  ) {
    return;
  }

  await chrome.userScripts.unregister();

  if (wanted.length > 0) {
    await chrome.userScripts.register(wanted);
  }
};

const documentsPaletteKey = "documentsPalette";

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

const reloadDocuments = async (): Promise<void> => {
  const tabs = await chrome.tabs.query({ url: documentUrlPattern });

  await Promise.allSettled(
    tabs.flatMap((tab) =>
      tab.id === undefined ? [] : [chrome.tabs.reload(tab.id)]
    )
  );
};

/**
 * Reloads open documents when they were last loaded with another palette, or
 * with dark mode in the other state, so they pick up the change from their
 * first paint. A registration Chrome cleared on an extension update and the
 * worker restored changes nothing they show, so it reloads nothing. Returns
 * whether it reloaded them.
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

  await reloadDocuments();
  await writeDocumentsPalette(palette);

  return true;
};
