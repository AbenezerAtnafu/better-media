import type { BackgroundJobPayload } from "../engine/lifecycle-engine";

/** Runtime instance returned by createBetterMedia */
export interface BetterMediaRuntime {
  /** Process an uploaded file through the plugin lifecycle */
  processUpload(fileKey: string, metadata?: Record<string, unknown>): Promise<void>;
  /**
   * Execute a background job (call from worker process).
   * Use with Bull, SQS, Inngest, etc.
   */
  runBackgroundJob(payload: BackgroundJobPayload): Promise<void>;
}
