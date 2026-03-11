import sharp from "sharp";
import { thumbnailStorageKey } from "../utils/thumbnail-key";
import type { PipelineContext, ThumbnailResult, StorageAdapter } from "@better-media/core";
import type { MediaProcessingPluginOptions } from "../interfaces/options.interface";
import type { ExtractedMetadata } from "../interfaces/extracted-metadata.interface";
import type { ThumbnailSize } from "../interfaces/thumbnail-size.interface";

const DEFAULT_IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/avif"];

function getThumbnailSizes(opts: MediaProcessingPluginOptions): ThumbnailSize[] {
  const defaults: ThumbnailSize[] = [{ width: 150, height: 150 }, { width: 640 }, { width: 1280 }];
  const fromOpts = opts.defaultThumbnailSizes ?? defaults;
  const custom = opts.thumbnailSizes ?? [];
  return [...fromOpts, ...custom];
}

function getOutputExt(format: "jpeg" | "png" | "webp"): string {
  return format === "jpeg" ? "jpg" : format;
}

export async function processImageThumbnails(
  context: PipelineContext,
  buffer: Buffer,
  opts: MediaProcessingPluginOptions
): Promise<{ thumbnails: ThumbnailResult[]; metadata?: ExtractedMetadata }> {
  const { file, storage, processing } = context;
  const fileKey = file.key;
  const mimeTypes = opts.mimeTypes ?? DEFAULT_IMAGE_MIMES;
  const mime = file.mimeType ?? "";

  if (!mimeTypes.includes(mime)) {
    return { thumbnails: [] };
  }

  const sizes = getThumbnailSizes(opts);
  const thumbFormat = opts.thumbnailFormat ?? "jpeg";
  const jpegQuality = opts.jpegQuality ?? 80;
  const outputExt = getOutputExt(thumbFormat);
  const extractMetadata = opts.extractMetadata !== false;
  const includeExif = opts.includeExif !== false;

  const img = sharp(buffer);
  let extracted: ExtractedMetadata | undefined;
  const thumbnails: ThumbnailResult[] = [];

  if (extractMetadata) {
    const meta = await img.metadata();
    extracted = {
      format: meta.format,
      width: meta.width,
      height: meta.height,
      orientation: meta.orientation,
    };
    if (includeExif && meta.exif) {
      extracted.exif = meta.exif as unknown as Record<string, unknown>;
    }

    // Write dimensions to processing
    if (meta.width != null && meta.height != null) {
      processing.dimensions = {
        width: meta.width,
        height: meta.height,
      };
    }
  }

  for (const size of sizes) {
    let pipeline = img.clone().resize(size.width, size.height, {
      fit: size.height ? "cover" : "inside",
      withoutEnlargement: true,
    });

    if (thumbFormat === "jpeg") {
      pipeline = pipeline.jpeg({ quality: jpegQuality });
    } else if (thumbFormat === "webp") {
      pipeline = pipeline.webp({ quality: jpegQuality });
    } else {
      pipeline = pipeline.png();
    }

    const thumbBuffer = await pipeline.toBuffer();
    const { width: outWidth, height: outHeight } = await sharp(thumbBuffer).metadata();
    const w = outWidth ?? size.width;
    const h = outHeight ?? size.height ?? w;
    const thumbKey = thumbnailStorageKey(fileKey, w, h, outputExt);

    await (storage as StorageAdapter).put(thumbKey, thumbBuffer);

    thumbnails.push({
      key: thumbKey,
      width: w,
      height: h,
      format: thumbFormat,
    });
  }

  return { thumbnails, metadata: extracted };
}
