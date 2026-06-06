/**
 * BullMQ Worker Process
 *
 * Run this in a separate process alongside the Express app when REDIS_URL is set:
 *   REDIS_HOST=localhost tsx src/worker.ts
 *
 * This process shares the same storage/database/plugins config as the app
 * but consumes background jobs from Redis instead of running them in-process.
 */
import { createBullMQWorker } from "@better-media/adapter-jobs-bullmq";
import type { BackgroundJobPayload } from "@better-media/framework";
import { media } from "../media.config";

const connection = {
  host: process.env.REDIS_HOST ?? "localhost",
  port: Number(process.env.REDIS_PORT ?? 6379),
};

const worker = createBullMQWorker(
  async (payload) => {
    await media.runBackgroundJob(payload as unknown as BackgroundJobPayload);
  },
  {
    connection,
    concurrency: Number(process.env.WORKER_CONCURRENCY ?? 5),
  }
);

console.log("[worker] BullMQ worker started. Waiting for jobs...");
console.log(`[worker] Redis: ${connection.host}:${connection.port}`);

async function shutdown(signal: string) {
  console.log(`[worker] ${signal} received — shutting down gracefully`);
  await worker.close();
  console.log("[worker] Shutdown complete");
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
