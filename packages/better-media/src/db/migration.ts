import type { DatabaseAdapter } from "@better-media/core";
import { schema } from "./schema";
import type { ModelDefinition, TableMetadata, MigrationOperation, SqlDialect } from "./types";
import { MigrationPlanner } from "./plan";

interface MigratableAdapter extends DatabaseAdapter {
  getMetadata(): Promise<TableMetadata[]>;
  executeMigration(operation: MigrationOperation): Promise<void>;
  __getDialect?(): SqlDialect;
  // Legacy / Mono-adapter fallback
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

  // New robust SQL migration path
  if (
    typeof migratable.getMetadata === "function" &&
    typeof migratable.executeMigration === "function"
  ) {
    console.log("[BetterMedia] Starting planned migration...");

    let dialect = options.dialect;
    if (!dialect && typeof migratable.__getDialect === "function") {
      dialect = migratable.__getDialect();
    }
    // Default to postgres if we can't detect, but KyselyDbAdapter now has it.
    const resolvedDialect = dialect || "postgres";

    const metadata = await migratable.getMetadata();
    const planner = new MigrationPlanner(resolvedDialect);

    if (mode === "force") {
      // For force mode, we still use the planner but we might want to drop tables first.
      // The old adapter __createTable handles 'force' at the table level.
      // To keep it simple for now, we'll iterate and use legacy force if available.
    }

    const operations = planner.plan(schema, metadata);

    if (operations.length === 0) {
      console.log("[BetterMedia] Database is up to date.");
      return;
    }

    console.log(`[BetterMedia] Plan: ${operations.length} operation(s) to execute.`);
    for (const op of operations) {
      await migratable.executeMigration(op);
    }
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
