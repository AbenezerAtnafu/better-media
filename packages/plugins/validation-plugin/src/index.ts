import type { PipelinePlugin, MediaRuntime, PipelineContext, PluginApi } from "@better-media/core";
import type { ValidationPluginOptions } from "./interfaces/options.interface";
import { runValidation } from "./runtime/runner";

export type { ValidationPluginOptions } from "./interfaces/options.interface";

/**
 * Validation plugin for the Better Media pipeline.
 * Supports file type, size, dimensions, checksum, and custom validators.
 * Configurable failure behavior and file-not-found handling (presigned URLs).
 */
export function validationPlugin(opts: ValidationPluginOptions = {}): PipelinePlugin {
  const executionMode = opts.executionMode ?? "background";
  const isBackground = executionMode === "background";

  return {
    name: "validation",
    runtimeManifest: {
      id: "better-media-validation",
      version: "1.0.0",
      trustLevel: "trusted", // Authorized for core metadata (size, mime, checksums)
      capabilities: ["file.read", "metadata.write.own", "processing.write.own", "trusted.propose"],
      namespace: "validation",
    },
    executionMode,
    intensive: isBackground,
    apply(runtime: MediaRuntime) {
      runtime.hooks["validation:run"].tap(
        "validation",
        async (context: PipelineContext, api: PluginApi) => {
          return runValidation(context, api, opts);
        },
        { mode: executionMode }
      );
    },
  };
}
