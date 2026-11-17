import { mkdir, readFile, rm } from "node:fs/promises";
import path from "node:path";

import type { BrowserContext, Page } from "playwright";

import { paletteCacheKey } from "../src/page/palette-cache.ts";
import { enabledKey, paletteKey } from "../src/settings/settings.ts";
import { reviewPalette } from "../src/theme/checks.ts";
import {
  defaultPalette,
  paletteFromFile,
  parsePalette,
  samePalette,
} from "../src/theme/palette.ts";
import type { Palette } from "../src/theme/palette.ts";
import {
  launchWithExtension,
  openWithDiagnostics,
  outputDir,
  pageScriptsRegisteredIn,
  parseDocumentArgs,
  readPageMarginPixel,
  readReport,
  waitForDocsToDraw,
  waitUntil,
} from "./browser.ts";
import { printChecks } from "./checks.ts";
import type { Check } from "./checks.ts";

const { url, headed } = parseDocumentArgs();
const outDir = outputDir("verify-options");
const exportedFile = path.join(outDir, "exported-colours.json");
const profile = path.join(outDir, "profile");

const editedAccent = "#5fafff";
const editedBg = "#1d2021";

const custom: Palette = {
  ...defaultPalette,
  accent: editedAccent,
  bg: editedBg,
};

const saveOptions = async (page: Page): Promise<void> => {
  await page.locator("#save").click();
  await waitUntil("the options to save", async () => {
    const status = await page.locator("#status").textContent();

    return status === "Saved.";
  });
};

const pageMarker = "verifyOptionsMarker";

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

      return await pageScriptsRegisteredIn(reopened);
    } catch {
      return false;
    }
  });

  return reopened;
};

const stayedThrough = async (
  page: Page,
  action: () => Promise<unknown>
): Promise<boolean> => {
  await page.evaluate(
    (marker) => Reflect.set(globalThis, marker, true),
    pageMarker
  );
  await action();
  await page.waitForTimeout(3000);

  return await page.evaluate(
    (marker) => Reflect.has(globalThis, marker),
    pageMarker
  );
};

const storeDefaultPaletteExplicitly = async (
  optionsPage: Page
): Promise<void> => {
  await optionsPage.evaluate(
    async ([key, palette]) => {
      await chrome.storage.local.set({ [key]: palette });
    },
    [paletteKey, defaultPalette] as const
  );
};

interface ColdCacheLoad {
  readonly pixel: string;
  readonly loads: number;
  readonly drawsBeforePaletteArrived: number | null | undefined;
  readonly paletteChanged: boolean | null | undefined;
}

const loadWithEmptyCache = async (page: Page): Promise<ColdCacheLoad> => {
  await page.evaluate((key) => {
    localStorage.removeItem(key);
  }, paletteCacheKey);

  let loads = 0;

  const countLoad = (): void => {
    loads += 1;
  };

  page.on("load", countLoad);
  await page.reload({ waitUntil: "load" });
  await waitForDocsToDraw(page);
  page.off("load", countLoad);
  const report = await readReport(page);

  return {
    pixel: await readPageMarginPixel(page),
    loads,
    drawsBeforePaletteArrived: report?.drawsBeforePaletteArrived,
    paletteChanged: report?.paletteChangedOnArrival,
  };
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

if (reviewPalette(custom).theme === undefined) {
  throw new Error("the custom palette under test is not saveable");
}

const { context, optionsPage } = await launchWithExtension(headed, profile);

try {
  await optionsPage
    .getByLabel("accent hex", { exact: true })
    .fill(editedAccent);
  await optionsPage.getByLabel("bg hex", { exact: true }).fill(editedBg);

  const [download] = await Promise.all([
    optionsPage.waitForEvent("download"),
    optionsPage.locator("#export").click(),
  ]);

  await download.saveAs(exportedFile);
  const exported = paletteFromFile(await readFile(exportedFile, "utf8"));
  await optionsPage.locator("#default").click();
  await optionsPage.locator("#import").setInputFiles(exportedFile);
  await waitUntil("the import", async () => {
    const accent = await optionsPage
      .getByLabel("accent hex", { exact: true })
      .inputValue();

    return accent === editedAccent;
  });
  await optionsPage.screenshot({ path: path.join(outDir, "options.png") });
  await saveOptions(optionsPage);
  const saved = parsePalette(await storedPalette(optionsPage));

  const page = await openWithDiagnostics(context, url);
  const customPixel = await readPageMarginPixel(page);
  await page.screenshot({ path: path.join(outDir, "custom.png") });
  const cold = await loadWithEmptyCache(page);

  const reloaded = page.waitForEvent("load");
  await optionsPage.locator("#default").click();
  await saveOptions(optionsPage);
  await reloaded;
  await waitForDocsToDraw(page);
  const defaultPixel = await readPageMarginPixel(page);
  const resetReport = await readReport(page);
  const storedAfterReset = await storedPalette(optionsPage);

  const stayedThroughUnchangedWrite = await stayedThrough(page, async () => {
    await storeDefaultPaletteExplicitly(optionsPage);
  });

  let reopened = optionsPage;

  const stayedThroughUpdate = await stayedThrough(page, async () => {
    reopened = await reloadExtension(context, optionsPage);
  });

  const offPixel = await switchOff(reopened, page).catch(String);

  const checks: Check[] = [
    {
      name: "export writes the colours shown",
      ok: !("error" in exported) && samePalette(exported, custom),
      detail:
        "error" in exported
          ? exported.error
          : `exported bg ${exported.bg}, accent ${exported.accent}`,
    },
    {
      name: "importing the export and saving keeps the edits",
      ok: saved !== undefined && samePalette(saved, custom),
      detail: `saved bg ${saved?.bg ?? "none"}, accent ${saved?.accent ?? "none"}`,
    },
    {
      name: "document uses the saved palette",
      ok: customPixel === editedBg,
      detail: `pixel ${customPixel}, expected ${editedBg}`,
    },
    {
      name: "with no cached palette, the stored one applies before Docs draws",
      ok:
        cold.pixel === editedBg &&
        cold.loads === 1 &&
        cold.paletteChanged === true &&
        cold.drawsBeforePaletteArrived === 0,
      detail: `pixel ${cold.pixel}, ${cold.loads} load(s), switched in place: ${String(cold.paletteChanged)}, ${String(cold.drawsBeforePaletteArrived)} draws before the palette arrived`,
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
      name: "documents reloaded for a change start with the new palette cached",
      ok: resetReport?.paletteChangedOnArrival === false,
      detail: `palette changed on arrival: ${String(resetReport?.paletteChangedOnArrival)}`,
    },
    {
      name: "a settings write that changes nothing leaves documents alone",
      ok: stayedThroughUnchangedWrite,
      detail: stayedThroughUnchangedWrite
        ? "not reloaded"
        : "the document reloaded",
    },
    {
      name: "an extension update leaves themed documents alone",
      ok: stayedThroughUpdate,
      detail: stayedThroughUpdate ? "not reloaded" : "the document reloaded",
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
