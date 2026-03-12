import { Readable } from "node:stream";
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
    async getSize(key: string) {
      const buf = store.get(key);
      return buf != null ? buf.length : null;
    },
    async getStream(key: string) {
      const buf = store.get(key);
      if (buf == null) return null;
      return Readable.toWeb(Readable.from(buf)) as unknown as ReadableStream<Uint8Array>;
    },
  };
}
