import { documentUrlPattern } from "../docs/docs.ts";
import { files } from "../extension/files.ts";

const scriptId = "docs-dark-mode";

const pageScript: chrome.scripting.RegisteredContentScript = {
  id: scriptId,
  matches: [documentUrlPattern],
  js: [files.page],
  css: [files.stylesheet],
  runAt: "document_start",
  world: "MAIN",
  allFrames: false,
  persistAcrossSessions: true,
};

/**
 * Dark mode is on exactly while the page script and stylesheet are registered,
 * so pages never need to ask whether it is on before Docs starts drawing.
 */
export const syncRegistration = async (enabled: boolean): Promise<void> => {
  const registered = await chrome.scripting.getRegisteredContentScripts({
    ids: [scriptId],
  });

  if (registered.length > 0) {
    await chrome.scripting.unregisterContentScripts({ ids: [scriptId] });
  }

  if (enabled) {
    await chrome.scripting.registerContentScripts([pageScript]);
  }
};

/** Reloads open documents so they pick up the change from their first paint. */
export const reloadDocuments = async (): Promise<void> => {
  const tabs = await chrome.tabs.query({ url: documentUrlPattern });
  await Promise.all(
    tabs.flatMap((tab) =>
      tab.id === undefined ? [] : [chrome.tabs.reload(tab.id)]
    )
  );
};
