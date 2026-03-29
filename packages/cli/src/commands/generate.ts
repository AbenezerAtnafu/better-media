import { Command } from "commander";
import path from "node:path";
import process from "node:process";
import { getAdapter, type SqlDialect } from "@better-media/core";
import { loadProjectConfig } from "../project-config";
import { generateSchema } from "../generators";

/** Default path whose directory is the migrations root (filename unused for output). */
function getDefaultSchemaOutput(): string {
  return "better-media-migrations/migration.sql";
}

export function registerGenerateCommand(program: Command): void {
  program
    .command("generate")
    .description("Generate Better Media database schema for the configured adapter")
    .option("-C, --cwd <path>", "Working directory to resolve config from", process.cwd())
    .option("--config <path>", "Path to media config file")
    .option(
      "--dialect <dialect>",
      "SQL dialect (postgres|mysql|sqlite|mssql). Defaults from adapter/config.",
      undefined
    )
    .action(async (opts: { cwd: string; config?: string; dialect?: SqlDialect }) => {
      const cwd = path.resolve(opts.cwd);
      const loaded = await loadProjectConfig({ cwd, configPath: opts.config });
      const adapter = await getAdapter(loaded.config);

      const dialectFromAdapter =
        typeof (adapter as unknown as { __getDialect?: () => SqlDialect }).__getDialect ===
        "function"
          ? (adapter as unknown as { __getDialect: () => SqlDialect }).__getDialect()
          : undefined;
      const dialect =
        opts.dialect ??
        (loaded.config.dialect as SqlDialect | undefined) ??
        dialectFromAdapter ??
        "postgres";

      const outPath = path.resolve(cwd, loaded.config.schemaOutput ?? getDefaultSchemaOutput());
      await generateSchema({
        cwd,
        adapter,
        outPath,
        dialect,
        options: loaded.config,
      });
    });
}
