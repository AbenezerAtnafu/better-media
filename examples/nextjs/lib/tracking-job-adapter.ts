import type { JobAdapter } from "@better-media/core";

/** Job stored for later processing */
export interface StoredJob {
  name: string;
  payload: Record<string, unknown>;
}

const jobs: StoredJob[] = [];

export function trackingJobAdapter(): JobAdapter {
  return {
    async enqueue(name: string, payload: Record<string, unknown>) {
      jobs.push({ name, payload });
    },
  };
}

export function getQueuedJobs(): StoredJob[] {
  return [...jobs];
}

export function clearQueuedJobs(): void {
  jobs.length = 0;
}
