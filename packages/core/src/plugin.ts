import type { StorageAdapter } from "./storage";
import type { DatabaseAdapter } from "./database";

export interface PipelineContext {
  fileKey: string;
  metadata: Record<string, unknown>;
  /** Storage adapter for reading/writing file bytes */
  storage: StorageAdapter;
  /** Database adapter for media metadata/records */
  database: DatabaseAdapter;
}

export interface PipelinePlugin {
  readonly name: string;
  execute(context: PipelineContext): Promise<void>;
}
