import type { DatabaseAdapter } from "@better-media/core";
import { schema } from "./schema";
import type { ModelDefinition } from "./types";

interface MigratableKyselyAdapter extends DatabaseAdapter {
  __createTable(
    model: string,
    definition: ModelDefinition,
    options: { mode: "safe" | "diff" | "force" }
  ): Promise<void>;
}

interface MigratableMongoAdapter extends DatabaseAdapter {
  __initCollection(
    model: string,
    definition: ModelDefinition,
    options: { mode: "safe" | "diff" | "force" }
  ): Promise<void>;
}

export interface MigrationOptions {
  /**
   * Migration mode:
   * - 'safe': Only create missing tables/collections and add missing columns/indexes.
   * - 'diff': Not yet implemented (requires engine-specific introspection).
   * - 'force': Drop and recreate all tables/collections (destructive).
   */
  mode?: "safe" | "diff" | "force";
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

  // Check if this adapter supports migrations
  if (
    "__createTable" in adapter &&
    typeof (adapter as Record<string, unknown>).__createTable === "function"
  ) {
    // Kysely / SQL adapter
    for (const [model, definition] of Object.entries(schema)) {
      await (adapter as MigratableKyselyAdapter).__createTable(model, definition, { mode });
    }
  } else if (
    "__initCollection" in adapter &&
    typeof (adapter as Record<string, unknown>).__initCollection === "function"
  ) {
    // MongoDB adapter
    for (const [model, definition] of Object.entries(schema)) {
      await (adapter as MigratableMongoAdapter).__initCollection(model, definition, { mode });
    }
  } else {
    console.warn("[BetterMedia] Adapter does not support automatic migrations.");
  }
}
