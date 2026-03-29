import type { PipelinePlugin } from "./interfaces/plugin.interface";
import type { PipelineContext } from "./interfaces/context.interface";

export {
  markFileContentVerified,
  type VerifiedSourceId,
  type PipelineContextWithVerified,
} from "./verified-sources";
export type { PipelinePlugin, PluginExecutionMode } from "./interfaces/plugin.interface";
export type { PipelineContext, FileContent } from "./interfaces/context.interface";
export {
  TrustedMetadataSchema,
  type TrustedMetadata,
} from "./interfaces/trusted-metadata.interface";
export type { FileInfo } from "./interfaces/file-info.interface";
export type { StorageLocation } from "./interfaces/storage-location.interface";
export type {
  ProcessingResults,
  ThumbnailResult,
  VariantResult,
  MediaDimensions,
} from "./interfaces/processing-results.interface";
export type { PluginHooks } from "./interfaces/hooks.interface";
export { HOOK_NAMES } from "./interfaces/hook-name.interface";
export type { HookName } from "./interfaces/hook-name.interface";
export { HOOK_MODE_CONSTRAINTS, resolveHookMode } from "./interfaces/hook-mode.interface";
export type { HookModeConstraint } from "./interfaces/hook-mode.interface";
export type { HookHandler, HookHandlerOptions } from "./interfaces/hook.interface";
export {
  ValidationResultSchema,
  type ValidationResult,
  VirusScanResultSchema,
  type VirusScanResult,
  type MediaRuntime,
  type MediaRuntimeHook,
} from "./interfaces/media-runtime.interface";
export type {
  PluginManifest,
  PluginCapability,
  PluginTrustLevel,
} from "./interfaces/plugin.interface";
export type { PluginApi } from "./interfaces/context.interface";

/** Plugin contract alias – plugins register themselves via apply() and tap into hooks */
export type MediaPlugin = PipelinePlugin;

/** Context passed to hook handlers – pipeline stage execution context */
export type HookContext = PipelineContext;
