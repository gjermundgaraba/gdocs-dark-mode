import {
  darkModeClass,
  knownCanvasColors,
  pageCanvasClass,
} from "../docs/docs.ts";
import { createRemapper } from "../remap/remap.ts";
import { defaultPalette } from "../theme/palette.ts";
import { createTheme } from "../theme/theme.ts";
import { renderDocsCss } from "../ui/docs-css.ts";
import { installCanvasHook } from "./canvas-hook.ts";
import { createDiagnostics, debugEnabled } from "./diagnostics.ts";
import { takePalette } from "./palette-global.ts";

const diagnostics = debugEnabled()
  ? createDiagnostics(darkModeClass)
  : undefined;

const theme = createTheme(takePalette() ?? defaultPalette);

const stylesheet = document.createElement("style");

stylesheet.textContent = renderDocsCss(theme);

document.documentElement.append(stylesheet);

document.documentElement.classList.add(darkModeClass);

installCanvasHook({
  remapper: createRemapper(theme, knownCanvasColors),
  appliesTo: (canvas) => canvas.classList.contains(pageCanvasClass),
  observer: diagnostics,
});

if (diagnostics !== undefined) {
  globalThis.gdocsDarkMode = { report: diagnostics.report };
}
