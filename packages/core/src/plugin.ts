import type { StorageAdapter } from "./storage";
import type { DatabaseAdapter } from "./database";

/** Plugin execution mode: sync (inline) or background (queued) */
export type PluginExecutionMode = "sync" | "background";

/** Plugin lifecycle hooks (extensible) */
export interface PluginHooks {
  /** Hook names → handlers. Structure for future use. */
  [key: string]: (...args: unknown[]) => Promise<void>;
}

export interface PipelineContext {
  fileKey: string;
  metadata: Record<string, unknown>;
  /** Storage adapter for reading/writing file bytes */
  storage: StorageAdapter;
  /** Database adapter for media metadata/records */
  database: DatabaseAdapter;
}

/**
 * Pipeline Plugin
 * ├─ name
 * ├─ hooks (extensible lifecycle hooks)
 * └─ execution mode
 *      ├─ sync    – run inline during processUpload
 *      └─ background – enqueue via job adapter
 */
export interface PipelinePlugin {
  readonly name: string;
  /** Lifecycle hooks. Structure for future use. */
  readonly hooks?: PluginHooks;
  /** Execution mode: sync (default) or background */
  readonly executionMode?: PluginExecutionMode;
  execute(context: PipelineContext): Promise<void>;
}
