import type { PipelinePlugin, PipelineContext } from "@better-media/core";

export function validationPlugin(): PipelinePlugin {
  return {
    name: "validation",
    async execute(context: PipelineContext) {
      console.log(`Validating file ${context.fileKey}...`);
    },
  };
}
