import type {
  StorageAdapter,
  DatabaseAdapter,
  PipelinePlugin,
  PipelineContext,
} from "@better-media/core";
import { BetterMediaConfig } from "./interfaces/config.interface";
import { BetterMediaRuntime } from "./interfaces/runtime.interface";

/** Lifecycle engine that runs plugins in sequence */
class LifecycleEngine {
  constructor(
    private readonly plugins: PipelinePlugin[],
    private readonly storage: StorageAdapter,
    private readonly database: DatabaseAdapter
  ) {}

  async run(fileKey: string, metadata: Record<string, unknown> = {}): Promise<void> {
    const context: PipelineContext = {
      fileKey,
      metadata,
      storage: this.storage,
      database: this.database,
    };

    for (const plugin of this.plugins) {
      await plugin.execute(context);
    }
  }
}

/**
 * Create and initialize the Better Media runtime.
 *
 * @example
 * ```ts
 * const media = createBetterMedia({
 *   storage: s3Storage(...),
 *   database: postgresAdapter(...),
 *   plugins: [
 *     validationPlugin(),
 *     virusScanPlugin(),
 *     mediaProcessingPlugin()
 *   ]
 * });
 *
 * await media.processUpload("uploads/abc123.jpg", { contentType: "image/jpeg" });
 * ```
 */
export function createBetterMedia(config: BetterMediaConfig): BetterMediaRuntime {
  const { storage, database, plugins } = config;

  const engine = new LifecycleEngine(plugins, storage, database);

  return {
    async processUpload(fileKey: string, metadata: Record<string, unknown> = {}) {
      await engine.run(fileKey, metadata);
    },
  };
}
