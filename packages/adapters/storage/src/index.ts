import type { StorageAdapter } from "@better-media/core";

/**
 * In-memory storage adapter for development/testing.
 * Data is lost when the process exits.
 */
export function memoryStorage(): StorageAdapter {
  const store = new Map<string, Buffer>();

  return {
    async get(key: string) {
      return store.get(key) ?? null;
    },
    async put(key: string, value: Buffer) {
      store.set(key, value);
    },
    async delete(key: string) {
      store.delete(key);
    },
  };
}
