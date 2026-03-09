// Core types and utilities
export type MediaStatus = "PENDING_VERIFICATION" | "VALID" | "INVALID" | "PROCESSING" | "COMPLETED";

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export type { PipelinePlugin, PipelineContext, PluginExecutionMode, PluginHooks } from "./plugin";
export type { StorageAdapter } from "./storage";
export type { DatabaseAdapter } from "./database";
export type { JobAdapter } from "./job";
