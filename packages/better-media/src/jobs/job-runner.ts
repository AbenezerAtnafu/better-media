import type {
  JobAdapter,
  PipelineContext,
  StorageAdapter,
  DatabaseAdapter,
} from "@better-media/core";
import type { HookRegistry } from "../plugins/plugin.interface";
import type { BackgroundJobPayload } from "../core/lifecycle-engine";

/**
 * Execute a background job: rebuild context, find handler, run it.
 * Call from worker process (Bull, SQS, Inngest, etc.).
 */
export async function runBackgroundJob(
  payload: BackgroundJobPayload,
  registry: HookRegistry,
  storage: StorageAdapter,
  database: DatabaseAdapter,
  jobs: JobAdapter
): Promise<void> {
  const { fileKey, metadata, hookName, pluginName } = payload;

  const handlers = registry.get(hookName) ?? [];
  const handler = handlers.find((h) => h.name === pluginName);
  if (!handler) {
    throw new Error(`Handler not found: ${hookName}/${pluginName}`);
  }

  const context: PipelineContext = {
    fileKey,
    metadata: { ...metadata },
    storage,
    database,
    jobs,
    utilities: {},
  };

  await handler.fn(context);
}
