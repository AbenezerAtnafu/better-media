import { Pool } from "pg";
import { createBetterMedia } from "@better-media/framework";
import { S3StorageAdapter } from "@better-media/adapter-storage-s3";
import { validationPlugin } from "@better-media/plugin-validation";
import { mediaProcessingPlugin } from "@better-media/plugin-media-processing";

const storage = new S3StorageAdapter({
  region: process.env.AWS_REGION ?? "us-east-1",
  bucket: process.env.AWS_BUCKET ?? "express-test-bucket",
  accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "minioadmin",
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "minioadmin",
  endpoint: process.env.AWS_ENDPOINT ?? "http://localhost:9000",
  forcePathStyle: true,
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
      process.env.DATABASE_URL ?? "postgres://postgres:root@localhost:5432/better-media",
  }),
  plugins,
  dialect: "postgres",
  // schemaOutput: "better-media/schema.sql",
};

export const media = createBetterMedia(mediaOptions);

export default mediaOptions;
