import type { PipelineContext } from "./context.interface";
import type { ValidationResult } from "./media-runtime.interface";

/**
 * Handler for a pipeline stage hook.
 * Can return ValidationResult to abort pipeline (validation phases).
 */
export type HookHandler = (ctx: PipelineContext) => Promise<void | ValidationResult>;

/** Options for hook registration (tap) */
export interface HookHandlerOptions {
  /** Sync (inline) or background (queued via JobAdapter) */
  mode?: "sync" | "background";
}
