import path from "node:path";
import fs from "node:fs/promises";
import os from "node:os";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import ffmpeg from "fluent-ffmpeg";
import type {
  PipelineContext,
  ThumbnailResult,
  MediaDimensions,
  StorageAdapter,
} from "@better-media/core";
import type { MediaProcessingPluginOptions } from "../interfaces/options.interface";
import type { ExtractedMetadata } from "../interfaces/extracted-metadata.interface";
import type { ThumbnailSize } from "../interfaces/thumbnail-size.interface";

const DEFAULT_VIDEO_MIMES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-msvideo",
  "video/x-matroska",
];

function getThumbnailSizes(opts: MediaProcessingPluginOptions): ThumbnailSize[] {
  const defaults: ThumbnailSize[] = [{ width: 150, height: 150 }, { width: 640 }, { width: 1280 }];
  const fromOpts = opts.defaultThumbnailSizes ?? defaults;
  const custom = opts.thumbnailSizes ?? [];
  return [...fromOpts, ...custom];
}

import { thumbnailStorageKey } from "../utils/thumbnail-key";

function getOutputExt(format: "jpeg" | "png" | "webp"): string {
  return format === "jpeg" ? "jpg" : format;
}

interface FfprobeFormat {
  format_name?: string;
  duration?: string;
  [key: string]: unknown;
}

interface FfprobeStream {
  codec_type?: string;
  width?: number;
  height?: number;
  codec_name?: string;
  r_frame_rate?: string;
  [key: string]: unknown;
}

interface FfprobeResult {
  format?: FfprobeFormat;
  streams?: FfprobeStream[];
}

function getVideoMetadata(probe: FfprobeResult): ExtractedMetadata {
  const videoStream = probe.streams?.find((s) => s.codec_type === "video");
  const format = probe.format;
  const duration = format?.duration ? parseFloat(format.duration) : undefined;
  const width = videoStream?.width;
  const height = videoStream?.height;

  return {
    format: format?.format_name,
    width,
    height,
    duration,
    codec: videoStream?.codec_name,
    framerate: videoStream?.r_frame_rate,
  };
}

export async function processVideoThumbnails(
  context: PipelineContext,
  buffer: Buffer,
  opts: MediaProcessingPluginOptions
): Promise<{ thumbnails: ThumbnailResult[]; metadata?: ExtractedMetadata }> {
  const { file, storage, processing } = context;
  const fileKey = file.key;
  const mimeTypes = opts.mimeTypes ?? DEFAULT_VIDEO_MIMES;
  const mime = file.mimeType ?? "";

  if (!mimeTypes.includes(mime)) {
    return { thumbnails: [] };
  }

  const sizes = getThumbnailSizes(opts);
  const thumbFormat = opts.thumbnailFormat ?? "jpeg";
  const jpegQuality = opts.jpegQuality ?? 80;
  const outputExt = getOutputExt(thumbFormat);
  const extractMetadata = opts.extractMetadata !== false;

  const tmpDir = os.tmpdir();
  const inputPath = path.join(
    tmpDir,
    `better-media-${randomUUID()}${path.extname(fileKey) || ".mp4"}`
  );
  const framePath = path.join(tmpDir, `better-media-frame-${randomUUID()}.png`);

  try {
    await fs.writeFile(inputPath, buffer);

    let extracted: ExtractedMetadata | undefined;

    if (extractMetadata) {
      extracted = await new Promise<ExtractedMetadata>((resolve, reject) => {
        ffmpeg.ffprobe(inputPath, (err, probe) => {
          if (err) {
            reject(err);
            return;
          }
          resolve(getVideoMetadata(probe as FfprobeResult));
        });
      });

      if (extracted?.width != null && extracted?.height != null) {
        processing.dimensions ??= {} as MediaDimensions;
        (processing.dimensions as MediaDimensions).width = extracted.width;
        (processing.dimensions as MediaDimensions).height = extracted.height;
        if (extracted.duration != null) {
          (processing.dimensions as MediaDimensions).duration = extracted.duration;
        }
      }
    }

    await new Promise<void>((resolve, reject) => {
      ffmpeg(inputPath)
        .screenshots({
          timestamps: ["00:00:01"],
          filename: path.basename(framePath),
          folder: path.dirname(framePath),
          size: "640x?",
        })
        .on("end", () => resolve())
        .on("error", reject);
    });

    const frameBuffer = await fs.readFile(framePath);
    const thumbnails: ThumbnailResult[] = [];

    for (const size of sizes) {
      let pipeline = sharp(frameBuffer).resize(size.width, size.height, {
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
  } finally {
    await fs.unlink(inputPath).catch(() => {});
    await fs.unlink(framePath).catch(() => {});
  }
}
