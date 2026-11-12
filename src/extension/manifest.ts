import { documentUrlPattern } from "../docs/docs.ts";
import { files, iconPaths } from "./files.ts";

/**
 * The page script is a user script, and from Chrome 138 user scripts run once
 * the user turns on "Allow User Scripts" for the extension. The build targets
 * this too.
 */
export const minimumChromeVersion = 138;

export const createManifest = (version: string): chrome.runtime.ManifestV3 => ({
  manifest_version: 3,
  name: "Google Docs Dark Mode",
  version,
  description:
    "Themes Google Docs, including the document page, with the gg dark palette or your own colours.",
  minimum_chrome_version: String(minimumChromeVersion),
  permissions: ["userScripts", "storage"],
  host_permissions: [documentUrlPattern],
  background: { service_worker: files.background },
  icons: iconPaths("on"),
  action: {
    default_title: "Google Docs dark mode",
    default_icon: iconPaths("off"),
  },
  options_ui: { page: files.optionsPage, open_in_tab: true },
});
