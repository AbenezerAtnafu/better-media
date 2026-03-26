import path from "node:path";
import fs from "fs-extra";
import chalk from "chalk";
import {
  schema,
  generateCreateSchemaSql,
  getMigrations,
  type SqlDialect,
  type MigrationOptions,
} from "better-media";
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

const builtInGenerators: Record<string, GenerateFn> = {
  async kysely({ cwd, outPath, dialect, adapter }) {
    await fs.ensureDir(path.dirname(outPath));
    let sql: string;
    try {
      const planned = await getMigrations(adapter, { dialect });
      sql = planned.compileMigrations();
    } catch {
      sql = generateCreateSchemaSql({ schema, dialect });
    }
    await fs.writeFile(outPath, sql, "utf8");
    console.log(chalk.green(`[media] Generated schema at ${path.relative(cwd, outPath)}`));
  },
  async postgres(args) {
    await builtInGenerators.kysely(args);
  },
  async prisma() {
    throw new Error(
      '[media] Prisma schema generator is not implemented yet. Run "npx media@latest generate" with Kysely, then apply via Prisma migrate/push.'
    );
  },
  async drizzle() {
    throw new Error(
      '[media] Drizzle schema generator is not implemented yet. Run "npx media@latest generate" with Kysely, then apply via Drizzle migrate/push.'
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
    await builtInMigrators.kysely(args);
  },
  async prisma() {
    throw new Error(
      '[media] The migrate command only works with the built-in Kysely adapter. For Prisma, run "npx media@latest generate" and apply with Prisma migrate/push.'
    );
  },
  async drizzle() {
    throw new Error(
      '[media] The migrate command only works with the built-in Kysely adapter. For Drizzle, run "npx media@latest generate" and apply with Drizzle migrate/push.'
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
    await builtInMigrators.kysely(args);
    return;
  }

  throw new Error(`[media] Direct migrations are not supported for adapter "${id ?? "unknown"}".`);
}
