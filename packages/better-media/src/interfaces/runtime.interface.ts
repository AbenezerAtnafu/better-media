/** Runtime instance returned by createBetterMedia */
export interface BetterMediaRuntime {
    /** Process an uploaded file through the plugin lifecycle */
    processUpload(fileKey: string, metadata?: Record<string, unknown>): Promise<void>;
  }
  