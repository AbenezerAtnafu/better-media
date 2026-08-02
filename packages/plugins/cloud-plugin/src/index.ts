import type { PipelinePlugin, MediaRuntime, PipelineContext, PluginApi } from "@better-media/core";
import { EventBuffer } from "./buffer.js";

export type StorageProvider = "s3" | "gcs" | "filesystem" | "memory";

export interface CloudReporterOptions {
  /** API key from the better-media dashboard (BETTER_MEDIA_API_KEY). */
  apiKey: string;
  /**
   * Your storage adapter type. Inferred from context when omitted:
   * bucket present → "s3", otherwise → "filesystem".
   */
  storageProvider?: StorageProvider;
  /** Override the ingest endpoint (defaults to https://api.better-media.dev/v1/ingest). */
  endpoint?: string;
}

const DEFAULT_ENDPOINT = "https://api.better-media.dev/v1/ingest";

function ts() {
  return new Date().toISOString();
}

function inferProvider(ctx: PipelineContext, configured?: StorageProvider): StorageProvider {
  if (configured) return configured;
  return ctx.storageLocation.bucket ? "s3" : "filesystem";
}

/**
 * Cloud reporter plugin for better-media.
 * Streams pipeline lifecycle events to the better-media dashboard.
 *
 * @example
 * ```ts
 * import { cloudReporter } from "@better-media/plugin-cloud";
 *
 * export default defineConfig({
 *   plugins: [cloudReporter({ apiKey: process.env.BETTER_MEDIA_API_KEY })],
 * });
 * ```
 */
export function cloudReporter(opts: CloudReporterOptions): PipelinePlugin {
  const buffer = new EventBuffer(opts.apiKey, opts.endpoint ?? DEFAULT_ENDPOINT);

  return {
    name: "cloud-reporter",
    runtimeManifest: {
      id: "better-media-cloud-reporter",
      version: "1.0.0",
      trustLevel: "untrusted",
      capabilities: ["file.read", "metadata.write.own"],
      namespace: "cloud",
    },
    executionMode: "sync",

    apply(runtime: MediaRuntime) {
      // upload:complete — file is in storage, all trusted metadata is final
      runtime.hooks["upload:complete"].tap(
        "cloud-reporter",
        async (ctx: PipelineContext, _api: PluginApi) => {
          const sha256 = ctx.trusted.checksums?.sha256 ?? ctx.file.checksums?.["sha256"];
          if (!sha256) return; // no hash — can't dedup, skip

          buffer.push({
            event: "file.uploaded",
            fileId: ctx.recordId,
            filename: ctx.file.originalName ?? ctx.file.key,
            mimeType: ctx.trusted.file?.mimeType ?? ctx.file.mimeType ?? "application/octet-stream",
            sizeBytes: ctx.trusted.file?.size ?? ctx.file.size ?? 0,
            sha256,
            storageProvider: inferProvider(ctx, opts.storageProvider),
            storageLocation: ctx.storageLocation.bucket ?? ctx.storageLocation.key,
            timestamp: ts(),
          });
        }
      );

      // validation:run — if this tap executes the file passed validation
      runtime.hooks["validation:run"].tap(
        "cloud-reporter",
        async (ctx: PipelineContext, _api: PluginApi) => {
          buffer.push({
            event: "file.validation.passed",
            fileId: ctx.recordId,
            plugin: "validation-plugin",
            timestamp: ts(),
          });
        }
      );

      // scan:run — read antivirus result written by the scan plugin
      runtime.hooks["scan:run"].tap(
        "cloud-reporter",
        async (ctx: PipelineContext, _api: PluginApi) => {
          const scanMeta = (ctx.metadata as Record<string, unknown>)?.antivirus as
            | { status?: string; threats?: string[] }
            | undefined;

          const result: "clean" | "infected" | "suspicious" =
            scanMeta?.status === "infected"
              ? "infected"
              : scanMeta?.status === "error"
                ? "suspicious"
                : "clean";

          buffer.push({
            event: "file.scan.completed",
            fileId: ctx.recordId,
            plugin: "virus-scan-plugin",
            result,
            ...(scanMeta?.threats?.[0] ? { threatName: scanMeta.threats[0] } : {}),
            timestamp: ts(),
          });
        }
      );

      // process:run — file processing stage completed
      runtime.hooks["process:run"].tap(
        "cloud-reporter",
        async (ctx: PipelineContext, _api: PluginApi) => {
          buffer.push({
            event: "file.processing.completed",
            fileId: ctx.recordId,
            plugin: "media-processing-plugin",
            durationMs: 0,
            timestamp: ts(),
          });
        }
      );
    },
  };
}
