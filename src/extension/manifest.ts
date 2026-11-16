import { documentUrlPattern } from "../docs/docs.ts";
import { files, iconPaths } from "./files.ts";

/**
 * The oldest Chrome the extension supports, 110, which has every built-in the
 * lint preset asks for, such as `Array.prototype.toSorted`. The build targets
 * it too, without polyfills.
 */
export const minimumChromeVersion = 110;

export const createManifest = (version: string): chrome.runtime.ManifestV3 => ({
  manifest_version: 3,
  name: "Dark Mode for Google Docs",
  version,
  description:
    "Themes Google Docs, including the document page, with the gg dark palette or your own colours.",
  minimum_chrome_version: String(minimumChromeVersion),
  permissions: ["scripting", "storage"],
  host_permissions: [documentUrlPattern],
  background: { service_worker: files.background },
  icons: iconPaths("on"),
  action: {
    default_title: "Dark mode for Google Docs",
    default_icon: iconPaths("off"),
  },
  options_ui: { page: files.optionsPage, open_in_tab: true },
});
