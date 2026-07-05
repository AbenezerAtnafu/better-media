import { defineConfig } from "tsup";
import { baseConfig } from "../../../tsup.config.base";

// file-type is ESM-only. For CJS output we must bundle it (no require() of ESM).
// For ESM output we leave it external — Node's native ESM handles the CJS transitive
// deps (debug → require("tty")) correctly without a bundled shim.
export default defineConfig([
  {
    ...baseConfig,
    format: ["cjs"],
    noExternal: ["file-type"],
  },
  {
    ...baseConfig,
    format: ["esm"],
  },
]);
