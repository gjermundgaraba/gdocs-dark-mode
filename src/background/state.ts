const enabledKey = "enabled";

/** Whether dark mode is on, kept in extension storage. On until switched off. */
export const readEnabled = async (): Promise<boolean> => {
  const stored = await chrome.storage.local.get(enabledKey);

  return stored[enabledKey] !== false;
};

export const writeEnabled = async (enabled: boolean): Promise<void> => {
  await chrome.storage.local.set({ [enabledKey]: enabled });
};
