import type { PipelineContext } from "@better-media/core";
import { DEFAULT_AUDIO_PRESETS, DEFAULT_AUDIO_MIME_TYPES } from "../constants/presets";

export type AudioStreamingFormat = "hls" | "dash" | "progressive";

export interface AudioPreset {
  /** Used in storage path, e.g. "high", "medium". Must be stable for idempotent keys. */
  name: string;
  /** Audio bitrate, e.g. "192k". Default: "128k". */
  bitrate?: string;
  /**
   * FFmpeg audio codec. Default: "aac".
   * Common values: "aac", "libmp3lame" (MP3), "libopus" (Opus).
   */
  codec?: string;
  /** Sample rate in Hz, e.g. 44100 or 48000. Omit to keep source rate. */
  sampleRate?: number;
  /** Channel count. 1 = mono, 2 = stereo (default). */
  channels?: number;
}

export interface AudioStreamingPluginOptions {
  /** Execution mode. Default: "background". */
  executionMode?: "sync" | "background";

  /**
   * Streaming formats to generate. Default: ["hls"].
   * - "hls": segmented HLS stream (.m3u8 + .ts segments)
   * - "dash": DASH manifest + segments
   * - "progressive": single transcoded file per preset (direct download)
   */
  formats?: AudioStreamingFormat[];

  /** Quality presets to transcode. Default: high/medium/low AAC. */
  presets?: AudioPreset[];

  /**
   * Adjust each preset at runtime from context.metadata (e.g. restrict quality
   * based on subscription tier).
   */
  resolvePreset?: (
    context: PipelineContext,
    preset: AudioPreset,
    index: number
  ) => AudioPreset | Promise<AudioPreset>;

  /** Only process files whose mimeType is in this list. Default: common audio types. */
  allowedMimeTypes?: string[];

  /** Prefix for streaming storage keys. Default: "audio". */
  derivativePrefix?: string;

  /** HLS/DASH segment duration in seconds. Default: 6. */
  segmentDuration?: number;

  /**
   * Insert rows into media_versions for:
   * - HLS/DASH: master playlist + each variant playlist
   * - progressive: each transcoded file
   * Default: true.
   */
  persistMediaVersions?: boolean;

  /**
   * Skip transcoding if the master key already exists in storage.
   * For progressive, checks the first preset's file. Default: true.
   */
  skipExistingDerivatives?: boolean;

  /** Timeout for the full transcoding pass (ms). Default: 300_000 (5 min). */
  timeoutMs?: number;
}

export type ResolvedAudioStreamingOptions = Required<
  Pick<
    AudioStreamingPluginOptions,
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

export function resolveAudioStreamingOptions(
  opts: AudioStreamingPluginOptions
): ResolvedAudioStreamingOptions {
  return {
    formats: opts.formats && opts.formats.length > 0 ? opts.formats : ["hls"],
    presets: opts.presets && opts.presets.length > 0 ? opts.presets : [...DEFAULT_AUDIO_PRESETS],
    allowedMimeTypes: opts.allowedMimeTypes ?? [...DEFAULT_AUDIO_MIME_TYPES],
    derivativePrefix: opts.derivativePrefix ?? "audio",
    segmentDuration: opts.segmentDuration ?? 6,
    persistMediaVersions: opts.persistMediaVersions !== false,
    skipExistingDerivatives: opts.skipExistingDerivatives !== false,
    timeoutMs: opts.timeoutMs ?? 300_000,
  };
}

/** Infer file extension and ffmpeg format string from codec name. */
export function inferProgressiveFormat(codec: string): { ext: string; ffmpegFormat: string } {
  switch (codec) {
    case "libmp3lame":
      return { ext: ".mp3", ffmpegFormat: "mp3" };
    case "libopus":
      return { ext: ".opus", ffmpegFormat: "opus" };
    case "aac":
    default:
      return { ext: ".aac", ffmpegFormat: "adts" };
  }
}
