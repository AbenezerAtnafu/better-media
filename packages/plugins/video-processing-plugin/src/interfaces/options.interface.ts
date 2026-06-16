import { DEFAULT_THUMBNAIL_PRESETS, DEFAULT_VIDEO_MIME_TYPES } from "../constants/defaults";

/** A single thumbnail to extract from the video. */
export interface ThumbnailPreset {
  /**
   * Position to extract.
   * - number: seconds from start (e.g. 5 = 5s)
   * - string ending with "%": percentage of total duration (e.g. "10%")
   * - other string: parsed as seconds (e.g. "5.5")
   */
  at: number | string;
  /** Output image format. Default: "jpeg". */
  format?: "jpeg" | "png" | "webp";
  /** Output width in pixels. Aspect ratio preserved when only one dimension is set. */
  width?: number;
  /** Output height in pixels. */
  height?: number;
}

/** A single transcode target. */
export interface TranscodePreset {
  /** Identifier used in storage key and media_versions. Must be stable. */
  name: string;
  /** Output container format. */
  format: "mp4" | "webm";
  /** Video codec. Defaults: libx264 (mp4), libvpx-vp9 (webm). */
  videoCodec?: string;
  /** Audio codec. Defaults: aac (mp4), libopus (webm). */
  audioCodec?: string;
  /** Video bitrate, e.g. "1000k". */
  videoBitrate?: string;
  /** Audio bitrate, e.g. "128k". */
  audioBitrate?: string;
  /** Resolution as "WxH", e.g. "1280x720". Omit to keep source resolution. */
  resolution?: string;
}

export interface VideoProcessingPluginOptions {
  /** Execution mode. Default: "background". */
  executionMode?: "sync" | "background";

  /**
   * Thumbnail presets to extract.
   * Pass `false` to disable thumbnail extraction entirely.
   * Default: one JPEG at 10% of duration, 640px wide.
   */
  thumbnails?: ThumbnailPreset[] | false;

  /**
   * Transcode presets to produce. Omit or pass an empty array for no transcoding.
   * Each preset produces one output file stored as a media_versions row.
   */
  transcode?: TranscodePreset[];

  /** Only process files whose mimeType is in this list. Default: common video types. */
  allowedMimeTypes?: string[];

  /**
   * Skip the plugin if the source file is larger than this (bytes).
   * Useful for very large uploads that shouldn't block the sync path.
   * Default: no limit.
   */
  maxInputBytes?: number;

  /** Override the ffmpeg binary path. Default: resolved from PATH. */
  ffmpegPath?: string;

  /** Override the ffprobe binary path. Default: resolved from PATH. */
  ffprobePath?: string;

  /** Storage key prefix for derivative files. Default: "processing". */
  derivativePrefix?: string;

  /**
   * Insert rows into media_versions for thumbnails and transcoded outputs.
   * Default: true.
   */
  persistMediaVersions?: boolean;

  /**
   * Skip a thumbnail or transcode if the storage key already exists.
   * Default: true.
   */
  skipExistingDerivatives?: boolean;

  /** Timeout for the full processing run in milliseconds. Default: 300_000 (5 min). */
  timeoutMs?: number;
}

export type ResolvedVideoProcessingOptions = Required<
  Pick<
    VideoProcessingPluginOptions,
    | "allowedMimeTypes"
    | "derivativePrefix"
    | "persistMediaVersions"
    | "skipExistingDerivatives"
    | "timeoutMs"
  >
> & {
  thumbnails: ThumbnailPreset[] | false;
  transcode: TranscodePreset[];
  maxInputBytes: number | undefined;
  ffmpegPath: string | undefined;
  ffprobePath: string | undefined;
};

export function resolveVideoProcessingOptions(
  opts: VideoProcessingPluginOptions
): ResolvedVideoProcessingOptions {
  return {
    thumbnails:
      opts.thumbnails === false
        ? false
        : opts.thumbnails && opts.thumbnails.length > 0
          ? opts.thumbnails
          : [...DEFAULT_THUMBNAIL_PRESETS],
    transcode: opts.transcode ?? [],
    allowedMimeTypes: opts.allowedMimeTypes ?? [...DEFAULT_VIDEO_MIME_TYPES],
    maxInputBytes: opts.maxInputBytes,
    ffmpegPath: opts.ffmpegPath,
    ffprobePath: opts.ffprobePath,
    derivativePrefix: opts.derivativePrefix ?? "processing",
    persistMediaVersions: opts.persistMediaVersions !== false,
    skipExistingDerivatives: opts.skipExistingDerivatives !== false,
    timeoutMs: opts.timeoutMs ?? 300_000,
  };
}
