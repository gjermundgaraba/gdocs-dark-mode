import { documentUrlPattern } from "../docs/docs.ts";
import { files } from "../extension/files.ts";

const scripts: chrome.scripting.RegisteredContentScript[] = [
  {
    id: "docs-dark-mode",
    matches: [documentUrlPattern],
    js: [files.page],
    runAt: "document_start",
    world: "MAIN",
    allFrames: false,
    persistAcrossSessions: true,
  },
  {
    id: "docs-dark-mode-palette",
    matches: [documentUrlPattern],
    js: [files.bridge],
    runAt: "document_start",
    world: "ISOLATED",
    allFrames: false,
    persistAcrossSessions: true,
  },
];

/** The ids of the scripts registered while dark mode is on. */
export const scriptIds = scripts.map(({ id }) => id);

/**
 * Dark mode is on exactly while the page script and its palette bridge are
 * registered, so pages never need to ask whether it is on before Docs starts
 * drawing. Clears every script this extension registered first.
 */
export const syncRegistration = async (enabled: boolean): Promise<void> => {
  await chrome.scripting.unregisterContentScripts();

  if (enabled) {
    await chrome.scripting.registerContentScripts(scripts);
  }
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
