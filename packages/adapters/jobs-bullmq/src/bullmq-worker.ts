import { Worker } from "bullmq";
import type { ConnectionOptions, WorkerOptions, Job } from "bullmq";

export interface BullMQWorkerOptions {
  connection: ConnectionOptions;
  /** Queue name to consume. Must match the queueName used in bullmqJobAdapter(). Defaults to "better-media:background". */
  queueName?: string;
  /** Number of concurrent jobs. Defaults to 5. Lower this for CPU-intensive jobs like video processing. */
  concurrency?: number;
  /** Additional BullMQ WorkerOptions. connection, concurrency, and autorun are always controlled by this factory. */
  workerOptions?: Omit<WorkerOptions, "connection" | "concurrency" | "autorun">;
}

const DEFAULT_QUEUE_NAME = "better-media:background";
const DEFAULT_CONCURRENCY = 5;

/**
 * Creates and starts a BullMQ Worker that processes background jobs enqueued
 * by bullmqJobAdapter(). Run this from a dedicated worker process.
 *
 * @param processor - Async function that handles a single job payload.
 *   Wire this to `media.runBackgroundJob(payload as BackgroundJobPayload)`.
 * @returns The BullMQ Worker instance. Call worker.close() for graceful shutdown.
 *
 * @example
 * ```ts
 * const worker = createBullMQWorker(
 *   (payload) => media.runBackgroundJob(payload as BackgroundJobPayload),
 *   { connection: { host: "localhost", port: 6379 }, concurrency: 3 }
 * );
 *
 * process.on("SIGTERM", async () => { await worker.close(); process.exit(0); });
 * ```
 */
export function createBullMQWorker(
  processor: (payload: Record<string, unknown>) => Promise<void>,
  options: BullMQWorkerOptions
): Worker {
  const queueName = options.queueName ?? DEFAULT_QUEUE_NAME;
  const concurrency = options.concurrency ?? DEFAULT_CONCURRENCY;

  const worker = new Worker(
    queueName,
    async (job: Job) => {
      await processor(job.data as Record<string, unknown>);
    },
    {
      ...options.workerOptions,
      connection: options.connection,
      concurrency,
      autorun: true,
    }
  );

  worker.on("completed", (job: Job) => {
    console.log(`[better-media:worker] Job completed: ${job.id}`);
  });

  worker.on("failed", (job: Job | undefined, err: Error) => {
    console.error(`[better-media:worker] Job failed: ${job?.id}`, err.message);
  });

  worker.on("error", (err: Error) => {
    console.error("[better-media:worker] Worker error:", err.message);
  });

  return worker;
}
