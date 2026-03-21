// Types and schemas are now exported from "better-media" directly.
export * from "./adapters/memory/memory-db.adapter";
export * from "./adapters/kysely/kysely-db.adapter";
export * from "./adapters/mongodb/mongodb-db.adapter";
export type { KyselyDbConfig } from "./adapters/kysely/kysely-db-config.interface";
export type { MongoDbConfig } from "./adapters/mongodb/mongodb-db-config.interface";

// Backwards compatibility for the old memoryDatabase export
import { MemoryDbAdapter } from "./adapters/memory/memory-db.adapter";
import type { DatabaseAdapter } from "@better-media/core";

export function memoryDatabase(): DatabaseAdapter {
  // Return a proxy that supports the new DatabaseAdapter interface + the old get/put methods
  // for the legacy adapters that haven't been migrated to the new schema-driven architecture yet.
  const adapter = new MemoryDbAdapter();
  return new Proxy(adapter, {
    get(target, prop, receiver) {
      if (prop === "get") {
        return async (key: string) => {
          const res = await adapter.findOne({
            model: "legacy",
            where: [{ field: "id", value: key }],
          });
          return res;
        };
      }
      if (prop === "put") {
        return async (key: string, data: Record<string, unknown>) => {
          await adapter.create({ model: "legacy", data: { id: key, ...data } });
        };
      }
      if (prop === "delete") {
        return async (key: string) => {
          await adapter.delete({ model: "legacy", where: [{ field: "id", value: key }] });
        };
      }
      return Reflect.get(target, prop, receiver);
    },
  });
}
