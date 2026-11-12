import { hueNames } from "@gjermundgaraba/gg-theme/derive";
import type { HueName } from "@gjermundgaraba/gg-theme/derive";

import { refreshMessage } from "../extension/messages.ts";
import { userScriptsAllowed } from "../extension/user-scripts.ts";
import {
  readPalette,
  resetPalette,
  writePalette,
} from "../settings/settings.ts";
import {
  defaultPalette,
  paletteFromTokensFile,
  paletteKeys,
  samePalette,
} from "../theme/palette.ts";
import type { Palette, PaletteKey } from "../theme/palette.ts";
import type { Theme } from "../theme/theme.ts";
import { readHexInput, viewEditor } from "./editor.ts";
import type { EditorState } from "./editor.ts";
import { pageStyle } from "./page-style.ts";

interface ColourField {
  readonly picker: HTMLInputElement;
  readonly text: HTMLInputElement;
  readonly sample: HTMLElement;
}

const required = <T extends Element>(
  selector: string,
  kind: abstract new () => T
): T => {
  const found = document.querySelector(selector);

  if (!(found instanceof kind)) {
    throw new TypeError(`options.html has no ${selector}`);
  }

  return found;
};

const describeError = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

const isHue = (key: PaletteKey): key is HueName =>
  hueNames.some((hue) => hue === key);

const createField = (key: PaletteKey, grid: HTMLElement): ColourField => {
  const label = document.createElement("label");
  const picker = document.createElement("input");
  const text = document.createElement("input");
  const sample = document.createElement("span");

  label.textContent = key;
  label.htmlFor = `colour-${key}`;
  picker.type = "color";
  picker.id = `colour-${key}`;
  picker.dataset["key"] = key;
  text.type = "text";
  text.spellcheck = false;
  text.ariaLabel = `${key} hex`;
  sample.className = "sample";
  grid.append(label, picker, text, sample);

  return { picker, text, sample };
};

const showList = (list: HTMLElement, items: readonly string[]): void => {
  list.replaceChildren(
    ...items.map((item) => {
      const entry = document.createElement("li");
      entry.textContent = item;

      return entry;
    })
  );
};

const applyPageStyle = (theme: Theme): void => {
  for (const [property, value] of Object.entries(pageStyle(theme))) {
    document.documentElement.style.setProperty(property, value);
  }
};

const showSample = (field: ColourField, theme: Theme, key: PaletteKey) => {
  if (!isHue(key)) {
    return;
  }

  const [soft, tint] = [theme[`soft-${key}`], theme[`tint-${key}`]];
  field.sample.textContent = `Aa ${soft} on ${tint}`;
  field.sample.style.color = soft;
  field.sample.style.background = tint;
};

const start = async (): Promise<void> => {
  const saved = await readPalette();
  let state: EditorState = { draft: saved, saved, unreadable: new Set() };

  const save = required("#save", HTMLButtonElement);
  const status = required("#status", HTMLElement);
  const errors = required("#errors", HTMLElement);
  const warnings = required("#warnings", HTMLElement);
  const importInput = required("#import", HTMLInputElement);
  const baseGrid = required("#base", HTMLElement);
  const hueGrid = required("#hues", HTMLElement);

  const fields = new Map(
    paletteKeys.map((key) => [
      key,
      createField(key, isHue(key) ? hueGrid : baseGrid),
    ])
  );

  const render = (notice?: string): void => {
    const view = viewEditor(state);

    for (const [key, field] of fields) {
      const unreadable = state.unreadable.has(key);
      field.picker.value = state.draft[key];
      field.text.ariaInvalid = String(unreadable);

      if (!unreadable && document.activeElement !== field.text) {
        field.text.value = state.draft[key];
      }

      if (view.theme !== undefined) {
        showSample(field, view.theme, key);
      }
    }

    if (view.theme !== undefined) {
      applyPageStyle(view.theme);
    }

    showList(errors, view.errors);
    showList(warnings, view.warnings);
    save.disabled = !view.canSave;
    status.textContent = notice ?? view.status;
  };

  const editDraft = (draft: Palette): void => {
    state = { ...state, draft, unreadable: new Set() };
    render();
  };

  const setColour = (key: PaletteKey, text: string): void => {
    const color = readHexInput(text);
    const unreadable = new Set(state.unreadable);

    if (color === undefined) {
      unreadable.add(key);
      state = { ...state, unreadable };
    } else {
      unreadable.delete(key);
      state = { ...state, draft: { ...state.draft, [key]: color }, unreadable };
    }

    render();
  };

  for (const [key, field] of fields) {
    field.picker.addEventListener("input", () => {
      setColour(key, field.picker.value);
    });
    field.text.addEventListener("input", () => {
      setColour(key, field.text.value);
    });
    field.text.addEventListener("change", () => {
      render();
    });
  }

  const importFile = async (file: File): Promise<void> => {
    const imported = paletteFromTokensFile(await file.text());

    if ("error" in imported) {
      render(`Not imported: ${imported.error}`);

      return;
    }

    editDraft(imported);
  };

  importInput.addEventListener("change", () => {
    const [file] = importInput.files ?? [];
    importInput.value = "";

    if (file !== undefined) {
      importFile(file).catch((error: unknown) => {
        render(`Not imported: ${describeError(error)}`);
      });
    }
  });

  required("#default", HTMLButtonElement).addEventListener("click", () => {
    editDraft(defaultPalette);
  });

  required("#revert", HTMLButtonElement).addEventListener("click", () => {
    editDraft(state.saved);
  });

  const saveDraft = async (): Promise<void> => {
    const { draft } = state;

    await (samePalette(draft, defaultPalette)
      ? resetPalette()
      : writePalette(draft));
    state = { ...state, saved: draft };
    render("Saved.");
  };

  save.addEventListener("click", () => {
    saveDraft().catch((error: unknown) => {
      render(`Not saved: ${describeError(error)}`);
    });
  });

  render();
};

const report = (error: unknown): void => {
  console.error("gdocs-dark-mode options:", error);
};

const blockedRecheckMs = 1000;

const showSetupUntilAllowed = async (): Promise<void> => {
  const allowed = await userScriptsAllowed();
  required("#setup", HTMLElement).hidden = allowed;

  if (allowed) {
    await chrome.runtime.sendMessage(refreshMessage);

    return;
  }

  setTimeout(() => {
    showSetupUntilAllowed().catch(report);
  }, blockedRecheckMs);
};

required("#open-details", HTMLButtonElement).addEventListener("click", () => {
  chrome.tabs
    .create({ url: `chrome://extensions/?id=${chrome.runtime.id}` })
    .catch(report);
});

showSetupUntilAllowed().catch(report);

start().catch(report);
