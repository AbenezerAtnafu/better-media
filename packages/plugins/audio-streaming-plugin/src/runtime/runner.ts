import os from "node:os";
import path from "node:path";
import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import type { PipelineContext, PluginApi, VariantResult } from "@better-media/core";
import type {
  AudioStreamingPluginOptions,
  AudioStreamingFormat,
  AudioPreset,
} from "../interfaces/options.interface";
import {
  resolveAudioStreamingOptions,
  inferProgressiveFormat,
} from "../interfaces/options.interface";
import { isReferenceUrlMode, readBufferForProcessing } from "./buffer";
import { transcodeHLS, transcodeDASH, transcodeProgressive, FfmpegNotFoundError } from "./ffmpeg";
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

function masterKeyForFormat(
  prefix: string,
  recordId: string,
  format: AudioStreamingFormat
): string {
  switch (format) {
    case "hls":
      return `${prefix}/${recordId}/hls/master.m3u8`;
    case "dash":
      return `${prefix}/${recordId}/dash/master.mpd`;
    // For progressive, check existence of first preset — handled separately in runner
    default:
      return `${prefix}/${recordId}/progressive`;
  }
}

function variantPlaylistKey(
  prefix: string,
  recordId: string,
  format: AudioStreamingFormat,
  presetName: string
): string {
  return format === "hls"
    ? `${prefix}/${recordId}/hls/${presetName}/index.m3u8`
    : `${prefix}/${recordId}/dash/${presetName}/stream.mpd`;
}

function progressiveKey(prefix: string, recordId: string, preset: AudioPreset): string {
  const { ext } = inferProgressiveFormat(preset.codec ?? "aac");
  return `${prefix}/${recordId}/progressive/${preset.name}${ext}`;
}

function mimeTypeForFormat(format: AudioStreamingFormat, codec?: string): string {
  if (format === "dash") return "application/dash+xml";
  if (format === "hls") return "application/x-mpegURL";
  // progressive
  const { ext } = inferProgressiveFormat(codec ?? "aac");
  if (ext === ".mp3") return "audio/mpeg";
  if (ext === ".opus") return "audio/ogg";
  return "audio/aac";
}

export async function runAudioStreaming(
  context: PipelineContext,
  api: PluginApi,
  opts: AudioStreamingPluginOptions
): Promise<void> {
  const resolved = resolveAudioStreamingOptions(opts);

  if (isReferenceUrlMode(context)) {
    api.emitMetadata({ skipped: "reference-url" });
    return;
  }

  const mime = context.file.mimeType;
  if (!mime || !resolved.allowedMimeTypes.includes(mime)) {
    api.emitMetadata({ skipped: "mime-not-allowed", mimeType: mime });
    return;
  }

  // skipExistingDerivatives: check the first format's master key as proxy
  if (resolved.skipExistingDerivatives) {
    const firstFormat = resolved.formats[0]!;
    const checkKey =
      firstFormat === "progressive"
        ? progressiveKey(resolved.derivativePrefix, context.recordId, resolved.presets[0]!)
        : masterKeyForFormat(resolved.derivativePrefix, context.recordId, firstFormat);

    if (await context.storage.exists(checkKey)) {
      api.emitMetadata({ skipped: "already-processed", key: checkKey });
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

  // Write input to temp file
  const tempInputDir = path.join(os.tmpdir(), randomUUID());
  await fs.mkdir(tempInputDir, { recursive: true });
  const ext = context.file.extension ?? ".mp3";
  const inputPath = path.join(tempInputDir, `input${ext}`);
  await fs.writeFile(inputPath, buffer);

  const presets: AudioPreset[] = opts.resolvePreset
    ? await Promise.all(
        resolved.presets.map((preset, index) =>
          Promise.resolve(opts.resolvePreset!(context, preset, index))
        )
      )
    : resolved.presets;

  const streamingVariants: VariantResult[] = [];
  let audioDuration = 0;
  const tempDirs: string[] = [tempInputDir];

  try {
    for (const format of resolved.formats) {
      const tempOutputDir = path.join(os.tmpdir(), randomUUID());
      await fs.mkdir(tempOutputDir, { recursive: true });
      tempDirs.push(tempOutputDir);

      let duration = 0;

      try {
        if (format === "progressive") {
          const result = await withTimeout(
            transcodeProgressive(inputPath, tempOutputDir, presets),
            resolved.timeoutMs,
            "transcode-progressive"
          );
          duration = result.duration;
        } else {
          const transcode = format === "hls" ? transcodeHLS : transcodeDASH;
          const result = await withTimeout(
            transcode(inputPath, tempOutputDir, presets, resolved.segmentDuration),
            resolved.timeoutMs,
            `transcode-${format}`
          );
          duration = result.duration;
        }
        if (duration > 0) audioDuration = duration;
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

      const storagePrefix =
        format === "progressive"
          ? `${resolved.derivativePrefix}/${context.recordId}/progressive`
          : `${resolved.derivativePrefix}/${context.recordId}/${format}`;

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

      // Collect variant keys + persist media_versions rows
      if (resolved.persistMediaVersions) {
        let versionCounter = await nextMediaVersionStart(context.database, context.recordId);

        if (format === "progressive") {
          // One row + one variant per preset file
          for (const preset of presets) {
            const key = progressiveKey(resolved.derivativePrefix, context.recordId, preset);
            streamingVariants.push({ key, format: "progressive" });

            try {
              await context.database.create({
                model: "media_versions",
                data: {
                  id: randomUUID(),
                  mediaId: context.recordId,
                  storageKey: key,
                  mimeType: mimeTypeForFormat("progressive", preset.codec),
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
                key,
                message: err instanceof Error ? err.message : String(err),
              });
            }
          }
        } else {
          // Master + one row per variant playlist
          const masterKey = masterKeyForFormat(resolved.derivativePrefix, context.recordId, format);
          streamingVariants.push({ key: masterKey, format });

          const rowsToInsert = [
            { storageKey: masterKey },
            ...presets.map((p) => ({
              storageKey: variantPlaylistKey(
                resolved.derivativePrefix,
                context.recordId,
                format,
                p.name
              ),
            })),
          ];

          for (const row of rowsToInsert) {
            try {
              await context.database.create({
                model: "media_versions",
                data: {
                  id: randomUUID(),
                  mediaId: context.recordId,
                  storageKey: row.storageKey,
                  mimeType: mimeTypeForFormat(format),
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
      } else {
        // Not persisting — still collect variant keys for emitProcessing
        if (format === "progressive") {
          for (const preset of presets) {
            streamingVariants.push({
              key: progressiveKey(resolved.derivativePrefix, context.recordId, preset),
              format: "progressive",
            });
          }
        } else {
          streamingVariants.push({
            key: masterKeyForFormat(resolved.derivativePrefix, context.recordId, format),
            format,
          });
        }
      }
    }
  } finally {
    await Promise.allSettled(tempDirs.map((d) => fs.rm(d, { recursive: true, force: true })));
  }

  if (streamingVariants.length === 0) return;

  api.emitProcessing({
    variants: { streaming: streamingVariants },
    "audio-streaming": {
      formats: resolved.formats,
      presets: presets.map((p) => p.name),
      duration: audioDuration || undefined,
      segmentDuration: resolved.formats.some((f) => f !== "progressive")
        ? resolved.segmentDuration
        : undefined,
    },
  });
}
