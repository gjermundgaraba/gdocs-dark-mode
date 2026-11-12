import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { chromium } from "playwright";

import { iconSizes } from "../src/extension/files.ts";
import type { IconState } from "../src/extension/files.ts";
import { defaultTheme } from "../src/theme/theme.ts";

interface IconColors {
  readonly page: string;
  readonly ink: string;
  readonly accent: string;
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
    page: defaultTheme.bg,
    ink: defaultTheme.fg,
    accent: defaultTheme.accent,
  },
  off: { page: "#ffffff", ink: "#5f6368", accent: "#5f6368" },
};

const browser = await chromium.launch();

try {
  const page = await browser.newPage();
  await mkdir(iconDir, { recursive: true });

  for (const [state, { page: paper, ink, accent }] of Object.entries(colors)) {
    for (const size of iconSizes) {
      const dataUrl = await page.evaluate(
        (icon) => {
          const canvas = document.createElement("canvas");
          canvas.width = icon.size;
          canvas.height = icon.size;
          const context = canvas.getContext("2d");

          if (context === null) {
            throw new Error("no 2D context");
          }

          const unit = icon.size / 16;
          context.fillStyle = icon.paper;
          context.strokeStyle = icon.ink;
          context.lineWidth = unit;
          context.beginPath();
          context.roundRect(
            2.5 * unit,
            0.5 * unit,
            11 * unit,
            15 * unit,
            1.5 * unit
          );
          context.fill();
          context.stroke();
          context.fillStyle = icon.ink;

          for (const [row, width] of [
            [4, 7],
            [7, 7],
            [10, 4.5],
          ] as const) {
            context.fillRect(4.5 * unit, row * unit, width * unit, unit);
          }

          context.fillStyle = icon.accent;
          context.fillRect(9.5 * unit, 10 * unit, 2 * unit, unit);

          return canvas.toDataURL("image/png");
        },
        { size, paper, ink, accent }
      );

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
