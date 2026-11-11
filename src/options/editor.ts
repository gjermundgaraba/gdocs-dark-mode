import { paletteProblems } from "../theme/checks.ts";
import { samePalette } from "../theme/palette.ts";
import type { Palette, PaletteKey } from "../theme/palette.ts";
import { createTheme } from "../theme/theme.ts";
import type { Theme } from "../theme/theme.ts";

/** What the options page holds: the palette being edited and the saved one. */
export interface EditorState {
  readonly draft: Palette;
  readonly saved: Palette;
  /** Fields whose text is not a colour; the draft keeps their last colour. */
  readonly unreadable: ReadonlySet<PaletteKey>;
}

/** What the options page shows for an `EditorState`. */
export interface EditorView {
  /** The draft's theme, or `undefined` while it has errors. */
  readonly theme: Theme | undefined;
  readonly errors: readonly string[];
  readonly warnings: readonly string[];
  readonly canSave: boolean;
  readonly status: string;
}

const hexInput = /^#?(?<digits>[\da-f]{6})$/iu;

/** Reads a typed colour, `#rrggbb` or `rrggbb` in any case, as `#rrggbb`. */
export const readHexInput = (text: string): string | undefined => {
  const digits = hexInput.exec(text.trim())?.groups?.["digits"];

  return digits === undefined ? undefined : `#${digits.toLowerCase()}`;
};

const statusFor = (errors: number, changed: boolean): string => {
  if (errors > 0) {
    return "Fix the errors to save.";
  }

  return changed ? "Unsaved changes." : "No unsaved changes.";
};

export const viewEditor = (state: EditorState): EditorView => {
  const problems = paletteProblems(state.draft);

  const errors = [
    ...[...state.unreadable].map((key) => `${key} is not a #rrggbb colour.`),
    ...problems.errors,
  ];

  const changed = !samePalette(state.draft, state.saved);

  return {
    theme: problems.errors.length === 0 ? createTheme(state.draft) : undefined,
    errors,
    warnings: problems.warnings,
    canSave: errors.length === 0 && changed,
    status: statusFor(errors.length, changed),
  };
};
