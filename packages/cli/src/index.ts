import { Command } from "commander";
import chalk from "chalk";

const program = new Command();

program.name("better-media").description("CLI for Better Media framework").version("1.0.0");

program
  .command("init")
  .description("Initialize a new Better Media project")
  .action(() => {
    console.log(chalk.green("Initializing Better Media project..."));
  });

program.parse(process.argv);
