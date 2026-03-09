import { DatabaseAdapter } from "../../database/interfaces/adapter.interface";
import { StorageAdapter } from "../../storage/interfaces/adapter.interface";

export interface PipelineContext {
  fileKey: string;
  metadata: Record<string, unknown>;
  /** Storage adapter for reading/writing file bytes */
  storage: StorageAdapter;
  /** Database adapter for media metadata/records */
  database: DatabaseAdapter;
}
