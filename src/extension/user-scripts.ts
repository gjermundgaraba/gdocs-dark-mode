/**
 * Whether the user has turned on "Allow User Scripts" on the extension's
 * details page. Until then `chrome.userScripts` is missing.
 */
export const userScriptsAllowed = async (): Promise<boolean> => {
  try {
    await chrome.userScripts.getScripts();

    return true;
  } catch {
    return false;
  }
};
