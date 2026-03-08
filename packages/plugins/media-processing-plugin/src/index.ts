import type { PipelinePlugin, PipelineContext } from "@better-media/core";

export const mediaProcessingPlugin: PipelinePlugin = {
  name: "media-processing",
  async execute(context: PipelineContext) {
    console.log(`Processing media ${context.fileKey}...`);
  },
};
