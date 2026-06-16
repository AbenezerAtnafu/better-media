import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import type { PipelineContext, PluginApi } from "@better-media/core";
import type {
  VideoProcessingPluginOptions,
  ThumbnailPreset,
  TranscodePreset,
} from "../interfaces/options.interface";
import { resolveVideoProcessingOptions } from "../interfaces/options.interface";
import { isReferenceUrlMode, readBufferForProcessing } from "./buffer";
import { probeVideo, extractThumbnail, transcodeVideo, FfmpegNotFoundError } from "./ffmpeg";
import { nextMediaVersionStart } from "./next-version";

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  if (!Number.isFinite(ms) || ms <= 0) return promise;
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      }
    );
  });
}

function thumbnailExt(format: ThumbnailPreset["format"]): string {
  switch (format) {
    case "png":
      return ".png";
    case "webp":
      return ".webp";
    default:
      return ".jpg";
  }
}

function thumbnailMime(format: ThumbnailPreset["format"]): string {
  switch (format) {
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    default:
      return "image/jpeg";
  }
}

function transcodeMime(format: TranscodePreset["format"]): string {
  return format === "webm" ? "video/webm" : "video/mp4";
}

export async function runVideoProcessing(
  context: PipelineContext,
  api: PluginApi,
  opts: VideoProcessingPluginOptions
): Promise<void> {
  const resolved = resolveVideoProcessingOptions(opts);

  if (isReferenceUrlMode(context)) {
    api.emitMetadata({ skipped: "reference-url" });
    return;
  }

  const mime = context.file.mimeType;
  if (!mime || !resolved.allowedMimeTypes.includes(mime)) {
    api.emitMetadata({ skipped: "mime-not-allowed", mimeType: mime });
    return;
  }

  let buffer: Buffer | null;
  try {
    buffer = await withTimeout(
      readBufferForProcessing(context),
      resolved.timeoutMs,
      "readBufferForProcessing"
    );
  } catch (err: unknown) {
    api.emitMetadata({
      error: "read-failed",
      message: err instanceof Error ? err.message : String(err),
    });
    return;
  }

  if (buffer == null) {
    api.emitMetadata({ skipped: "no-file-content" });
    return;
  }

  if (resolved.maxInputBytes != null && buffer.length > resolved.maxInputBytes) {
    api.emitMetadata({
      skipped: "input-too-large",
      size: buffer.length,
      maxInputBytes: resolved.maxInputBytes,
    });
    return;
  }

  // Write buffer to a temp file so ffmpeg can read it
  const tempDir = path.join(os.tmpdir(), randomUUID());
  await fs.mkdir(tempDir, { recursive: true });
  const ext = context.file.extension ?? ".mp4";
  const inputPath = path.join(tempDir, `input${ext}`);
  await fs.writeFile(inputPath, buffer);

  try {
    await runWithInput(context, api, resolved, inputPath, tempDir);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
}

async function runWithInput(
  context: PipelineContext,
  api: PluginApi,
  resolved: ReturnType<typeof resolveVideoProcessingOptions>,
  inputPath: string,
  tempDir: string
): Promise<void> {
  // Probe video for metadata
  let probe: Awaited<ReturnType<typeof probeVideo>>;
  try {
    probe = await withTimeout(
      probeVideo(inputPath, { ffprobePath: resolved.ffprobePath }),
      resolved.timeoutMs,
      "probeVideo"
    );
  } catch (err: unknown) {
    if (err instanceof FfmpegNotFoundError) {
      api.emitMetadata({ error: "ffmpeg-not-found", message: err.message });
      return;
    }
    api.emitMetadata({
      error: "probe-failed",
      message: err instanceof Error ? err.message : String(err),
    });
    return;
  }

  const ffOpts = { ffmpegPath: resolved.ffmpegPath };
  const prefix = resolved.derivativePrefix;
  const recordId = context.recordId;

  // ---------- Thumbnails ----------
  const thumbnailResults: Array<{
    key: string;
    format: string;
    width?: number;
    height?: number;
    index: number;
  }> = [];

  if (resolved.thumbnails !== false) {
    let versionCounter = await nextMediaVersionStart(context.database, recordId);

    for (let i = 0; i < resolved.thumbnails.length; i++) {
      const preset = resolved.thumbnails[i]!;
      const format = preset.format ?? "jpeg";
      const ext = thumbnailExt(preset.format);
      const storageKey = `${prefix}/${recordId}/thumbnails/thumb_${i}${ext}`;

      if (resolved.skipExistingDerivatives && (await context.storage.exists(storageKey))) {
        thumbnailResults.push({
          key: storageKey,
          format,
          width: preset.width,
          height: preset.height,
          index: i,
        });
        continue;
      }

      const outputPath = path.join(tempDir, `thumb_${i}${ext}`);
      let dims: { width?: number; height?: number } = {};
      try {
        dims = await withTimeout(
          extractThumbnail(inputPath, outputPath, preset, probe.duration, ffOpts),
          resolved.timeoutMs,
          `extractThumbnail[${i}]`
        );
      } catch (err: unknown) {
        if (err instanceof FfmpegNotFoundError) {
          api.emitMetadata({ error: "ffmpeg-not-found", message: err.message });
          return;
        }
        api.emitMetadata({
          error: "thumbnail-failed",
          index: i,
          message: err instanceof Error ? err.message : String(err),
        });
        continue;
      }

      let thumbBuf: Buffer;
      try {
        thumbBuf = await fs.readFile(outputPath);
      } catch (err: unknown) {
        api.emitMetadata({
          error: "thumbnail-read-failed",
          index: i,
          message: err instanceof Error ? err.message : String(err),
        });
        continue;
      }

      try {
        await context.storage.put(storageKey, thumbBuf);
      } catch (err: unknown) {
        api.emitMetadata({
          error: "storage-put-failed",
          key: storageKey,
          message: err instanceof Error ? err.message : String(err),
        });
        continue;
      }

      thumbnailResults.push({
        key: storageKey,
        format,
        width: dims.width,
        height: dims.height,
        index: i,
      });

      if (resolved.persistMediaVersions) {
        try {
          await context.database.create({
            model: "media_versions",
            data: {
              id: randomUUID(),
              mediaId: recordId,
              storageKey,
              mimeType: thumbnailMime(preset.format),
              size: thumbBuf.length,
              width: dims.width,
              height: dims.height,
              isOriginal: false,
              type: "thumbnail",
              versionNumber: versionCounter,
              createdAt: new Date(),
            },
          });
          versionCounter += 1;
        } catch (err: unknown) {
          api.emitMetadata({
            error: "media-versions-persist-failed",
            key: storageKey,
            message: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }
  }

  // ---------- Transcode ----------
  const transcodeResults: Array<{
    key: string;
    name: string;
    format: string;
    duration: number;
  }> = [];

  if (resolved.transcode.length > 0) {
    let versionCounter = await nextMediaVersionStart(context.database, recordId);

    for (const preset of resolved.transcode) {
      const storageKey = `${prefix}/${recordId}/transcode/${preset.name}.${preset.format}`;

      if (resolved.skipExistingDerivatives && (await context.storage.exists(storageKey))) {
        transcodeResults.push({
          key: storageKey,
          name: preset.name,
          format: preset.format,
          duration: probe.duration,
        });
        continue;
      }

      const outputPath = path.join(tempDir, `transcode_${preset.name}.${preset.format}`);
      let transcoded: { duration: number };
      try {
        transcoded = await withTimeout(
          transcodeVideo(inputPath, outputPath, preset, ffOpts),
          resolved.timeoutMs,
          `transcodeVideo[${preset.name}]`
        );
      } catch (err: unknown) {
        if (err instanceof FfmpegNotFoundError) {
          api.emitMetadata({ error: "ffmpeg-not-found", message: err.message });
          return;
        }
        api.emitMetadata({
          error: "transcode-failed",
          name: preset.name,
          message: err instanceof Error ? err.message : String(err),
        });
        continue;
      }

      let outBuf: Buffer;
      try {
        outBuf = await fs.readFile(outputPath);
      } catch (err: unknown) {
        api.emitMetadata({
          error: "transcode-read-failed",
          name: preset.name,
          message: err instanceof Error ? err.message : String(err),
        });
        continue;
      }

      try {
        await context.storage.put(storageKey, outBuf);
      } catch (err: unknown) {
        api.emitMetadata({
          error: "storage-put-failed",
          key: storageKey,
          message: err instanceof Error ? err.message : String(err),
        });
        continue;
      }

      transcodeResults.push({
        key: storageKey,
        name: preset.name,
        format: preset.format,
        duration: transcoded.duration,
      });

      if (resolved.persistMediaVersions) {
        try {
          await context.database.create({
            model: "media_versions",
            data: {
              id: randomUUID(),
              mediaId: recordId,
              storageKey,
              mimeType: transcodeMime(preset.format),
              size: outBuf.length,
              isOriginal: false,
              type: "compressed",
              versionNumber: versionCounter,
              createdAt: new Date(),
            },
          });
          versionCounter += 1;
        } catch (err: unknown) {
          api.emitMetadata({
            error: "media-versions-persist-failed",
            key: storageKey,
            message: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }
  }

  // Emit probe metadata and processing results
  api.emitMetadata({
    duration: probe.duration,
    videoCodec: probe.videoCodec,
    audioCodec: probe.audioCodec,
    width: probe.width,
    height: probe.height,
    framerate: probe.framerate,
    bitrate: probe.bitrate,
  });

  const processingPatch: Record<string, unknown> = {};
  if (thumbnailResults.length > 0) processingPatch.thumbnails = thumbnailResults;
  if (transcodeResults.length > 0) processingPatch.transcode = transcodeResults;
  if (Object.keys(processingPatch).length > 0) api.emitProcessing(processingPatch);
}
