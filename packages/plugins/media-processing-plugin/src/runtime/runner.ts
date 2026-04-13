import { randomUUID } from "node:crypto";
import type { PipelineContext, PluginApi } from "@better-media/core";
import type { MediaProcessingPluginOptions } from "../interfaces/options.interface";
import { resolveMediaProcessingOptions } from "../interfaces/options.interface";
import { isReferenceUrlMode, readBufferForProcessing } from "./buffer";
import { tryImportSharp, generateThumbnailsWithSharp } from "./image";
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

export async function runMediaProcessing(
  context: PipelineContext,
  api: PluginApi,
  opts: MediaProcessingPluginOptions
): Promise<void> {
  const resolved = resolveMediaProcessingOptions(opts);

  if (isReferenceUrlMode(context)) {
    api.emitMetadata({ skipped: "reference-url" });
    return;
  }

  if (!resolved.thumbnails) {
    api.emitMetadata({ skipped: "thumbnails-disabled" });
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
    const message = err instanceof Error ? err.message : String(err);
    api.emitMetadata({ error: "read-failed", message });
    return;
  }

  if (buffer == null) {
    api.emitMetadata({ skipped: "no-file-content" });
    return;
  }

  if (buffer.length > resolved.maxInputBytes) {
    api.emitMetadata({
      skipped: "input-too-large",
      size: buffer.length,
      maxInputBytes: resolved.maxInputBytes,
    });
    return;
  }

  const sharp = await tryImportSharp();
  if (sharp == null) {
    api.emitMetadata({
      skipped: "sharp-not-installed",
      hint: "pnpm add sharp (optional peer of @better-media/plugin-media-processing)",
    });
    return;
  }

  const thumbnailPresets: typeof resolved.thumbnailPresets = opts.resolveThumbnailPreset
    ? await Promise.all(
        resolved.thumbnailPresets.map((preset, index) =>
          Promise.resolve(opts.resolveThumbnailPreset!(context, preset, index))
        )
      )
    : resolved.thumbnailPresets;

  let dimensions: { width: number; height: number } | undefined;
  let generated: Awaited<ReturnType<typeof generateThumbnailsWithSharp>>;

  try {
    generated = await withTimeout(
      generateThumbnailsWithSharp(
        sharp,
        buffer,
        thumbnailPresets,
        context.recordId,
        resolved.derivativePrefix
      ),
      resolved.timeoutMs,
      "generateThumbnailsWithSharp"
    );
    dimensions = generated.dimensions;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    api.emitMetadata({ error: "image-processing-failed", message });
    return;
  }

  const thumbnailResults: import("@better-media/core").ThumbnailResult[] = [];
  let versionCounter = await nextMediaVersionStart(context.database, context.recordId);

  for (const { result, buffer: outBuf } of generated.thumbnails) {
    if (resolved.skipExistingDerivatives && (await context.storage.exists(result.key))) {
      thumbnailResults.push(result);
      continue;
    }

    try {
      await context.storage.put(result.key, outBuf);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      api.emitMetadata({ error: "storage-put-failed", key: result.key, message });
      continue;
    }

    thumbnailResults.push(result);

    if (resolved.persistMediaVersions) {
      try {
        await context.database.create({
          model: "media_versions",
          data: {
            id: randomUUID(),
            mediaId: context.recordId,
            storageKey: result.key,
            isOriginal: false,
            type: "thumbnail",
            versionNumber: versionCounter,
            createdAt: new Date(),
          },
        });
        versionCounter += 1;
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        api.emitMetadata({
          error: "media-versions-persist-failed",
          key: result.key,
          message,
        });
      }
    }
  }

  const patch: Record<string, unknown> = {
    thumbnails: { default: thumbnailResults },
  };
  if (dimensions) patch.dimensions = dimensions;

  api.emitProcessing(patch);
}
