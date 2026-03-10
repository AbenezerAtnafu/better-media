import type { HookName } from "./hook-name.interface";

/**
 * Hook-level execution mode constraint.
 * - sync-only: Handler always runs inline. Passing background is overridden with a warning.
 * - sync-or-background: Plugin may choose either; both are valid.
 * - background-only: Handler always runs enqueued. Passing sync is overridden with a warning.
 */
export type HookModeConstraint = "sync-only" | "sync-or-background" | "background-only";

/** Per-hook mode constraints. Single source of truth for hook execution rules. */
export const HOOK_MODE_CONSTRAINTS: Record<HookName, HookModeConstraint> = {
  "upload:init": "sync-only",
  "validation:run": "sync-only",
  "scan:run": "sync-only",
  "process:run": "sync-or-background",
  "upload:complete": "sync-or-background",
};

/**
 * Resolve effective execution mode given hook constraint and requested mode.
 * Returns the mode to use and whether it was overridden (for logging).
 */
export function resolveHookMode(
  hookName: HookName,
  requested: "sync" | "background"
): { effective: "sync" | "background"; overridden: boolean } {
  const constraint = HOOK_MODE_CONSTRAINTS[hookName];

  if (constraint === "sync-only" && requested === "background") {
    return { effective: "sync", overridden: true };
  }
  if (constraint === "background-only" && requested === "sync") {
    return { effective: "background", overridden: true };
  }

  return { effective: requested, overridden: false };
}
