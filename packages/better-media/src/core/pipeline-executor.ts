import path from "node:path";
import type {
  JobAdapter,
  PipelineContext,
  StorageAdapter,
  DatabaseAdapter,
  ValidationResult,
} from "@better-media/core";
import { HOOK_NAMES } from "../plugins/plugin-registry";
import type { LifecycleEngine } from "./lifecycle-engine";

function buildFileInfo(
  fileKey: string,
  metadata: Record<string, unknown>
): PipelineContext["file"] {
  const mime = metadata.contentType ?? metadata.mimeType ?? metadata["content-type"];
  const size = typeof metadata.size === "number" ? metadata.size : undefined;
  const originalName = (metadata.originalName as string) ?? (metadata.originalname as string);
  const ext = originalName
    ? path.extname(originalName).toLowerCase()
    : path.extname(fileKey).toLowerCase();

  return {
    key: fileKey,
    size,
    mimeType: typeof mime === "string" ? mime : undefined,
    originalName: typeof originalName === "string" ? originalName : undefined,
    extension: ext || undefined,
    checksums: undefined,
  };
}

function buildStorageLocation(fileKey: string): PipelineContext["storageLocation"] {
  return {
    key: fileKey,
    bucket: undefined,
    region: undefined,
    url: undefined,
  };
}

/** Error thrown when validation phase aborts the pipeline */
export class ValidationError extends Error {
  constructor(public readonly result: ValidationResult) {
    super(result.message ?? "Validation failed");
    this.name = "ValidationError";
  }
}

/**
 * Pipeline executor: runs phases in order (upload:init → validation → scan → process → upload:complete).
 */
export class PipelineExecutor {
  constructor(
    private readonly engine: LifecycleEngine,
    private readonly storage: StorageAdapter,
    private readonly database: DatabaseAdapter,
    private readonly jobs: JobAdapter
  ) {}

  async run(fileKey: string, metadata: Record<string, unknown> = {}): Promise<void> {
    const meta = { ...metadata };
    const context: PipelineContext = {
      file: buildFileInfo(fileKey, meta),
      storageLocation: buildStorageLocation(fileKey),
      processing: {},
      metadata: meta,
      utilities: {},
      storage: this.storage,
      database: this.database,
      jobs: this.jobs,
    };

    for (const phase of HOOK_NAMES) {
      const result = await this.engine.trigger(phase, context);
      if (result !== undefined && typeof result === "object" && result.valid === false) {
        throw new ValidationError(result);
      }
    }
  }
}
