import { documentUrlPattern } from "../docs/docs.ts";
import { files } from "../extension/files.ts";
import { paletteAssignment } from "../page/palette-global.ts";
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
 * the page never has to ask. Returns whether the registration changed.
 */
export const syncPageScript = async (
  palette: Palette | undefined
): Promise<boolean> => {
  const wanted = palette === undefined ? [] : [pageScript(palette)];

  if (
    fingerprint(await chrome.userScripts.getScripts()) === fingerprint(wanted)
  ) {
    return false;
  }

  await chrome.userScripts.unregister();

  if (wanted.length > 0) {
    await chrome.userScripts.register(wanted);
  }

  return true;
};

/** Reloads open documents so they pick up a change from their first paint. */
export const reloadDocuments = async (): Promise<void> => {
  const tabs = await chrome.tabs.query({ url: documentUrlPattern });

  await Promise.all(
    tabs.flatMap((tab) =>
      tab.id === undefined ? [] : [chrome.tabs.reload(tab.id)]
    )
  );
};
