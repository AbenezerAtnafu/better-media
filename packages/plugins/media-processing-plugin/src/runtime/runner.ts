import fs from "node:fs/promises";
import type { PipelineContext, StorageAdapter } from "@better-media/core";
import type { MediaProcessingPluginOptions } from "../interfaces/options.interface";
import { runProcessors } from "../processors";

async function getBufferFromContext(context: PipelineContext): Promise<Buffer | null> {
  const fileContent = context.utilities?.fileContent;
  if (fileContent?.buffer) return fileContent.buffer;
  if (fileContent?.tempPath) return fs.readFile(fileContent.tempPath);
  return null;
}

export async function runMediaProcessing(
  context: PipelineContext,
  opts: MediaProcessingPluginOptions
): Promise<void> {
  const { file, storage } = context;
  const fileKey = file.key;

  let buffer = await getBufferFromContext(context);
  if (buffer == null) {
    buffer = await (storage as StorageAdapter).get(fileKey);
  }
  if (buffer == null) {
    return;
  }

  await runProcessors(context, buffer, opts);
}
