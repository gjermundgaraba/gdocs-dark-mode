import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

import { build } from "vite";

import packageJson from "../package.json" with { type: "json" };
import { files } from "../src/extension/files.ts";
import {
  createManifest,
  minimumChromeVersion,
} from "../src/extension/manifest.ts";

const root = path.join(import.meta.dirname, "..");
const dist = path.join(root, "dist");

const scripts = [
  { entry: "src/page/main.ts", output: files.page },
  { entry: "src/background/background.ts", output: files.background },
] as const;

const bundleAsClassicScript = async (
  entry: string,
  output: string
): Promise<void> => {
  await build({
    configFile: false,
    root,
    logLevel: "warn",
    build: {
      outDir: dist,
      emptyOutDir: false,
      target: `chrome${minimumChromeVersion}`,
      minify: false,
      lib: {
        entry: path.join(root, entry),
        formats: ["iife"],
        name: "gdocsDarkMode",
        fileName: () => output,
      },
    },
  });
};

await rm(dist, { recursive: true, force: true });

await mkdir(dist, { recursive: true });

for (const { entry, output } of scripts) {
  await bundleAsClassicScript(entry, output);
}

await build({
  configFile: false,
  root: path.join(root, "src/options"),
  base: "./",
  logLevel: "warn",
  build: {
    outDir: dist,
    emptyOutDir: false,
    target: `chrome${minimumChromeVersion}`,
    minify: false,
    rolldownOptions: {
      input: path.join(root, "src/options", files.optionsPage),
    },
  },
});

await cp(path.join(root, "src/extension/icons"), path.join(dist, files.icons), {
  recursive: true,
});

await writeFile(
  path.join(dist, "manifest.json"),
  `${JSON.stringify(createManifest(packageJson.version), null, 2)}\n`
);

console.log(`built gdocs-dark-mode ${packageJson.version} into dist/`);
