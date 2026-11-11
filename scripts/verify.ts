import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import type { Page } from "playwright";

import { toHex } from "../src/color/color.ts";
import { pageCanvasClass } from "../src/docs/docs.ts";
import type { DiagnosticsReport } from "../src/page/diagnostics.ts";
import { createTheme } from "../src/theme/theme.ts";
import type { Theme } from "../src/theme/theme.ts";
import {
  launchWithExtension,
  openWithDiagnostics,
  outputDir,
  parseDocumentArgs,
  readPageMarginPixel,
  readReport,
  readSavedPalette,
} from "./browser.ts";
import { printChecks } from "./checks.ts";
import type { Check } from "./checks.ts";

const { url, headed } = parseDocumentArgs();
const outDir = outputDir("verify");

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

const evaluate = (
  report: DiagnosticsReport,
  pixel: string,
  theme: Theme
): Check[] => {
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
      name: "saved palette applied before the first draw",
      ok: report.palette === "applied" && report.drawsBeforePalette === 0,
      detail: `palette ${report.palette}; ${report.drawsBeforePalette} draws before it`,
    },
    {
      name: "blank page is BG",
      ok: pixel === toHex(theme.bg),
      detail: `pixel ${pixel}, expected ${toHex(theme.bg)}`,
    },
  ];
};

await mkdir(outDir, { recursive: true });

const { context, optionsPage } = await launchWithExtension(headed);

try {
  const theme = createTheme(await readSavedPalette(optionsPage));
  const page = await openWithDiagnostics(context, url);
  await page.screenshot({ path: path.join(outDir, "page.png") });
  const pixel = await readPageMarginPixel(page);
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

  const checks = evaluate(report, pixel, theme);

  printChecks(checks);
  console.log(`\nreport and screenshots in ${outDir}`);
} finally {
  await context.close();
}
