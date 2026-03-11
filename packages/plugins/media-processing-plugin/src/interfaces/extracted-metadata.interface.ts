/** Extracted metadata from images or video. Stored in processing["media-processing"].extractedMetadata */
export interface ExtractedMetadata {
  format?: string;
  width?: number;
  height?: number;
  duration?: number;
  orientation?: number;
  exif?: Record<string, unknown>;
  codec?: string;
  framerate?: string;
}
