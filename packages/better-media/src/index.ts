import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import type { Readable } from "node:stream";
import type { JobAdapter } from "@better-media/core";
import { memoryJobAdapter } from "@better-media/adapter-jobs";
import type { BetterMediaConfig } from "./config/config.interface";
import type {
  BetterMediaRuntime,
  IngestInput,
  MediaMetadata,
  MediaResult,
} from "./runtime/runtime.interface";
import { buildPluginRegistry, hasBackgroundHandlers } from "./plugins/plugin-registry";
import { LifecycleEngine } from "./core/lifecycle-engine";
import { PipelineExecutor } from "./core/pipeline-executor";
import { runBackgroundJob } from "./jobs/job-runner";
import type { BackgroundJobPayload } from "./core/lifecycle-engine";

function createNoopJobAdapter(): JobAdapter {
  return {
    async enqueue(_name: string, _payload: Record<string, unknown>) {
      // No-op when no job adapter configured
    },
  };
}

type NormalizedFile = {
  /** File bytes ready for storage.put — always a Buffer. */
  data: Buffer;
  metadata: MediaMetadata;
  /** True when path-based ingest should unlink the source (default deleteAfterUpload). */
  shouldDeleteSource: boolean;
  sourcePath?: string;
};

async function normalizeInput(
  input: IngestInput,
  fileHandling: import("./core/file-loader").FileHandlingConfig
): Promise<NormalizedFile> {
  const { file, metadata = {}, deleteAfterUpload = true } = input;
  const maxBufferBytes = fileHandling.maxBufferBytes;
  let data: Buffer;
  let shouldDeleteSource = false;
  let sourcePath: string | undefined;

  if ("buffer" in file && file.buffer) {
    data = file.buffer;
  } else if ("path" in file && file.path) {
    if (maxBufferBytes != null) {
      const stat = await fs.stat(file.path);
      if (stat.size > maxBufferBytes) {
        throw new Error(
          `File at "${file.path}" is ${stat.size} bytes, which exceeds the configured ` +
            `maxBufferBytes limit of ${maxBufferBytes}. Use a storage adapter that supports ` +
            `streaming uploads, or increase maxBufferBytes.`
        );
      }
    }
    data = await fs.readFile(file.path);
    if (deleteAfterUpload) {
      shouldDeleteSource = true;
      sourcePath = file.path;
    }
  } else if ("stream" in file && file.stream) {
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    for await (const chunk of file.stream) {
      const buf = Buffer.from(chunk);
      totalBytes += buf.length;
      if (maxBufferBytes != null && totalBytes > maxBufferBytes) {
        throw new Error(
          `Stream exceeded the configured maxBufferBytes limit of ${maxBufferBytes}. ` +
            `Use a storage adapter that supports streaming uploads, or increase maxBufferBytes.`
        );
      }
      chunks.push(buf);
    }
    data = Buffer.concat(chunks);
  } else if ("url" in file && file.url) {
    if (file.mode === "reference") {
      throw new Error("URL reference mode is not fully implemented yet.");
    }
    const response = await fetch(file.url);
    if (!response.ok) throw new Error(`Failed to fetch URL: ${response.statusText}`);
    data = Buffer.from(await response.arrayBuffer());
  } else {
    throw new Error("Invalid MediaFileInput. Must provide buffer, stream, path, or url.");
  }

  return { data, metadata, shouldDeleteSource, sourcePath };
}

/**
 * Create and initialize the Better Media runtime.
 *
 * @example
 * ```ts
 * const media = createBetterMedia({
 *   storage: new S3StorageAdapter({
 *     bucket: "my-bucket",
 *     region: "us-east-1",
 *     accessKeyId: "...",
 *     secretAccessKey: "..."
 *   }),
 *   database: postgresAdapter(...),
 *   jobs: redisJobAdapter(),
 *   plugins: [
 *     validationPlugin(),
 *     virusScanPlugin(),
 *     thumbnailPlugin({ mode: "background" }),
 *     videoProcessingPlugin({ mode: "background" })
 *   ]
 * });
 *
 * const result = await media.upload.ingest({
 *   file: { buffer },
 *   metadata: { filename: "photo.jpg", mimeType: "image/jpeg" },
 * });
 * ```
 */
export function createBetterMedia(config: BetterMediaConfig): BetterMediaRuntime {
  const { storage, database, plugins } = config;
  const { registry } = buildPluginRegistry(plugins);

  const fileHandling = config.fileHandling ?? {};
  const jobAdapter =
    config.jobs ??
    (hasBackgroundHandlers(registry)
      ? (() => {
          const adapter = memoryJobAdapter({
            processor: (p) =>
              runBackgroundJob(
                p as unknown as BackgroundJobPayload,
                registry,
                storage,
                database,
                adapter,
                fileHandling
              ),
          });
          return adapter;
        })()
      : createNoopJobAdapter());
  const engine = new LifecycleEngine(registry, jobAdapter);
  const executor = new PipelineExecutor(engine, storage, database, jobAdapter, fileHandling);

  const runPipeline = (fileKey: string, metadata: Record<string, unknown> = {}) =>
    executor.run(fileKey, metadata);

  return {
    upload: {
      async ingest(input: IngestInput): Promise<MediaResult> {
        const normalized = await normalizeInput(input, fileHandling);
        const finalKey = input.key ?? normalized.metadata.filename ?? `file-${randomUUID()}`;

        try {
          await storage.put(finalKey, normalized.data);
          await runPipeline(finalKey, { ...normalized.metadata, ...input.context });

          return {
            key: finalKey,
            status: "processed",
            metadata: normalized.metadata,
          };
        } finally {
          if (normalized.shouldDeleteSource && normalized.sourcePath) {
            await fs
              .unlink(normalized.sourcePath)
              .catch((err) => console.warn("Cleanup failed:", err));
          }
        }
      },
      fromBuffer(buffer: Buffer, input?: Omit<IngestInput, "file">) {
        return this.ingest({ file: { buffer }, ...input });
      },
      fromStream(stream: Readable, input?: Omit<IngestInput, "file">) {
        return this.ingest({ file: { stream }, ...input });
      },
      fromPath(path: string, input?: Omit<IngestInput, "file">) {
        return this.ingest({ file: { path }, ...input });
      },
      fromUrl(url: string, input?: Omit<IngestInput, "file"> & { mode?: "import" | "reference" }) {
        return this.ingest({ file: { url, mode: input?.mode ?? "import" }, ...input });
      },
      async presignedPutUrl(key: string, options?: { expiresIn?: number; contentType?: string }) {
        const fn = storage.createPresignedPutUrl;
        if (typeof fn !== "function") {
          throw new Error(
            "Presigned upload not supported by this storage adapter. Use an S3/GCS adapter."
          );
        }
        return fn.call(storage, key, options);
      },
      async complete(key: string, metadata: MediaMetadata = {}, context?: Record<string, unknown>) {
        await runPipeline(key, { ...metadata, ...context });
        return {
          key,
          status: "processed",
          metadata,
        };
      },
    },
    files: {
      get(fileKey: string) {
        return database.findOne({ model: "media", where: [{ field: "id", value: fileKey }] });
      },
      async delete(fileKey: string) {
        await Promise.all([
          storage.delete(fileKey),
          database.delete({ model: "media", where: [{ field: "id", value: fileKey }] }),
        ]);
      },
      async getUrl(fileKey: string, options?: { expiresIn?: number }) {
        const fn = storage.getUrl;
        if (typeof fn !== "function") {
          throw new Error(
            "URL generation not supported by this storage adapter. Use an S3/GCS adapter."
          );
        }
        return fn.call(storage, fileKey, options);
      },
      reprocess(fileKey: string, metadata: Record<string, unknown> = {}) {
        return runPipeline(fileKey, metadata);
      },
    },
    async runBackgroundJob(payload: BackgroundJobPayload) {
      await runBackgroundJob(payload, registry, storage, database, jobAdapter, fileHandling);
    },
  };
}

export { ValidationError } from "./core/pipeline-executor";
export {
  PluginRegistry,
  buildPluginRegistry,
  validatePlugin,
  hasBackgroundHandlers,
  HOOK_NAMES,
} from "./plugins/plugin-registry";
export type { BackgroundJobPayload } from "./core/lifecycle-engine";
export type {
  BetterMediaRuntime,
  FileRecord,
  Metadata,
  IngestInput,
  MediaFileInput,
  MediaMetadata,
  MediaResult,
} from "./runtime/runtime.interface";
export type { GetUrlOptions, PresignedPutUrlOptions } from "@better-media/core";
export type { FileHandlingConfig } from "./core/file-loader";

// DB Architecture exports
export * from "./db";
