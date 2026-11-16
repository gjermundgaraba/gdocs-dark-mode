import { iconPaths } from "../extension/files.ts";

/** What the toolbar shows: whether dark mode is on. */
export type ExtensionState = "on" | "off";

const titles: Record<ExtensionState, string> = {
  on: "Dark mode for Google Docs: on (click to switch off)",
  off: "Dark mode for Google Docs: off (click to switch on)",
};

/** Sets the toolbar icon and tooltip for `state`. */
export const showState = async (state: ExtensionState): Promise<void> => {
  await chrome.action.setIcon({ path: iconPaths(state) });
  await chrome.action.setTitle({ title: titles[state] });
};
