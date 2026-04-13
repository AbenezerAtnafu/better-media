import rootConfig from "../../eslint.config.mjs";
import tseslint from "typescript-eslint";

export default tseslint.config(
  ...rootConfig,
  {
    files: ["**/*.ts", "**/*.tsx"],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // App Router + client components use hooks without explicit return types
      "@typescript-eslint/explicit-function-return-type": "off",
    },
  },
  {
    ignores: [".next/**", "node_modules/**", "eslint.config.mjs", "next-env.d.ts"],
  }
);
