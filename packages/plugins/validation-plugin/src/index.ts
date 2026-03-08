import type { PipelinePlugin, PipelineContext } from "@better-media/core";

export const validationPlugin: PipelinePlugin = {
  name: "validation",
  async execute(context: PipelineContext) {
    console.log(`Validating file ${context.fileKey}...`);
  },
};
