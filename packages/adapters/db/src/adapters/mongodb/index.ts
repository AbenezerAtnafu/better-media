export * from "./mongodb-db-config.interface";
export * from "./mongodb-db.adapter";

import { MongoDbAdapter, type MongoDbOptions } from "./mongodb-db.adapter";
import type { DatabaseAdapter } from "@better-media/core";
import type { MongoClient } from "mongodb";

export function mongodbAdapter(client: MongoClient, options: MongoDbOptions): DatabaseAdapter {
  const adapter = new MongoDbAdapter(client, options);
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
