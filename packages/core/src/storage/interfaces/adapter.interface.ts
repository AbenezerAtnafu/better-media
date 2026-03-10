/** Options for generating a URL to access stored media */
export interface GetUrlOptions {
  /** Expiration time in seconds (for signed URLs). Default depends on adapter. */
  expiresIn?: number;
}

/** Options for creating a presigned PUT URL (direct-to-storage upload) */
export interface PresignedPutUrlOptions {
  /** Expiration time in seconds. Default depends on adapter. */
  expiresIn?: number;
  /** Content-Type hint for the upload (used by S3, etc.) */
  contentType?: string;
}

export interface StorageAdapter {
  get(key: string): Promise<Buffer | null>;
  put(key: string, value: Buffer): Promise<void>;
  delete(key: string): Promise<void>;

  /**
   * Generate a URL to access the file (public or signed).
   * Optional: adapters for S3, GCS, etc. implement this; memory adapter does not.
   */
  getUrl?(key: string, options?: GetUrlOptions): Promise<string>;

  /**
   * Create a presigned PUT URL for direct-to-storage upload (client uploads without app receiving bytes).
   * Optional: adapters for S3, GCS, etc. implement this; memory adapter does not.
   */
  createPresignedPutUrl?(key: string, options?: PresignedPutUrlOptions): Promise<string>;
}
