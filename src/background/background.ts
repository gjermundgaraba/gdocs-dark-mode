import { theme } from "../theme/theme.ts";
import { showState } from "./icon.ts";
import { reloadDocuments, syncRegistration } from "./registration.ts";
import { readEnabled, writeEnabled } from "./state.ts";

const apply = async (enabled: boolean): Promise<void> => {
  await syncRegistration(enabled);
  await showState(theme, enabled);
};

const toggle = async (): Promise<void> => {
  const enabled = !(await readEnabled());
  await writeEnabled(enabled);
  await apply(enabled);
  await reloadDocuments();
};

const reregisterAfterInstallOrUpdate = async (): Promise<void> => {
  await apply(await readEnabled());
};

const redrawIconAfterBrowserStart = async (): Promise<void> => {
  await showState(theme, await readEnabled());
};

const report = (error: unknown): void => {
  console.error("gdocs-dark-mode:", error);
};

chrome.runtime.onInstalled.addListener(() => {
  reregisterAfterInstallOrUpdate().catch(report);
});

chrome.runtime.onStartup.addListener(() => {
  redrawIconAfterBrowserStart().catch(report);
});

chrome.action.onClicked.addListener(() => {
  toggle().catch(report);
});
