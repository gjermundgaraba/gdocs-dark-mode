import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { Page } from "playwright";

import { toHex } from "../src/color/color.ts";
import { pageCanvasClass } from "../src/docs/docs.ts";
import type { DiagnosticsReport } from "../src/page/diagnostics.ts";
import { theme } from "../src/theme/theme.ts";
import {
  launchWithExtension,
  openWithDiagnostics,
  outputDir,
  parseDocumentArgs,
  readReport,
} from "./browser.ts";

interface Check {
  readonly name: string;
  readonly ok: boolean;
  readonly detail: string;
}

const { url, headed } = parseDocumentArgs();
const outDir = outputDir("verify");

const readFirstPageMarginPixel = async (page: Page): Promise<string> =>
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

const dragSelectOnFirstPage = async (page: Page): Promise<void> => {
  const box = await page
    .locator(`canvas.${pageCanvasClass}`)
    .first()
    .boundingBox();

  if (box === null) {
    return;
  }

  await page.mouse.move(box.x + 100, box.y + 160);
  await page.mouse.down();
  await page.mouse.move(box.x + 500, box.y + 320, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(1000);
};

const evaluate = (report: DiagnosticsReport, pixel: string): Check[] => {
  const recoloured = Object.values(report.recolouredDraws).reduce(
    (sum, count) => sum + count,
    0
  );

  const commonestOpaquePaper = report.colors.find(
    ({ role, css }) => role === "paper" && css.startsWith("#")
  );

  return [
    {
      name: "hook reaches the page canvas",
      ok: recoloured > 0,
      detail: `${recoloured} recoloured draws; other canvases: ${JSON.stringify(report.otherCanvasDraws)}`,
    },
    {
      name: "Docs draws a light page",
      ok: commonestOpaquePaper?.css === "#ffffff",
      detail: `commonest opaque paper colour: ${commonestOpaquePaper?.css ?? "none"} (dark here suggests Docs now draws dark itself)`,
    },
    {
      name: "every colour recognised",
      ok: report.unrecognised.length === 0,
      detail:
        report.unrecognised.length === 0
          ? "none unrecognised"
          : report.unrecognised.join(", "),
    },
    {
      name: "no canvas handed to a worker",
      ok: report.offscreenTransfers === 0,
      detail: `${report.offscreenTransfers} transfers`,
    },
    {
      name: "dark-mode class kept on <html>",
      ok: report.darkModeClassPresent,
      detail: String(report.darkModeClassPresent),
    },
    {
      name: "blank page is BG",
      ok: pixel === toHex(theme.bg),
      detail: `pixel ${pixel}, expected ${toHex(theme.bg)}`,
    },
  ];
};

await mkdir(outDir, { recursive: true });

const context = await launchWithExtension(headed);

try {
  const page = await openWithDiagnostics(context, url);
  await page.screenshot({ path: path.join(outDir, "page.png") });
  const pixel = await readFirstPageMarginPixel(page);
  await dragSelectOnFirstPage(page);
  await page.screenshot({ path: path.join(outDir, "selection.png") });
  const report = await readReport(page);

  if (report === undefined) {
    throw new Error("the diagnostics report disappeared");
  }

  await writeFile(
    path.join(outDir, "report.json"),
    `${JSON.stringify({ url, pixel, report }, null, 2)}\n`
  );

  const checks = evaluate(report, pixel);

  for (const check of checks) {
    console.log(
      `${check.ok ? "PASS" : "FAIL"}  ${check.name}: ${check.detail}`
    );
  }

  console.log(`\nreport and screenshots in ${outDir}`);

  if (checks.some(({ ok }) => !ok)) {
    process.exitCode = 1;
  }
} finally {
  await context.close();
}
