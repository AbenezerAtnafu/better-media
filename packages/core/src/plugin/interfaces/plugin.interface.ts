import type { MediaRuntime } from "./media-runtime.interface";
import type { PipelineContext } from "./context.interface";

/** Plugin execution mode: sync (inline) or background (queued) */
export type PluginExecutionMode = "sync" | "background";

/**
 * Plugin capabilities: what a plugin is allowed to do.
 */
export type PluginCapability =
  | "file.read"
  | "metadata.write.own"
  | "processing.write.own"
  | "trusted.propose";

/**
 * Plugin trust level: untrusted (default) or trusted.
 */
export type PluginTrustLevel = "untrusted" | "trusted";

/**
 * Plugin Manifest: immutable identity and requirements.
 */
export interface PluginManifest {
  readonly id: string;
  readonly version: string;
  readonly trustLevel: PluginTrustLevel;
  readonly capabilities: PluginCapability[];
  readonly namespace: string;
}

/**
 * Pipeline Plugin (apply pattern, Webpack/Babel style)
 * - apply: receive runtime, tap into hooks (preferred)
 * - execute: legacy single-phase; mapped to process:run when apply is absent
 */
export interface PipelinePlugin {
  readonly name: string;
  /** Manifest: Required identity and security metadata */
  readonly runtimeManifest: PluginManifest;
  /** Apply: receive runtime, tap into hooks. Standard Webpack/Babel pattern. */
  apply?(runtime: MediaRuntime): void;
  /** Legacy: single-phase execution. Mapped to process:run when apply is absent. */
  execute?(context: PipelineContext): Promise<void>;
  /** Execution mode: sync (default) or background */
  readonly executionMode?: PluginExecutionMode;
  /** Intensive plugins run in background by default. Non-intensive default to sync. */
  readonly intensive?: boolean;
}
