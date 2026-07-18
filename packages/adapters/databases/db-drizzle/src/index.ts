import { DrizzleDbAdapter, type DrizzleDbOptions } from "./drizzle-db.adapter";
import type { DrizzleDb } from "./drizzle-db-config.interface";
import type { DatabaseAdapter } from "@better-media/core";

export * from "./drizzle-db-config.interface";
export * from "./drizzle-db.adapter";

export function drizzleAdapter(db: DrizzleDb, options: DrizzleDbOptions): DatabaseAdapter {
  const adapter = new DrizzleDbAdapter(db, options);
  return new Proxy(adapter, {
    get(target, prop, receiver) {
      if (prop === "get") {
        return async (key: string) =>
          adapter.findOne({ model: "legacy", where: [{ field: "id", value: key }] });
      }
      if (prop === "put") {
        return async (key: string, data: Record<string, unknown>) =>
          adapter.create({ model: "legacy", data: { id: key, ...data } });
      }
      if (prop === "delete") {
        return async (key: string) =>
          adapter.delete({ model: "legacy", where: [{ field: "id", value: key }] });
      }
      return Reflect.get(target, prop, receiver);
    },
  });
}
