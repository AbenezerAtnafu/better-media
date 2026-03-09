/** Lifecycle hook names (aligns with AWS/Cloudinary media pipeline stages) */
export type HookName =
  | "upload:init"
  | "validation:run"
  | "scan:run"
  | "process:run"
  | "storage:write";
