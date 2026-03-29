import path from "node:path";
import type {
  JobAdapter,
  PipelineContext,
  StorageAdapter,
  DatabaseAdapter,
} from "@better-media/core";
import type { HookRegistry } from "../plugins/plugin.interface";
import type { BackgroundJobPayload } from "../core/lifecycle-engine";
import {
  loadFileIntoContext,
  loadTrustedFromDb,
  saveTrustedToDb,
  cleanupTempFile,
  type FileHandlingConfig,
} from "../core/file-loader";

function syncTrustedToFile(context: PipelineContext): void {
  const { trusted, file } = context;
  if (trusted.file?.mimeType != null) file.mimeType = trusted.file.mimeType;
  if (trusted.file?.size != null) file.size = trusted.file.size;
  if (trusted.file?.originalName != null) file.originalName = trusted.file.originalName;
  if (trusted.checksums) file.checksums = { ...file.checksums, ...trusted.checksums };
}

/**
 * Execute a background job: rebuild context, find handler, run it.
 * Call from worker process (Bull, SQS, Inngest, etc.).
 */
export async function runBackgroundJob(
  payload: BackgroundJobPayload,
  registry: HookRegistry,
  storage: StorageAdapter,
  database: DatabaseAdapter,
  jobs: JobAdapter,
  fileHandling: FileHandlingConfig = {}
): Promise<void> {
  const {
    recordId: payloadRecordId,
    metadata = {},
    file: payloadFile,
    storageLocation: payloadStorage,
    processing: payloadProcessing,
    hookName,
    pluginName,
  } = payload;

  const meta = { ...metadata };

  // Backwards compat: legacy payloads may have fileKey instead of file
  const legacyKey = (payload as { fileKey?: string }).fileKey;
  if (!payloadFile && !legacyKey) {
    throw new Error("Background job payload must include file or fileKey");
  }
  const file: PipelineContext["file"] =
    payloadFile ??
    (legacyKey
      ? {
          key: legacyKey,
          size: typeof meta.size === "number" ? meta.size : undefined,
          mimeType:
            typeof (meta.contentType ?? meta.mimeType ?? meta["content-type"]) === "string"
              ? ((meta.contentType ?? meta.mimeType ?? meta["content-type"]) as string)
              : undefined,
          originalName:
            typeof (meta.originalName ?? meta.originalname) === "string"
              ? ((meta.originalName ?? meta.originalname) as string)
              : undefined,
          extension: path.extname(legacyKey).toLowerCase() || undefined,
        }
      : { key: "" });

  const recordId = payloadRecordId ?? file.key ?? "unknown";

  const storageLocation: PipelineContext["storageLocation"] = payloadStorage ?? { key: file.key };

  const processing: PipelineContext["processing"] = payloadProcessing ?? {};

  const trustedFromDb = await loadTrustedFromDb(database, recordId);

  const context: PipelineContext = {
    recordId,
    file,
    storageLocation,
    processing,
    metadata: meta,
    trusted: trustedFromDb ?? {},
    utilities: {},
    storage,
    database,
    jobs,
  };

  if (trustedFromDb) {
    syncTrustedToFile(context);
  }

  try {
    await loadFileIntoContext(context, fileHandling);

    const handlers = registry.get(hookName) ?? [];
    const handler = handlers.find((h) => h.name === pluginName);
    if (!handler) {
      throw new Error(`Handler not found: ${hookName}/${pluginName}`);
    }

    // Use the manifest from the registry exclusively to prevent trust escalation
    const manifest = handler.manifest;

    // TODO: Ideally createSecureContext should be in a shared utility.
    // For now, we'll implement it or use it if exported from LifecycleEngine.
    // Let's assume we need to implement it here for now or I should have exported it.
    // I will export it from LifecycleEngine.
    const { createSecureContext } = await import("../core/lifecycle-engine");
    const { proxy, api } = createSecureContext(
      context,
      pluginName,
      manifest.namespace,
      manifest.trustLevel,
      manifest.capabilities
    );

    await handler.fn(proxy, api);

    if (context.trusted.file ?? context.trusted.checksums) {
      await saveTrustedToDb(database, recordId, file.key, context.trusted);
    }
  } finally {
    await cleanupTempFile(context);
  }
}
