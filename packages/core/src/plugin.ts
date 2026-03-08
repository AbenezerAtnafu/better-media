export interface PipelineContext {
  fileKey: string;
  metadata: Record<string, unknown>;
}

export interface PipelinePlugin {
  readonly name: string;
  execute(context: PipelineContext): Promise<void>;
}
