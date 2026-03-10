/** Lifecycle hook names (aligns with AWS/Cloudinary media pipeline stages). Single source of truth. */
export const HOOK_NAMES = [
  "upload:init",
  "validation:run",
  "scan:run",
  "process:run",
  "upload:complete",
] as const;

export type HookName = (typeof HOOK_NAMES)[number];
