import { config } from "@clanker-stuff/oxlint-config";

export default config({
  overrides: [
    {
      files: ["src/page/canvas-hook.ts", "src/page/diagnostics.ts"],
      rules: { "typescript/unbound-method": "off" },
    },
  ],
});
