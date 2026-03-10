/** Where the file lives in storage. Populated by upload adapter or upload:init. */
export interface StorageLocation {
  /** Logical key (same as file.key). Always present. */
  key: string;
  /** Bucket name (S3, GCS). Optional for memory/local adapters. */
  bucket?: string;
  /** Region (S3). Optional. */
  region?: string;
  /** Public or pre-signed URL. Optional; computed on demand by adapters. */
  url?: string;
}
