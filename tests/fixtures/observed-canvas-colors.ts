import type { Role } from "../../src/remap/remap.ts";

export interface ObservedColor {
  readonly css: string;
  readonly role: Role;
  /** Where it was seen: what it was drawing. */
  readonly seen: string;
}

/**
 * Colours seen on live Docs page canvases, as the diagnostics report lists
 * them. When a Docs update introduces a colour, add it here with the role it
 * was drawn in, so the remapper is tested against what Docs actually draws.
 */
export const observedCanvasColors: readonly ObservedColor[] = [
  { css: "#ffffff", role: "paper", seen: "page background" },
  { css: "#000000", role: "ink", seen: "body text and underlines" },
  { css: "#1155cc", role: "ink", seen: "link text and underline" },
  { css: "#980000", role: "ink", seen: "dark red text" },
  { css: "#000099", role: "ink", seen: "dark blue text" },
  { css: "#4374b7", role: "ink", seen: "blue text" },
  { css: "#f2f2f2", role: "paper", seen: "table cell shading" },
  { css: "#cccccc", role: "ink", seen: "table borders (strokeRect)" },
  { css: "rgba(78, 143, 248, 0.5)", role: "paper", seen: "text selection" },
];
