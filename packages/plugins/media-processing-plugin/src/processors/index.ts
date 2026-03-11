import type { PipelineContext } from "@better-media/core";
import type { MediaProcessingPluginOptions } from "../interfaces/options.interface";
import { processImageThumbnails } from "./image/thumbnail";
import { processVideoThumbnails } from "./video/thumbnail";

const IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];

const VIDEO_MIMES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-msvideo",
  "video/x-matroska",
];

const ALL_MIMES = [...IMAGE_MIMES, ...VIDEO_MIMES];

function applyResults(
  context: PipelineContext,
  thumbnails: Awaited<ReturnType<typeof processImageThumbnails>>["thumbnails"],
  metadata: Awaited<ReturnType<typeof processImageThumbnails>>["metadata"]
): void {
  context.processing.thumbnails ??= {};
  context.processing.thumbnails["media-processing"] = thumbnails;
  if (metadata) {
    context.processing["media-processing"] ??= {};
    (context.processing["media-processing"] as { extractedMetadata?: unknown }).extractedMetadata =
      metadata;
  }
}

export async function runProcessors(
  context: PipelineContext,
  buffer: Buffer,
  opts: MediaProcessingPluginOptions
): Promise<void> {
  const mime = context.file.mimeType ?? "";
  const mimeTypes = opts.mimeTypes ?? ALL_MIMES;

  if (!mimeTypes.includes(mime)) {
    return;
  }

  if (mime.startsWith("image/")) {
    const result = await processImageThumbnails(context, buffer, opts);
    applyResults(context, result.thumbnails, result.metadata);
    return;
  }

  if (mime.startsWith("video/")) {
    const result = await processVideoThumbnails(context, buffer, opts);
    applyResults(context, result.thumbnails, result.metadata);
  }
}
