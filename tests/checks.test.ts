import { describe, expect, it } from "vite-plus/test";

import { paletteProblems } from "../src/theme/checks.ts";
import { defaultPalette } from "../src/theme/palette.ts";

describe("paletteProblems", () => {
  it("finds nothing wrong with the default palette", () => {
    expect(paletteProblems(defaultPalette)).toStrictEqual({
      errors: [],
      warnings: [],
    });
  });

  it("refuses a light palette", () => {
    const { errors } = paletteProblems({
      ...defaultPalette,
      bg: "#ffffff",
      surface: "#f0f0f0",
      fg: "#101010",
    });

    expect(errors.join("\n")).toMatch(/darker|cannot reach/u);
  });

  it("refuses a palette whose soft colours cannot be readable", () => {
    const { errors } = paletteProblems({
      ...defaultPalette,
      bg: "#fafafa",
      surface: "#fafafa",
    });

    expect(errors).toHaveLength(1);
  });

  it("warns, without refusing, about low contrast", () => {
    const { errors, warnings } = paletteProblems({
      ...defaultPalette,
      "fg-dim": "#4a4d48",
    });

    expect(errors).toStrictEqual([]);
    expect(warnings.some((warning) => warning.startsWith("fg-dim/bg"))).toBe(
      true
    );
  });
});
