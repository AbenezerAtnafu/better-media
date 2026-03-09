import type { DatabaseAdapter } from "@better-media/core";

/**
 * In-memory database adapter for development/testing.
 * Data is lost when the process exits.
 */
export function memoryDatabase(): DatabaseAdapter {
  const store = new Map<string, Record<string, unknown>>();

  return {
    async get(key: string) {
      return store.get(key) ?? null;
    },
    async put(key: string, data: Record<string, unknown>) {
      store.set(key, data);
    },
    async delete(key: string) {
      store.delete(key);
    },
  };
}
