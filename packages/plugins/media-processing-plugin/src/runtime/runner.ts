import type { PipelineContext, StorageAdapter } from "@better-media/core";
import type { MediaProcessingPluginOptions } from "./interfaces/options.interface";
import { runProcessors } from "./processors";

export async function runMediaProcessing(
  context: PipelineContext,
  opts: MediaProcessingPluginOptions
): Promise<void> {
  const { file, storage } = context;
  const fileKey = file.key;

  const buffer = await (storage as StorageAdapter).get(fileKey);
  if (buffer == null) {
    return;
  }

  await runProcessors(context, buffer, opts);
}
