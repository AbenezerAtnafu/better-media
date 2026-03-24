import type { PipelineContext } from "./interfaces/context.interface";

/** Provenance tokens for trusted metadata (e.g. proposeTrusted). */
export type VerifiedSourceId = "file:content";

export interface PipelineContextWithVerified extends PipelineContext {
  _verifiedSources?: Set<VerifiedSourceId>;
}

/**
 * Mark that this pipeline run has read file bytes from storage (buffer or temp path).
 * Required before trusted plugins may call proposeTrusted with file/checksums/media patches.
 */
export function markFileContentVerified(context: PipelineContext): void {
  const c = context as PipelineContextWithVerified;
  c._verifiedSources ??= new Set();
  c._verifiedSources.add("file:content");
}
