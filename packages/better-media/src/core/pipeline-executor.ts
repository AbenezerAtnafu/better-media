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
import {
  loadFileIntoContext,
  loadTrustedFromDb,
  saveTrustedToDb,
  cleanupTempFile,
  type FileHandlingConfig,
} from "./file-loader";

function buildFileInfo(
  fileKey: string,
  metadata: Record<string, unknown>
): PipelineContext["file"] {
  const mime = metadata.contentType ?? metadata.mimeType ?? metadata["content-type"];
  const size = typeof metadata.size === "number" ? metadata.size : undefined;
  const originalName =
    (metadata.originalName as string) ??
    (metadata.originalname as string) ??
    (() => {
      try {
        const url = new URL(fileKey);
        return path.basename(url.pathname);
      } catch {
        return undefined;
      }
    })();
  const ext = originalName
    ? path.extname(originalName).toLowerCase()
    : (() => {
        try {
          const url = new URL(fileKey);
          return path.extname(url.pathname).toLowerCase();
        } catch {
          return path.extname(fileKey).toLowerCase();
        }
      })();

  return {
    key: fileKey,
    size,
    mimeType: typeof mime === "string" ? mime : undefined,
    originalName: typeof originalName === "string" ? originalName : undefined,
    extension: ext || undefined,
    checksums: undefined,
  };
}

function buildStorageLocation(
  fileKey: string,
  referenceUrl?: string
): PipelineContext["storageLocation"] {
  return {
    key: fileKey,
    bucket: undefined,
    region: undefined,
    url: referenceUrl,
  };
}

function syncTrustedToFile(context: PipelineContext): void {
  const { trusted, file } = context;
  if (trusted.file?.mimeType != null) file.mimeType = trusted.file.mimeType;
  if (trusted.file?.size != null) file.size = trusted.file.size;
  if (trusted.file?.originalName != null) file.originalName = trusted.file.originalName;
  if (trusted.checksums) file.checksums = { ...file.checksums, ...trusted.checksums };
}

/** Error thrown when validation phase aborts the pipeline */
export class ValidationError extends Error {
  constructor(
    public readonly recordId: string,
    public readonly fileKey: string,
    public readonly result: ValidationResult
  ) {
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
    private readonly jobs: JobAdapter,
    private readonly fileHandling: FileHandlingConfig = {}
  ) {}

  async run(
    recordId: string,
    fileKey: string,
    metadata: Record<string, unknown> = {},
    appContext: Record<string, unknown> = {}
  ): Promise<void> {
    const meta = { ...metadata };
    const trustedFromDb = await loadTrustedFromDb(this.database, recordId);

    const context: PipelineContext = {
      recordId,
      file: buildFileInfo(fileKey, meta),
      storageLocation: buildStorageLocation(fileKey, appContext.referenceUrl as string),
      processing: {},
      metadata: { ...meta, ...appContext }, // Merge for plugins to read backwards-compatibly
      trusted: trustedFromDb ?? {},
      utilities: {},
      storage: this.storage,
      database: this.database,
      jobs: this.jobs,
    };

    if (trustedFromDb) {
      syncTrustedToFile(context);
    }

    try {
      await loadFileIntoContext(context, this.fileHandling);

      // Initialize the media record early to satisfy foreign key constraints
      // for any results (validation, scan) persisted by plugins during the pipeline.
      await saveTrustedToDb(this.database, recordId, fileKey, context.trusted, {
        filename: context.file.originalName,
        mimeType: context.file.mimeType,
        size: context.file.size,
        context: appContext,
      });

      for (const phase of HOOK_NAMES) {
        const result = await this.engine.trigger(phase, context);
        if (result !== undefined && typeof result === "object" && result.valid === false) {
          throw new ValidationError(recordId, fileKey, result);
        }
      }

      // Single-shot Upsert of initial data and trusted results
      await saveTrustedToDb(this.database, recordId, fileKey, context.trusted, {
        filename: context.file.originalName,
        mimeType: context.file.mimeType,
        size: context.file.size,
        context: appContext,
      });
    } finally {
      await cleanupTempFile(context);
    }
  }
}
