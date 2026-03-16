import { createBetterMedia } from "better-media";
import { memoryStorage } from "@better-media/adapter-storage-memory";
import { memoryDatabase } from "@better-media/adapter-db";
import { validationPlugin } from "@better-media/plugin-validation";
import { virusScanPlugin } from "@better-media/plugin-virus-scan";
import { trackingJobAdapter } from "./tracking-job-adapter";
import type { BetterMediaRuntime } from "better-media";

const storage = memoryStorage();
const database = memoryDatabase();

let mediaInstance: BetterMediaRuntime | null = null;

/**
 * Better Media instance (lazy-loaded).
 * Mirrors Better Auth: config in lib/, accessed via getter so heavy deps
 * (e.g. fluent-ffmpeg) are loaded at runtime, not bundled by Next.js.
 */
export async function getMedia(): Promise<BetterMediaRuntime> {
  if (mediaInstance) return mediaInstance;
  const { mediaProcessingPlugin } = await import("@better-media/plugin-media-processing");
  mediaInstance = createBetterMedia({
    storage,
    database,
    jobs: trackingJobAdapter(),
    plugins: [
      validationPlugin({
        executionMode: "background",
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
      virusScanPlugin(),
      mediaProcessingPlugin({ executionMode: "background" }),
    ],
  });
  return mediaInstance;
}

export { storage };
