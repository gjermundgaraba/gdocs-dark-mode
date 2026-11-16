import { refreshMessage } from "../extension/messages.ts";
import { userScriptsAllowed } from "../extension/user-scripts.ts";
import {
  enabledKey,
  paletteKey,
  readEnabled,
  readPalette,
  writeEnabled,
} from "../settings/settings.ts";
import { showState } from "./icon.ts";
import type { ExtensionState } from "./icon.ts";
import { syncOpenDocuments, syncPageScript } from "./registration.ts";

interface Update {
  readonly state: ExtensionState;
  readonly documentsReloaded: boolean;
}

const update = async (): Promise<Update> => {
  if (!(await userScriptsAllowed())) {
    return { state: "blocked", documentsReloaded: false };
  }

  const enabled = await readEnabled();
  const palette = enabled ? await readPalette() : undefined;
  await syncPageScript(palette);

  return {
    state: enabled ? "on" : "off",
    documentsReloaded: await syncOpenDocuments(palette),
  };
};

const sync = async (): Promise<boolean> => {
  const { state, documentsReloaded } = await update();
  await showState(state);

  return documentsReloaded;
};

let previous: Promise<unknown> = Promise.resolve();

const oneAtATime = async <T>(task: () => Promise<T>): Promise<T> => {
  const current = previous.then(task);
  previous = current.catch(() => undefined);

  return await current;
};

const report = (error: unknown): void => {
  console.error("gdocs-dark-mode:", error);
};

const refresh = (): void => {
  oneAtATime(sync).catch(report);
};

const toggleOnceInSync = async (): Promise<void> => {
  if (!(await userScriptsAllowed())) {
    await chrome.runtime.openOptionsPage();

    return;
  }

  if (!(await sync())) {
    await writeEnabled(!(await readEnabled()));
    await sync();
  }
};

const openSetupIfBlocked = async (): Promise<void> => {
  if (!(await userScriptsAllowed())) {
    await chrome.runtime.openOptionsPage();
  }
};

refresh();

chrome.runtime.onStartup.addListener(refresh);

chrome.runtime.onInstalled.addListener(() => {
  openSetupIfBlocked().catch(report);
});

chrome.action.onClicked.addListener(() => {
  oneAtATime(toggleOnceInSync).catch(report);
});

chrome.storage.local.onChanged.addListener((changes) => {
  if (enabledKey in changes || paletteKey in changes) {
    refresh();
  }
});

chrome.runtime.onMessage.addListener((message) => {
  if (message === refreshMessage) {
    refresh();
  }
});
