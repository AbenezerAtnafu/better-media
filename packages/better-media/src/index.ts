import type { MediaStatus, PipelinePlugin, PipelineContext } from '@better-media/core';

export class IntakeService {
  async handleUpload(fileKey: string) {
    console.log(`Handling upload for ${fileKey}...`);
    return 'PENDING_VERIFICATION' satisfies MediaStatus;
  }
}

export class PipelineEngine {
  private steps: PipelinePlugin[] = [];

  registerStep(step: PipelinePlugin) {
    this.steps.push(step);
  }

  async run(fileKey: string, metadata: Record<string, unknown> = {}) {
    const context: PipelineContext = { fileKey, metadata };
    for (const step of this.steps) {
      await step.execute(context);
    }
  }
}
