import type { BackgroundJobPayload } from "../core/lifecycle-engine";

/** Session returned by upload.createSession() */
export interface UploadSession {
  id: string;
  expiresAt: number;
}

/** File record from database */
export type FileRecord = Record<string, unknown>;

/** Runtime instance returned by createBetterMedia */
export interface BetterMediaRuntime {
  upload: {
    /** Create an upload session (for multipart/chunked flows) */
    createSession(): Promise<UploadSession>;
    /** Complete upload and run pipeline. Pass sessionId from createSession, or empty string for direct upload. */
    complete(sessionId: string, fileKey: string, metadata?: Record<string, unknown>): Promise<void>;
  };
  files: {
    /** Get file record by key */
    get(fileKey: string): Promise<FileRecord | null>;
  };
  metadata: {
    /** Get metadata by key */
    get(key: string): Promise<Record<string, unknown> | null>;
    /** Store metadata by key */
    put(key: string, data: Record<string, unknown>): Promise<void>;
  };
  /**
   * Execute a background job (call from worker process).
   * Use with Bull, SQS, Inngest, etc.
   */
  runBackgroundJob(payload: BackgroundJobPayload): Promise<void>;
  /**
   * @deprecated Use media.upload.complete("", fileKey, metadata) instead
   * Process an uploaded file through the plugin lifecycle
   */
  processUpload(fileKey: string, metadata?: Record<string, unknown>): Promise<void>;
}
