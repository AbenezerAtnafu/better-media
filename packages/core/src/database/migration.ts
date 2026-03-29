import type { DatabaseAdapter } from "./interfaces/adapter.interface";
import { schema } from "./schema";
import type { ModelDefinition, TableMetadata, MigrationOperation, SqlDialect } from "./types";
import { MigrationPlanner } from "./plan";
import { compileMigrationOperationsSql } from "./sql";

/**
 * Internal interface used only by runMigrations. Adapter authors do NOT need to
 * declare or implement this — the migration engine discovers these methods via
 * duck-typing at runtime. Prefix `__` signals framework-internal use.
 */
interface MigratableAdapter extends DatabaseAdapter {
  __getMetadata?(): Promise<TableMetadata[]>;
  __executeMigration?(operation: MigrationOperation): Promise<void>;
  __getDialect?(): SqlDialect;
  // Legacy fallback paths
  __createTable?(
    model: string,
    definition: ModelDefinition,
    options: { mode: "safe" | "diff" | "force" }
  ): Promise<void>;
  __initCollection?(
    model: string,
    definition: ModelDefinition,
    options: { mode: "safe" | "diff" | "force" }
  ): Promise<void>;
}

export interface MigrationOptions {
  /**
   * Migration mode:
   * - 'safe': Only create missing tables/collections and add missing columns/indexes.
   * - 'diff': Full schema comparison and incremental updates (Recommended).
   * - 'force': Drop and recreate all tables/collections (destructive).
   */
  mode?: "safe" | "diff" | "force";
  /**
   * For SQL adapters, the dialect can be manually specified.
   * If omitted, the adapter will try to detect it.
   */
  dialect?: SqlDialect;
}

export interface PlannedMigrationTable {
  table: string;
  fields: string[];
}

export interface PlannedMigrations {
  toBeCreated: PlannedMigrationTable[];
  toBeAdded: PlannedMigrationTable[];
  operations: MigrationOperation[];
  compileMigrations: () => string;
  runMigrations: () => Promise<void>;
}

export async function getMigrations(
  adapter: DatabaseAdapter,
  options: MigrationOptions = {}
): Promise<PlannedMigrations> {
  const migratable = adapter as MigratableAdapter;

  if (
    typeof migratable.__getMetadata !== "function" ||
    typeof migratable.__executeMigration !== "function"
  ) {
    return {
      toBeCreated: [],
      toBeAdded: [],
      operations: [],
      compileMigrations: () => "",
      runMigrations: async () => {
        throw new Error("[BetterMedia] Adapter does not support planned migrations.");
      },
    };
  }

  let dialect = options.dialect;
  if (!dialect && typeof migratable.__getDialect === "function") {
    dialect = migratable.__getDialect();
  }
  const resolvedDialect = dialect || "postgres";
  const metadata = await migratable.__getMetadata();
  const planner = new MigrationPlanner(resolvedDialect);
  const operations = planner.plan(schema, metadata);

  const toBeCreated = operations
    .filter(
      (op): op is Extract<MigrationOperation, { type: "createTable" }> => op.type === "createTable"
    )
    .map((op) => ({ table: op.table, fields: Object.keys(op.definition.fields) }));

  const toBeAdded = operations
    .filter(
      (op): op is Extract<MigrationOperation, { type: "addColumn" }> => op.type === "addColumn"
    )
    .reduce<PlannedMigrationTable[]>((acc, op) => {
      const existing = acc.find((t) => t.table === op.table);
      if (existing) existing.fields.push(op.field);
      else acc.push({ table: op.table, fields: [op.field] });
      return acc;
    }, []);

  return {
    toBeCreated,
    toBeAdded,
    operations,
    compileMigrations: () =>
      compileMigrationOperationsSql({ operations, dialect: resolvedDialect }),
    runMigrations: async () => {
      for (const op of operations) {
        await migratable.__executeMigration!(op);
      }
    },
  };
}

/**
 * Migration engine. It iterates through the central BmSchema and invokes
 * engine-specific setup commands on the adapter.
 */
export async function runMigrations(
  adapter: DatabaseAdapter,
  options: MigrationOptions = {}
): Promise<void> {
  const mode = options.mode ?? "safe";
  const migratable = adapter as MigratableAdapter;

  // Preferred path: adapter exposes __getMetadata + __executeMigration
  if (
    typeof migratable.__getMetadata === "function" &&
    typeof migratable.__executeMigration === "function"
  ) {
    console.log("[BetterMedia] Starting planned migration...");

    const { operations, runMigrations: runPlannedMigrations } = await getMigrations(
      adapter,
      options
    );

    if (operations.length === 0) {
      console.log("[BetterMedia] Database is up to date.");
      return;
    }

    console.log(`[BetterMedia] Plan: ${operations.length} operation(s) to execute.`);
    await runPlannedMigrations();
    console.log("[BetterMedia] Migration completed successfully.");
    return;
  }

  // Legacy fallback for MongoDB or unrefactored adapters
  if (typeof migratable.__createTable === "function") {
    // Kysely / SQL adapter (Legacy)
    for (const [model, definition] of Object.entries(schema)) {
      await migratable.__createTable(model, definition, { mode });
    }
  } else if (typeof migratable.__initCollection === "function") {
    // MongoDB adapter
    for (const [model, definition] of Object.entries(schema)) {
      await migratable.__initCollection(model, definition, { mode });
    }
  } else {
    console.warn("[BetterMedia] Adapter does not support automatic migrations.");
  }
}
