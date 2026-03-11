import type {
  PipelineContext,
  ValidationResult,
  StorageAdapter,
  DatabaseAdapter,
} from "@better-media/core";
import type { ValidationPluginOptions } from "../interfaces/options.interface";
import { ValidationErrorItem } from "../interfaces/error-item.interface";
import { runValidators } from "../validators";

const VALIDATION_DB_KEY_PREFIX = "better-media:validation:";

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

function recordValidationResult(
  database: DatabaseAdapter,
  fileKey: string,
  valid: boolean,
  errors: ValidationErrorItem[]
): Promise<void> {
  const key = `${VALIDATION_DB_KEY_PREFIX}${fileKey}`;
  return database.put(key, {
    fileKey,
    valid,
    errors,
    timestamp: new Date().toISOString(),
  });
}

export async function runValidation(
  context: PipelineContext,
  opts: ValidationPluginOptions
): Promise<void | ValidationResult> {
  const { file, metadata, storage, database } = context;
  const fileKey = file.key;

  const buffer = await fetchWithRetry(storage, fileKey, opts);

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

    await recordValidationResult(database, fileKey, false, [notFoundError]);

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

  const errors = await runValidators(buffer, context.file, metadata, opts);

  if (errors.length === 0) {
    await recordValidationResult(database, fileKey, true, []);
    return;
  }

  await recordValidationResult(database, fileKey, false, errors);

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
