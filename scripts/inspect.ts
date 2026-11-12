import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { luminance, parseCanvasColor } from "../src/color/color.ts";
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
  readonly backgrounds: ReadonlyArray<{
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

const { context } = await launchWithExtension(
  headed,
  path.join(outDir, "profile")
);

try {
  const page = await openWithDiagnostics(context, url);
  await page.screenshot({ path: path.join(outDir, "page.png") });

  const findings: PageFindings = await page.evaluate((darkClass) => {
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

    const colorReader = document.createElement("canvas").getContext("2d");

    const inCanvasForm = (css: string): string => {
      if (colorReader === null) {
        return css;
      }

      colorReader.fillStyle = css;

      return colorReader.fillStyle;
    };

    const backgrounds = new Map<
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
        backgroundColor !== "rgba(0, 0, 0, 0)"
      ) {
        const id = element.id === "" ? "" : `#${element.id}`;
        const classes = [...element.classList].slice(0, 3).join(".");
        const key = `${element.tagName.toLowerCase()}${id}${classes === "" ? "" : `.${classes}`}`;

        const entry = backgrounds.get(key) ?? {
          element: key,
          background: inCanvasForm(backgroundColor),
          count: 0,
        };

        entry.count += 1;
        backgrounds.set(key, entry);
      }
    }

    return {
      darkModeRuleTokens: [...darkModeRuleTokens].toSorted(),
      backgrounds: [...backgrounds.values()],
      canvases: [...document.querySelectorAll("canvas")].map((canvas) => ({
        canvasClass: canvas.className,
        parentClass: canvas.parentElement?.className ?? "",
        size: `${canvas.width}x${canvas.height}`,
      })),
    };
  }, darkModeClass);

  const lightElements = findings.backgrounds.filter(({ background }) => {
    const color = parseCanvasColor(background);

    return (
      color !== undefined &&
      color.a >= minimumOpacity &&
      luminance(color) > lightLuminance
    );
  });

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
    lightElements,
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
