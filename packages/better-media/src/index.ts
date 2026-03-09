import type {
  StorageAdapter,
  DatabaseAdapter,
  JobAdapter,
  PipelinePlugin,
} from "@better-media/core";
import { BetterMediaConfig } from "./interfaces/config.interface";
import { BetterMediaRuntime } from "./interfaces/runtime.interface";
import { buildPluginRegistry } from "./registry/plugin-registry";
import { LifecycleEngine } from "./engine/lifecycle-engine";
import { PipelineExecutor } from "./executor/pipeline-executor";
import { runBackgroundJob } from "./jobs/job-runner";

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
  const jobAdapter = config.jobs ?? createNoopJobAdapter();

  const { registry } = buildPluginRegistry(plugins);
  const engine = new LifecycleEngine(registry, jobAdapter);
  const executor = new PipelineExecutor(engine, storage, database);

  return {
    async processUpload(fileKey: string, metadata: Record<string, unknown> = {}) {
      await executor.run(fileKey, metadata);
    },
    async runBackgroundJob(payload: import("./engine/lifecycle-engine").BackgroundJobPayload) {
      await runBackgroundJob(payload, registry, storage, database);
    },
  };
}

export { ValidationError } from "./executor/pipeline-executor";
export type { BackgroundJobPayload } from "./engine/lifecycle-engine";
