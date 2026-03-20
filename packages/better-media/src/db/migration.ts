import type { DatabaseAdapter } from "@better-media/core";
import { schema } from "./schema";

/**
 * Migration engine. It iterates through the central BmSchema and invokes
 * engine-specific DDL/setup commands on the adapter.
 *
 * It looks for a private `__createTable` or `__initCollection` method on
 * the adapter since the public `DatabaseAdapter` interface is just CRUD.
 */
export async function runMigrations(adapter: DatabaseAdapter): Promise<void> {
  // Check if this adapter supports migrations
  if ("__createTable" in adapter && typeof adapter.__createTable === "function") {
    // Kysely / SQL adapter
    for (const [model, definition] of Object.entries(schema)) {
      await adapter.__createTable(model, definition);
    }
  } else if ("__initCollection" in adapter && typeof adapter.__initCollection === "function") {
    // MongoDB adapter
    for (const [model, definition] of Object.entries(schema)) {
      await adapter.__initCollection(model, definition);
    }
  } else {
    // For MemoryDbAdapter or any custom adapter without migration support,
    // we log or simply do nothing.
    console.warn("[BetterMedia] Adapter does not support automatic migrations.");
  }
}
