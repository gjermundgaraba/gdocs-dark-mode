/** Output files in the built extension, shared by the build, the manifest and the background worker. */
export const files = {
  background: "background.js",
  page: "docs-theme.js",
  paletteSync: "docs-palette.js",
  optionsPage: "options.html",
  icons: "icons",
} as const;

/** What the toolbar icon shows: a dark page while dark mode is on, a light one otherwise. */
export type IconState = "on" | "off";

/** The sizes each icon is rendered at, for the toolbar and the extensions page. */
export const iconSizes = [16, 32, 48, 128] as const;

/** The icon's image at each size, as extension paths. */
export const iconPaths = (state: IconState): Record<number, string> =>
  Object.fromEntries(
    iconSizes.map((size) => [size, `${files.icons}/${state}-${size}.png`])
  );
