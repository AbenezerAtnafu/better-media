import type { PipelinePlugin, PipelineContext } from "@better-media/core";

export function mediaProcessingPlugin(): PipelinePlugin {
  return {
    name: "media-processing",
    async execute(context: PipelineContext) {
      console.log(`Processing media ${context.fileKey}...`);
    },
  };
}
