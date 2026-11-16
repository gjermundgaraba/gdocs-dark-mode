import {
  darkModeClass,
  knownCanvasColors,
  pageCanvasClass,
} from "../docs/docs.ts";
import { createRemapper } from "../remap/remap.ts";
import { reviewPalette } from "../theme/checks.ts";
import { samePalette } from "../theme/palette.ts";
import type { Palette } from "../theme/palette.ts";
import { defaultTheme } from "../theme/theme.ts";
import type { Theme } from "../theme/theme.ts";
import { renderDocsCss } from "../ui/docs-css.ts";
import { installCanvasHook } from "./canvas-hook.ts";
import { createDiagnostics, debugEnabled } from "./diagnostics.ts";
import {
  paletteEvent,
  parsePaletteJson,
  readCachedPalette,
} from "./palette-cache.ts";

const diagnostics = debugEnabled()
  ? createDiagnostics(darkModeClass)
  : undefined;

const themeOf = (palette: Palette | undefined): Theme =>
  (palette === undefined ? undefined : reviewPalette(palette).theme) ??
  defaultTheme;

let theme = themeOf(readCachedPalette());
let remapper = createRemapper(theme, knownCanvasColors);
let pageDrawn = false;

const stylesheet = document.createElement("style");

stylesheet.textContent = renderDocsCss(theme);

document.documentElement.append(stylesheet);

document.documentElement.classList.add(darkModeClass);

installCanvasHook({
  remapper: { remap: (css, role) => remapper.remap(css, role) },
  appliesTo: (canvas) => {
    const applies = canvas.classList.contains(pageCanvasClass);
    pageDrawn ||= applies;

    return applies;
  },
  observer: diagnostics,
});

const applyStoredPalette = (event: Event): void => {
  const palette = parsePaletteJson(
    event instanceof CustomEvent ? String(event.detail) : null
  );

  if (palette === undefined) {
    return;
  }

  document.removeEventListener(paletteEvent, applyStoredPalette);
  const stored = themeOf(palette);
  const changed = !samePalette(stored, theme);
  diagnostics?.onPaletteArrived(changed);

  if (!changed) {
    return;
  }

  if (!pageDrawn) {
    theme = stored;
    remapper = createRemapper(theme, knownCanvasColors);
    stylesheet.textContent = renderDocsCss(theme);

    return;
  }

  if (samePalette(themeOf(readCachedPalette()), stored)) {
    globalThis.location.reload();
  }
};

document.addEventListener(paletteEvent, applyStoredPalette);

if (diagnostics !== undefined) {
  globalThis.gdocsDarkMode = { report: diagnostics.report };
}
