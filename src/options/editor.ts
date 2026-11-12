import { isHexColor } from "../color/color.ts";
import { reviewPalette } from "../theme/checks.ts";
import { samePalette } from "../theme/palette.ts";
import type { Palette, PaletteKey } from "../theme/palette.ts";
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

/** Reads a typed colour, `#rrggbb` or `rrggbb` in any case, as `#rrggbb`. */
export const readHexInput = (text: string): string | undefined => {
  const trimmed = text.trim();
  const hex = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;

  return isHexColor(hex) ? hex.toLowerCase() : undefined;
};

const statusFor = (errors: number, changed: boolean): string => {
  if (errors > 0) {
    return "Fix the errors to save.";
  }

  return changed ? "Unsaved changes." : "No unsaved changes.";
};

export const viewEditor = (state: EditorState): EditorView => {
  const review = reviewPalette(state.draft);

  const errors = [
    ...[...state.unreadable].map((key) => `${key} is not a #rrggbb colour.`),
    ...review.errors,
  ];

  const changed = !samePalette(state.draft, state.saved);

  return {
    theme: review.theme,
    errors,
    warnings: review.warnings,
    canSave: errors.length === 0 && changed,
    status: statusFor(errors.length, changed),
  };
};
