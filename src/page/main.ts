import {
  darkModeClass,
  knownCanvasColors,
  pageCanvasClass,
} from "../docs/docs.ts";
import { createRemapper } from "../remap/remap.ts";
import type { Palette } from "../theme/palette.ts";
import { createTheme, defaultTheme } from "../theme/theme.ts";
import type { Theme } from "../theme/theme.ts";
import { renderDocsCss } from "../ui/docs-css.ts";
import { installCanvasHook } from "./canvas-hook.ts";
import { createDiagnostics, debugEnabled } from "./diagnostics.ts";
import { takePalette } from "./palette-handoff.ts";

const diagnostics = debugEnabled()
  ? createDiagnostics(darkModeClass)
  : undefined;

const stylesheet = document.createElement("style");

stylesheet.textContent = renderDocsCss(defaultTheme);

document.documentElement.append(stylesheet);

document.documentElement.classList.add(darkModeClass);

let remapper = createRemapper(defaultTheme, knownCanvasColors);

installCanvasHook({
  remapper: { remap: (css, role) => remapper.remap(css, role) },
  appliesTo: (canvas) => canvas.classList.contains(pageCanvasClass),
  observer: diagnostics,
});

const themeFrom = (palette: Palette): Theme | undefined => {
  try {
    return createTheme(palette);
  } catch {
    return undefined;
  }
};

takePalette((palette) => {
  if (palette === undefined) {
    diagnostics?.notePalette("malformed");

    return;
  }

  const theme = themeFrom(palette);

  if (theme === undefined) {
    diagnostics?.notePalette("underivable");

    return;
  }

  remapper = createRemapper(theme, knownCanvasColors);
  stylesheet.textContent = renderDocsCss(theme);
  diagnostics?.notePalette("applied");
});

if (diagnostics !== undefined) {
  globalThis.gdocsDarkMode = { report: diagnostics.report };
}
