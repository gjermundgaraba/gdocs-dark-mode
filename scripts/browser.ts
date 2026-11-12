import { rm } from "node:fs/promises";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { parseArgs } from "node:util";

import { chromium } from "playwright";
import type { BrowserContext, Page } from "playwright";

import { scriptId } from "../src/background/registration.ts";
import { pageCanvasClass } from "../src/docs/docs.ts";
import { files } from "../src/extension/files.ts";
import { debugStorageKey } from "../src/page/diagnostics.ts";
import type { DiagnosticsReport } from "../src/page/diagnostics.ts";

const root = path.join(import.meta.dirname, "..");
const pollIntervalMs = 250;
const timeoutMs = 30_000;

/** A public, view-only document with headings, coloured text, links and a table. */
export const publicDocUrl =
  "https://docs.google.com/document/d/1U1RGAehQwRypUTovF1KRlpiOFze0b-_2gc6fAH0KY0k/edit";

/** The unpacked extension, built by `pnpm run build`. */
export const extensionDir = path.join(root, "dist");

export interface DocumentArgs {
  readonly url: string;
  readonly headed: boolean;
}

/**
 * `--url <document>` (default: the public document) and `--headed` to watch
 * the browser. A leading `--`, which pnpm passes through, is ignored.
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

  return { url: values.url ?? publicDocUrl, headed: values.headed };
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

const allowUserScripts = async (
  context: BrowserContext,
  extensionId: string
): Promise<void> => {
  const details = await context.newPage();
  await details.goto(`chrome://extensions/?id=${extensionId}`);
  await details.locator("#allow-user-scripts").click();
  await details.close();
};

const waitForRegistration = async (optionsPage: Page): Promise<void> => {
  await waitUntil("the page script to be registered", async () => {
    const registered = await optionsPage.evaluate(async () => {
      try {
        const scripts = await chrome.userScripts.getScripts();

        return scripts.map(({ id }) => id);
      } catch {
        return [];
      }
    });

    return registered.join(",") === scriptId;
  });
};

/**
 * Playwright's Chromium with the built extension loaded into a new profile at
 * `profile`, set up the way a user would: "Allow User Scripts" turned on, then
 * the options page opened, which has the extension register its page script.
 * Resolves once it is registered; a document opened earlier would load
 * unthemed.
 */
export const launchWithExtension = async (
  headed: boolean,
  profile: string
): Promise<LoadedExtension> => {
  await rm(profile, { recursive: true, force: true });

  const context = await chromium.launchPersistentContext(profile, {
    channel: "chromium",
    headless: !headed,
    viewport: { width: 1400, height: 1000 },
    args: [
      `--disable-extensions-except=${extensionDir}`,
      `--load-extension=${extensionDir}`,
    ],
  });

  const worker =
    context.serviceWorkers()[0] ??
    (await context.waitForEvent("serviceworker"));

  const extensionId = new URL(worker.url()).host;
  await allowUserScripts(context, extensionId);
  const optionsPage = await context.newPage();
  await optionsPage.goto(
    `chrome-extension://${extensionId}/${files.optionsPage}`
  );
  await waitForRegistration(optionsPage);

  return { context, optionsPage };
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
      `${url} needs a Google sign-in, which these scripts do not support; use a public document`
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
