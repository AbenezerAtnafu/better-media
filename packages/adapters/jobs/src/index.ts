import type { JobAdapter } from "@better-media/core";

export interface MemoryJobAdapterOptions {
  /** When provided, jobs are run in-process via setImmediate (default for background plugins) */
  processor?: (payload: Record<string, unknown>) => Promise<void>;
}

/**
 * Default in-memory job adapter for development/testing.
 * When processor is provided, jobs run in-process via setImmediate.
 * When not provided, jobs are stored only (for manual worker polling).
 */
export function memoryJobAdapter(options?: MemoryJobAdapterOptions): JobAdapter {
  const processor = options?.processor;
  return {
    async enqueue(name: string, payload: Record<string, unknown>) {
      if (processor) {
        setImmediate(() => {
          void processor(payload);
        });
      }
      void name;
    },
  };
}
