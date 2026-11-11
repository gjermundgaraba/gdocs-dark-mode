import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { parseArgs } from "node:util";

import { chromium } from "playwright";
import type { BrowserContext, Page } from "playwright";

import { debugStorageKey } from "../src/page/diagnostics.ts";
import type { DiagnosticsReport } from "../src/page/diagnostics.ts";
import { publicDocUrl, referenceDocUrl } from "./reference-doc.ts";

const root = path.join(import.meta.dirname, "..");
const pollIntervalMs = 250;
const timeoutMs = 30_000;

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

const waitForPageScriptRegistration = async (
  context: BrowserContext
): Promise<void> => {
  const worker =
    context.serviceWorkers()[0] ??
    (await context.waitForEvent("serviceworker"));

  await waitUntil("the page script to be registered", async () => {
    const registered = await worker.evaluate(async () => {
      const scripts = await chrome.scripting.getRegisteredContentScripts();

      return scripts.length;
    });

    return registered > 0;
  });
};

/**
 * Playwright's Chromium with the built extension loaded, once the extension
 * has registered its page script; a document opened earlier would load
 * unthemed.
 */
export const launchWithExtension = async (
  headed: boolean
): Promise<BrowserContext> => {
  const context = await chromium.launchPersistentContext(profileDir, {
    channel: "chromium",
    headless: !headed,
    viewport: { width: 1400, height: 1000 },
    args: [
      `--disable-extensions-except=${extensionDir}`,
      `--load-extension=${extensionDir}`,
    ],
  });

  await waitForPageScriptRegistration(context);

  return context;
};

export const readReport = async (
  page: Page
): Promise<DiagnosticsReport | undefined> =>
  await page.evaluate(() => globalThis.gdocsDarkMode?.report());

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
  await waitUntil("Docs to draw its page", async () => {
    const report = await readReport(page);

    return (
      report !== undefined && Object.keys(report.recolouredDraws).length > 0
    );
  });
  await page.waitForTimeout(3000);

  return page;
};
