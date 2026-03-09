import type { MediaRuntime } from "./media-runtime.interface";
import type { PipelineContext } from "./context.interface";

/** Plugin execution mode: sync (inline) or background (queued) */
export type PluginExecutionMode = "sync" | "background";

/**
 * Pipeline Plugin (apply pattern, Webpack/Babel style)
 * - apply: receive runtime, tap into hooks (preferred)
 * - execute: legacy single-phase; mapped to process:run when apply is absent
 */
export interface PipelinePlugin {
  readonly name: string;
  /** Apply: receive runtime, tap into hooks. Standard Webpack/Babel pattern. */
  apply?(runtime: MediaRuntime): void;
  /** Legacy: single-phase execution. Mapped to process:run when apply is absent. */
  execute?(context: PipelineContext): Promise<void>;
  /** Execution mode: sync (default) or background */
  readonly executionMode?: PluginExecutionMode;
}
