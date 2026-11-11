import {
  paletteKey,
  readEnabled,
  readPalette,
  writeEnabled,
} from "../settings/settings.ts";
import { createTheme, defaultTheme } from "../theme/theme.ts";
import type { Theme } from "../theme/theme.ts";
import { showState } from "./icon.ts";
import { reloadDocuments, syncRegistration } from "./registration.ts";

const savedTheme = async (): Promise<Theme> => {
  const palette = await readPalette();

  try {
    return createTheme(palette);
  } catch {
    return defaultTheme;
  }
};

const showCurrentState = async (): Promise<void> => {
  await showState(await savedTheme(), await readEnabled());
};

const toggle = async (): Promise<void> => {
  const enabled = !(await readEnabled());
  await writeEnabled(enabled);
  await syncRegistration(enabled);
  await showCurrentState();
  await reloadDocuments();
};

const reregisterAfterInstallOrUpdate = async (): Promise<void> => {
  await syncRegistration(await readEnabled());
  await showCurrentState();
};

const applySavedPalette = async (): Promise<void> => {
  await showCurrentState();

  if (await readEnabled()) {
    await reloadDocuments();
  }
};

const report = (error: unknown): void => {
  console.error("gdocs-dark-mode:", error);
};

chrome.runtime.onInstalled.addListener(() => {
  reregisterAfterInstallOrUpdate().catch(report);
});

chrome.runtime.onStartup.addListener(() => {
  showCurrentState().catch(report);
});

chrome.action.onClicked.addListener(() => {
  toggle().catch(report);
});

chrome.storage.local.onChanged.addListener((changes) => {
  if (paletteKey in changes) {
    applySavedPalette().catch(report);
  }
});
