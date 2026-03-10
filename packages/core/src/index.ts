// Core types and utilities
export type MediaStatus = "PENDING_VERIFICATION" | "VALID" | "INVALID" | "PROCESSING" | "COMPLETED";

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export { HOOK_NAMES, HOOK_MODE_CONSTRAINTS, resolveHookMode } from "./plugin/index";
export type {
  PipelinePlugin,
  PipelineContext,
  FileInfo,
  StorageLocation,
  ProcessingResults,
  ThumbnailResult,
  VariantResult,
  MediaDimensions,
  PluginExecutionMode,
  PluginHooks,
  HookName,
  HookHandler,
  HookHandlerOptions,
  HookModeConstraint,
  MediaPlugin,
  HookContext,
  MediaRuntime,
  MediaRuntimeHook,
  ValidationResult,
} from "./plugin/index";
export type { StorageAdapter, GetUrlOptions, PresignedPutUrlOptions } from "./storage/index";
export type { DatabaseAdapter } from "./database/index";
export type { JobAdapter } from "./job/index";
