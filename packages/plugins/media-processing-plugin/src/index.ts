import type { PipelinePlugin, MediaRuntime, PipelineContext, PluginApi } from "@better-media/core";
import type { MediaProcessingPluginOptions } from "./interfaces/options.interface";
import { runMediaProcessing } from "./runtime/runner";

export type { MediaProcessingPluginOptions } from "./interfaces/options.interface";

/**
 * Media processing plugin for the Better Media pipeline (stub).
 * Currently logs on `process:run`; thumbnail/metadata handling is not implemented.
 */
export function mediaProcessingPlugin(opts: MediaProcessingPluginOptions = {}): PipelinePlugin {
  const executionMode = opts.executionMode ?? "background";
  const isBackground = executionMode === "background";

  return {
    name: "media-processing",
    runtimeManifest: {
      id: "better-media-processing",
      version: "1.0.0",
      trustLevel: "untrusted",
      capabilities: ["file.read", "metadata.write.own", "processing.write.own"],
      namespace: "media-processing",
    },
    executionMode,
    intensive: isBackground,
    apply(runtime: MediaRuntime) {
      runtime.hooks["process:run"].tap(
        "media-processing",
        async (context: PipelineContext, api: PluginApi) => runMediaProcessing(context, api, opts),
        { mode: executionMode }
      );
    },
  };
}
