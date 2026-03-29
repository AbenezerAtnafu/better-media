/** Result of a single virus scan operation. */
export interface ScanResult {
  /** Whether the file was found to be infected. */
  infected: boolean;
  /** Names of viruses detected (empty if clean). */
  viruses: string[];
  /** Raw output from the scanner engine, if available. */
  raw?: unknown;
}

/** Persisted scan record written to the database adapter. */
export interface ScanRecord {
  recordId: string;
  fileKey: string;
  infected: boolean;
  viruses: string[];
  scannedAt: string;
  scannerName: string;
  durationMs: number;
}
