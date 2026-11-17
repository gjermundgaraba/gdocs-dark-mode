import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { chromium } from "playwright";

import { iconSizes } from "../src/extension/files.ts";
import type { IconState } from "../src/extension/files.ts";
import { defaultTheme } from "../src/theme/theme.ts";

interface IconColors {
  readonly paperTop: string;
  readonly paperBottom: string;
  readonly edge: string;
  readonly fold: string;
  readonly heading: string;
  readonly text: string;
  readonly link: string;
  readonly moon: string;
}

interface IconSpec {
  readonly size: number;
  readonly padding: number;
  readonly colors: IconColors;
}

const iconDir = path.join(
  import.meta.dirname,
  "..",
  "src",
  "extension",
  "icons"
);

const colors: Record<IconState, IconColors> = {
  on: {
    paperTop: defaultTheme.surface,
    paperBottom: defaultTheme.bg,
    edge: defaultTheme.overlay,
    fold: defaultTheme.overlay,
    heading: defaultTheme.fg,
    text: defaultTheme["fg-dim"],
    link: defaultTheme.accent,
    moon: defaultTheme.yellow,
  },
  off: {
    paperTop: "#ffffff",
    paperBottom: "#f8f9fa",
    edge: "#9aa0a6",
    fold: "#dadce0",
    heading: "#3c4043",
    text: "#80868b",
    link: "#80868b",
    moon: "#9aa0a6",
  },
};

/** https://developer.chrome.com/docs/webstore/images#icons */
const storeIconPadding = (size: number): number => (size === 128 ? 16 : 0);

const drawIcon = (icon: IconSpec): string => {
  const canvas = document.createElement("canvas");
  canvas.width = icon.size;
  canvas.height = icon.size;
  const context = canvas.getContext("2d");

  if (context === null) {
    throw new Error("no 2D context");
  }

  const artwork = icon.size - 2 * icon.padding;
  const unit = artwork / 24;
  const small = artwork <= 16;
  const { colors: palette } = icon;

  const pageLeft = 3.5 * unit;
  const pageTop = 0.75 * unit;
  const pageWidth = 17 * unit;
  const pageHeight = 22.5 * unit;
  const fold = (small ? 5 : 6) * unit;
  const corner = 2 * unit;
  const edgeWidth = Math.max(1, unit * 0.6);

  context.translate(icon.padding, icon.padding);

  const page = new Path2D();
  page.moveTo(pageLeft + corner, pageTop);
  page.lineTo(pageLeft + pageWidth - fold, pageTop);
  page.lineTo(pageLeft + pageWidth, pageTop + fold);
  page.arcTo(
    pageLeft + pageWidth,
    pageTop + pageHeight,
    pageLeft,
    pageTop + pageHeight,
    corner
  );
  page.arcTo(pageLeft, pageTop + pageHeight, pageLeft, pageTop, corner);
  page.arcTo(pageLeft, pageTop, pageLeft + pageWidth, pageTop, corner);
  page.closePath();

  const paper = context.createLinearGradient(
    0,
    pageTop,
    0,
    pageTop + pageHeight
  );

  paper.addColorStop(0, palette.paperTop);
  paper.addColorStop(1, palette.paperBottom);
  context.lineJoin = "round";
  context.lineWidth = edgeWidth;
  context.strokeStyle = palette.edge;

  const outline = (region: Path2D, fill: CanvasGradient | string): void => {
    context.fillStyle = fill;
    context.fill(region);
    context.stroke(region);
  };

  outline(page, paper);

  const foldLeft = pageLeft + pageWidth - fold;
  const flap = new Path2D();
  flap.moveTo(foldLeft, pageTop);
  flap.lineTo(foldLeft, pageTop + fold - corner / 2);
  flap.quadraticCurveTo(
    foldLeft,
    pageTop + fold,
    foldLeft + corner / 2,
    pageTop + fold
  );
  flap.lineTo(pageLeft + pageWidth, pageTop + fold);
  flap.closePath();
  outline(flap, palette.fold);

  const bar = (
    left: number,
    top: number,
    width: number,
    height: number,
    color: string
  ): void => {
    context.fillStyle = color;
    context.beginPath();
    context.roundRect(
      left * unit,
      top * unit,
      width * unit,
      height * unit,
      (height * unit) / 2
    );
    context.fill();
  };

  if (small) {
    bar(6.5, 10, 11, 2.25, palette.heading);
    bar(6.5, 14.25, 11, 2.25, palette.text);
    bar(6.5, 18.5, 6, 2.25, palette.link);

    return canvas.toDataURL("image/png");
  }

  const moonX = 8.75 * unit;
  const moonY = 6.75 * unit;
  const moonRadius = 2.75 * unit;
  context.save();
  context.beginPath();
  context.arc(moonX, moonY, moonRadius, 0, Math.PI * 2);
  context.clip();
  context.fillStyle = palette.moon;
  context.fill();
  context.fillStyle = paper;
  context.beginPath();
  context.arc(
    moonX + 1.6 * unit,
    moonY - 1.1 * unit,
    moonRadius * 0.85,
    0,
    Math.PI * 2
  );
  context.fill();
  context.restore();

  bar(6.5, 12, 11, 1.5, palette.heading);
  bar(6.5, 15, 11, 1.5, palette.text);
  bar(6.5, 18, 7, 1.5, palette.text);
  bar(14.25, 18, 3.25, 1.5, palette.link);

  return canvas.toDataURL("image/png");
};

const browser = await chromium.launch({ channel: "chromium" });

try {
  const page = await browser.newPage();
  await mkdir(iconDir, { recursive: true });

  for (const [state, stateColors] of Object.entries(colors)) {
    for (const size of iconSizes) {
      const dataUrl = await page.evaluate(drawIcon, {
        size,
        padding: storeIconPadding(size),
        colors: stateColors,
      });

      await writeFile(
        path.join(iconDir, `${state}-${size}.png`),
        Buffer.from(dataUrl.replace(/^data:image\/png;base64,/u, ""), "base64")
      );
    }
  }

  console.log(`rendered icons into ${iconDir}`);
} finally {
  await browser.close();
}
