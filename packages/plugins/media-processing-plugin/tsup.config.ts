import { defineConfig } from "tsup";
import { baseConfig } from "../../../tsup.config.base";

export default defineConfig({
  ...baseConfig,
  /** Sharp is loaded via dynamic `import()` at runtime; never bundle it. */
  external: ["sharp"],
});
