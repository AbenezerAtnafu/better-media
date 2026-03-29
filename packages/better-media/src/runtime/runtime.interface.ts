import type {
  GetUrlOptions,
  PresignedUploadOptions,
  PresignedUploadResult,
} from "@better-media/core";
import type { BackgroundJobPayload } from "../core/lifecycle-engine";

import type { Readable } from "node:stream";

export type MediaFileInput =
  | { buffer: Buffer }
  | { stream: Readable }
  | { path: string }
  | { url: string; mode?: "import" | "reference" }; // import = download to storage, reference = register only

export type MediaMetadata = {
  filename?: string;
  mimeType?: string;
  size?: number;
  context?: Record<string, unknown>; // userId, tenantId, requestId (for idempotency)
  [key: string]: unknown;
};

export type IngestInput = {
  file: MediaFileInput;
  metadata?: MediaMetadata;
  key?: string;
  /**
   * When `file` is a filesystem path, whether to delete that file after ingest completes.
   * Defaults to `true` (typical for temp uploads, e.g. Multer). Set to `false` when the path
   * points at a permanent user file that must be kept on disk.
   */
  deleteAfterUpload?: boolean;
};

export type MediaResult = {
  /** The unique database record identifier (UUID). */
  id: string;
  /** The storage key (filename or path). */
  key: string;
  url?: string;
  metadata?: MediaMetadata;
  status: "stored" | "processed";
};

/** Metadata for uploads (e.g. contentType). Accepted at upload time. */
export type Metadata = MediaMetadata;

/** File record in database (one per file). */
export type FileRecord = MediaMetadata;

export interface BetterMediaRuntime {
  upload: {
    ingest(input: IngestInput): Promise<MediaResult>;

    // Convenience Helpers
    fromBuffer(buffer: Buffer, input?: Omit<IngestInput, "file">): Promise<MediaResult>;
    fromStream(stream: Readable, input?: Omit<IngestInput, "file">): Promise<MediaResult>;
    fromPath(path: string, input?: Omit<IngestInput, "file">): Promise<MediaResult>;
    fromUrl(
      url: string,
      input?: Omit<IngestInput, "file"> & { mode?: "import" | "reference" }
    ): Promise<MediaResult>;

    // Direct-to-Storage (Presigned URLs) Flow

    /**
     * Create a presigned upload for direct-to-storage upload.
     * Supports both PUT (binary body) and POST (multipart form) with strict server-side validation.
     * After the client uploads, call `complete()` to run the processing pipeline.
     */
    requestPresignedUpload(
      key: string,
      options: PresignedUploadOptions
    ): Promise<PresignedUploadResult>;

    /** Called by the client *after* successfully uploading to the presigned URL */
    complete(key: string, metadata?: MediaMetadata): Promise<MediaResult>;
  };

  /** File operations */
  files: {
    get(fileKey: string): Promise<FileRecord | null>;
    delete(fileKey: string): Promise<void>;
    getUrl(fileKey: string, options?: GetUrlOptions): Promise<string>;
    reprocess(fileKey: string, metadata?: Metadata): Promise<void>;
  };

  /** Execute background job (call from worker). */
  runBackgroundJob(payload: BackgroundJobPayload): Promise<void>;
}
