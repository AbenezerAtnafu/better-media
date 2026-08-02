import type { PipelinePlugin, MediaRuntime, PipelineContext, PluginApi } from "@better-media/core";
import type { VideoProcessingPluginOptions } from "./interfaces/options.interface";
import { runVideoProcessing } from "./runtime/runner";

export type {
  VideoProcessingPluginOptions,
  ThumbnailPreset,
  TranscodePreset,
} from "./interfaces/options.interface";
export { DEFAULT_THUMBNAIL_PRESETS, DEFAULT_VIDEO_MIME_TYPES } from "./constants/defaults";

/**
 * Video processing plugin: thumbnail extraction, transcoding, and metadata via ffmpeg.
 *
 * Requires `fluent-ffmpeg` peer dependency and the `ffmpeg`/`ffprobe` binaries in PATH.
 */
export function videoProcessingPlugin(opts: VideoProcessingPluginOptions = {}): PipelinePlugin {
  const executionMode = opts.executionMode ?? "background";

  return {
    name: "video-processing",
    runtimeManifest: {
      id: "better-media-video-processing",
      version: "0.8.0",
      trustLevel: "untrusted",
      capabilities: ["file.read", "metadata.write.own", "processing.write.own"],
      namespace: "video-processing",
    },
    executionMode,
    intensive: true,
    apply(runtime: MediaRuntime) {
      runtime.hooks["process:run"].tap(
        "video-processing",
        async (context: PipelineContext, api: PluginApi) => runVideoProcessing(context, api, opts),
        { mode: executionMode }
      );
    },
  };
}
