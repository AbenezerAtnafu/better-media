import type { PipelinePlugin, MediaRuntime, PipelineContext, PluginApi } from "@better-media/core";
import type { AudioStreamingPluginOptions } from "./interfaces/options.interface";
import { runAudioStreaming } from "./runtime/runner";

export type {
  AudioStreamingPluginOptions,
  AudioPreset,
  AudioStreamingFormat,
} from "./interfaces/options.interface";
export { DEFAULT_AUDIO_PRESETS, DEFAULT_AUDIO_MIME_TYPES } from "./constants/presets";

/**
 * Audio streaming plugin: HLS, DASH, and/or progressive transcoding via ffmpeg.
 *
 * Requires `fluent-ffmpeg` peer dependency and the `ffmpeg` binary in PATH.
 */
export function audioStreamingPlugin(opts: AudioStreamingPluginOptions = {}): PipelinePlugin {
  const executionMode = opts.executionMode ?? "background";

  return {
    name: "audio-streaming",
    runtimeManifest: {
      id: "better-media-audio-streaming",
      version: "0.8.0",
      trustLevel: "untrusted",
      capabilities: ["file.read", "metadata.write.own", "processing.write.own"],
      namespace: "audio-streaming",
    },
    executionMode,
    intensive: true,
    apply(runtime: MediaRuntime) {
      runtime.hooks["process:run"].tap(
        "audio-streaming",
        async (context: PipelineContext, api: PluginApi) => runAudioStreaming(context, api, opts),
        { mode: executionMode }
      );
    },
  };
}
