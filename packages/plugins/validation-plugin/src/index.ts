import type { PipelinePlugin, MediaRuntime } from "@better-media/core";

export function validationPlugin(): PipelinePlugin {
  return {
    name: "validation",
    apply(runtime: MediaRuntime) {
      runtime.hooks["validation:run"].tap("validation", async (context) => {
        console.log(`Validating file ${context.fileKey}...`);
      });
    },
  };
}
