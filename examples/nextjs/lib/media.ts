import { createBetterMedia } from "better-media";
import { memoryStorage } from "@better-media/adapter-storage";
import { memoryDatabase } from "@better-media/adapter-db";
import { validationPlugin } from "@better-media/plugin-validation";
import { virusScanPlugin } from "@better-media/plugin-virus-scan";
import { mediaProcessingPlugin } from "@better-media/plugin-media-processing";
import { trackingJobAdapter } from "./tracking-job-adapter";

export const media = createBetterMedia({
  storage: memoryStorage(),
  database: memoryDatabase(),
  jobs: trackingJobAdapter(),
  plugins: [
    validationPlugin(), // sync (default)
    virusScanPlugin(), // sync (default)
    mediaProcessingPlugin({ mode: "background" }), // runs via job queue
  ],
});
