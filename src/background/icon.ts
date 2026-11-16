import { iconPaths } from "../extension/files.ts";

/** What the toolbar shows: whether dark mode is on. */
export type ExtensionState = "on" | "off";

const titles: Record<ExtensionState, string> = {
  on: "Google Docs dark mode: on (click to switch off)",
  off: "Google Docs dark mode: off (click to switch on)",
};

/** Sets the toolbar icon and tooltip for `state`. */
export const showState = async (state: ExtensionState): Promise<void> => {
  await chrome.action.setIcon({ path: iconPaths(state) });
  await chrome.action.setTitle({ title: titles[state] });
};
