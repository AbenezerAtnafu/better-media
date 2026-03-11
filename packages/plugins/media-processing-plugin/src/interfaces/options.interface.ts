import type { ThumbnailSize } from "./thumbnail-size.interface";

/**
 * Media processing plugin configuration.
 */
export interface MediaProcessingPluginOptions {
  /**
   * Execution mode. Default: "background".
   * Sync: runs inline during pipeline.
   * Background: enqueues via JobAdapter, pipeline continues.
   */
  executionMode?: "sync" | "background";

  /**
   * Default thumbnail sizes. Merged with thumbnailSizes.
   * Each size: width required; height optional (maintains aspect ratio).
   */
  defaultThumbnailSizes?: ThumbnailSize[];

  /**
   * User-defined thumbnail sizes. Merged with defaultThumbnailSizes.
   */
  thumbnailSizes?: ThumbnailSize[];

  /**
   * MIME types to process for thumbnails. Omit to use built-in list.
   * Images: image/jpeg, image/png, image/webp, image/gif, image/avif
   * Video: video/mp4, video/webm, video/quicktime, video/x-msvideo
   */
  mimeTypes?: string[];

  /**
   * Extract and store metadata (dimensions, format, exif, etc). Default: true.
   */
  extractMetadata?: boolean;

  /**
   * Include EXIF in extracted metadata (images only). Default: true.
   * Disable if EXIF contains PII or is too large.
   */
  includeExif?: boolean;

  /**
   * Output format for image thumbnails. Default: "jpeg".
   * JPEG is smaller; PNG preserves transparency.
   */
  thumbnailFormat?: "jpeg" | "png" | "webp";

  /**
   * JPEG quality for thumbnails (1-100). Default: 80.
   */
  jpegQuality?: number;
}
