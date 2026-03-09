/** Lifecycle hook names (aligns with AWS/Cloudinary media pipeline stages) */
export type HookName =
  | "upload:init"
  | "validation:run"
  | "scan:run"
  | "storage:write"
  | "process:run"
  | "upload:complete";
