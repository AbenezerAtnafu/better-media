import type { VirusScanner } from "./scanner.interface";

/** Failure handling modes (mirrors validation plugin). */
export type VirusScanFailureMode = "abort" | "continue" | "custom";

/** Callback invoked when onFailure is "custom". */
export type VirusScanFailureCallback = (
  fileKey: string,
  viruses: string[]
) => void | Promise<{ valid: boolean; message?: string } | void>;

/**
 * Configuration for the virus scan plugin.
 * All fields are optional with sensible defaults.
 */
export interface VirusScanPluginOptions {
  /**
   * Execution mode: "sync" runs inline, "background" enqueues via job adapter.
   * Default: "background".
   */
  executionMode?: "sync" | "background";

  /**
   * Behavior when a virus is detected:
   * - "abort": return a failed ValidationResult, stopping the pipeline.
   * - "continue": record to DB, let the pipeline proceed.
   * - "custom": invoke onFailureCallback.
   * Default: "abort".
   */
  onFailure?: VirusScanFailureMode;

  /** Called when onFailure is "custom". */
  onFailureCallback?: VirusScanFailureCallback;

  /**
   * Injectable scanner implementation satisfying the VirusScanner interface.
   * Defaults to the built-in ClamAV scanner if omitted.
   */
  scanner?: VirusScanner;

  /** Timeout in milliseconds for a single scan operation. Default: 30_000. */
  scanTimeoutMs?: number;

  /**
   * Retry configuration for transient scanner failures (e.g. daemon unavailable).
   */
  retryOptions?: {
    /** Maximum number of attempts. Default: 3. */
    maxAttempts?: number;
    /** Base delay between retries in ms. Default: 1000. */
    delayMs?: number;
    /** Backoff strategy. Default: "exponential". */
    backoff?: "linear" | "exponential";
  };
}
