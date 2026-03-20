import { defineConfig } from "tsup";
import { baseConfig } from "../../../tsup.config.base";

export default defineConfig({
  ...baseConfig,
  entry: ["src/index.ts", "src/adapters/kysely/index.ts", "src/adapters/mongodb/index.ts"],
});
