import { describe, expect, it } from "vite-plus/test";

import {
  contrast,
  parseCanvasColor,
  parseHex,
  toHex,
} from "../src/color/color.ts";
import type { Rgba } from "../src/color/color.ts";
import { knownCanvasColors } from "../src/docs/docs.ts";
import { createRemapper } from "../src/remap/remap.ts";
import type { Role } from "../src/remap/remap.ts";
import { hueNames, theme } from "../src/theme/theme.ts";
import { chromatic, greys } from "./fixtures/google-palette.ts";
import { observedCanvasColors } from "./fixtures/observed-canvas-colors.ts";

const remapper = createRemapper(theme, knownCanvasColors);

const mapped = (css: string, role: Role): Rgba => {
  const result = remapper.remap(css, role);
  const color = result === undefined ? undefined : parseCanvasColor(result);

  if (color === undefined) {
    throw new Error(`${role} ${css} was not mapped to a colour`);
  }

  return color;
};

const white = parseHex("#ffffff");
const black = parseHex("#000000");
const tints = hueNames.map((hue) => theme.hues[hue].tint);
const maxContrast = contrast(theme.fg, theme.bg);

describe("endpoints", () => {
  it("turns the white page into BG and black text into FG", () => {
    expect(remapper.remap("#ffffff", "paper")).toBe(toHex(theme.bg));
    expect(remapper.remap("#000000", "ink")).toBe(toHex(theme.fg));
  });

  it("inverts the same way whatever the role", () => {
    expect(remapper.remap("#ffffff", "ink")).toBe(toHex(theme.bg));
    expect(remapper.remap("#000000", "paper")).toBe(toHex(theme.fg));
  });
});

describe("greys", () => {
  it("keep their contrast against the page, up to FG", () => {
    for (const grey of greys) {
      const expected = Math.min(contrast(parseHex(grey), white), maxContrast);
      expect(contrast(mapped(grey, "ink"), theme.bg), grey).toBeCloseTo(
        expected,
        1
      );
    }
  });

  it("keep black text readable on the light shading Docs offers", () => {
    for (const grey of [
      "#b7b7b7",
      "#cccccc",
      "#d9d9d9",
      "#efefef",
      "#f3f3f3",
      "#ffffff",
    ]) {
      expect(
        contrast(theme.fg, mapped(grey, "paper")),
        grey
      ).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("keep light shading distinct from the page", () => {
    expect(remapper.remap("#f3f3f3", "paper")).not.toBe(toHex(theme.bg));
  });
});

describe("coloured ink", () => {
  it("snaps to the nearest hue's Soft tier", () => {
    expect(remapper.remap("#980000", "ink")).toBe(toHex(theme.hues.red.soft));
    expect(remapper.remap("#1155cc", "ink")).toBe(toHex(theme.hues.blue.soft));
    expect(remapper.remap("#38761d", "ink")).toBe(toHex(theme.hues.green.soft));
    expect(remapper.remap("#ff00ff", "ink")).toBe(
      toHex(theme.hues.magenta.soft)
    );
  });

  it("stays readable on the page and on every highlight when it was readable on white", () => {
    for (const css of chromatic.filter(
      (color) => contrast(parseHex(color), white) >= 4.5
    )) {
      const ink = mapped(css, "ink");

      for (const paper of [theme.bg, ...tints]) {
        expect(
          contrast(ink, paper),
          `${css} on ${toHex(paper)}`
        ).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
});

describe("coloured paper", () => {
  it("becomes a Tint where Docs' text on it would be dark", () => {
    expect(remapper.remap("#ffff00", "paper")).toBe(
      toHex(theme.hues.yellow.tint)
    );
    expect(remapper.remap("#fff2cc", "paper")).toBe(
      toHex(theme.hues.yellow.tint)
    );
    expect(remapper.remap("#cfe2f3", "paper")).toBe(
      toHex(theme.hues.blue.tint)
    );
  });

  const readableWith = (text: Rgba) =>
    chromatic.filter((css) => {
      const original = parseHex(css);
      const other = text === black ? white : black;

      return (
        contrast(text, original) >= 4.5 &&
        contrast(text, original) >= contrast(other, original)
      );
    });

  it.each(readableWith(black))(
    "keeps black text readable on %s, as FG",
    (css) => {
      expect(contrast(theme.fg, mapped(css, "paper"))).toBeGreaterThanOrEqual(
        4.5
      );
    }
  );

  it.each(readableWith(white))(
    "keeps white text readable on %s, as BG",
    (css) => {
      expect(contrast(theme.bg, mapped(css, "paper"))).toBeGreaterThanOrEqual(
        4.5
      );
    }
  );
});

describe("alpha", () => {
  it("is kept", () => {
    expect(remapper.remap("rgba(0, 0, 0, 0.25)", "paper")).toBe(
      "rgba(226, 230, 224, 0.25)"
    );
  });
});

describe("the selection", () => {
  it("composites to SelectionBG over the page and stays translucent", () => {
    const selection = mapped("rgba(78, 143, 248, 0.5)", "paper");
    expect(selection.a).toBe(0.5);

    const over = (channel: "r" | "g" | "b"): number =>
      Math.round(selection[channel] * 0.5 + theme.bg[channel] * 0.5);

    expect(toHex({ r: over("r"), g: over("g"), b: over("b"), a: 1 })).toBe(
      toHex(theme.selectionBg)
    );
  });
});

describe("colours seen in live Docs", () => {
  it.each(observedCanvasColors)(
    "$role $css ($seen) is recognised",
    ({ css, role }) => {
      expect(remapper.remap(css, role)).toBeDefined();
    }
  );
});

describe("unreadable input", () => {
  it("is reported as undefined, so it draws unchanged", () => {
    expect(remapper.remap("color(display-p3 1 0 0)", "ink")).toBeUndefined();
  });
});
