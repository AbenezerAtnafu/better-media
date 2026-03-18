import type { ScanResult } from "./scan-result.interface";

/** Abstract virus scanner contract. Implementations can wrap ClamAV, VirusTotal, etc. */
export interface VirusScanner {
  /** Human-readable name of the scanner engine (e.g. "clamav"). */
  readonly name: string;

  /** One-time initialization (connect to daemon, load definitions, etc.). */
  init(): Promise<void>;

  /** Scan a file buffer in memory. */
  scanBuffer(buffer: Buffer): Promise<ScanResult>;

  /** Scan a file on disk by absolute path. */
  scanFile(filePath: string): Promise<ScanResult>;
}
