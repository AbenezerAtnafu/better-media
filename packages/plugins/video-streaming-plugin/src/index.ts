import type { PipelinePlugin, MediaRuntime, PipelineContext, PluginApi } from "@better-media/core";
import type { VideoStreamingPluginOptions } from "./interfaces/options.interface";
import { runVideoStreaming } from "./runtime/runner";

export type {
  VideoStreamingPluginOptions,
  StreamingProgressEvent,
  StreamingPreset,
  StreamingFormat,
} from "./interfaces/options.interface";
export { DEFAULT_STREAMING_PRESETS, DEFAULT_VIDEO_MIME_TYPES } from "./constants/presets";
export { resolveStreamingUrls } from "./playback/resolve-streaming-urls";
export type {
  StreamingUrlResult,
  ResolveStreamingUrlsOptions,
} from "./playback/resolve-streaming-urls";
export { resolveStreamingStatus } from "./playback/resolve-streaming-status";
export type {
  StreamingStatus,
  ResolveStreamingStatusOptions,
} from "./playback/resolve-streaming-status";
export { createStreamingProxy } from "./playback/create-streaming-proxy";
export type {
  StreamingProxyOptions,
  ProxyHandleOptions,
  StreamingProxy,
} from "./playback/create-streaming-proxy";

/**
 * Video streaming plugin: adaptive-bitrate HLS (and optionally DASH) transcoding via ffmpeg.
 *
 * Requires `fluent-ffmpeg` peer dependency and the `ffmpeg` binary in PATH.
 */
export function videoStreamingPlugin(opts: VideoStreamingPluginOptions = {}): PipelinePlugin {
  return {
    name: "video-streaming",
    runtimeManifest: {
      id: "better-media-video-streaming",
      version: "0.8.0",
      trustLevel: "untrusted",
      capabilities: ["file.read", "metadata.write.own", "processing.write.own"],
      namespace: "video-streaming",
    },
    executionMode: "background",
    intensive: true,
    apply(runtime: MediaRuntime) {
      runtime.hooks["process:run"].tap(
        "video-streaming",
        async (context: PipelineContext, api: PluginApi) => runVideoStreaming(context, api, opts),
        { mode: "background" }
      );
    },
  };
}
