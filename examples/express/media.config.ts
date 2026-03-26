import { Pool } from "pg";
import { createBetterMedia } from "better-media";
import { FileSystemStorageAdapter } from "@better-media/adapter-storage-filesystem";
import { validationPlugin } from "@better-media/plugin-validation";
import { mediaProcessingPlugin } from "@better-media/plugin-media-processing";

const storage = new FileSystemStorageAdapter({
  baseDir: "./uploads",
});

const plugins = [
  validationPlugin({
    executionMode: "sync",
    allowedMimeTypes: [
      "image/jpeg",
      "application/zip",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/pdf",
    ],
    useMagicBytes: true,
    onFailure: "abort",
  }),
  mediaProcessingPlugin({
    executionMode: "sync",
  }),
];

export const mediaOptions = {
  storage,
  database: new Pool({
    connectionString:
      process.env.DATABASE_URL ?? "postgres://postgres:postgres@localhost:5432/better_media",
  }),
  plugins,
  dialect: "postgres",
  // schemaOutput: "better-media/schema.sql",
};

export const media = createBetterMedia(mediaOptions);

export default mediaOptions;
