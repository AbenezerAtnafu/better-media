/**
 * Minimal database adapter interface for media metadata/records.
 * Implementations (Postgres, MongoDB, etc.) provide storage for pipeline state.
 */
export interface DatabaseAdapter {
  /** Get a media record by key */
  get(key: string): Promise<Record<string, unknown> | null>;
  /** Create or update a media record */
  put(key: string, data: Record<string, unknown>): Promise<void>;
  /** Delete a media record */
  delete(key: string): Promise<void>;
}
