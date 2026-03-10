// Core types and utilities
export type MediaStatus = "PENDING_VERIFICATION" | "VALID" | "INVALID" | "PROCESSING" | "COMPLETED";

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export { HOOK_NAMES } from "./plugin/index";
export type {
  PipelinePlugin,
  PipelineContext,
  PluginExecutionMode,
  PluginHooks,
  HookName,
  HookHandler,
  HookHandlerOptions,
  MediaPlugin,
  HookContext,
  MediaRuntime,
  MediaRuntimeHook,
  ValidationResult,
} from "./plugin/index";
export type { StorageAdapter, GetUrlOptions, PresignedPutUrlOptions } from "./storage/index";
export type { DatabaseAdapter } from "./database/index";
export type { JobAdapter } from "./job/index";
