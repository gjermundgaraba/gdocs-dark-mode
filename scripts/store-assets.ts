import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { BrowserContext, Page } from "playwright";

import { documentsPaletteKey } from "../src/background/registration.ts";
import { pageCanvasClass } from "../src/docs/docs.ts";
import { iconPaths } from "../src/extension/files.ts";
import { enabledKey, paletteKey } from "../src/settings/settings.ts";
import { reviewPalette } from "../src/theme/checks.ts";
import {
  defaultPalette,
  parsePalette,
  samePalette,
} from "../src/theme/palette.ts";
import type { Palette } from "../src/theme/palette.ts";
import { defaultTheme } from "../src/theme/theme.ts";
import {
  extensionDir,
  launchWithExtension,
  openDocument,
  outputDir,
  pageScriptsRegisteredIn,
  parseDocumentArgs,
  waitUntil,
} from "./browser.ts";
import type { Viewport } from "./browser.ts";

/** https://developer.chrome.com/docs/webstore/images#screenshots */
const screenshotSize = { width: 1280, height: 800 } as const;

/** https://developer.chrome.com/docs/webstore/images#promo */
const promoTileSize = { width: 440, height: 280 } as const;

const storeDir = path.join(import.meta.dirname, "..", "store");
const settleMs = 3000;

const warmPalette: Palette = {
  bg: "#1f1d1a",
  surface: "#2c2925",
  overlay: "#857d72",
  fg: "#ece4d6",
  "fg-dim": "#a89f91",
  "selection-bg": "#3d3528",
  accent: "#e8a865",
  red: "#f08a7e",
  green: "#a8c98a",
  yellow: "#ecc96b",
  blue: "#8fb3e0",
  magenta: "#d6a2c8",
  cyan: "#85cfc4",
  orange: "#f0a868",
};

const demoDocUrl =
  "https://docs.google.com/document/d/1Y7nUlMTG2nWeZAmgZqrahTr7PNAtlJQ0wutPbc6p7Xk/edit";

const documentArgs = parseDocumentArgs(demoDocUrl);
const { headed } = documentArgs;
const url = new URL(documentArgs.url);

url.searchParams.set("hl", "en");

const jpeg = async (page: Page): Promise<Buffer> =>
  await page.screenshot({ type: "jpeg", quality: 92 });

const save = async (name: string, image: Buffer): Promise<void> => {
  await writeFile(path.join(storeDir, name), image);
  console.log(`wrote store/${name}`);
};

const dataUrl = (type: string, bytes: Buffer): string =>
  `data:${type};base64,${bytes.toString("base64")}`;

const screenshotDocument = async (context: BrowserContext): Promise<Buffer> => {
  const page = await openDocument(context, url.href);
  await page.locator(`canvas.${pageCanvasClass}`).first().waitFor();
  await page.waitForTimeout(settleMs);
  const image = await jpeg(page);
  await page.close();

  return image;
};

const documentsPaletteIn = async (
  optionsPage: Page
): Promise<Palette | undefined> =>
  parsePalette(
    await optionsPage.evaluate(async (key) => {
      const items = await chrome.storage.local.get(key);

      return items[key];
    }, documentsPaletteKey)
  );

const applySettingsAndWaitForSync = async (
  optionsPage: Page,
  enabled: boolean,
  palette: Palette
): Promise<void> => {
  await optionsPage.evaluate(
    async ([settings]) => {
      await chrome.storage.local.set(settings);
    },
    [{ [enabledKey]: enabled, [paletteKey]: palette }] as const
  );
  await waitUntil("the worker to sync with the settings", async () => {
    const documentsPalette = await documentsPaletteIn(optionsPage);

    return (
      (await pageScriptsRegisteredIn(optionsPage)) === enabled &&
      (enabled
        ? documentsPalette !== undefined &&
          samePalette(documentsPalette, palette)
        : documentsPalette === undefined)
    );
  });
};

const renderHtml = async (
  context: BrowserContext,
  size: Viewport,
  html: string
): Promise<Buffer> => {
  const page = await context.newPage();
  await page.setViewportSize(size);
  await page.setContent(html, { waitUntil: "load" });
  await page.evaluate(async () => await document.fonts.ready);
  const image = await jpeg(page);
  await page.close();

  return image;
};

const beforeAfterHtml = (light: Buffer, dark: Buffer): string => `
  <style>
    body { margin: 0; }
    img { position: absolute; inset: 0; display: block; }
    .dark { clip-path: inset(0 0 0 50%); }
    .divider {
      position: absolute; top: 0; bottom: 0; left: calc(50% - 1px);
      width: 2px; background: ${defaultTheme.accent};
    }
  </style>
  <img src="${dataUrl("image/jpeg", light)}">
  <img class="dark" src="${dataUrl("image/jpeg", dark)}">
  <div class="divider"></div>`;

const promoTileHtml = (icon: Buffer): string => `
  <style>
    body {
      margin: 0; width: ${promoTileSize.width}px; height: ${promoTileSize.height}px;
      box-sizing: border-box; padding: 0 36px;
      display: flex; align-items: center; gap: 24px;
      background: ${defaultTheme.bg}; color: ${defaultTheme.fg};
      font-family: system-ui, sans-serif;
    }
    img { width: 144px; height: 144px; margin: 0 -16px; }
    h1 { margin: 0 0 8px; font-size: 30px; line-height: 1.15; font-weight: 600; }
    p { margin: 0; font-size: 16px; color: ${defaultTheme["fg-dim"]}; }
  </style>
  <img src="${dataUrl("image/png", icon)}">
  <div>
    <h1>Dark Mode for Google Docs</h1>
    <p>The whole document, in neutral greys or your own colours.</p>
  </div>`;

const { 128: storeIcon } = iconPaths("on");

if (storeIcon === undefined) {
  throw new Error("no 128 px icon to put on the promo tile");
}

const warmReview = reviewPalette(warmPalette);

if (warmReview.theme === undefined) {
  throw new Error(
    `the warm palette is not saveable: ${warmReview.errors.join("; ")}`
  );
}

await mkdir(storeDir, { recursive: true });

const { context, optionsPage } = await launchWithExtension(
  headed,
  path.join(outputDir("store-assets"), "profile"),
  screenshotSize
);

try {
  await applySettingsAndWaitForSync(optionsPage, true, defaultPalette);
  const dark = await screenshotDocument(context);

  await applySettingsAndWaitForSync(optionsPage, false, defaultPalette);
  const light = await screenshotDocument(context);

  await applySettingsAndWaitForSync(optionsPage, true, warmPalette);
  const warm = await screenshotDocument(context);
  await optionsPage.reload({ waitUntil: "load" });
  const options = await jpeg(optionsPage);

  const icon = await readFile(path.join(extensionDir, storeIcon));

  await save(
    "screenshot-1-before-after.jpg",
    await renderHtml(context, screenshotSize, beforeAfterHtml(light, dark))
  );
  await save("screenshot-2-default.jpg", dark);
  await save("screenshot-3-custom-colours.jpg", warm);
  await save("screenshot-4-options.jpg", options);
  await save(
    "promo-small-440x280.jpg",
    await renderHtml(context, promoTileSize, promoTileHtml(icon))
  );
} finally {
  await context.close();
}
