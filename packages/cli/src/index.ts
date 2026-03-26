import { Command } from "commander";
import chalk from "chalk";
import path from "node:path";
import process from "node:process";
import { loadProjectConfig } from "./project-config";
import { registerGenerateCommand } from "./commands/generate";
import { registerInitCommand } from "./commands/init";
import { registerMigrateCommand } from "./commands/migrate";

const program = new Command();

program.name("media").description("CLI for Better Media framework").version("1.0.0");

registerInitCommand(program);

registerGenerateCommand(program);
registerMigrateCommand(program);

program
  .command("config")
  .description("Validate and print resolved module exports (debug)")
  .option("-C, --cwd <path>", "Working directory to resolve config from", process.cwd())
  .option("--config <path>", "Path to media config file")
  .action(async (opts: { cwd: string; config?: string }) => {
    const cwd = path.resolve(opts.cwd);
    const loaded = await loadProjectConfig({ cwd, configPath: opts.config });
    console.log(
      chalk.gray("[media] Resolved config:"),
      JSON.stringify(
        {
          configPath: loaded.configPath,
          adapterHint: loaded.adapterHint,
          dialect: loaded.config.dialect,
          schemaOutput: loaded.config.schemaOutput,
        },
        null,
        2
      )
    );
  });

program.parse(process.argv);
