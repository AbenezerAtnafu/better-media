/** A single thumbnail or derived image */
export interface ThumbnailResult {
  key: string;
  width?: number;
  height?: number;
  format?: string;
  url?: string;
}

/** A transcoded or converted variant */
export interface VariantResult {
  key: string;
  format?: string;
  width?: number;
  height?: number;
  bitrate?: number;
  url?: string;
}

/** Image/video dimensions. Set by validation or processing. */
export interface MediaDimensions {
  width: number;
  height: number;
  /** Duration in seconds, for video */
  duration?: number;
}

/** Output from processing plugins. Each plugin writes to a namespaced key to avoid overwrites. */
export interface ProcessingResults {
  /** Dimensions (from validation or processing) */
  dimensions?: MediaDimensions;
  /** Thumbnails. Plugins append; use plugin name as key if multiple sources. */
  thumbnails?: Record<string, ThumbnailResult[]>;
  /** Variants (transcodes, conversions) */
  variants?: Record<string, VariantResult[]>;
  /** Plugin-specific results. Key by plugin name. */
  [pluginKey: string]: unknown;
}
