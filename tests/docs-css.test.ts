import { describe, expect, it } from "vite-plus/test";

import { toHex } from "../src/color/color.ts";
import { googleDarkModeTokens } from "../src/docs/docs.ts";
import { theme } from "../src/theme/theme.ts";
import { renderDocsCss } from "../src/ui/docs-css.ts";

const css = renderDocsCss(theme);

const declared = (property: string): string | undefined =>
  new RegExp(`\\s${property}:\\s*([^;]+);`, "u").exec(css)?.[1];

describe("renderDocsCss", () => {
  it.each(googleDarkModeTokens)("overrides %s and its -rgb twin", (token) => {
    expect(declared(token)).toMatch(/^#[\da-f]{6}$/u);
    expect(declared(`${token}-rgb`)).toMatch(/^\d{1,3},\d{1,3},\d{1,3}$/u);
  });

  it("themes the main surfaces", () => {
    expect(declared("--gm3-sys-color-surface")).toBe(toHex(theme.bg));
    expect(declared("--gm3-sys-color-on-surface")).toBe(toHex(theme.fg));
    expect(declared("--gm3-sys-color-primary")).toBe(
      toHex(theme.hues.accent.base)
    );
  });
});
