import type { PipelineContext, HookName, ValidationResult, JobAdapter } from "@better-media/core";
import type { HookRegistry } from "../registry/plugin-registry";

const JOB_QUEUE_NAME = "better-media:background";

/** Background job payload (serializable) */
export interface BackgroundJobPayload {
  fileKey: string;
  metadata: Record<string, unknown>;
  hookName: HookName;
  pluginName: string;
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

    for (const { name, fn } of syncHandlers) {
      const result = await fn(context);
      if (result !== undefined && typeof result === "object" && "valid" in result) {
        if (result.valid === false) return result;
      }
    }

    for (const { name, fn } of backgroundHandlers) {
      const payload: BackgroundJobPayload = {
        fileKey: context.fileKey,
        metadata: context.metadata,
        hookName,
        pluginName: name,
      };
      await this.jobAdapter.enqueue(JOB_QUEUE_NAME, { ...payload });
    }
  }
}
