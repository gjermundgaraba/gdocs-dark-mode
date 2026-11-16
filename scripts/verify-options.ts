import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";

import type { BrowserContext, Page } from "playwright";

import { scriptId } from "../src/background/registration.ts";
import { refreshMessage } from "../src/extension/messages.ts";
import { enabledKey, paletteKey } from "../src/settings/settings.ts";
import { reviewPalette } from "../src/theme/checks.ts";
import {
  defaultPalette,
  parsePalette,
  samePalette,
} from "../src/theme/palette.ts";
import type { Palette } from "../src/theme/palette.ts";
import {
  launchWithExtension,
  openWithDiagnostics,
  outputDir,
  parseDocumentArgs,
  readPageMarginPixel,
  waitForDocsToDraw,
  waitUntil,
} from "./browser.ts";
import { printChecks } from "./checks.ts";
import type { Check } from "./checks.ts";

const { url, headed } = parseDocumentArgs();
const outDir = outputDir("verify-options");
const profile = path.join(outDir, "profile");
const importedTokens = path.join(outDir, "tokens.json");

const importedAccent = "#5fafff";
const editedBg = "#1d2021";

const custom: Palette = {
  ...defaultPalette,
  accent: importedAccent,
  bg: editedBg,
};

const writeImportedTokens = async (): Promise<void> => {
  const tokensPath = createRequire(import.meta.url).resolve(
    "@gjermundgaraba/gg-theme/tokens"
  );

  const tokens = await readFile(tokensPath, "utf8");

  await writeFile(
    importedTokens,
    tokens.replace(
      `"accent": "${defaultPalette.accent}"`,
      `"accent": "${importedAccent}"`
    )
  );
};

const fieldValue = async (page: Page, key: string): Promise<string> =>
  await page.locator(`#colour-${key}`).inputValue();

const saveOptions = async (page: Page): Promise<void> => {
  await page.locator("#save").click();
  await waitUntil("the options to save", async () => {
    const status = await page.locator("#status").textContent();

    return status === "Saved.";
  });
};

const pageMarker = "verifyOptionsMarker";

const staysPutThroughUnchangedRefresh = async (
  optionsPage: Page,
  page: Page
): Promise<boolean> => {
  await page.evaluate(
    (marker) => Reflect.set(globalThis, marker, true),
    pageMarker
  );
  await optionsPage.evaluate(async (message) => {
    await chrome.runtime.sendMessage(message);
  }, refreshMessage);
  await page.waitForTimeout(3000);

  return await page.evaluate(
    (marker) => Reflect.has(globalThis, marker),
    pageMarker
  );
};

const reloadExtension = async (
  context: BrowserContext,
  optionsPage: Page
): Promise<Page> => {
  const optionsUrl = optionsPage.url();
  const extensionId = new URL(optionsUrl).host;
  const details = await context.newPage();
  await details.goto("chrome://extensions/");
  await details.locator("#devMode").click();
  await details.goto(`chrome://extensions/?id=${extensionId}`);
  await details.locator("extensions-detail-view #dev-reload-button").click();
  await details.close();

  const reopened = await context.newPage();
  await waitUntil("the extension to come back", async () => {
    try {
      await reopened.goto(optionsUrl);

      return await reopened.evaluate(async (id) => {
        const scripts = await chrome.userScripts.getScripts();

        return scripts.some((script) => script.id === id);
      }, scriptId);
    } catch {
      return false;
    }
  });

  return reopened;
};

const staysPutThroughExtensionReload = async (
  context: BrowserContext,
  optionsPage: Page,
  page: Page
): Promise<{ readonly stayed: boolean; readonly optionsPage: Page }> => {
  await page.evaluate(
    (marker) => Reflect.set(globalThis, marker, true),
    pageMarker
  );
  const reopened = await reloadExtension(context, optionsPage);
  await page.waitForTimeout(3000);

  const stayed = await page.evaluate(
    (marker) => Reflect.has(globalThis, marker),
    pageMarker
  );

  return { stayed, optionsPage: reopened };
};

const switchOff = async (optionsPage: Page, page: Page): Promise<string> => {
  await optionsPage.evaluate(async (key) => {
    await chrome.storage.local.set({ [key]: false });
  }, enabledKey);

  let pixel = "";

  await waitUntil("the document to reload unthemed", async () => {
    pixel = await readPageMarginPixel(page).catch(() => "reloading");

    return pixel === "#ffffff";
  });

  return pixel;
};

const storedPalette = async (page: Page): Promise<unknown> =>
  await page.evaluate(async (key) => {
    const items = await chrome.storage.local.get(key);

    return items[key];
  }, paletteKey);

await rm(outDir, { recursive: true, force: true });

await mkdir(outDir, { recursive: true });

await writeImportedTokens();

if (reviewPalette(custom).theme === undefined) {
  throw new Error("the custom palette under test is not saveable");
}

const { context, optionsPage } = await launchWithExtension(headed, profile);

try {
  await optionsPage.locator("#import").setInputFiles(importedTokens);
  await waitUntil("the import", async () => {
    const accent = await fieldValue(optionsPage, "accent");

    return accent === importedAccent;
  });
  await optionsPage.getByLabel("bg hex", { exact: true }).fill(editedBg);
  await optionsPage.screenshot({ path: path.join(outDir, "options.png") });
  await saveOptions(optionsPage);
  const saved = parsePalette(await storedPalette(optionsPage));

  const page = await openWithDiagnostics(context, url);
  const customPixel = await readPageMarginPixel(page);
  await page.screenshot({ path: path.join(outDir, "custom.png") });

  const reloaded = page.waitForEvent("load");
  await optionsPage.locator("#default").click();
  await saveOptions(optionsPage);
  await reloaded;
  await waitForDocsToDraw(page);
  const defaultPixel = await readPageMarginPixel(page);
  const storedAfterReset = await storedPalette(optionsPage);
  const stayed = await staysPutThroughUnchangedRefresh(optionsPage, page);

  const afterUpdate = await staysPutThroughExtensionReload(
    context,
    optionsPage,
    page
  );

  const offPixel = await switchOff(afterUpdate.optionsPage, page).catch(String);

  const checks: Check[] = [
    {
      name: "import and edit are saved",
      ok: saved !== undefined && samePalette(saved, custom),
      detail: `saved bg ${saved?.bg ?? "none"}, accent ${saved?.accent ?? "none"}`,
    },
    {
      name: "document uses the saved palette",
      ok: customPixel === editedBg,
      detail: `pixel ${customPixel}, expected ${editedBg}`,
    },
    {
      name: "saving the default clears the saved palette",
      ok: storedAfterReset === undefined,
      detail: `stored: ${JSON.stringify(storedAfterReset) ?? "nothing"}`,
    },
    {
      name: "open documents reload with the new palette",
      ok: defaultPixel === defaultPalette.bg,
      detail: `pixel ${defaultPixel}, expected ${defaultPalette.bg}`,
    },
    {
      name: "a refresh with nothing changed leaves documents alone",
      ok: stayed,
      detail: stayed ? "not reloaded" : "the document reloaded",
    },
    {
      name: "an extension update leaves themed documents alone",
      ok: afterUpdate.stayed,
      detail: afterUpdate.stayed ? "not reloaded" : "the document reloaded",
    },
    {
      name: "switching off reloads documents unthemed",
      ok: offPixel === "#ffffff",
      detail: `pixel ${offPixel}, expected #ffffff`,
    },
  ];

  printChecks(checks);
  console.log(`\nscreenshots in ${outDir}`);
} finally {
  await context.close();
}
