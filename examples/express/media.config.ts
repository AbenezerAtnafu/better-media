import { Pool } from "pg";
import { createBetterMedia } from "@better-media/framework";
import { S3StorageAdapter } from "@better-media/adapter-storage-s3";
import { bullmqJobAdapter } from "@better-media/adapter-jobs-bullmq";
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

// Parse REDIS_URL into { host, port, password } — BullMQ ConnectionOptions doesn't accept a URL string directly
const redisConnection = process.env.REDIS_URL
  ? (() => {
      const url = new URL(process.env.REDIS_URL!);
      return {
        host: url.hostname,
        port: Number(url.port) || 6379,
        ...(url.password && { password: decodeURIComponent(url.password) }),
      };
    })()
  : undefined;

export const mediaOptions = {
  storage,
  database: new Pool({
    connectionString:
      process.env.DATABASE_URL ?? "postgres://postgres:root@localhost:5432/better-media",
  }),
  plugins,
  dialect: "postgres",
  // schemaOutput: "better-media/schema.sql",
  // Use BullMQ when REDIS_URL is set; falls back to in-memory for local dev
  jobs: redisConnection
    ? bullmqJobAdapter({
        connection: redisConnection,
        defaultJobOptions: { attempts: 3, backoff: { type: "exponential", delay: 1000 } },
      })
    : undefined,
};

export const media = createBetterMedia(mediaOptions);

export default mediaOptions;
