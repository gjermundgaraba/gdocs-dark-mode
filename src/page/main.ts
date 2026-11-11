import {
  darkModeClass,
  knownCanvasColors,
  pageCanvasClass,
} from "../docs/docs.ts";
import { createRemapper } from "../remap/remap.ts";
import { theme } from "../theme/theme.ts";
import { installCanvasHook } from "./canvas-hook.ts";
import { createDiagnostics, debugEnabled } from "./diagnostics.ts";

const diagnostics = debugEnabled()
  ? createDiagnostics(darkModeClass)
  : undefined;

installCanvasHook({
  remapper: createRemapper(theme, knownCanvasColors),
  appliesTo: (canvas) => canvas.classList.contains(pageCanvasClass),
  observer: diagnostics,
});

document.documentElement.classList.add(darkModeClass);

if (diagnostics !== undefined) {
  globalThis.gdocsDarkMode = { report: diagnostics.report };
}
