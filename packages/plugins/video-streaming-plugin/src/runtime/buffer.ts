import fs from "node:fs/promises";
import type { PipelineContext } from "@better-media/core";

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
