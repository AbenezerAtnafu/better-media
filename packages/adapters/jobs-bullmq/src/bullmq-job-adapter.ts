import { Queue } from "bullmq";
import type { ConnectionOptions, JobsOptions } from "bullmq";
import type { JobAdapter } from "@better-media/core";

export interface BullMQJobAdapterOptions {
  connection: ConnectionOptions;
  /** Queue name to publish jobs to. Defaults to "better-media:background". */
  queueName?: string;
  /** Default BullMQ job options applied to every enqueued job. */
  defaultJobOptions?: JobsOptions;
}

const DEFAULT_QUEUE_NAME = "better-media:background";

/**
 * Creates a BullMQ-backed JobAdapter for use in the main application process.
 * Enqueues jobs to Redis; a separate worker process consumes them via createBullMQWorker().
 *
 * @example
 * ```ts
 * const media = createBetterMedia({
 *   jobs: bullmqJobAdapter({
 *     connection: { host: "localhost", port: 6379 },
 *     defaultJobOptions: { attempts: 3, backoff: { type: "exponential", delay: 1000 } },
 *   }),
 * });
 * ```
 */
export function bullmqJobAdapter(
  options: BullMQJobAdapterOptions
): JobAdapter & { close(): Promise<void> } {
  const queueName = options.queueName ?? DEFAULT_QUEUE_NAME;
  const queue = new Queue(queueName, {
    connection: options.connection,
    defaultJobOptions: options.defaultJobOptions,
  });

  return {
    async enqueue(name: string, payload: Record<string, unknown>): Promise<void> {
      await queue.add(name, payload, options.defaultJobOptions);
    },
    async close(): Promise<void> {
      await queue.close();
    },
  };
}
