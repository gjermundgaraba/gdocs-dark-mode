import { readPalette } from "../settings/settings.ts";
import { offerPalette } from "./palette-handoff.ts";

readPalette()
  .then(offerPalette)
  .catch((error: unknown) => {
    console.error("gdocs-dark-mode: could not read the saved palette", error);
  });
