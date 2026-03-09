import type {
  JobAdapter,
  PipelineContext,
  StorageAdapter,
  DatabaseAdapter,
  ValidationResult,
} from "@better-media/core";
import { HOOK_NAMES } from "../plugins/plugin-registry";
import type { LifecycleEngine } from "./lifecycle-engine";

/** Error thrown when validation phase aborts the pipeline */
export class ValidationError extends Error {
  constructor(public readonly result: ValidationResult) {
    super(result.message ?? "Validation failed");
    this.name = "ValidationError";
  }
}

/**
 * Pipeline executor: runs phases in order (upload:init → validation → scan → storage:write → process → upload:complete).
 */
export class PipelineExecutor {
  constructor(
    private readonly engine: LifecycleEngine,
    private readonly storage: StorageAdapter,
    private readonly database: DatabaseAdapter,
    private readonly jobs: JobAdapter
  ) {}

  async run(fileKey: string, metadata: Record<string, unknown> = {}): Promise<void> {
    const context: PipelineContext = {
      fileKey,
      metadata: { ...metadata },
      storage: this.storage,
      database: this.database,
      jobs: this.jobs,
      utilities: {},
    };

    for (const phase of HOOK_NAMES) {
      const result = await this.engine.trigger(phase, context);
      if (result !== undefined && typeof result === "object" && result.valid === false) {
        throw new ValidationError(result);
      }
    }
  }
}
