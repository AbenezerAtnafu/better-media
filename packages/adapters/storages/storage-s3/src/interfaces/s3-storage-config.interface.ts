export interface S3StorageConfig {
  /** AWS region (e.g. "us-east-1") */
  region: string;
  /** S3 bucket name. Can be a string, or a resolver function that determines the bucket based on the key. */
  bucket: string | ((key: string) => string);
  /** AWS access key ID */
  accessKeyId: string;
  /** AWS secret access key */
  secretAccessKey: string;
  /**
   * Custom endpoint for S3-compatible storage (e.g. MinIO).
   * Omit for standard AWS S3.
   */
  endpoint?: string;
  /**
   * Use path-style bucket URLs (bucket.endpoint vs endpoint/bucket).
   * Required for MinIO and some S3-compatible services.
   */
  forcePathStyle?: boolean;
}
