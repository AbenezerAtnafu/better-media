import type { PipelineContext, HookName, ValidationResult } from "@better-media/core";

/** Single tapped handler entry */
export interface TapInfo {
  name: string;
  fn: (ctx: PipelineContext) => Promise<void | ValidationResult>;
  mode: "sync" | "background";
  stage?: number;
}

/** Registry: hook name -> ordered list of handlers */
export type HookRegistry = Map<HookName, TapInfo[]>;
