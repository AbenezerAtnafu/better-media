import type { DatabaseAdapter } from "../../database/interfaces/adapter.interface";
import type { JobAdapter } from "../../job/interfaces/adapter.interface";
import type { StorageAdapter } from "../../storage/interfaces/adapter.interface";
import type { FileInfo } from "./file-info.interface";
import type { StorageLocation } from "./storage-location.interface";
import type { ProcessingResults } from "./processing-results.interface";
import type { TrustedMetadata } from "./trusted-metadata.interface";

/** File content loaded by framework. buffer or tempPath (when streamed to disk). */
export interface FileContent {
  buffer?: Buffer;
  tempPath?: string;
}

export interface PipelineContext {
  /** The unique database record identifier (typically a generated UUID). */
  recordId: string;

  /** Core file information. Mutable. */
  file: FileInfo;

  /** Storage location. Mutable but typically set once. */
  storageLocation: StorageLocation;

  /** Processing outputs (thumbnails, variants, etc). Mutable. */
  processing: ProcessingResults;

  /** Custom app/plugin metadata. Mutable. */
  metadata: Record<string, unknown>;

  /**
   * Plugin-derived metadata. First writer wins.
   * Prefilled from DB when available. Plugins read when set, compute and write when missing.
   */
  trusted: TrustedMetadata;

  /** Storage adapter – read-only reference */
  storage: StorageAdapter;

  /** Database adapter – read-only reference */
  database: DatabaseAdapter;

  /** Job adapter – read-only reference */
  jobs: JobAdapter;

  /** Plugin scratchpad. Not persisted. Mutable. Includes file content (buffer/tempPath) from framework. */
  utilities?: Record<string, unknown> & { fileContent?: FileContent };
}

/** Framework-mediated Write API for Plugins */
export interface PluginApi {
  /** Emit metadata under the plugin's own namespace. Scoped automatically. */
  emitMetadata(patch: Record<string, unknown>): void;
  /** Emit processing results (transcription, thumbnails) under plugin's namespace. */
  emitProcessing(patch: Record<string, unknown>): void;
  /** Propose updates to global trusted metadata. ONLY for 'trusted' plugins. */
  proposeTrusted(patch: TrustedMetadata): void;
}
