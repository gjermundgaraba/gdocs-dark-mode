import type { Theme } from "../theme/theme.ts";

/** The custom properties `options.html` styles itself with, from a theme. */
export const pageStyle = (theme: Theme) => ({
  "--bg": theme.bg,
  "--surface": theme.surface,
  "--overlay": theme.overlay,
  "--fg": theme.fg,
  "--fg-dim": theme["fg-dim"],
  "--accent": theme.accent,
  "--accent-tint": theme["tint-accent"],
  "--error": theme["soft-red"],
  "--warning": theme["soft-yellow"],
});
