import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import type { PipelineContext, PluginApi, VariantResult } from "@better-media/core";
import type {
  VideoStreamingPluginOptions,
  StreamingFormat,
  StreamingPreset,
} from "../interfaces/options.interface";
import { resolveVideoStreamingOptions } from "../interfaces/options.interface";
import { isReferenceUrlMode, readBufferForProcessing } from "./buffer";
import { transcodeHLS, transcodeDASH, FfmpegNotFoundError } from "./ffmpeg";
import { uploadDirectory } from "./upload";
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

function masterKeyForFormat(prefix: string, recordId: string, format: StreamingFormat): string {
  return format === "hls"
    ? `${prefix}/${recordId}/hls/master.m3u8`
    : `${prefix}/${recordId}/dash/master.mpd`;
}

function variantPlaylistKey(
  prefix: string,
  recordId: string,
  format: StreamingFormat,
  presetName: string
): string {
  return format === "hls"
    ? `${prefix}/${recordId}/hls/${presetName}/index.m3u8`
    : `${prefix}/${recordId}/dash/${presetName}/stream.mpd`;
}

export async function runVideoStreaming(
  context: PipelineContext,
  api: PluginApi,
  opts: VideoStreamingPluginOptions
): Promise<void> {
  const resolved = resolveVideoStreamingOptions(opts);

  if (isReferenceUrlMode(context)) {
    api.emitMetadata({ skipped: "reference-url" });
    return;
  }

  const mime = context.file.mimeType;
  if (!mime || !resolved.allowedMimeTypes.includes(mime)) {
    api.emitMetadata({ skipped: "mime-not-allowed", mimeType: mime });
    return;
  }

  // Check if already processed (skipExistingDerivatives checks HLS master as proxy)
  if (resolved.skipExistingDerivatives) {
    const firstMasterKey = masterKeyForFormat(
      resolved.derivativePrefix,
      context.recordId,
      resolved.formats[0]!
    );
    if (await context.storage.exists(firstMasterKey)) {
      api.emitMetadata({ skipped: "already-processed", key: firstMasterKey });
      return;
    }
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

  // Write buffer to a temp input file so ffmpeg can read it
  const tempInputDir = path.join(os.tmpdir(), randomUUID());
  await fs.mkdir(tempInputDir, { recursive: true });
  const ext = context.file.extension ?? ".mp4";
  const inputPath = path.join(tempInputDir, `input${ext}`);
  await fs.writeFile(inputPath, buffer);

  // Apply resolvePreset if provided
  const presets: StreamingPreset[] = opts.resolvePreset
    ? await Promise.all(
        resolved.presets.map((preset, index) =>
          Promise.resolve(opts.resolvePreset!(context, preset, index))
        )
      )
    : resolved.presets;

  const streamingVariants: VariantResult[] = [];
  let videoDuration = 0;
  const tempDirs: string[] = [tempInputDir];

  try {
    for (const format of resolved.formats) {
      const tempOutputDir = path.join(os.tmpdir(), randomUUID());
      await fs.mkdir(tempOutputDir, { recursive: true });
      tempDirs.push(tempOutputDir);

      const storagePrefix = `${resolved.derivativePrefix}/${context.recordId}/${format}`;

      let duration = 0;
      try {
        const transcode = format === "hls" ? transcodeHLS : transcodeDASH;
        const transcodeOnProgress = opts.onProgress
          ? (event: { preset?: string; percent?: number; currentTimeSecs?: number }) =>
              opts.onProgress!({ format, ...event })
          : undefined;
        const result = await withTimeout(
          transcode(
            inputPath,
            tempOutputDir,
            presets,
            resolved.segmentDuration,
            transcodeOnProgress
          ),
          resolved.timeoutMs,
          `transcode-${format}`
        );
        duration = result.duration;
        if (duration > 0) videoDuration = duration;
      } catch (err: unknown) {
        if (err instanceof FfmpegNotFoundError) {
          api.emitMetadata({ error: "ffmpeg-not-found", message: err.message });
          return;
        }
        api.emitMetadata({
          error: "transcode-failed",
          format,
          message: err instanceof Error ? err.message : String(err),
        });
        continue;
      }

      // Upload all files (segments + playlists) to storage
      try {
        await uploadDirectory(
          context.storage,
          tempOutputDir,
          storagePrefix,
          resolved.skipExistingDerivatives
        );
      } catch (err: unknown) {
        api.emitMetadata({
          error: "upload-failed",
          format,
          message: err instanceof Error ? err.message : String(err),
        });
        continue;
      }

      const masterKey = masterKeyForFormat(resolved.derivativePrefix, context.recordId, format);
      streamingVariants.push({ key: masterKey, format });

      // Persist media_versions rows: master + one per variant playlist
      if (resolved.persistMediaVersions) {
        let versionCounter = await nextMediaVersionStart(context.database, context.recordId);

        // HLS: master + one row per variant playlist.
        // DASH: master only — all representations live inside the single master.mpd.
        const variantRows =
          format === "hls"
            ? presets.map((p) => ({
                storageKey: variantPlaylistKey(
                  resolved.derivativePrefix,
                  context.recordId,
                  format,
                  p.name
                ),
                mimeType: "application/x-mpegURL" as const,
              }))
            : [];

        const rowsToInsert: Array<{ storageKey: string; mimeType: string }> = [
          {
            storageKey: masterKey,
            mimeType: format === "hls" ? "application/x-mpegURL" : "application/dash+xml",
          },
          ...variantRows,
        ];

        for (const row of rowsToInsert) {
          try {
            await context.database.create({
              model: "media_versions",
              data: {
                id: randomUUID(),
                mediaId: context.recordId,
                storageKey: row.storageKey,
                mimeType: row.mimeType,
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
              key: row.storageKey,
              message: err instanceof Error ? err.message : String(err),
            });
          }
        }
      }
    }
  } finally {
    await Promise.allSettled(tempDirs.map((d) => fs.rm(d, { recursive: true, force: true })));
  }

  if (streamingVariants.length === 0) return;

  api.emitProcessing({
    variants: { streaming: streamingVariants },
    "video-streaming": {
      formats: resolved.formats,
      presets: presets.map((p) => p.name),
      duration: videoDuration || undefined,
      segmentDuration: resolved.segmentDuration,
    },
  });
}
