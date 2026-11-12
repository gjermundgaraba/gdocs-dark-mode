import type { Role } from "../remap/remap.ts";
import type { DrawMethod, DrawObserver } from "./canvas-hook.ts";

/**
 * Diagnostics are off by default. Turn them on for docs.google.com with
 * `localStorage.setItem("gdocs-dark-mode:debug", "1")` and reload; then
 * `gdocsDarkMode.report()` in the page's console returns a `DiagnosticsReport`.
 */
export const debugStorageKey = "gdocs-dark-mode:debug";

export interface ColorRecord {
  readonly css: string;
  readonly role: Role;
  /** `null` when the remapper could not read `css`. */
  readonly mapped: string | null;
  readonly count: number;
}

export interface DiagnosticsReport {
  /** Draw calls on canvases the hook recoloured, by method. Empty means the hook never reached the page. */
  readonly recolouredDraws: Partial<Record<DrawMethod, number>>;
  /** Draw calls on other canvases, by the canvas's class (`(none)` when it has none). */
  readonly otherCanvasDraws: Record<string, number>;
  /** Every colour seen on recoloured canvases and what it became. */
  readonly colors: readonly ColorRecord[];
  /** Colours the remapper could not read, so drew unchanged. Should be empty. */
  readonly unrecognised: readonly string[];
  /** Canvases handed to a worker, where the hook cannot follow. Should be 0. */
  readonly offscreenTransfers: number;
  /** Whether `<html>` still carries the dark-mode class. */
  readonly darkModeClassPresent: boolean;
}

export interface Diagnostics extends DrawObserver {
  readonly report: () => DiagnosticsReport;
}

declare global {
  var gdocsDarkMode: Pick<Diagnostics, "report"> | undefined;
}

export const debugEnabled = (): boolean => {
  try {
    return globalThis.localStorage.getItem(debugStorageKey) === "1";
  } catch {
    return false;
  }
};

const increment = <Key extends string>(
  counts: Partial<Record<Key, number>>,
  key: Key
): void => {
  counts[key] = (counts[key] ?? 0) + 1;
};

/**
 * Records what the canvas hook sees, so a page that is not themed shows why.
 * The fix-docs-breakage skill reads the report's fields to tell breakages apart.
 */
export const createDiagnostics = (darkModeClass: string): Diagnostics => {
  const recolouredDraws: Partial<Record<DrawMethod, number>> = {};
  const otherCanvasDraws: Record<string, number> = {};

  const colors = new Map<string, ColorRecord>();

  let offscreenTransfers = 0;

  const transfer = HTMLCanvasElement.prototype.transferControlToOffscreen;
  HTMLCanvasElement.prototype.transferControlToOffscreen =
    function transferControlToOffscreen(this: HTMLCanvasElement) {
      offscreenTransfers += 1;

      return transfer.call(this);
    };

  return {
    onDraw: (method, canvas, recoloured) => {
      if (recoloured) {
        increment(recolouredDraws, method);
      } else {
        increment(otherCanvasDraws, canvas.className || "(none)");
      }
    },
    onColor: (css, role, mapped) => {
      const key = `${role} ${css}`;

      colors.set(key, {
        css,
        role,
        mapped: mapped ?? null,
        count: (colors.get(key)?.count ?? 0) + 1,
      });
    },
    report: () => {
      const seen = [...colors.values()].toSorted((x, y) => y.count - x.count);

      return {
        recolouredDraws: { ...recolouredDraws },
        otherCanvasDraws: { ...otherCanvasDraws },
        colors: seen,
        unrecognised: [
          ...new Set(
            seen.flatMap(({ css, mapped }) => (mapped === null ? [css] : []))
          ),
        ],
        offscreenTransfers,
        darkModeClassPresent:
          document.documentElement.classList.contains(darkModeClass),
      };
    },
  };
};
