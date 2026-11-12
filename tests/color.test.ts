import { describe, expect, it } from "vite-plus/test";

import {
  contrast,
  mix,
  parseCanvasColor,
  parseHex,
  rgb,
  toCss,
  translucentOver,
} from "../src/color/color.ts";

describe("parseCanvasColor", () => {
  it("reads both shapes canvas serialises to", () => {
    expect(parseCanvasColor("#1155cc")).toStrictEqual(rgb(0x11, 0x55, 0xcc));
    expect(parseCanvasColor("rgba(78, 143, 248, 0.5)")).toStrictEqual(
      rgb(78, 143, 248, 0.5)
    );
  });

  it("rejects anything else", () => {
    for (const css of [
      "red",
      "#fff",
      "color(display-p3 1 0 0)",
      "rgba(300, 0, 0, 1)",
      "rgb(0, 0, 0)",
      "",
    ]) {
      expect(parseCanvasColor(css)).toBeUndefined();
    }
  });
});

describe("toCss", () => {
  it("round-trips what canvas reports", () => {
    for (const css of ["#000000", "#fa9a84", "rgba(78, 143, 248, 0.5)"]) {
      const color = parseCanvasColor(css);
      expect(color && toCss(color)).toBe(css);
    }
  });
});

describe("contrast", () => {
  it("matches WCAG's black-on-white", () => {
    expect(contrast(rgb(0, 0, 0), rgb(255, 255, 255))).toBeCloseTo(21, 5);
  });
});

describe("mix", () => {
  it("returns its ends at 0 and 1", () => {
    const [from, to] = [parseHex("#282a27"), parseHex("#e2e6e0")];
    expect(mix(from, to, 0)).toStrictEqual(from);
    expect(mix(from, to, 1)).toStrictEqual(to);
  });
});

describe("translucentOver", () => {
  it("composites back to the target", () => {
    const [target, backdrop] = [parseHex("#53273a"), parseHex("#282a27")];
    const color = translucentOver(target, backdrop, 0.5);

    const composite = (channel: "r" | "g" | "b"): number =>
      Math.round(color[channel] * 0.5 + backdrop[channel] * 0.5);

    expect([composite("r"), composite("g"), composite("b")]).toStrictEqual([
      target.r,
      target.g,
      target.b,
    ]);
  });
});
