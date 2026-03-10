import type { PipelinePlugin, MediaRuntime } from "@better-media/core";

export interface MediaProcessingPluginOptions {
  /** Execution mode: sync (inline) or background (queued) */
  mode?: "sync" | "background";
}

export function mediaProcessingPlugin(options: MediaProcessingPluginOptions = {}): PipelinePlugin {
  const { mode = "sync" } = options;
  return {
    name: "media-processing",
    apply(runtime: MediaRuntime) {
      runtime.hooks["process:run"].tap(
        "media-processing",
        async (context) => {
          console.log(`Processing media ${context.file.key}...`);
        },
        { mode }
      );
    },
  };
}
