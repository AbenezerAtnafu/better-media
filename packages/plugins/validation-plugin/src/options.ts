/**
 * Validation plugin configuration.
 * All rules are optional; omit to skip that validation.
 */
export interface ValidationPluginOptions {
  /**
   * Execution mode. Default: "background".
   * Sync: runs inline and can abort the pipeline on failure.
   * Background: enqueues work; pipeline continues; result stored in DB.
   */
  executionMode?: "sync" | "background";

  /**
   * When validation fails: "abort" (return ValidationResult, stop pipeline),
   * "continue" (record failure in DB, let pipeline continue), or "custom" (invoke onFailureCallback).
   * Applies to sync mode. Background mode always records to DB.
   */
  onFailure?: "abort" | "continue" | "custom";

  /** Called when onFailure is "custom". Receives errors; return to control pipeline (abort if ValidationResult). */
  onFailureCallback?: (
    fileKey: string,
    errors: ValidationErrorItem[]
  ) => void | Promise<{ valid: boolean; message?: string } | void>;

  /** Allowed file extensions (e.g. [".jpg", ".png"]). Omit to skip. */
  allowedExtensions?: string[];

  /** Allowed MIME types (e.g. ["image/jpeg", "image/png"]). Omit to skip. */
  allowedMimeTypes?: string[];

  /** Validate MIME via magic bytes (not extension). Requires file bytes. */
  useMagicBytes?: boolean;

  /** Min file size in bytes. Omit to skip. */
  minBytes?: number;

  /** Max file size in bytes. Omit to skip. */
  maxBytes?: number;

  /** Min width in pixels (images/video). Omit to skip. */
  minWidth?: number;

  /** Max width in pixels. Omit to skip. */
  maxWidth?: number;

  /** Min height in pixels. Omit to skip. */
  minHeight?: number;

  /** Max height in pixels. Omit to skip. */
  maxHeight?: number;

  /** Max duration in seconds (video/audio). Use customValidators for implementation. */
  maxDurationSeconds?: number;

  /**
   * Expected checksum for integrity. If provided, computed hash must match.
   * metadata should contain the expected value (e.g. metadata.sha256).
   */
  checksum?: {
    algorithm: "sha256" | "sha512" | "md5";
    /** Key in metadata where expected hash is stored, or a literal value. */
    metadataKey?: string;
  };

  /**
   * Behavior when file is not found in storage (e.g. presigned URL, upload not complete).
   * "fail": return validation error.
   * "retry": retry with backoff (uses retryOptions).
   * "skip": skip validation, return valid (risky).
   */
  fileNotFoundBehavior?: "fail" | "retry" | "skip";

  /** Used when fileNotFoundBehavior is "retry". */
  retryOptions?: {
    maxAttempts?: number;
    delayMs?: number;
    backoff?: "linear" | "exponential";
  };

  /** Custom validators. Receives buffer and metadata; return errors to fail. */
  customValidators?: Array<
    (
      buffer: Buffer,
      metadata: Record<string, unknown>,
      fileKey: string
    ) => ValidationErrorItem[] | Promise<ValidationErrorItem[]>
  >;
}

export interface ValidationErrorItem {
  rule: string;
  message: string;
  details?: Record<string, unknown>;
}
