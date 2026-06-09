export interface GCSStorageConfig {
  /** GCS bucket name, or a resolver function to pick a bucket per key. */
  bucket: string | ((key: string) => string);

  /** GCP project ID. Optional when running on GCP with Application Default Credentials. */
  projectId?: string;

  /** Path to a service account key JSON file. */
  keyFilename?: string;

  /** Inline service account credentials (alternative to keyFilename). */
  credentials?: {
    client_email: string;
    private_key: string;
  };

  /**
   * Optional prefix prepended to every key written to GCS.
   * Useful for isolating Better Media files under a subdirectory (e.g. "media/").
   * The prefix is stripped from keys returned by list().
   */
  basePrefix?: string;
}
