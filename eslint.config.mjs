// @ts-check Let TS check this config file

import zotero from "@zotero-plugin/eslint-config";

export default zotero({
  ignores: ["AI Tag Suggester for Zotero.js"],
  overrides: [
    {
      files: ["**/*.ts"],
      rules: {
        // Zotero hook signatures include framework-provided parameters that
        // are intentionally unused in several lifecycle handlers.
        "@typescript-eslint/no-unused-vars": [
          "error",
          {
            argsIgnorePattern: "^_",
            caughtErrorsIgnorePattern: "^_",
            varsIgnorePattern: "^_",
          },
        ],
      },
    },
  ],
});
