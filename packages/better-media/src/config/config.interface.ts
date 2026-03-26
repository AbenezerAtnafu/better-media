import type {
  StorageAdapter,
  DatabaseAdapter,
  JobAdapter,
  PipelinePlugin,
} from "@better-media/core";

import type { BetterMediaSettings } from "./settings.interface";
import type { FileHandlingConfig } from "../core/file-loader";
import type { TrustedPluginPolicy } from "../plugins/plugin-registry";
import type { PgPoolLike } from "../db/postgres";

/** Configuration for the Better Media framework */
export interface BetterMediaConfig {
  /** Storage adapter for file bytes (S3, GCS, local, etc.) */
  storage: StorageAdapter;
  /** Database adapter or a Postgres Pool (built-in) for media metadata/records */
  database: DatabaseAdapter | PgPoolLike;
  /** Plugins to run in order during the lifecycle */
  plugins: PipelinePlugin[];
  /** Optional job adapter for background execution (default: in-memory) */
  jobs?: JobAdapter;
  /** Optional settings */
  settings?: BetterMediaSettings;
  /**
   * Optional file handling. When maxBufferBytes is set, files larger than that
   * are streamed to a temp file instead of loaded into memory.
   */
  fileHandling?: FileHandlingConfig;
  /** Optional policy gate for authorizing trusted plugins */
  trustedPolicy?: TrustedPluginPolicy;
}
