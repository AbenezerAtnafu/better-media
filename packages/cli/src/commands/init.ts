import { Command } from "commander";
import path from "node:path";
import process from "node:process";
import fs from "fs-extra";

type DetectedFramework = "express" | "nestjs" | "unknown";

function detectFramework(pkg: {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}): DetectedFramework {
  const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
  if ("@nestjs/core" in deps || "@nestjs/common" in deps) return "nestjs";
  if ("express" in deps) return "express";
  return "unknown";
}

function inferExtension(cwd: string, framework: DetectedFramework, pkgType?: string): "ts" | "js" {
  if (framework === "nestjs") return "ts";
  if (pkgType === "module") return "js";
  return "ts";
}

function buildConfigContent(ext: "ts" | "js"): string {
  const importPool = ext === "ts" ? 'import { Pool } from "pg";' : 'import { Pool } from "pg";';
  return `${importPool}

export const mediaOptions = {
  database: new Pool({
    connectionString:
      process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/better_media",
  }),
  dialect: "postgres",
  schemaOutput: "better-media/schema.sql",
};

export default mediaOptions;
`;
}

export function registerInitCommand(program: Command): void {
  program
    .command("init")
    .description("Generate media.config.ts/js based on detected framework")
    .option("-C, --cwd <path>", "Working directory", process.cwd())
    .option("-f, --force", "Overwrite existing config file", false)
    .action(async (opts: { cwd: string; force?: boolean }) => {
      const cwd = path.resolve(opts.cwd);
      const pkgPath = path.join(cwd, "package.json");
      if (!(await fs.pathExists(pkgPath))) {
        throw new Error(`[media] No package.json found in ${cwd}`);
      }

      const pkg = (await fs.readJson(pkgPath)) as {
        type?: string;
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };

      const framework = detectFramework(pkg);
      const ext = inferExtension(cwd, framework, pkg.type);
      const configFile = path.join(cwd, `media.config.${ext}`);

      if ((await fs.pathExists(configFile)) && !opts.force) {
        throw new Error(
          `[media] ${path.basename(configFile)} already exists. Re-run with --force to overwrite.`
        );
      }

      const content = buildConfigContent(ext);
      await fs.writeFile(configFile, content, "utf8");

      const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
      if (!("pg" in deps)) {
        console.warn('[media] Added config uses "pg". Install it with: pnpm add pg');
      }

      console.log(
        `[media] Created ${path.basename(configFile)} (${framework === "unknown" ? "generic" : framework} template)`
      );
    });
}
