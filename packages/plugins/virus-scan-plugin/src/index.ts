import type { PipelinePlugin, PipelineContext } from '@better-media/core';

export const virusScanPlugin: PipelinePlugin = {
  name: 'virus-scan',
  async execute(context: PipelineContext) {
    console.log(`Scanning file ${context.fileKey} for viruses...`);
  },
};
