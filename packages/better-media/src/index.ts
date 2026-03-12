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
 * await media.upload.multer("uploads/abc123.jpg", { contentType: "image/jpeg" });
 * ```
 */
export function createBetterMedia(config: BetterMediaConfig): BetterMediaRuntime {
  const { storage, database, plugins } = config;
  const { registry } = buildPluginRegistry(plugins);

  const fileHandling = config.fileHandling ?? {};
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
                adapter,
                fileHandling
              ),
          });
          return adapter;
        })()
      : createNoopJobAdapter());
  const engine = new LifecycleEngine(registry, jobAdapter);
  const executor = new PipelineExecutor(engine, storage, database, jobAdapter, fileHandling);

  const runPipeline = (fileKey: string, metadata: Record<string, unknown> = {}) =>
    executor.run(fileKey, metadata);

  return {
    upload: {
      multer(fileKey: string, metadata: Record<string, unknown> = {}) {
        return runPipeline(fileKey, metadata);
      },
      complete(fileKey: string, metadata: Record<string, unknown> = {}) {
        return runPipeline(fileKey, metadata);
      },
      async presignedPutUrl(
        fileKey: string,
        options?: { expiresIn?: number; contentType?: string }
      ) {
        const fn = storage.createPresignedPutUrl;
        if (typeof fn !== "function") {
          throw new Error(
            "Presigned upload not supported by this storage adapter. Use an S3/GCS adapter."
          );
        }
        return fn.call(storage, fileKey, options);
      },
    },
    files: {
      get(fileKey: string) {
        return database.get(fileKey);
      },
      async delete(fileKey: string) {
        await Promise.all([storage.delete(fileKey), database.delete(fileKey)]);
      },
      async getUrl(fileKey: string, options?: { expiresIn?: number }) {
        const fn = storage.getUrl;
        if (typeof fn !== "function") {
          throw new Error(
            "URL generation not supported by this storage adapter. Use an S3/GCS adapter."
          );
        }
        return fn.call(storage, fileKey, options);
      },
      reprocess(fileKey: string, metadata: Record<string, unknown> = {}) {
        return runPipeline(fileKey, metadata);
      },
    },
    async runBackgroundJob(payload: BackgroundJobPayload) {
      await runBackgroundJob(payload, registry, storage, database, jobAdapter, fileHandling);
    },
  };
}

export { ValidationError } from "./core/pipeline-executor";
export {
  PluginRegistry,
  buildPluginRegistry,
  validatePlugin,
  hasBackgroundHandlers,
  HOOK_NAMES,
} from "./plugins/plugin-registry";
export type { BackgroundJobPayload } from "./core/lifecycle-engine";
export type { BetterMediaRuntime, FileRecord, Metadata } from "./runtime/runtime.interface";
export type { GetUrlOptions, PresignedPutUrlOptions } from "@better-media/core";
export type { FileHandlingConfig } from "./core/file-loader";
