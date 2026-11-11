import { spawn } from "node:child_process";
import { once } from "node:events";

import { chromium } from "playwright";

import { playwrightProfileKeyArgs, profileDir } from "./browser.ts";

const browser = spawn(
  chromium.executablePath(),
  [
    `--user-data-dir=${profileDir}`,
    ...playwrightProfileKeyArgs,
    "--no-first-run",
    "--no-default-browser-check",
    "https://accounts.google.com/",
  ],
  { stdio: "ignore" }
);

console.log(
  `Sign in to Google in the Chromium window that opened, then quit it (⌘Q).\nProfile: ${profileDir}`
);

await once(browser, "exit");

console.log("Chromium closed. verify will reuse this sign-in.");
