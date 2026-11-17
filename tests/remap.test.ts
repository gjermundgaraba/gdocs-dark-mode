import { describe, expect, it } from "vite-plus/test";

import {
  contrast,
  parseCanvasColor,
  parseHex,
  toCss,
  toHex,
  withAlpha,
} from "../src/color/color.ts";
import type { Rgba } from "../src/color/color.ts";
import { knownCanvasColors } from "../src/docs/docs.ts";
import { createRemapper } from "../src/remap/remap.ts";
import type { Role } from "../src/remap/remap.ts";
import { hueNames } from "../src/theme/palette.ts";
import { defaultTheme as theme } from "../src/theme/theme.ts";
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
const bg = parseHex(theme.bg);
const fg = parseHex(theme.fg);
const tints = hueNames.map((hue) => parseHex(theme[`tint-${hue}`]));
const maxContrast = contrast(fg, bg);

const papersUnreadableOn = (css: string): string[] => {
  const ink = mapped(css, "ink");

  return [bg, ...tints].flatMap((paper) =>
    contrast(ink, paper) < 4.5 ? [toHex(paper)] : []
  );
};

const opaqueObserved = (role: Role): string[] =>
  observedCanvasColors.flatMap((color) =>
    color.role === role && color.css.startsWith("#") ? [color.css] : []
  );

describe("endpoints", () => {
  it("turns the white page into BG and black text into FG", () => {
    expect(remapper.remap("#ffffff", "paper")).toBe(theme.bg);
    expect(remapper.remap("#000000", "ink")).toBe(theme.fg);
  });

  it("inverts the same way whatever the role", () => {
    expect(remapper.remap("#ffffff", "ink")).toBe(theme.bg);
    expect(remapper.remap("#000000", "paper")).toBe(theme.fg);
  });
});

describe("greys", () => {
  it("keep their contrast against the page, up to FG", () => {
    for (const grey of greys) {
      const expected = Math.min(contrast(parseHex(grey), white), maxContrast);
      expect(contrast(mapped(grey, "ink"), bg), grey).toBeCloseTo(expected, 1);
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
      expect(contrast(fg, mapped(grey, "paper")), grey).toBeGreaterThanOrEqual(
        4.5
      );
    }
  });

  it("keep light shading distinct from the page", () => {
    expect(remapper.remap("#f3f3f3", "paper")).not.toBe(theme.bg);
  });
});

describe("coloured ink", () => {
  it("snaps to the nearest hue's Soft tier", () => {
    expect(remapper.remap("#980000", "ink")).toBe(theme["soft-red"]);
    expect(remapper.remap("#1155cc", "ink")).toBe(theme["soft-blue"]);
    expect(remapper.remap("#38761d", "ink")).toBe(theme["soft-green"]);
    expect(remapper.remap("#ff00ff", "ink")).toBe(theme["soft-magenta"]);
  });

  it("stays readable on the page and on every highlight when it was readable on white", () => {
    for (const css of chromatic.filter(
      (color) => contrast(parseHex(color), white) >= 4.5
    )) {
      expect(papersUnreadableOn(css), css).toStrictEqual([]);
    }
  });
});

describe("coloured paper", () => {
  it("becomes a Tint where Docs' text on it would be dark", () => {
    expect(remapper.remap("#ffff00", "paper")).toBe(theme["tint-yellow"]);
    expect(remapper.remap("#fff2cc", "paper")).toBe(theme["tint-yellow"]);
    expect(remapper.remap("#cfe2f3", "paper")).toBe(theme["tint-blue"]);
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
      expect(contrast(fg, mapped(css, "paper"))).toBeGreaterThanOrEqual(4.5);
    }
  );

  it.each(readableWith(white))(
    "keeps white text readable on %s, as BG",
    (css) => {
      expect(contrast(bg, mapped(css, "paper"))).toBeGreaterThanOrEqual(4.5);
    }
  );
});

describe("alpha", () => {
  it("is kept", () => {
    expect(remapper.remap("rgba(0, 0, 0, 0.25)", "paper")).toBe(
      toCss(withAlpha(fg, 0.25))
    );
  });
});

describe("the selection", () => {
  it("composites to SelectionBG over the page and stays translucent", () => {
    const selection = mapped("rgba(78, 143, 248, 0.5)", "paper");
    expect(selection.a).toBe(0.5);

    const over = (channel: "r" | "g" | "b"): number =>
      Math.round(selection[channel] * 0.5 + bg[channel] * 0.5);

    expect(toHex({ r: over("r"), g: over("g"), b: over("b"), a: 1 })).toBe(
      theme["selection-bg"]
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

  it.each(
    opaqueObserved("ink").filter((css) => contrast(parseHex(css), white) >= 4.5)
  )("ink %s stays readable on the page and every highlight", (css) => {
    expect(papersUnreadableOn(css)).toStrictEqual([]);
  });

  it.each(opaqueObserved("paper"))("paper %s keeps FG text readable", (css) => {
    expect(contrast(fg, mapped(css, "paper"))).toBeGreaterThanOrEqual(4.5);
  });
});

describe("unreadable input", () => {
  it("is reported as undefined, so it draws unchanged", () => {
    expect(remapper.remap("color(display-p3 1 0 0)", "ink")).toBeUndefined();
  });
});
