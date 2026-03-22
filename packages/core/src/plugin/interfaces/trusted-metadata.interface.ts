/**
 * Plugin-derived metadata shared across the pipeline.
 * First writer wins. Plugins read when set, compute and write when missing.
 */
export interface TrustedFileInfo {
  mimeType?: string;
  size?: number;
  originalName?: string;
  extension?: string;
}

export interface TrustedChecksums {
  sha256?: string;
  md5?: string;
}

export interface TrustedMetadata {
  file?: TrustedFileInfo;
  checksums?: TrustedChecksums;
}
