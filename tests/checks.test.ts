import { describe, expect, it } from "vite-plus/test";

import { reviewPalette } from "../src/theme/checks.ts";
import { defaultPalette } from "../src/theme/palette.ts";
import { defaultTheme } from "../src/theme/theme.ts";

describe("reviewPalette", () => {
  it("finds nothing wrong with the default palette", () => {
    expect(reviewPalette(defaultPalette)).toStrictEqual({
      theme: defaultTheme,
      errors: [],
      warnings: [],
    });
  });

  it("refuses a light palette", () => {
    const { errors } = reviewPalette({
      ...defaultPalette,
      bg: "#ffffff",
      surface: "#f0f0f0",
      fg: "#101010",
    });

    expect(errors).toStrictEqual([
      "This is a dark theme, so bg must be darker than fg.",
    ]);
  });

  it("refuses a palette whose soft colours cannot be readable", () => {
    const { theme, errors } = reviewPalette({
      ...defaultPalette,
      bg: "#8a8a8a",
      surface: "#8a8a8a",
      fg: "#ffffff",
    });

    expect(theme).toBeUndefined();
    expect(errors).toStrictEqual(["soft-accent cannot reach 4.5 contrast"]);
  });

  it("warns, without refusing, about low contrast", () => {
    const { errors, warnings } = reviewPalette({
      ...defaultPalette,
      "fg-dim": "#4a4d48",
    });

    expect(errors).toStrictEqual([]);
    expect(warnings.some((warning) => warning.startsWith("fg-dim/bg"))).toBe(
      true
    );
  });
});
