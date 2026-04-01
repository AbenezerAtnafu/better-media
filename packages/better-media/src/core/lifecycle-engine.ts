import {
  type PipelineContext,
  type HookName,
  type ValidationResult,
  type JobAdapter,
  type PluginManifest,
} from "@better-media/core";
import type { HookRegistry } from "../plugins/plugin.interface";
import { createSecureContext } from "./secure-context";

const JOB_QUEUE_NAME = "better-media:background";

/** Background job payload (serializable) */
export interface BackgroundJobPayload {
  recordId: string;
  metadata: Record<string, unknown>;
  file: PipelineContext["file"];
  storageLocation: PipelineContext["storageLocation"];
  processing: PipelineContext["processing"];
  hookName: HookName;
  pluginName: string;
  manifest: PluginManifest;
}

/**
 * Lifecycle engine: triggers hooks, runs sync handlers in series,
 * enqueues background handlers via JobAdapter.
 */
export class LifecycleEngine {
  constructor(
    private readonly registry: HookRegistry,
    private readonly jobAdapter: JobAdapter
  ) {}

  async trigger(hookName: HookName, context: PipelineContext): Promise<void | ValidationResult> {
    const handlers = this.registry.get(hookName) ?? [];
    const syncHandlers = handlers.filter((h) => h.mode === "sync");
    const backgroundHandlers = handlers.filter((h) => h.mode === "background");

    for (const { name, fn, manifest } of syncHandlers) {
      const { proxy, api } = createSecureContext(
        context,
        name,
        manifest.namespace,
        manifest.trustLevel,
        manifest.capabilities
      );

      const result = await fn(proxy, api);
      if (result !== undefined && typeof result === "object" && "valid" in result) {
        if (result.valid === false) return result;
      }
    }

    for (const { name, manifest } of backgroundHandlers) {
      // Deep clone to prevent shared references in memory-based adapters
      const payload: BackgroundJobPayload = {
        recordId: context.recordId,
        metadata: JSON.parse(JSON.stringify(context.metadata)),
        file: JSON.parse(JSON.stringify(context.file)),
        storageLocation: JSON.parse(JSON.stringify(context.storageLocation)),
        processing: JSON.parse(JSON.stringify(context.processing)),
        hookName,
        pluginName: name,
        manifest: JSON.parse(JSON.stringify(manifest)),
      };
      await this.jobAdapter.enqueue(JOB_QUEUE_NAME, payload as unknown as Record<string, unknown>);
    }
  }
}
