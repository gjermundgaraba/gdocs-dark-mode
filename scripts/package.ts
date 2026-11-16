import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { zipSync } from "fflate";

import packageJson from "../package.json" with { type: "json" };

const root = path.join(import.meta.dirname, "..");
const dist = path.join(root, "dist");
const output = path.join(root, `gdocs-dark-mode-${packageJson.version}.zip`);

const entries = await readdir(dist, { recursive: true, withFileTypes: true });
const contents: Record<string, Uint8Array> = {};

for (const entry of entries.filter((candidate) => candidate.isFile())) {
  const file = path.join(entry.parentPath, entry.name);
  contents[path.relative(dist, file).split(path.sep).join("/")] =
    await readFile(file);
}

await writeFile(output, zipSync(contents, { level: 9 }));

console.log(
  `packaged ${Object.keys(contents).length} files into ${path.relative(root, output)}`
);
