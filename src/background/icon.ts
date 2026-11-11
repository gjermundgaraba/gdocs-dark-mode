import { toHex } from "../color/color.ts";
import type { Theme } from "../theme/theme.ts";

const sizes = [16, 32] as const;

const draw = (
  size: number,
  page: string,
  ink: string,
  accent: string
): ImageData => {
  const canvas = new OffscreenCanvas(size, size);
  const context = canvas.getContext("2d");

  if (context === null) {
    throw new Error("OffscreenCanvas 2D context is unavailable");
  }

  const unit = size / 16;
  context.fillStyle = page;
  context.strokeStyle = ink;
  context.lineWidth = unit;
  context.beginPath();
  context.roundRect(2.5 * unit, 0.5 * unit, 11 * unit, 15 * unit, 1.5 * unit);
  context.fill();
  context.stroke();
  context.fillStyle = ink;

  for (const [row, width] of [
    [4, 7],
    [7, 7],
    [10, 4.5],
  ] as const) {
    context.fillRect(4.5 * unit, row * unit, width * unit, unit);
  }

  context.fillStyle = accent;
  context.fillRect(9.5 * unit, 10 * unit, 2 * unit, unit);

  return context.getImageData(0, 0, size, size);
};

/** Draws the toolbar icon, a document page that is dark when dark mode is on, and sets its tooltip. */
export const showState = async (
  theme: Theme,
  enabled: boolean
): Promise<void> => {
  const [page, ink, accent] = enabled
    ? [toHex(theme.bg), toHex(theme.fg), toHex(theme.hues.accent.base)]
    : ["#ffffff", "#5f6368", "#5f6368"];

  await chrome.action.setIcon({
    imageData: Object.fromEntries(
      sizes.map((size) => [size, draw(size, page, ink, accent)])
    ),
  });
  await chrome.action.setTitle({
    title: `Google Docs dark mode: ${enabled ? "on" : "off"} (click to switch)`,
  });
};
