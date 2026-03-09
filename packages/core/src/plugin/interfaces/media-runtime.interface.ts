import type { PipelineContext } from "./context.interface";
import type { HookName } from "./hook-name.interface";

/** Result from validation-phase handlers; can abort pipeline */
export interface ValidationResult {
  valid: boolean;
  message?: string;
}

/** Hook interface for plugin registration (Tapable-style) */
export interface MediaRuntimeHook {
  tap(
    name: string,
    fn: (ctx: PipelineContext) => Promise<void | ValidationResult>,
    options?: { mode?: "sync" | "background" }
  ): void;
}

/** Runtime host passed to plugins via apply(); exposes lifecycle hooks */
export interface MediaRuntime {
  readonly hooks: {
    [K in HookName]: MediaRuntimeHook;
  };
}
