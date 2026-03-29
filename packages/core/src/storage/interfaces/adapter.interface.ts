/** Options for generating a URL to access stored media */
export interface GetUrlOptions {
  /** Expiration time in seconds (for signed URLs). Default depends on adapter. */
  expiresIn?: number;
}

/** HTTP method to use for a presigned upload */
export type PresignedUploadMethod = "PUT" | "POST";

/**
 * Options for creating a presigned upload (PUT or POST).
 * Both methods apply validation as strictly as the S3 protocol allows.
 */
export interface PresignedUploadOptions {
  /**
   * Upload method.
   * - PUT: binary body, signed headers enforce Content-Type + Content-Length.
   * - POST: multipart/form-data with an S3 Policy enforcing size range and Content-Type.
   * Default: "PUT"
   */
  method?: PresignedUploadMethod;

  /** Required MIME type (e.g. "image/jpeg"). Enforced strictly for both methods. */
  contentType: string;

  /** Expiration in seconds. Default: 3600 */
  expiresIn?: number;

  /**
   * Maximum allowed file size in bytes.
   * - POST: enforced by S3 Policy (`content-length-range`). S3 rejects uploads exceeding this.
   * - PUT: encoded as `Content-Length` in the signed command. S3 rejects body size mismatches.
   *   For the tightest constraint on PUT, pass the exact expected file size here.
   */
  maxSizeBytes?: number;

  /**
   * Minimum allowed file size in bytes.
   * - POST: enforced by S3 Policy (`content-length-range`). Default: 1.
   * - PUT: not constrainable at the S3 level.
   */
  minSizeBytes?: number;

  /**
   * Additional user-defined metadata to attach to the object (stored as x-amz-meta-* on S3).
   * These are signed into the URL/Policy, so any metadata mismatch causes a 403.
   */
  metadata?: Record<string, string>;
}

/**
 * Unified presigned upload result — same shape for both PUT and POST.
 *
 * @example PUT usage (mobile app / API client):
 * ```ts
 * fetch(result.url, {
 *   method: "PUT",
 *   headers: result.headers,
 *   body: fileBlob,
 * });
 * ```
 *
 * @example POST usage (browser form / web app):
 * ```ts
 * const form = new FormData();
 * for (const [key, value] of Object.entries(result.fields ?? {})) {
 *   form.append(key, value);
 * }
 * form.append("file", fileBlob); // file field MUST be last
 * fetch(result.url, { method: "POST", body: form });
 * ```
 */
export interface PresignedUploadResult {
  method: PresignedUploadMethod;
  /** The URL to upload to. For POST this is the bucket endpoint; for PUT it is the fully signed URL. */
  url: string;
  /**
   * Required form fields (POST only).
   * Must be appended to the multipart/form-data body BEFORE the file field, in the order provided.
   */
  fields?: Record<string, string>;
  /**
   * Required HTTP headers (PUT only).
   * The client MUST send all of these headers exactly as specified.
   * Mismatch causes S3 to return 403 Forbidden.
   */
  headers?: Record<string, string>;
}

export interface StorageAdapter {
  get(key: string): Promise<Buffer | null>;
  put(key: string, value: Buffer): Promise<void>;
  delete(key: string): Promise<void>;

  /**
   * Check if a key exists without loading the full content.
   */
  exists(key: string): Promise<boolean>;

  /**
   * Optional: get file size in bytes without loading the full buffer.
   * Used with fileHandling.maxBufferBytes to decide buffer vs stream.
   */
  getSize?(key: string): Promise<number | null>;

  /**
   * Optional: stream file contents. Used when file exceeds maxBufferBytes.
   */
  getStream?(key: string): Promise<ReadableStream | null>;

  /**
   * Generate a signed or public URL to access the file.
   * Optional: S3/GCS adapters implement this; memory adapter does not.
   */
  getUrl?(key: string, options?: GetUrlOptions): Promise<string>;

  /**
   * Create a presigned upload for direct-to-storage upload.
   * Supports both PUT (binary body) and POST (multipart form) with strict validation.
   * Optional: S3/GCS adapters implement this; memory adapter does not.
   */
  createPresignedUpload?(
    key: string,
    options: PresignedUploadOptions
  ): Promise<PresignedUploadResult>;

  /**
   * Remove all stored keys. Optional; mainly for testing/dev (e.g. memory adapter).
   */
  clear?(): Promise<void>;
}
