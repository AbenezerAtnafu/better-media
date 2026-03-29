import path from "node:path";
import fs from "fs-extra";
import chalk from "chalk";
import {
  schema,
  getMigrations,
  MigrationPlanner,
  compileMigrationOperationsSql,
  type SqlDialect,
  type MigrationOptions,
  type TableMetadata,
  applyOperationsToMetadata,
} from "@better-media/core";
import type { DatabaseAdapter } from "@better-media/core";

type CustomSchemaResult = {
  code: string;
  fileName?: string;
  path?: string;
  overwrite?: boolean;
};

type AdapterWithExtras = DatabaseAdapter & {
  id?: string;
  createSchema?: (options: unknown, file?: string) => Promise<CustomSchemaResult>;
};

type GenerateFn = (args: {
  cwd: string;
  adapter: DatabaseAdapter;
  outPath: string;
  dialect: SqlDialect;
  options?: unknown;
}) => Promise<void>;

type MigrateFn = (args: {
  adapter: DatabaseAdapter;
  mode: MigrationOptions["mode"];
  dialect?: SqlDialect;
}) => Promise<void>;

function resolveMigrationsDir(cwd: string, outPath: string, options: unknown): string {
  const opts = options as { migrationsDir?: string } | undefined;
  if (opts?.migrationsDir && typeof opts.migrationsDir === "string") {
    return path.resolve(cwd, opts.migrationsDir);
  }
  return path.dirname(outPath);
}

/** Subfolders named with numeric timestamps (ms) contain `migration.sql` + `snapshot.json` per run. */
const TIMESTAMP_DIR = /^\d{10,20}$/;

async function findLatestTimestampRunDir(migrationsDir: string): Promise<string | undefined> {
  if (!(await fs.pathExists(migrationsDir))) return undefined;
  const entries = await fs.readdir(migrationsDir, { withFileTypes: true });
  const names = entries
    .filter((e) => e.isDirectory() && TIMESTAMP_DIR.test(e.name))
    .map((e) => e.name);
  const latest = names[0];
  return latest ? path.join(migrationsDir, latest) : undefined;
}

async function resolveSnapshotReadPath(migrationsDir: string): Promise<string | undefined> {
  const latestRun = await findLatestTimestampRunDir(migrationsDir);
  const nested = latestRun ? path.join(latestRun, "snapshot.json") : undefined;
  if (nested && (await fs.pathExists(nested))) return nested;
  const legacyRoot = path.join(migrationsDir, "snapshot.json");
  if (await fs.pathExists(legacyRoot)) return legacyRoot;
  return undefined;
}

const builtInGenerators: Record<string, GenerateFn> = {
  async kysely({ cwd, outPath, dialect, adapter, options }) {
    const migrationsDir = resolveMigrationsDir(cwd, outPath, options);
    await fs.ensureDir(migrationsDir);

    let currentTables: TableMetadata[] = [];
    let snapshotLoaded = false;

    const snapshotReadPath = await resolveSnapshotReadPath(migrationsDir);
    if (snapshotReadPath) {
      try {
        currentTables = await fs.readJson(snapshotReadPath);
        snapshotLoaded = true;
      } catch {
        console.warn(
          chalk.yellow(
            `[media] Failed to load snapshot at ${snapshotReadPath}, falling back to DB introspection.`
          )
        );
      }
    }

    if (!snapshotLoaded) {
      if (typeof (adapter as { __getMetadata?: unknown }).__getMetadata === "function") {
        currentTables = await (
          adapter as unknown as { __getMetadata: () => Promise<TableMetadata[]> }
        ).__getMetadata();
      }
    }

    const planner = new MigrationPlanner(dialect);
    const plannedOperations = planner.plan(schema, currentTables);

    if (plannedOperations.length === 0) {
      console.log(
        chalk.blue(`[media] No changes detected. Database/Snapshot is already up to date.`)
      );
      return;
    }

    const sql = compileMigrationOperationsSql({ operations: plannedOperations, dialect });

    const nextMetadata = applyOperationsToMetadata(currentTables, plannedOperations, dialect);
    const runTs = Date.now();
    const runDir = path.join(migrationsDir, String(runTs));
    await fs.ensureDir(runDir);

    const snapshotWritePath = path.join(runDir, "snapshot.json");
    await fs.writeJson(snapshotWritePath, nextMetadata, { spaces: 2 });

    const migrationFile = path.join(runDir, "migration.sql");
    await fs.writeFile(migrationFile, sql, "utf8");
    console.log(chalk.green(`[media] Generated migration at ${path.relative(cwd, migrationFile)}`));
  },
  async postgres(args) {
    const kysely = builtInGenerators.kysely;
    if (!kysely) throw new Error("Kysely generator not found");
    await kysely(args);
  },
  async prisma() {
    throw new Error(
      '[media] Prisma schema generator is not implemented yet. Run "npx better-media generate" with Kysely, then apply via Prisma migrate/push.'
    );
  },
  async drizzle() {
    throw new Error(
      '[media] Drizzle schema generator is not implemented yet. Run "npx better-media generate" with Kysely, then apply via Drizzle migrate/push.'
    );
  },
};

const builtInMigrators: Record<string, MigrateFn> = {
  async kysely({ mode, dialect, adapter }) {
    const hasPlannedMigration =
      typeof (adapter as { __getMetadata?: unknown }).__getMetadata === "function" &&
      typeof (adapter as { __executeMigration?: unknown }).__executeMigration === "function";

    if (!hasPlannedMigration) {
      throw new Error(
        `[media] This adapter does not support direct CLI migrations. ` +
          `Use "media generate" and apply via your ORM migration tool.`
      );
    }
    const planned = await getMigrations(adapter, { mode, dialect });
    await planned.runMigrations();
  },
  async postgres(args) {
    const kysely = builtInMigrators.kysely;
    if (!kysely) throw new Error("Kysely migrator not found");
    await kysely(args);
  },
  async prisma() {
    throw new Error(
      '[media] The migrate command only works with the built-in Kysely adapter. For Prisma, run "npx better-media generate" and apply with Prisma migrate/push.'
    );
  },
  async drizzle() {
    throw new Error(
      '[media] The migrate command only works with the built-in Kysely adapter. For Drizzle, run "npx better-media generate" and apply with Drizzle migrate/push.'
    );
  },
};

export async function generateSchema(args: {
  cwd: string;
  adapter: DatabaseAdapter;
  outPath: string;
  dialect: SqlDialect;
  options?: unknown;
}): Promise<void> {
  const adapterEx = args.adapter as AdapterWithExtras;
  const id = adapterEx.id;

  if (id && id in builtInGenerators) {
    await builtInGenerators[id]!(args);
    return;
  }

  if (typeof adapterEx.createSchema === "function") {
    const generated = await adapterEx.createSchema(args.options, args.outPath);
    const targetPath = generated.fileName ?? generated.path ?? args.outPath;
    const overwrite = generated.overwrite ?? true;
    if (!overwrite && (await fs.pathExists(targetPath))) {
      throw new Error(`[media] Refusing to overwrite existing file: ${targetPath}`);
    }
    await fs.ensureDir(path.dirname(targetPath));
    await fs.writeFile(targetPath, generated.code, "utf8");
    console.log(chalk.green(`[media] Generated schema at ${path.relative(args.cwd, targetPath)}`));
    return;
  }

  throw new Error(
    `[media] ${id ?? "adapter"} is not supported. If it is a custom adapter, implement createSchema(options, file).`
  );
}

export async function migrateWithAdapter(args: {
  adapter: DatabaseAdapter;
  mode: MigrationOptions["mode"];
  dialect?: SqlDialect;
}): Promise<void> {
  const adapterEx = args.adapter as AdapterWithExtras;
  const id = adapterEx.id;

  if (id && id in builtInMigrators) {
    await builtInMigrators[id]!(args);
    return;
  }

  if (
    typeof (args.adapter as { __getMetadata?: unknown }).__getMetadata === "function" &&
    typeof (args.adapter as { __executeMigration?: unknown }).__executeMigration === "function"
  ) {
    const kysely = builtInMigrators.kysely;
    if (!kysely) throw new Error("Kysely migrator not found");
    await kysely(args);
    return;
  }

  throw new Error(`[media] Direct migrations are not supported for adapter "${id ?? "unknown"}".`);
}
