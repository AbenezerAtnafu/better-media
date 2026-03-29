import type { PipelineContext, PluginApi } from "@better-media/core";
import type { MediaProcessingPluginOptions } from "../interfaces/options.interface";

export async function runMediaProcessing(
  context: PipelineContext,
  _api: PluginApi,
  opts: MediaProcessingPluginOptions
): Promise<void> {
  const { file } = context;
  console.log("[media-processing] process:run (stub — sharp/ffmpeg disabled)", {
    key: file.key,
    mimeType: file.mimeType,
    executionMode: opts.executionMode ?? "background",
  });
}
