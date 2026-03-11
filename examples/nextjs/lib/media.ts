import { createBetterMedia } from "better-media";
import { memoryStorage } from "@better-media/adapter-storage";
import { memoryDatabase } from "@better-media/adapter-db";
import { validationPlugin } from "@better-media/plugin-validation";
import { virusScanPlugin } from "@better-media/plugin-virus-scan";
import { mediaProcessingPlugin } from "@better-media/plugin-media-processing";
import { trackingJobAdapter } from "./tracking-job-adapter";

const storage = memoryStorage();
const database = memoryDatabase();

export const media = createBetterMedia({
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

export { storage };
