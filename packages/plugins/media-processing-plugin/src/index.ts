import type { PipelinePlugin, MediaRuntime } from "@better-media/core";
import type { MediaProcessingPluginOptions } from "./interfaces/options.interface";
import { runMediaProcessing } from "./runtime/runner";

export type { MediaProcessingPluginOptions } from "./interfaces/options.interface";
export type { ExtractedMetadata } from "./interfaces/extracted-metadata.interface";
export type { ThumbnailSize } from "./interfaces/thumbnail-size.interface";

/**
 * Media processing plugin for the Better Media pipeline.
 * Generates thumbnails for images and video, extracts metadata (dimensions, EXIF, duration).
 * Uses sharp for images, ffmpeg for video. Configurable sizes and execution mode.
 */
export function mediaProcessingPlugin(opts: MediaProcessingPluginOptions = {}): PipelinePlugin {
  const executionMode = opts.executionMode ?? "background";
  const isBackground = executionMode === "background";

  return {
    name: "media-processing",
    executionMode,
    intensive: isBackground,
    apply(runtime: MediaRuntime) {
      runtime.hooks["process:run"].tap(
        "media-processing",
        async (context) => runMediaProcessing(context, opts),
        { mode: executionMode }
      );
    },
  };
}
