import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import type { GetAdapterOptions } from "better-media";
import ts from "typescript";

export type AdapterHint = "kysely" | "prisma" | "drizzle" | "unknown";

export type ProjectConfig = GetAdapterOptions & {
  dialect?: string;
  schemaOutput?: string;
  migrationsDir?: string;
};

export type LoadedProjectConfig = {
  configPath: string;
  adapterHint: AdapterHint;
  config: ProjectConfig;
};

async function fileExists(p: string): Promise<boolean> {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function detectAdapterHint(cwd: string): Promise<AdapterHint> {
  try {
    const pkgPath = path.join(cwd, "package.json");
    const raw = await fs.readFile(pkgPath, "utf8");
    const pkg = JSON.parse(raw) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      peerDependencies?: Record<string, string>;
    };
    const deps = {
      ...(pkg.dependencies ?? {}),
      ...(pkg.devDependencies ?? {}),
      ...(pkg.peerDependencies ?? {}),
    };
    if ("kysely" in deps) return "kysely";
    if ("prisma" in deps || "@prisma/client" in deps) return "prisma";
    if ("drizzle-orm" in deps) return "drizzle";
    return "unknown";
  } catch {
    return "unknown";
  }
}

function normalizeModuleExport(mod: unknown): unknown {
  if (!mod) return mod;
  const m = mod as Record<string, unknown>;
  return (m.default ?? mod) as unknown;
}

async function importJsModule(absPath: string): Promise<unknown> {
  const url = pathToFileURL(absPath).href;
  const mod = await import(url);
  return normalizeModuleExport(mod);
}

async function requireTsModule(absPath: string): Promise<unknown> {
  const require = createRequire(import.meta.url);

  try {
    const tsNode = require("ts-node") as {
      register: (opts?: {
        transpileOnly?: boolean;
        compilerOptions?: Record<string, unknown>;
      }) => void;
    };
    tsNode.register({
      transpileOnly: true,
      compilerOptions: { module: "CommonJS", moduleResolution: "Node" },
    });
  } catch {
    // ignore (we'll surface a clearer error below if require fails)
  }

  const mod = require(absPath) as unknown;
  return normalizeModuleExport(mod);
}

async function importTsModule(absPath: string): Promise<unknown> {
  const source = await fs.readFile(absPath, "utf8");
  const transpiled = ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      moduleResolution: ts.ModuleResolutionKind.Bundler,
      esModuleInterop: true,
      resolveJsonModule: true,
    },
    fileName: absPath,
  });

  // Emit beside source so relative imports keep working.
  const tempPath = path.join(path.dirname(absPath), `.media-config-${randomUUID()}.mjs`);
  await fs.writeFile(tempPath, transpiled.outputText, "utf8");

  try {
    const mod = await import(pathToFileURL(tempPath).href);
    return normalizeModuleExport(mod);
  } finally {
    await fs.unlink(tempPath).catch(() => undefined);
  }
}

function assertValidConfig(
  value: unknown,
  configPath: string
): asserts value is Record<string, unknown> {
  if (!value || typeof value !== "object") {
    throw new Error(`[media] Config "${configPath}" must export an object.`);
  }
}

const CONFIG_CANDIDATES = [
  "media.config.ts",
  "media.config.js",
  "better-media.config.ts",
  "better-media.config.js",
] as const;

export async function loadProjectConfig(options?: {
  cwd?: string;
  configPath?: string;
}): Promise<LoadedProjectConfig> {
  const cwd = path.resolve(options?.cwd ?? process.cwd());

  let configPath = options?.configPath ? path.resolve(cwd, options.configPath) : undefined;

  if (configPath && !(await fileExists(configPath))) {
    throw new Error(`[media] Config file not found: ${path.relative(cwd, configPath)}`);
  }

  if (!configPath) {
    for (const candidate of CONFIG_CANDIDATES) {
      const abs = path.join(cwd, candidate);

      if (await fileExists(abs)) {
        configPath = abs;
        break;
      }
    }
    if (!configPath) {
      throw new Error(
        `[media] No configuration file found. Add one of: ${CONFIG_CANDIDATES.map(
          (c) => `"${c}"`
        ).join(", ")}, or pass --config <path>.`
      );
    }
  }

  if (!configPath) {
    throw new Error(
      `[media] No configuration file found. Add one of: ${CONFIG_CANDIDATES.map(
        (c) => `"${c}"`
      ).join(", ")}, or pass --config <path>.`
    );
  }

  const adapterHint = await detectAdapterHint(cwd);
  const ext = path.extname(configPath);

  let rawConfig: unknown;
  try {
    rawConfig =
      ext === ".ts" ? await requireTsModule(configPath) : await importJsModule(configPath);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (ext === ".ts") {
      try {
        rawConfig = await importTsModule(configPath);
      } catch {
        throw new Error(
          `[media] Failed to load "${path.basename(
            configPath
          )}". For TypeScript configs, install "ts-node" in your app or use a .js config. Original error: ${msg}`
        );
      }
    } else {
      throw err;
    }
  }

  assertValidConfig(rawConfig, configPath);

  const cfg = rawConfig as Record<string, unknown>;
  const dialect = typeof cfg.dialect === "string" ? (cfg.dialect as string) : undefined;
  const schemaOutput =
    typeof cfg.schemaOutput === "string" ? (cfg.schemaOutput as string) : undefined;
  const migrationsDir =
    typeof cfg.migrationsDir === "string" ? (cfg.migrationsDir as string) : undefined;

  return {
    configPath,
    adapterHint,
    config: {
      database: cfg.database as ProjectConfig["database"],
      createDatabase: cfg.createDatabase as ProjectConfig["createDatabase"],
      dialect,
      schemaOutput,
      migrationsDir,
    },
  };
}
