import { describe, expect, it } from "vite-plus/test";

import { readHexInput, viewEditor } from "../src/options/editor.ts";
import { defaultPalette } from "../src/theme/palette.ts";

const saved = defaultPalette;

describe("readHexInput", () => {
  it.each([
    ["#ABCDEF", "#abcdef"],
    ["abcdef", "#abcdef"],
    [" #123456 ", "#123456"],
    ["#12345", undefined],
    ["red", undefined],
  ])("reads %j as %j", (text, color) => {
    expect(readHexInput(text)).toBe(color);
  });
});

describe("viewEditor", () => {
  it("has nothing to save while the draft matches what is saved", () => {
    const view = viewEditor({ draft: saved, saved, unreadable: new Set() });

    expect(view.canSave).toBe(false);
    expect(view.theme).toBeDefined();
  });

  it("saves a changed, usable draft", () => {
    const view = viewEditor({
      draft: { ...saved, accent: "#5fafff" },
      saved,
      unreadable: new Set(),
    });

    expect(view.canSave).toBe(true);
    expect(view.status).toBe("Unsaved changes.");
  });

  it("refuses to save while a field is unreadable", () => {
    const view = viewEditor({
      draft: { ...saved, accent: "#5fafff" },
      saved,
      unreadable: new Set(["fg"]),
    });

    expect(view.canSave).toBe(false);
    expect(view.errors).toContain("fg is not a #rrggbb colour.");
  });

  it("has no theme for a draft with errors", () => {
    const view = viewEditor({
      draft: { ...saved, bg: "#ffffff", fg: "#000000" },
      saved,
      unreadable: new Set(),
    });

    expect(view.theme).toBeUndefined();
    expect(view.canSave).toBe(false);
  });
});
