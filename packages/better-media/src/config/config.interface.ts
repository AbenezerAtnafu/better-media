import type {
  StorageAdapter,
  DatabaseAdapter,
  JobAdapter,
  PipelinePlugin,
} from "@better-media/core";

import type { BetterMediaSettings } from "./settings.interface";

/** Configuration for the Better Media framework */
export interface BetterMediaConfig {
  /** Storage adapter for file bytes (S3, GCS, local, etc.) */
  storage: StorageAdapter;
  /** Database adapter for media metadata/records */
  database: DatabaseAdapter;
  /** Plugins to run in order during the lifecycle */
  plugins: PipelinePlugin[];
  /** Optional job adapter for background execution (default: in-memory) */
  jobs?: JobAdapter;
  /** Optional settings */
  settings?: BetterMediaSettings;
}
