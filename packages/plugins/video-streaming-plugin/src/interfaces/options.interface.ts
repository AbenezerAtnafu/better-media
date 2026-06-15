import type { PipelineContext } from "@better-media/core";
import { DEFAULT_STREAMING_PRESETS, DEFAULT_VIDEO_MIME_TYPES } from "../constants/presets";

export type StreamingFormat = "hls" | "dash";

export interface StreamingPreset {
  /** Used in storage path, e.g. "360p", "720p". Must be stable for idempotent keys. */
  name: string;
  /** Output width (px). Aspect ratio preserved if only height is set. */
  width?: number;
  /** Output height (px). Aspect ratio preserved if only width is set. */
  height?: number;
  /** Video bitrate, e.g. "1000k". */
  videoBitrate?: string;
  /** Audio bitrate, e.g. "128k". */
  audioBitrate?: string;
  /** Video codec. Default: "libx264". */
  videoCodec?: string;
  /** Audio codec. Default: "aac". */
  audioCodec?: string;
}

export interface VideoStreamingPluginOptions {
  /** Execution mode. Default: "background". */
  executionMode?: "sync" | "background";

  /**
   * Streaming formats to generate. Default: ["hls"].
   * Add "dash" to also produce a DASH manifest.
   */
  formats?: StreamingFormat[];

  /** Quality presets to transcode. Default: 360p / 720p / 1080p. */
  presets?: StreamingPreset[];

  /**
   * Adjust each preset at runtime from context.metadata (e.g. restrict max quality
   * based on subscription tier).
   */
  resolvePreset?: (
    context: PipelineContext,
    preset: StreamingPreset,
    index: number
  ) => StreamingPreset | Promise<StreamingPreset>;

  /** Only process files whose mimeType is in this list. Default: common video types. */
  allowedMimeTypes?: string[];

  /** Prefix for streaming storage keys. Default: "streaming". */
  derivativePrefix?: string;

  /** HLS/DASH segment duration in seconds. Default: 6. */
  segmentDuration?: number;

  /**
   * Insert rows into media_versions for master playlists and variant playlists.
   * Individual segments are never persisted. Default: true.
   */
  persistMediaVersions?: boolean;

  /**
   * Skip transcoding if the master playlist already exists in storage. Default: true.
   */
  skipExistingDerivatives?: boolean;

  /** Timeout for the full transcoding pass (ms). Default: 600_000 (10 min). */
  timeoutMs?: number;
}

export type ResolvedVideoStreamingOptions = Required<
  Pick<
    VideoStreamingPluginOptions,
    | "formats"
    | "presets"
    | "allowedMimeTypes"
    | "derivativePrefix"
    | "segmentDuration"
    | "persistMediaVersions"
    | "skipExistingDerivatives"
    | "timeoutMs"
  >
>;

export function resolveVideoStreamingOptions(
  opts: VideoStreamingPluginOptions
): ResolvedVideoStreamingOptions {
  return {
    formats: opts.formats && opts.formats.length > 0 ? opts.formats : ["hls"],
    presets:
      opts.presets && opts.presets.length > 0 ? opts.presets : [...DEFAULT_STREAMING_PRESETS],
    allowedMimeTypes: opts.allowedMimeTypes ?? [...DEFAULT_VIDEO_MIME_TYPES],
    derivativePrefix: opts.derivativePrefix ?? "streaming",
    segmentDuration: opts.segmentDuration ?? 6,
    persistMediaVersions: opts.persistMediaVersions !== false,
    skipExistingDerivatives: opts.skipExistingDerivatives !== false,
    timeoutMs: opts.timeoutMs ?? 600_000,
  };
}
