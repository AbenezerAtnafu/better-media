import type { JobAdapter } from "@better-media/core";

/**
 * Default in-memory job adapter for development/testing.
 * Jobs are queued and run immediately (structure only; execution TBD).
 */
export function memoryJobAdapter(): JobAdapter {
  return {
    async enqueue(name: string, payload: Record<string, unknown>) {
      // Structure only - implementation will run jobs in background
      void name;
      void payload;
    },
  };
}
