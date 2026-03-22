import type { GetUrlOptions, PresignedPutUrlOptions } from "@better-media/core";
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
  [key: string]: unknown;
};

export type IngestInput = {
  file: MediaFileInput;
  metadata?: MediaMetadata;
  context?: Record<string, unknown>; // userId, tenantId, requestId (for idempotency)
  key?: string; // Explicitly unified key naming
};

export type MediaResult = {
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
    presignedPutUrl(key: string, options?: PresignedPutUrlOptions): Promise<string>;
    /** Called by the client *after* successfully uploading to the presigned URL */
    complete(
      key: string,
      metadata?: MediaMetadata,
      context?: Record<string, unknown>
    ): Promise<MediaResult>;
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
