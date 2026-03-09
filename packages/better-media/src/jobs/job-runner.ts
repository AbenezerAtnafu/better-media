import type { PipelineContext, StorageAdapter, DatabaseAdapter } from "@better-media/core";
import type { HookRegistry } from "../registry/plugin-registry";
import type { BackgroundJobPayload } from "../engine/lifecycle-engine";

/**
 * Execute a background job: rebuild context, find handler, run it.
 * Call from worker process (Bull, SQS, Inngest, etc.).
 */
export async function runBackgroundJob(
  payload: BackgroundJobPayload,
  registry: HookRegistry,
  storage: StorageAdapter,
  database: DatabaseAdapter
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
  };

  await handler.fn(context);
}
