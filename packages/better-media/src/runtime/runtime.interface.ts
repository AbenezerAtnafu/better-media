import type { GetUrlOptions, PresignedPutUrlOptions } from "@better-media/core";
import type { BackgroundJobPayload } from "../core/lifecycle-engine";

/** Metadata for uploads (e.g. contentType). Accepted at upload time. */
export type Metadata = Record<string, unknown>;

/** File record in database (one per file). */
export type FileRecord = Metadata;

export interface BetterMediaRuntime {
  /** Multer flow: after storage.put, run pipeline */
  upload: {
    multer(fileKey: string, metadata?: Metadata): Promise<void>;
    presignedPutUrl(fileKey: string, options?: PresignedPutUrlOptions): Promise<string>;
    complete(fileKey: string, metadata?: Metadata): Promise<void>;
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
