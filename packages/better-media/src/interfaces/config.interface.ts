import type {
    StorageAdapter,
    DatabaseAdapter,
    PipelinePlugin,
  } from "@better-media/core";

import { BetterMediaSettings } from "./settings.interface";

/** Configuration for the Better Media framework */
export interface BetterMediaConfig {
    /** Storage adapter for file bytes (S3, GCS, local, etc.) */
    storage: StorageAdapter;
    /** Database adapter for media metadata/records */
    database: DatabaseAdapter;
    /** Plugins to run in order during the lifecycle */
    plugins: PipelinePlugin[];
    /** Optional settings */
    settings?: BetterMediaSettings;
  }