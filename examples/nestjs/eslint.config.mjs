import rootConfig from "../../eslint.config.mjs";
import tseslint from "typescript-eslint";
import prettierPlugin from "eslint-plugin-prettier/recommended";

export default tseslint.config(
  ...rootConfig,
  prettierPlugin,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/interface-name-prefix": "off",
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    ignores: ["eslint.config.mjs", "dist", "node_modules", "test"],
  }
);
