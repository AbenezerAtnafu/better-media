export * from "./memory-db.adapter";

import { MemoryDbAdapter } from "./memory-db.adapter";
import type { DatabaseAdapter } from "@better-media/core";

export function memoryDatabase(): DatabaseAdapter {
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
