import type {
  PipelineContext,
  HookName,
  ValidationResult,
  PluginApi,
  PluginManifest,
} from "@better-media/core";

/** Single tapped handler entry */
export interface TapInfo {
  name: string;
  fn: (ctx: PipelineContext, api: PluginApi) => Promise<void | ValidationResult>;
  mode: "sync" | "background";
  manifest: PluginManifest;
  stage?: number;
}

/** Registry: hook name -> ordered list of handlers */
export type HookRegistry = Map<HookName, TapInfo[]>;
