import { Command } from "commander";
import chalk from "chalk";
import path from "node:path";
import process from "node:process";
import { existsSync } from "node:fs";
import { createInterface } from "node:readline/promises";
import { getAdapter, getMigrations, type MigrationOptions, type SqlDialect } from "better-media";
import { loadProjectConfig } from "../project-config";
import { migrateWithAdapter } from "../generators";

export function registerMigrateCommand(program: Command): void {
  program
    .command("migrate")
    .description("Apply Better Media schema directly to the database (Kysely adapter only)")
    .option("-C, --cwd <path>", "Working directory to resolve config from", process.cwd())
    .option("--config <path>", "Path to media config file")
    .option("--mode <mode>", "Migration mode (safe|diff|force)", "diff")
    .option("-y, --yes", "Automatically accept and run migrations without prompting", false)
    .option("--y", "(deprecated) same as --yes", false)
    .option(
      "--dialect <dialect>",
      "SQL dialect override (postgres|mysql|sqlite|mssql). Defaults from adapter/config.",
      undefined
    )
    .action(async (opts: unknown) => {
      const parsed = opts as {
        cwd?: string;
        config?: string;
        mode?: MigrationOptions["mode"];
        dialect?: SqlDialect;
        y?: boolean;
        yes?: boolean;
      };
      const options = {
        cwd: parsed.cwd ?? process.cwd(),
        config: parsed.config,
        mode: parsed.mode ?? "diff",
        dialect: parsed.dialect,
        y: Boolean(parsed.y),
        yes: Boolean(parsed.yes),
      };
      if (!["safe", "diff", "force"].includes(options.mode)) {
        throw new Error(`[media] Invalid --mode "${String(options.mode)}". Use safe|diff|force.`);
      }
      if (options.dialect && !["postgres", "mysql", "sqlite", "mssql"].includes(options.dialect)) {
        throw new Error(
          `[media] Invalid --dialect "${String(options.dialect)}". Use postgres|mysql|sqlite|mssql.`
        );
      }

      const cwd = path.resolve(options.cwd);
      if (!existsSync(cwd)) {
        console.error(`[media] The directory "${cwd}" does not exist.`);
        process.exit(1);
      }

      const loaded = await loadProjectConfig({ cwd, configPath: options.config });
      const adapter = await getAdapter(loaded.config);

      const dialectFromAdapter =
        typeof (adapter as unknown as { __getDialect?: () => SqlDialect }).__getDialect ===
        "function"
          ? (adapter as unknown as { __getDialect: () => SqlDialect }).__getDialect()
          : undefined;
      const dialect =
        options.dialect ?? (loaded.config.dialect as SqlDialect | undefined) ?? dialectFromAdapter;

      if (options.y) {
        console.warn("[media] WARNING: --y is deprecated. Use -y or --yes.");
        options.yes = true;
      }

      const planned = await getMigrations(adapter, { mode: options.mode, dialect });
      if (!planned.operations.length) {
        console.log("No migrations needed.");
        process.exit(0);
      }

      console.log("[media] The migration will affect the following:");
      for (const table of [...planned.toBeCreated, ...planned.toBeAdded]) {
        console.log(
          "->",
          chalk.magenta(table.fields.join(", ")),
          chalk.white("fields on"),
          chalk.yellow(table.table),
          chalk.white("table.")
        );
      }

      let shouldMigrate = options.yes ?? false;
      if (!shouldMigrate) {
        const rl = createInterface({ input: process.stdin, output: process.stdout });
        const answer = await rl.question("Are you sure you want to run these migrations? (y/N) ");
        rl.close();
        shouldMigrate = /^y(es)?$/i.test(answer.trim());
      }

      if (!shouldMigrate) {
        console.log("Migration cancelled.");
        process.exit(0);
      }

      try {
        await migrateWithAdapter({ adapter, mode: options.mode, dialect });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (loaded.adapterHint === "prisma" || loaded.adapterHint === "drizzle") {
          console.error(message);
          process.exit(0);
        }
        throw error;
      }
      console.log("Migration completed successfully.");
    });
}
