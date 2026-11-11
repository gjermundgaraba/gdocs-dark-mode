import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { parseArgs } from "node:util";

import { chromium } from "playwright";
import type { BrowserContext, Page } from "playwright";

import { scriptIds } from "../src/background/registration.ts";
import { pageCanvasClass } from "../src/docs/docs.ts";
import { files } from "../src/extension/files.ts";
import { debugStorageKey } from "../src/page/diagnostics.ts";
import type { DiagnosticsReport } from "../src/page/diagnostics.ts";
import { paletteKey } from "../src/settings/settings.ts";
import { defaultPalette, parsePalette } from "../src/theme/palette.ts";
import type { Palette } from "../src/theme/palette.ts";
import { publicDocUrl, referenceDocUrl } from "./reference-doc.ts";

const root = path.join(import.meta.dirname, "..");
const pollIntervalMs = 250;
const timeoutMs = 30_000;
const reloadSettleMs = 2000;

/** The unpacked extension, built by `pnpm run build`. */
export const extensionDir = path.join(root, "dist");

/** Persistent, so a Google sign-in made with `pnpm run sign-in` carries over to verify. */
export const profileDir = path.join(root, ".cache", "profile");

/**
 * Playwright starts Chromium with these, which pick the key the profile's
 * cookies are encrypted with; a sign-in made without them cannot be read back.
 */
export const playwrightProfileKeyArgs = [
  "--password-store=basic",
  "--use-mock-keychain",
];

export interface DocumentArgs {
  readonly url: string;
  readonly headed: boolean;
}

/**
 * `--url <document>` (default: the reference document if configured, else the
 * public one) and `--headed` to watch the browser. A leading `--`, which pnpm
 * passes through, is ignored.
 */
export const parseDocumentArgs = (): DocumentArgs => {
  const [first, ...rest] = process.argv.slice(2);

  const { values } = parseArgs({
    args: first === "--" ? rest : process.argv.slice(2),
    options: {
      url: { type: "string" },
      headed: { type: "boolean", default: false },
    },
  });

  return {
    url: values.url ?? referenceDocUrl ?? publicDocUrl,
    headed: values.headed,
  };
};

/** Where scripts write reports and screenshots. */
export const outputDir = (name: string): string =>
  path.join(root, ".cache", name);

export const waitUntil = async (
  label: string,
  ready: () => Promise<boolean>
): Promise<void> => {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (await ready()) {
      return;
    }

    await sleep(pollIntervalMs);
  }

  throw new Error(`timed out waiting for ${label}`);
};

export interface LoadedExtension {
  readonly context: BrowserContext;
  /** The extension's options page, open in its own tab; it can call every API the extension may. */
  readonly optionsPage: Page;
}

const launch = async (
  headed: boolean,
  profile: string
): Promise<BrowserContext> =>
  await chromium.launchPersistentContext(profile, {
    channel: "chromium",
    headless: !headed,
    viewport: { width: 1400, height: 1000 },
    args: [
      `--disable-extensions-except=${extensionDir}`,
      `--load-extension=${extensionDir}`,
    ],
  });

const reloadExtension = async (profile: string): Promise<string> => {
  const context = await launch(false, profile);

  try {
    const worker =
      context.serviceWorkers()[0] ??
      (await context.waitForEvent("serviceworker"));

    const closed = worker.waitForEvent("close");

    await worker
      .evaluate(() => {
        chrome.runtime.reload();
      })
      .catch(async () => await closed);
    await closed;
    await sleep(reloadSettleMs);

    return new URL(worker.url()).host;
  } finally {
    await context.close();
  }
};

const openOptionsPage = async (
  context: BrowserContext,
  extensionId: string
): Promise<Page> => {
  const page = await context.newPage();
  await page.goto(`chrome-extension://${extensionId}/${files.optionsPage}`);

  return page;
};

const waitForRegistration = async (optionsPage: Page): Promise<void> => {
  const expected = scriptIds.toSorted().join(",");

  await waitUntil("the page scripts to be registered", async () => {
    const registered = await optionsPage.evaluate(async () => {
      const scripts = await chrome.scripting.getRegisteredContentScripts();

      return scripts.map(({ id }) => id);
    });

    return registered.toSorted().join(",") === expected;
  });
};

/**
 * Playwright's Chromium with the built extension loaded, once the extension
 * has registered its page scripts; a document opened earlier would load
 * unthemed. It first reloads the extension in a separate launch, as
 * chrome://extensions' Reload would, which clears scripts registered by an
 * earlier build. Uses the shared profile unless given another.
 */
export const launchWithExtension = async (
  headed: boolean,
  profile = profileDir
): Promise<LoadedExtension> => {
  const extensionId = await reloadExtension(profile);
  const context = await launch(headed, profile);
  const optionsPage = await openOptionsPage(context, extensionId);
  await waitForRegistration(optionsPage);

  return { context, optionsPage };
};

/** The palette the extension has saved in this profile, as the page receives it. */
export const readSavedPalette = async (optionsPage: Page): Promise<Palette> => {
  const stored = await optionsPage.evaluate(async (key) => {
    const items = await chrome.storage.local.get(key);

    return items[key];
  }, paletteKey);

  return parsePalette(stored) ?? defaultPalette;
};

export const readReport = async (
  page: Page
): Promise<DiagnosticsReport | undefined> =>
  await page.evaluate(() => globalThis.gdocsDarkMode?.report());

/** Waits until a document opened with diagnostics has drawn its page and settled. */
export const waitForDocsToDraw = async (page: Page): Promise<void> => {
  await waitUntil("Docs to draw its page", async () => {
    const report = await readReport(page);

    return (
      report !== undefined && Object.keys(report.recolouredDraws).length > 0
    );
  });
  await page.waitForTimeout(3000);
};

/** Opens `url` with diagnostics on and waits until Docs has drawn and settled. */
export const openWithDiagnostics = async (
  context: BrowserContext,
  url: string
): Promise<Page> => {
  const page = await context.newPage();
  await page.goto(url, { waitUntil: "load" });

  if (new URL(page.url()).hostname === "accounts.google.com") {
    throw new Error(
      `${url} needs a signed-in profile: run \`pnpm run sign-in\` first`
    );
  }

  await page.evaluate((key) => {
    localStorage.setItem(key, "1");
  }, debugStorageKey);
  await page.reload({ waitUntil: "load" });
  await waitForDocsToDraw(page);

  return page;
};

/**
 * The first page tile's colour inside the top margin, where nothing but the
 * blank page is drawn, as `#rrggbb`, or a description of why it is not one.
 */
export const readPageMarginPixel = async (page: Page): Promise<string> =>
  await page.evaluate((canvasClass) => {
    const canvas = document.querySelector(`canvas.${canvasClass}`);

    if (!(canvas instanceof HTMLCanvasElement)) {
      return "no page canvas";
    }

    try {
      const pixel = canvas.getContext("2d")?.getImageData(24, 24, 1, 1).data;
      const [r = 0, g = 0, b = 0, a = 0] = pixel ?? [];
      const hex = `#${[r, g, b].map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;

      return a === 255 ? hex : `${hex} at alpha ${a}`;
    } catch (error) {
      return `unreadable (${String(error)})`;
    }
  }, pageCanvasClass);
