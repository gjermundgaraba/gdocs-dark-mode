import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  darkModeClass,
  googleDarkModeTokens,
  googleThemedTokenPrefixes,
} from "../src/docs/docs.ts";
import {
  launchWithExtension,
  openWithDiagnostics,
  outputDir,
  parseDocumentArgs,
  readReport,
} from "./browser.ts";

interface PageFindings {
  readonly darkModeRuleTokens: readonly string[];
  readonly lightElements: ReadonlyArray<{
    readonly element: string;
    readonly background: string;
    readonly count: number;
  }>;
  readonly canvases: ReadonlyArray<{
    readonly canvasClass: string;
    readonly parentClass: string;
    readonly size: string;
  }>;
}

const { url, headed } = parseDocumentArgs();
const outDir = outputDir("inspect");

const lightLuminance = 0.4;

const minimumOpacity = 0.5;

await mkdir(outDir, { recursive: true });

const context = await launchWithExtension(headed);

try {
  const page = await openWithDiagnostics(context, url);
  await page.screenshot({ path: path.join(outDir, "page.png") });

  const findings: PageFindings = await page.evaluate(
    ({ darkClass, lightThreshold, opacityThreshold }) => {
      const darkModeRuleTokens = new Set<string>();

      const collect = (rules: CSSRuleList): void => {
        for (const rule of rules) {
          if (rule instanceof CSSGroupingRule) {
            collect(rule.cssRules);
          }

          if (
            rule instanceof CSSStyleRule &&
            rule.selectorText === `.${darkClass}`
          ) {
            for (const property of rule.style) {
              darkModeRuleTokens.add(property);
            }
          }
        }
      };

      for (const sheet of document.styleSheets) {
        try {
          collect(sheet.cssRules);
        } catch {
          continue;
        }
      }

      const lightBackground = (css: string): boolean => {
        const [r = "0", g = "0", b = "0", a = "1"] =
          css.match(/[\d.]+/gu) ?? [];

        const [red = 0, green = 0, blue = 0] = [r, g, b].map((value) => {
          const byte = Number(value) / 255;

          return byte <= 0.04045
            ? byte / 12.92
            : ((byte + 0.055) / 1.055) ** 2.4;
        });

        return (
          Number(a) >= opacityThreshold &&
          0.2126 * red + 0.7152 * green + 0.0722 * blue > lightThreshold
        );
      };

      const light = new Map<
        string,
        { element: string; background: string; count: number }
      >();

      for (const element of document.querySelectorAll("body *")) {
        const box = element.getBoundingClientRect();
        const { backgroundColor, maskImage } = getComputedStyle(element);

        if (
          box.width > 0 &&
          box.height > 0 &&
          box.bottom > 0 &&
          box.top < innerHeight &&
          maskImage === "none" &&
          lightBackground(backgroundColor)
        ) {
          const id = element.id === "" ? "" : `#${element.id}`;
          const classes = [...element.classList].slice(0, 3).join(".");
          const key = `${element.tagName.toLowerCase()}${id}${classes === "" ? "" : `.${classes}`}`;

          const entry = light.get(key) ?? {
            element: key,
            background: backgroundColor,
            count: 0,
          };

          entry.count += 1;
          light.set(key, entry);
        }
      }

      return {
        darkModeRuleTokens: [...darkModeRuleTokens].toSorted(),
        lightElements: [...light.values()],
        canvases: [...document.querySelectorAll("canvas")].map((canvas) => ({
          canvasClass: canvas.className,
          parentClass: canvas.parentElement?.className ?? "",
          size: `${canvas.width}x${canvas.height}`,
        })),
      };
    },
    {
      darkClass: darkModeClass,
      lightThreshold: lightLuminance,
      opacityThreshold: minimumOpacity,
    }
  );

  const themed = findings.darkModeRuleTokens.filter(
    (token) =>
      !token.endsWith("-rgb") &&
      googleThemedTokenPrefixes.some((prefix) => token.startsWith(prefix))
  );

  const known = new Set<string>(googleDarkModeTokens);
  const live = new Set(themed);

  const summary = {
    url,
    newGoogleTokens: themed.filter((token) => !known.has(token)),
    goneGoogleTokens: googleDarkModeTokens.filter((token) => !live.has(token)),
    darkModeRuleFound: findings.darkModeRuleTokens.length > 0,
    lightElements: findings.lightElements,
    canvases: findings.canvases,
    report: await readReport(page),
  };

  await writeFile(
    path.join(outDir, "inspect.json"),
    `${JSON.stringify(summary, null, 2)}\n`
  );

  console.log(`dark-mode rule found: ${String(summary.darkModeRuleFound)}`);
  console.log(
    `new Google tokens: ${summary.newGoogleTokens.join(", ") || "none"}`
  );
  console.log(
    `gone Google tokens: ${summary.goneGoogleTokens.join(", ") || "none"}`
  );
  console.log(`light elements in view: ${summary.lightElements.length}`);

  for (const { element, background, count } of summary.lightElements) {
    console.log(`  ${element} (${background}) ×${count}`);
  }

  console.log(`canvases: ${summary.canvases.length}`);
  console.log(`\nfull findings and a screenshot in ${outDir}`);
} finally {
  await context.close();
}
