import { createBetterMedia } from "@better-media/framework";
import { memoryStorage } from "@better-media/adapter-storage-memory";
import { memoryDatabase } from "@better-media/adapter-db";
import { validationPlugin } from "@better-media/plugin-validation";
import { ClamScanner, virusScanPlugin } from "@better-media/plugin-virus-scan";
import { trackingJobAdapter } from "./tracking-job-adapter";
import type { BetterMediaRuntime } from "@better-media/framework";

const storage = memoryStorage();
const database = memoryDatabase();

let mediaInstance: BetterMediaRuntime | null = null;

/**
 * Better Media instance (lazy-loaded).
 * Mirrors Better Auth: config in lib/, accessed via getter so heavy deps
 * are loaded at runtime, not bundled by Next.js.
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
      virusScanPlugin({
        scanner: new ClamScanner({
          clamdscan: {
            host: "localhost",
            port: 3310,
            timeout: 10000,
          },
          debugMode: true,
          removeInfected: false,
        }),
        executionMode: "background",
        onFailure: "custom",
        onFailureCallback: async (fileKey: string, viruses: string[]) => {
          console.error(`[virus-scan] Threat in "${fileKey}": ${viruses.join(", ")}`);
          return { valid: false, message: `Upload rejected: malware detected` };
        },
        scanTimeoutMs: 30_000,
      }),
      mediaProcessingPlugin({ executionMode: "background" }),
    ],
  });
  return mediaInstance;
}

export { storage };
