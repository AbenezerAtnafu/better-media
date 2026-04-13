import fs from "node:fs/promises";
import type { PipelineContext } from "@better-media/core";

/**
 * Load file bytes for processing: utilities (buffer/tempPath) first, then storage.get(key).
 */
export async function readBufferForProcessing(context: PipelineContext): Promise<Buffer | null> {
  const fileContent = context.utilities?.fileContent;
  if (fileContent?.buffer) return fileContent.buffer;
  if (fileContent?.tempPath) return fs.readFile(fileContent.tempPath);
  return context.storage.get(context.file.key);
}

export function isReferenceUrlMode(context: PipelineContext): boolean {
  const url = context.storageLocation?.url;
  return typeof url === "string" && url === context.file.key;
}
