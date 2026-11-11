import { toHex } from "../color/color.ts";
import type { Theme } from "../theme/theme.ts";

/** The custom properties `options.html` styles itself with, from a theme. */
export const pageStyle = (theme: Theme) => ({
  "--bg": toHex(theme.bg),
  "--surface": toHex(theme.surface),
  "--overlay": toHex(theme.overlay),
  "--fg": toHex(theme.fg),
  "--fg-dim": toHex(theme.fgDim),
  "--accent": toHex(theme.hues.accent.base),
  "--accent-tint": toHex(theme.hues.accent.tint),
  "--error": toHex(theme.hues.red.soft),
  "--warning": toHex(theme.hues.yellow.soft),
});
