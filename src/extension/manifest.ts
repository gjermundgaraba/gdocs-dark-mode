import { documentUrlPattern } from "../docs/docs.ts";
import { files } from "./files.ts";

/**
 * Registered content scripts gained `world: "MAIN"` in Chrome 102, and the page
 * script uses `Array.prototype.toSorted` from 110. The build targets this too.
 */
export const minimumChromeVersion = 110;

export const createManifest = (version: string): chrome.runtime.ManifestV3 => ({
  manifest_version: 3,
  name: "Google Docs Dark Mode",
  version,
  description:
    "Themes Google Docs, including the document page, with the gg dark palette or your own colours.",
  minimum_chrome_version: String(minimumChromeVersion),
  permissions: ["scripting", "storage"],
  host_permissions: [documentUrlPattern],
  background: { service_worker: files.background },
  action: { default_title: "Google Docs dark mode" },
  options_ui: { page: files.optionsPage, open_in_tab: true },
});
