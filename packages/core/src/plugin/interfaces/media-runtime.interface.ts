import { z } from "zod";
import type { PipelineContext, PluginApi } from "./context.interface";
import type { HookName } from "./hook-name.interface";

/**
 * Result from validation-phase handlers; can abort pipeline.
 * Persisted to 'validation_results' table.
 */
export const ValidationResultSchema = z
  .object({
    valid: z.boolean(),
    pluginId: z.string().optional(),
    message: z.string().optional(),
    errors: z.array(z.string()).optional(),
  })
  .strict();

export type ValidationResult = z.infer<typeof ValidationResultSchema>;

/**
 * Result from virus-scan handlers.
 * Persisted to 'virus_scan_results' table.
 */
export const VirusScanResultSchema = z
  .object({
    status: z.enum(["clean", "infected", "error"]),
    threats: z.array(z.string()).optional(),
    scanner: z.string().optional(),
    scannedAt: z.string().datetime().optional(),
  })
  .strict();

export type VirusScanResult = z.infer<typeof VirusScanResultSchema>;

/** Hook interface for plugin registration (Tapable-style) */
export interface MediaRuntimeHook {
  tap(
    name: string,
    fn: (ctx: PipelineContext, api: PluginApi) => Promise<void | ValidationResult>,
    options?: { mode?: "sync" | "background" }
  ): void;
}

/** Runtime host passed to plugins via apply(); exposes lifecycle hooks */
export interface MediaRuntime {
  readonly hooks: {
    [K in HookName]: MediaRuntimeHook;
  };
}
