import type { JobAdapter } from "@better-media/core";
import { memoryJobAdapter } from "@better-media/adapter-jobs";
import type { BetterMediaConfig } from "./config/config.interface";
import type { BetterMediaRuntime } from "./runtime/runtime.interface";
import { buildPluginRegistry, hasBackgroundHandlers } from "./plugins/plugin-registry";
import { LifecycleEngine } from "./core/lifecycle-engine";
import { PipelineExecutor } from "./core/pipeline-executor";
import { runBackgroundJob } from "./jobs/job-runner";
import type { BackgroundJobPayload } from "./core/lifecycle-engine";

function createNoopJobAdapter(): JobAdapter {
  return {
    async enqueue(_name: string, _payload: Record<string, unknown>) {
      // No-op when no job adapter configured
    },
  };
}

/**
 * Create and initialize the Better Media runtime.
 *
 * @example
 * ```ts
 * const media = createBetterMedia({
 *   storage: s3Storage(...),
 *   database: postgresAdapter(...),
 *   jobs: redisJobAdapter(),
 *   plugins: [
 *     validationPlugin(),
 *     virusScanPlugin(),
 *     thumbnailPlugin({ mode: "background" }),
 *     videoProcessingPlugin({ mode: "background" })
 *   ]
 * });
 *
 * await media.processUpload("uploads/abc123.jpg", { contentType: "image/jpeg" });
 * ```
 */
export function createBetterMedia(config: BetterMediaConfig): BetterMediaRuntime {
  const { storage, database, plugins } = config;
  const { registry } = buildPluginRegistry(plugins);

  const jobAdapter =
    config.jobs ??
    (hasBackgroundHandlers(registry)
      ? (() => {
          const adapter = memoryJobAdapter({
            processor: (p) =>
              runBackgroundJob(
                p as unknown as BackgroundJobPayload,
                registry,
                storage,
                database,
                adapter
              ),
          });
          return adapter;
        })()
      : createNoopJobAdapter());
  const engine = new LifecycleEngine(registry, jobAdapter);
  const executor = new PipelineExecutor(engine, storage, database, jobAdapter);

  const runPipeline = (fileKey: string, metadata: Record<string, unknown> = {}) =>
    executor.run(fileKey, metadata);

  return {
    upload: {
      async createSession() {
        return {
          id: crypto.randomUUID(),
          expiresAt: Date.now() + 3600000,
        };
      },
      async complete(_sessionId: string, fileKey: string, metadata: Record<string, unknown> = {}) {
        await runPipeline(fileKey, metadata);
      },
    },
    files: {
      async get(fileKey: string) {
        return database.get(fileKey);
      },
    },
    metadata: {
      async get(key: string) {
        return database.get(key);
      },
      async put(key: string, data: Record<string, unknown>) {
        await database.put(key, data);
      },
    },
    async runBackgroundJob(payload: BackgroundJobPayload) {
      await runBackgroundJob(payload, registry, storage, database, jobAdapter);
    },
    async processUpload(fileKey: string, metadata: Record<string, unknown> = {}) {
      await runPipeline(fileKey, metadata);
    },
  };
}

export { ValidationError } from "./core/pipeline-executor";
export type { BackgroundJobPayload } from "./core/lifecycle-engine";
export type { BetterMediaRuntime, FileRecord, UploadSession } from "./runtime/runtime.interface";
