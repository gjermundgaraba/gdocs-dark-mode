import { refreshMessage } from "../extension/messages.ts";
import { userScriptsAllowed } from "../extension/user-scripts.ts";
import {
  readEnabled,
  readPalette,
  writeEnabled,
} from "../settings/settings.ts";
import { showState } from "./icon.ts";
import type { ExtensionState } from "./icon.ts";
import { reloadDocuments, syncPageScript } from "./registration.ts";

interface Update {
  readonly state: ExtensionState;
  readonly registrationChanged: boolean;
}

const update = async (): Promise<Update> => {
  if (!(await userScriptsAllowed())) {
    return { state: "blocked", registrationChanged: false };
  }

  const enabled = await readEnabled();

  const registrationChanged = await syncPageScript(
    enabled ? await readPalette() : undefined
  );

  if (registrationChanged) {
    await reloadDocuments();
  }

  return { state: enabled ? "on" : "off", registrationChanged };
};

const oneAtATime = <T>(task: () => Promise<T>): (() => Promise<T>) => {
  let previous: Promise<unknown> = Promise.resolve();

  return async () => {
    const current = previous.then(task);
    previous = current.catch(() => undefined);

    return await current;
  };
};

const refresh = oneAtATime(async (): Promise<boolean> => {
  const { state, registrationChanged } = await update();
  await showState(state);

  return registrationChanged;
});

const report = (error: unknown): void => {
  console.error("gdocs-dark-mode:", error);
};

const toggleOnceInSync = async (): Promise<void> => {
  if (!(await refresh())) {
    await writeEnabled(!(await readEnabled()));
  }
};

const toggle = async (): Promise<void> => {
  await ((await userScriptsAllowed())
    ? toggleOnceInSync()
    : chrome.runtime.openOptionsPage());
};

const openSetupIfBlocked = async (): Promise<void> => {
  if (!(await userScriptsAllowed())) {
    await chrome.runtime.openOptionsPage();
  }
};

refresh().catch(report);

chrome.runtime.onStartup.addListener(() => {
  refresh().catch(report);
});

chrome.runtime.onInstalled.addListener(() => {
  openSetupIfBlocked().catch(report);
});

chrome.action.onClicked.addListener(() => {
  toggle().catch(report);
});

chrome.storage.local.onChanged.addListener(() => {
  refresh().catch(report);
});

chrome.runtime.onMessage.addListener((message) => {
  if (message === refreshMessage) {
    refresh().catch(report);
  }
});
