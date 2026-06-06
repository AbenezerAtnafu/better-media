import type { MediaResult } from "../runtime/runtime.interface";

export interface ProcessingCompleteEvent {
  id: string;
  key: string;
  pluginName: string;
}

export interface ErrorEvent {
  id?: string;
  key?: string;
}

export interface BetterMediaEvents {
  /** Fired after ingest() or complete() pipeline succeeds. */
  onUploadComplete?: (result: MediaResult) => void | Promise<void>;
  /** Fired after a background job finishes (background plugin completed). */
  onProcessingComplete?: (event: ProcessingCompleteEvent) => void | Promise<void>;
  /**
   * Fired on any pipeline or background job error.
   * The original error is still thrown to the caller — this is a side-effect notification only.
   */
  onError?: (error: Error, context: ErrorEvent) => void | Promise<void>;
}
