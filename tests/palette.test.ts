import { hueNames } from "@gjermundgaraba/gg-theme/derive";
import tokens from "@gjermundgaraba/gg-theme/tokens" with { type: "json" };
import { describe, expect, it } from "vite-plus/test";

import { toHex } from "../src/color/color.ts";
import {
  defaultPalette,
  paletteFromTokensFile,
  paletteKeys,
  parsePalette,
  samePalette,
} from "../src/theme/palette.ts";
import { createTheme, defaultTheme } from "../src/theme/theme.ts";

const tokensFile = JSON.stringify(tokens);

describe("parsePalette", () => {
  it("reads the default palette from gg-theme's dark palette", () => {
    for (const key of paletteKeys) {
      expect(defaultPalette[key]).toBe(tokens.palette.dark[key]);
    }
  });

  it("lower-cases colours and drops extra keys", () => {
    const parsed = parsePalette({
      ...defaultPalette,
      bg: "#ABCDEF",
      cursor: "#000000",
    });

    expect(parsed?.bg).toBe("#abcdef");
    expect(Object.keys(parsed ?? {}).toSorted()).toStrictEqual(
      [...paletteKeys].toSorted()
    );
  });

  it.each([
    ["a missing colour", { ...defaultPalette, fg: undefined }],
    ["a short hex colour", { ...defaultPalette, fg: "#fff" }],
    ["a non-string colour", { ...defaultPalette, fg: 0xff_ff_ff }],
    ["an array", Object.values(defaultPalette)],
    ["null", null],
    ["a string", "#282a27"],
  ])("rejects %s", (_label, value) => {
    expect(parsePalette(value)).toBeUndefined();
  });
});

describe("paletteFromTokensFile", () => {
  it("imports gg-theme's own tokens.json", () => {
    const imported = paletteFromTokensFile(tokensFile);

    expect("error" in imported).toBe(false);
    expect(
      "error" in imported ? false : samePalette(imported, defaultPalette)
    ).toBe(true);
  });

  it.each([
    ["not JSON", "{", "not valid JSON"],
    ["JSON without palette.dark", '{"palette":{}}', "no palette.dark"],
    [
      "a palette.dark missing colours",
      '{"palette":{"dark":{"bg":"#000000"}}}',
      "needs a #rrggbb colour",
    ],
  ])("explains %s", (_label, text, message) => {
    const imported = paletteFromTokensFile(text);

    expect("error" in imported ? imported.error : "").toContain(message);
  });
});

describe("createTheme", () => {
  it("derives the tiers gg-theme publishes for its own palette", () => {
    const published = tokens.tiers.dark;

    expect(toHex(defaultTheme.wash)).toBe(published.wash);

    for (const hue of hueNames) {
      const tiers = defaultTheme.hues[hue];
      expect(toHex(tiers.soft), hue).toBe(published[`soft-${hue}`]);
      expect(toHex(tiers.quiet), hue).toBe(published[`quiet-${hue}`]);
      expect(toHex(tiers.wash), hue).toBe(published[`wash-${hue}`]);
      expect(toHex(tiers.tint), hue).toBe(published[`tint-${hue}`]);
    }
  });

  it("follows a custom background", () => {
    const theme = createTheme({ ...defaultPalette, bg: "#101010" });

    expect(toHex(theme.bg)).toBe("#101010");
    expect(toHex(theme.wash)).not.toBe(toHex(defaultTheme.wash));
  });
});
