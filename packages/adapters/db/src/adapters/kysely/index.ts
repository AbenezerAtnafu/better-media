export * from "./kysely-db-config.interface";
export * from "./kysely-db.adapter";

import { KyselyDbAdapter, type KyselyDbOptions, type DbSchema } from "./kysely-db.adapter";
import type { DatabaseAdapter } from "@better-media/core";
import type { Kysely } from "kysely";

export function kyselyAdapter(db: Kysely<DbSchema>, options: KyselyDbOptions): DatabaseAdapter {
  const adapter = new KyselyDbAdapter(db, options);
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
