import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import type {
  PipelineContext,
  ValidationResult,
  StorageAdapter,
  DatabaseAdapter,
  PluginApi,
} from "@better-media/core";
import { markFileContentVerified } from "@better-media/core";
import type { ValidationPluginOptions } from "../interfaces/options.interface";
import { ValidationErrorItem } from "../interfaces/error-item.interface";
import { extractMetadataFromBuffer } from "../extract-metadata";
import { runValidators, ValidatorService } from "../validators";

// Boilerplate Logger (Industry Standard Placeholder)
const SecurityLogger = {
  logSuspiciousActivity: (fileKey: string, errors: ValidationErrorItem[]) => {
    const threats = errors.filter((e) => e.rule === "security-threat" || e.rule === "magic-bytes");
    if (threats.length > 0) {
      console.warn(`[SECURITY ALERT] Suspicious activity on ${fileKey}:`, threats);
    }
  },
};

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(
  storage: StorageAdapter,
  fileKey: string,
  opts: ValidationPluginOptions
): Promise<Buffer | null> {
  const behavior = opts.fileNotFoundBehavior ?? "fail";
  const retryOpts = opts.retryOptions ?? { maxAttempts: 3, delayMs: 1000, backoff: "exponential" };
  const maxAttempts = retryOpts.maxAttempts ?? 3;
  const delayMs = retryOpts.delayMs ?? 1000;
  const backoff = retryOpts.backoff ?? "exponential";

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const buffer = await storage.get(fileKey);
    if (buffer != null) return buffer;

    if (behavior === "skip") return null;
    if (behavior === "fail" || attempt === maxAttempts) return null;

    const wait = backoff === "exponential" ? delayMs * Math.pow(2, attempt - 1) : delayMs * attempt;
    await sleep(wait);
  }

  return null;
}

async function readBufferForValidation(context: PipelineContext): Promise<Buffer | null> {
  const fileContent = context.utilities?.fileContent;
  if (fileContent?.buffer) return fileContent.buffer;
  if (fileContent?.tempPath) return fs.readFile(fileContent.tempPath);
  return null;
}

async function recordValidationResult(
  database: DatabaseAdapter,
  recordId: string,
  valid: boolean,
  errors: ValidationErrorItem[]
): Promise<void> {
  const model = "media_validation_results";
  const pluginId = "better-media-validation";
  const data = {
    mediaId: recordId,
    valid,
    pluginId,
    errors,
    createdAt: new Date().toISOString(),
  };

  const existing = await database.findOne({
    model,
    where: [
      { field: "mediaId", value: recordId },
      { field: "pluginId", value: pluginId },
    ],
  });

  if (existing) {
    await database.update({
      model,
      where: [{ field: "id", value: existing.id }],
      update: data,
    });
  } else {
    await database.create({
      model,
      data: { id: randomUUID(), ...data },
    });
  }
}

export async function runValidation(
  context: PipelineContext,
  api: PluginApi,
  opts: ValidationPluginOptions
): Promise<void | ValidationResult> {
  const { file, metadata, storage, database } = context;
  const fileKey = file.key;

  let buffer = await readBufferForValidation(context);
  if (buffer == null) buffer = await fetchWithRetry(storage, fileKey, opts);

  if (buffer == null) {
    const notFoundError: ValidationErrorItem = {
      rule: "file-not-found",
      message:
        opts.fileNotFoundBehavior === "retry"
          ? "File not found in storage after retries (e.g. presigned URL upload not complete)"
          : "File not found in storage",
      details: { fileKey },
    };

    if (opts.fileNotFoundBehavior === "skip") {
      return; // Skip validation, let pipeline continue
    }

    await recordValidationResult(database, context.recordId, false, [notFoundError]);

    if (opts.onFailure === "continue" || opts.onFailure === "custom") {
      if (opts.onFailure === "custom" && opts.onFailureCallback) {
        const result = await opts.onFailureCallback(fileKey, [notFoundError]);
        if (result && result.valid === false) return result;
      }
      return;
    }

    return {
      valid: false,
      message: notFoundError.message,
    };
  }

  // Provenance: bytes were read from storage (utilities or retry path) — required for proposeTrusted guard
  markFileContentVerified(context);

  // Extract critical metadata: first-writer-wins via PluginApi (skip when nothing to merge)
  const patch = await extractMetadataFromBuffer(buffer, context, opts);
  const hasTrustedPatch =
    (patch.file && Object.keys(patch.file).length > 0) ||
    (patch.checksums && Object.keys(patch.checksums).length > 0) ||
    (patch.media && Object.keys(patch.media).length > 0);
  if (hasTrustedPatch) {
    api.proposeTrusted(patch);
  }

  const errors = await runValidators(buffer, context.file, metadata, database, opts);

  if (errors.length === 0) {
    await recordValidationResult(database, context.recordId, true, []);
    return;
  }

  // Security Logging (Mandatory for threats)
  SecurityLogger.logSuspiciousActivity(fileKey, errors);

  await recordValidationResult(database, context.recordId, false, errors);

  const message = errors.map((e) => e.message).join("; ");
  const result: ValidationResult = { valid: false, message };

  switch (opts.onFailure ?? "abort") {
    case "continue":
      return;
    case "custom":
      if (opts.onFailureCallback) {
        const customResult = await opts.onFailureCallback(fileKey, errors);
        if (customResult && customResult.valid === false) return customResult;
      }
      return result;
    case "abort":
    default:
      return result;
  }
}

export { ValidatorService };
