/** Core file information. Populated by upload adapter / upload:init. */
export interface FileInfo {
  /** Logical key in storage. Always present. */
  key: string;
  /** File size in bytes */
  size?: number;
  /** MIME type (e.g. "image/jpeg"). Use this instead of contentType/mimeType. */
  mimeType?: string;
  /** Original filename from upload (e.g. "photo.jpg") */
  originalName?: string;
  /** File extension (e.g. ".jpg"). Derived from key or originalName. */
  extension?: string;
  /** Checksum for validation (e.g. sha256). Key names are hashing algorithm. */
  checksums?: Record<string, string>;
}
