import { createBetterMedia } from "@better-media/framework";
import { memoryDatabase } from "@better-media/adapter-db-memory";
import { validationPlugin } from "@better-media/plugin-validation";
import { virusScanPlugin } from "@better-media/plugin-virus-scan";
import type { VirusScanner } from "@better-media/plugin-virus-scan";
import { mediaProcessingPlugin } from "@better-media/plugin-media-processing";
import type { BetterMediaRuntime } from "@better-media/framework";
import { S3StorageAdapter } from "@better-media/adapter-storage-s3";

const storage = new S3StorageAdapter({
  region: process.env.AWS_REGION ?? "us-east-1",
  bucket: process.env.AWS_BUCKET ?? "express-test-bucket",
  accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "minioadmin",
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "minioadmin",
  endpoint: process.env.AWS_ENDPOINT ?? "http://localhost:9000",
  forcePathStyle: true,
});
const database = memoryDatabase();

/** No-op scanner so the example runs without ClamAV; swap for `ClamScanner` in production. */
const noopVirusScanner: VirusScanner = {
  name: "noop",
  init: async () => {},
  scanBuffer: async () => ({ infected: false, viruses: [] }),
  scanFile: async () => ({ infected: false, viruses: [] }),
};

let mediaInstance: BetterMediaRuntime | null = null;

/**
 * Better Media singleton for the Next.js app.
 * `sharp` is a dependency of this example so image thumbnails work in `process:run` jobs.
 *
 * `validation:run` and `scan:run` are **sync-only** hooks in the framework; `executionMode` must be
 * `"sync"` or you get override warnings. Only `process:run` (e.g. media processing) may use `"background"`.
 */
export function getMedia(): BetterMediaRuntime {
  if (mediaInstance) return mediaInstance;
  mediaInstance = createBetterMedia({
    storage,
    database,
    plugins: [
      validationPlugin({
        executionMode: "sync",
        allowedExtensions: [".jpg", ".jpeg", ".png", ".webp"],
        allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
        useMagicBytes: true,
        maxBytes: 10 * 1024 * 1024,
        minWidth: 1,
        maxWidth: 8000,
        minHeight: 1,
        maxHeight: 8000,
        fileNotFoundBehavior: "fail",
        onFailure: "abort",
      }),
      virusScanPlugin({
        scanner: noopVirusScanner,
        executionMode: "sync",
        onFailure: "continue",
      }),
      mediaProcessingPlugin({
        executionMode: "background",
        derivativePrefix: "versions",
        thumbnailPresets: [
          { name: "sm", width: 160, format: "webp", quality: 82 },
          { name: "md", width: 480, format: "webp", quality: 85 },
        ],
      }),
    ],
  });
  return mediaInstance;
}

export { storage, database };
