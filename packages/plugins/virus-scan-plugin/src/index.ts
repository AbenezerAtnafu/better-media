import type { PipelinePlugin, PipelineContext } from "@better-media/core";

export function virusScanPlugin(): PipelinePlugin {
  return {
    name: "virus-scan",
    async execute(context: PipelineContext) {
      console.log(`Scanning file ${context.fileKey} for viruses...`);
    },
  };
}
