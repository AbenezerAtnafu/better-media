import type { PipelinePlugin, MediaRuntime, PipelineContext, PluginApi } from "@better-media/core";
import type { VideoStreamingPluginOptions } from "./interfaces/options.interface";
import { runVideoStreaming } from "./runtime/runner";

export type {
  VideoStreamingPluginOptions,
  StreamingPreset,
  StreamingFormat,
} from "./interfaces/options.interface";
export { DEFAULT_STREAMING_PRESETS, DEFAULT_VIDEO_MIME_TYPES } from "./constants/presets";

/**
 * Video streaming plugin: adaptive-bitrate HLS (and optionally DASH) transcoding via ffmpeg.
 *
 * Requires `fluent-ffmpeg` peer dependency and the `ffmpeg` binary in PATH.
 */
export function videoStreamingPlugin(opts: VideoStreamingPluginOptions = {}): PipelinePlugin {
  const executionMode = opts.executionMode ?? "background";

  return {
    name: "video-streaming",
    runtimeManifest: {
      id: "better-media-video-streaming",
      version: "1.0.0",
      trustLevel: "untrusted",
      capabilities: ["file.read", "metadata.write.own", "processing.write.own"],
      namespace: "video-streaming",
    },
    executionMode,
    intensive: true,
    apply(runtime: MediaRuntime) {
      runtime.hooks["process:run"].tap(
        "video-streaming",
        async (context: PipelineContext, api: PluginApi) => runVideoStreaming(context, api, opts),
        { mode: executionMode }
      );
    },
  };
}
