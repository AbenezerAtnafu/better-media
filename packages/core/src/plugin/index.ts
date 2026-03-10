import type { PipelinePlugin } from "./interfaces/plugin.interface";
import type { PipelineContext } from "./interfaces/context.interface";

export type { PipelinePlugin, PluginExecutionMode } from "./interfaces/plugin.interface";
export type { PipelineContext } from "./interfaces/context.interface";
export type { PluginHooks } from "./interfaces/hooks.interface";
export { HOOK_NAMES } from "./interfaces/hook-name.interface";
export type { HookName } from "./interfaces/hook-name.interface";
export { HOOK_MODE_CONSTRAINTS, resolveHookMode } from "./interfaces/hook-mode.interface";
export type { HookModeConstraint } from "./interfaces/hook-mode.interface";
export type { HookHandler, HookHandlerOptions } from "./interfaces/hook.interface";
export type {
  MediaRuntime,
  MediaRuntimeHook,
  ValidationResult,
} from "./interfaces/media-runtime.interface";

/** Plugin contract alias – plugins register themselves via apply() and tap into hooks */
export type MediaPlugin = PipelinePlugin;

/** Context passed to hook handlers – pipeline stage execution context */
export type HookContext = PipelineContext;
