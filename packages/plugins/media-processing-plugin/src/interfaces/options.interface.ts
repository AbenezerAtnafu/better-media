import type { PipelineContext } from "@better-media/core";

/**
 * Sharp `resize.fit` strategy (see Sharp docs).
 * Default in the plugin is `"inside"` when omitted.
 */
export type ThumbnailResizeFit = "cover" | "contain" | "fill" | "inside" | "outside";

/**
 * One derived thumbnail / preview size. Names must be stable for idempotent storage keys.
 */
export interface ThumbnailPreset {
  /** Used in storage path (e.g. `sm`, `cover`). */
  name: string;
  /** Max width (px); aspect preserved if height omitted. */
  width?: number;
  /** Max height (px); aspect preserved if width omitted. */
  height?: number;
  /**
   * How the image is scaled to `width`/`height`. Default: `"inside"`.
   * If you take values from a client, validate against {@link ThumbnailResizeFit} on the server
   * before putting them on the preset (or use {@link MediaProcessingPluginOptions.resolveThumbnailPreset}).
   */
  fit?: ThumbnailResizeFit;
  /** Output format. Default: `webp`. */
  format?: "jpeg" | "jpg" | "png" | "webp" | "avif";
  /** Quality for lossy formats (1–100). Default: 80. */
  quality?: number;
}

const DEFAULT_ALLOWED_MIME = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/tiff",
  "image/avif",
] as const;

/** Default MIME allowlist for thumbnail generation (raster-friendly). */
export const DEFAULT_ALLOWED_IMAGE_MIME_TYPES: string[] = [...DEFAULT_ALLOWED_MIME];

const DEFAULT_MAX_INPUT_BYTES = 25 * 1024 * 1024;

const DEFAULT_PRESETS: ThumbnailPreset[] = [{ name: "sm", width: 320, format: "webp" }];

/**
 * Media processing plugin configuration (image thumbnails via optional `sharp`).
 */
export interface MediaProcessingPluginOptions {
  /**
   * Execution mode. Default: `"background"`.
   */
  executionMode?: "sync" | "background";

  /**
   * Generate thumbnails for allowed image MIME types. Default: true.
   * Requires optional peer `sharp` to be installed.
   */
  thumbnails?: boolean;

  /** Presets run in order. Default: single 320px WebP thumbnail. */
  thumbnailPresets?: ThumbnailPreset[];

  /**
   * Adjust each preset at runtime (e.g. merge validated upload metadata into `fit`).
   * Use this when the client sends crop/fit preferences and your route copies them into `context.metadata`.
   */
  resolveThumbnailPreset?: (
    context: PipelineContext,
    preset: ThumbnailPreset,
    index: number
  ) => ThumbnailPreset | Promise<ThumbnailPreset>;

  /**
   * Only process files whose `file.mimeType` is in this list.
   * Default: common raster images (see {@link DEFAULT_ALLOWED_IMAGE_MIME_TYPES}).
   */
  allowedMimeTypes?: string[];

  /** Skip processing when input is larger than this (bytes). Default: 25 MiB. */
  maxInputBytes?: number;

  /**
   * Prefix for derivative storage keys: `{derivativePrefix}/{recordId}/thumb-{name}.{ext}`.
   * Default: `"versions"`.
   */
  derivativePrefix?: string;

  /**
   * Insert rows into `media_versions` after each successful `storage.put`.
   * Default: true.
   */
  persistMediaVersions?: boolean;

  /**
   * If the derivative key already exists in storage, skip upload and DB insert.
   * Default: true.
   */
  skipExistingDerivatives?: boolean;

  /**
   * Optional timeout for the whole image pass (ms). Default: 120_000.
   */
  timeoutMs?: number;
}

export function resolveMediaProcessingOptions(
  opts: MediaProcessingPluginOptions
): Required<
  Pick<
    MediaProcessingPluginOptions,
    | "thumbnails"
    | "thumbnailPresets"
    | "allowedMimeTypes"
    | "maxInputBytes"
    | "derivativePrefix"
    | "persistMediaVersions"
    | "skipExistingDerivatives"
    | "timeoutMs"
  >
> {
  return {
    thumbnails: opts.thumbnails !== false,
    thumbnailPresets:
      opts.thumbnailPresets && opts.thumbnailPresets.length > 0
        ? opts.thumbnailPresets
        : DEFAULT_PRESETS,
    allowedMimeTypes: opts.allowedMimeTypes ?? [...DEFAULT_ALLOWED_IMAGE_MIME_TYPES],
    maxInputBytes: opts.maxInputBytes ?? DEFAULT_MAX_INPUT_BYTES,
    derivativePrefix: opts.derivativePrefix ?? "versions",
    persistMediaVersions: opts.persistMediaVersions !== false,
    skipExistingDerivatives: opts.skipExistingDerivatives !== false,
    timeoutMs: opts.timeoutMs ?? 120_000,
  };
}
