import { iconPaths } from "../extension/files.ts";

/**
 * What the toolbar shows: dark mode `on` or `off`, or `blocked` until the user
 * allows user scripts, which the page script needs.
 */
export type ExtensionState = "on" | "off" | "blocked";

const titles: Record<ExtensionState, string> = {
  on: "Google Docs dark mode: on (click to switch off)",
  off: "Google Docs dark mode: off (click to switch on)",
  blocked:
    "Google Docs dark mode needs Allow User Scripts (click to see how to turn it on)",
};

/** Sets the toolbar icon, badge and tooltip for `state`. */
export const showState = async (state: ExtensionState): Promise<void> => {
  await chrome.action.setIcon({
    path: iconPaths(state === "on" ? "on" : "off"),
  });
  await chrome.action.setBadgeText({ text: state === "blocked" ? "!" : "" });
  await chrome.action.setTitle({ title: titles[state] });
};
