import { describe, expect, it } from "vite-plus/test";

import { contrast, parseHex } from "../src/color/color.ts";
import {
  defaultPalette,
  hueNames,
  paletteFromFile,
  paletteKeys,
  paletteToFile,
  parsePalette,
} from "../src/theme/palette.ts";
import { createTheme, defaultTheme } from "../src/theme/theme.ts";
import type { Theme } from "../src/theme/theme.ts";

describe("parsePalette", () => {
  it("reads the default palette back unchanged", () => {
    expect(parsePalette(defaultPalette)).toStrictEqual(defaultPalette);
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

describe("palette files", () => {
  it("reads back what it exported", () => {
    const palette = { ...defaultPalette, bg: "#101112", red: "#ff0000" };

    expect(paletteFromFile(paletteToFile(palette))).toStrictEqual(palette);
  });

  it.each([
    ["not JSON", "{", "not valid JSON"],
    [
      "colours missing or malformed",
      JSON.stringify({ ...defaultPalette, fg: "#fff", cyan: undefined }),
      "needs a #rrggbb colour for: fg, cyan.",
    ],
    ["a JSON array", "[]", `for: ${paletteKeys.join(", ")}.`],
  ])("explains %s", (_label, text, message) => {
    const imported = paletteFromFile(text);

    expect("error" in imported ? imported.error : "").toContain(message);
  });
});

describe("createTheme", () => {
  it.each([
    ["the default palette", defaultPalette],
    [
      "hues too dark to read as they are",
      {
        ...defaultPalette,
        red: "#5a0000",
        blue: "#00205a",
        accent: "#3a1a4a",
      },
    ],
  ])(
    "makes soft text readable and quiet marks visible for %s",
    (_label, palette) => {
      const theme = createTheme(palette);

      const ratio = (x: keyof Theme, y: keyof Theme): number =>
        contrast(parseHex(theme[x]), parseHex(theme[y]));

      for (const hue of hueNames) {
        for (const background of [
          "bg",
          "surface",
          "wash",
          ...hueNames.map((other) => `wash-${other}` as const),
        ] as const) {
          expect(ratio(`soft-${hue}`, background)).toBeGreaterThanOrEqual(4.5);
        }

        expect(ratio(`quiet-${hue}`, "bg")).toBeGreaterThanOrEqual(3);
      }
    }
  );

  it("follows a custom background", () => {
    const theme = createTheme({ ...defaultPalette, bg: "#101010" });

    expect(theme.bg).toBe("#101010");
    expect(theme.wash).not.toBe(defaultTheme.wash);
  });
});
