---
name: better-media
description: Integrate better-media — a modular TypeScript media pipeline framework for file intake, validation, processing, and storage
---

# better-media Integration Skill

better-media provides a single unified API over file storage, a database, and a plugin pipeline. You configure it once with `createBetterMedia()`, then use the returned runtime to ingest and manage media files.

## Installation

```bash
# Core runtime (required)
pnpm add @better-media/framework

# Pick a storage adapter
pnpm add @better-media/adapter-storage-s3          # AWS S3 / MinIO / R2
pnpm add @better-media/adapter-storage-filesystem  # Local disk
pnpm add @better-media/adapter-storage-gcs         # Google Cloud Storage
pnpm add @better-media/adapter-storage-memory      # In-memory (dev/test only)

# Pick a database adapter
pnpm add @better-media/adapter-db-kysely           # PostgreSQL / MySQL / SQLite via Kysely
pnpm add @better-media/mongodb-adapter             # MongoDB
pnpm add @better-media/adapter-db-memory           # In-memory (dev/test only)

# Optional: job adapter for background processing
pnpm add @better-media/adapter-jobs-bullmq         # BullMQ + Redis

# Optional plugins
pnpm add @better-media/plugin-validation           # MIME type, size, dimension checks
pnpm add @better-media/plugin-media-processing     # Thumbnails and image variants (requires sharp)
pnpm add @better-media/plugin-virus-scan           # ClamAV virus scanning
pnpm add @better-media/plugin-video-streaming      # HLS/DASH adaptive streaming (requires ffmpeg)
pnpm add @better-media/plugin-audio-streaming      # Audio streaming
pnpm add @better-media/plugin-video-processing     # Video transcoding
```

## Setup

Always create a single instance and export it. Never call `createBetterMedia()` inside request handlers.

```ts
// lib/media.ts
import { createBetterMedia } from "@better-media/framework";
import { S3StorageAdapter } from "@better-media/adapter-storage-s3";
import { Pool } from "pg";
import { validationPlugin } from "@better-media/plugin-validation";
import { mediaProcessingPlugin } from "@better-media/plugin-media-processing";

const storage = new S3StorageAdapter({
  region: process.env.AWS_REGION!,
  bucket: process.env.AWS_BUCKET!,
  accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  // Optional: endpoint for MinIO / R2 / local dev
  endpoint: process.env.AWS_ENDPOINT,
  forcePathStyle: true, // Required for MinIO
});

export const media = createBetterMedia({
  storage,
  database: new Pool({ connectionString: process.env.DATABASE_URL }),
  plugins: [
    validationPlugin({
      executionMode: "sync", // validation:run is sync-only
      allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
      useMagicBytes: true,
      maxBytes: 10 * 1024 * 1024,
      onFailure: "abort",
    }),
    mediaProcessingPlugin({
      executionMode: "background", // process:run can be background
      thumbnailPresets: [
        { name: "sm", width: 160, format: "webp", quality: 82 },
        { name: "md", width: 480, format: "webp", quality: 85 },
      ],
    }),
  ],
  // Optional: BullMQ for durable background jobs
  // jobs: bullmqJobAdapter({ connection: redisConnection }),
});
```

## Storage Adapters

| Adapter                    | Package                      | When to use                               |
| -------------------------- | ---------------------------- | ----------------------------------------- |
| `S3StorageAdapter`         | `adapter-storage-s3`         | Production — AWS S3, MinIO, Cloudflare R2 |
| `FileSystemStorageAdapter` | `adapter-storage-filesystem` | Local dev or self-hosted                  |
| `GCSStorageAdapter`        | `adapter-storage-gcs`        | Google Cloud Storage                      |
| `memoryStorageAdapter()`   | `adapter-storage-memory`     | Dev/test only — data lost on restart      |

```ts
// S3
new S3StorageAdapter({ region, bucket, accessKeyId, secretAccessKey, endpoint?, forcePathStyle? })

// Filesystem
new FileSystemStorageAdapter({ baseDir: "./uploads" })

// Memory
import { memoryStorageAdapter } from "@better-media/adapter-storage-memory";
const storage = memoryStorageAdapter();
```

## Database Adapters

| Adapter                           | Package             | When to use                            |
| --------------------------------- | ------------------- | -------------------------------------- |
| `pg.Pool` (direct)                | `pg`                | PostgreSQL — pass Pool directly        |
| `@better-media/adapter-db-kysely` | `adapter-db-kysely` | PostgreSQL / MySQL / SQLite via Kysely |
| `@better-media/mongodb-adapter`   | `mongodb-adapter`   | MongoDB                                |
| `memoryDatabase()`                | `adapter-db-memory` | Dev/test only — data lost on restart   |

```ts
// PostgreSQL (direct pg Pool)
import { Pool } from "pg";
{
  database: new Pool({ connectionString: process.env.DATABASE_URL });
}

// Memory
import { memoryDatabase } from "@better-media/adapter-db-memory";
{
  database: memoryDatabase();
}
```

## Plugins

### Hook mode constraints — critical

| Hook              | Constraint         | Plugins that tap it                             |
| ----------------- | ------------------ | ----------------------------------------------- |
| `validation:run`  | **sync only**      | `validationPlugin`                              |
| `scan:run`        | **sync only**      | `virusScanPlugin`                               |
| `process:run`     | sync or background | `mediaProcessingPlugin`, `videoStreamingPlugin` |
| `upload:complete` | sync or background | custom plugins                                  |

Always set `executionMode: "sync"` for validation and virus scan. Setting it to `"background"` on a sync-only hook produces a warning and is overridden.

### validationPlugin

```ts
import { validationPlugin } from "@better-media/plugin-validation";

validationPlugin({
  executionMode: "sync", // required — validation:run is sync-only
  allowedMimeTypes: ["image/jpeg", "image/png"],
  allowedExtensions: [".jpg", ".png"],
  useMagicBytes: true, // verify MIME from file content, not extension
  maxBytes: 10 * 1024 * 1024,
  minWidth: 1,
  maxWidth: 8000,
  minHeight: 1,
  maxHeight: 8000,
  onFailure: "abort", // "abort" | "continue"
});
```

### mediaProcessingPlugin

Requires `sharp` as a peer dependency.

```ts
import { mediaProcessingPlugin } from "@better-media/plugin-media-processing";

mediaProcessingPlugin({
  executionMode: "background",
  thumbnailPresets: [
    { name: "sm", width: 160, format: "webp", quality: 82 },
    { name: "md", width: 480, format: "webp", quality: 85 },
    { name: "lg", width: 1200, format: "webp", quality: 88 },
  ],
  derivativePrefix: "versions", // Storage key prefix for derivatives
  persistMediaVersions: true, // Save thumbnail records to DB
});
```

### virusScanPlugin

Requires ClamAV running locally or a custom scanner implementation.

```ts
import { virusScanPlugin, ClamScanner } from "@better-media/plugin-virus-scan";

virusScanPlugin({
  executionMode: "sync", // scan:run is sync-only
  scanner: new ClamScanner(), // or custom VirusScanner implementation
  onFailure: "abort",
});
```

### videoStreamingPlugin

Requires `ffmpeg` in PATH.

```ts
import { videoStreamingPlugin } from "@better-media/plugin-video-streaming";

videoStreamingPlugin({
  executionMode: "background",
  formats: ["hls"], // "hls" | "dash"
  presets: [
    { name: "360p", height: 360, videoBitrate: "800k", audioBitrate: "96k" },
    { name: "720p", height: 720, videoBitrate: "2500k", audioBitrate: "128k" },
    { name: "1080p", height: 1080, videoBitrate: "5000k", audioBitrate: "192k" },
  ],
  derivativePrefix: "streaming",
  segmentDuration: 6,
});
```

## API Reference

### media.upload

```ts
// From a Buffer (most common for server-side uploads)
await media.upload.fromBuffer(buffer, {
  originalName: "photo.jpg",
  mimeType: "image/jpeg",
  metadata: { userId: "abc" }, // arbitrary app metadata
});

// From a file path
await media.upload.fromPath("/tmp/upload.jpg", { originalName: "photo.jpg" });

// From a readable stream
await media.upload.fromStream(readableStream, { mimeType: "video/mp4" });

// From a URL (import the file)
await media.upload.fromUrl("https://example.com/photo.jpg", { mode: "import" });

// Presigned S3 upload — two-step: request URL, then finalize after client uploads
const { url, key } = await media.upload.requestPresignedUpload("uploads/photo.jpg", {
  contentType: "image/jpeg",
  expiresIn: 3600,
});
// After client uploads directly to S3:
await media.upload.complete(key, { originalName: "photo.jpg" });
```

### media.files

```ts
const record = await media.files.get(recordId);
const url = await media.files.getUrl(recordId);
const buffer = await media.files.download(recordId);
const stream = await media.files.stream(recordId);

await media.files.delete(recordId);
await media.files.deleteMany([id1, id2]);
await media.files.move(recordId, "new/storage/key.jpg");
await media.files.copy(recordId, "copies/storage/key.jpg");
await media.files.reprocess(recordId); // re-run all plugins
```

### media.stream (requires videoStreamingPlugin)

```ts
const playbackUrl = await media.stream.getPlaybackUrl(recordId, { format: "hls" });
const variants = await media.stream.getVariants(recordId, { format: "hls" });
```

## Framework Integration Patterns

### Express

```ts
import express from "express";
import multer from "multer";
import { media } from "./lib/media";

const upload = multer({ storage: multer.memoryStorage() });
const app = express();

// Multipart form upload
app.post("/upload", upload.single("file"), async (req, res) => {
  const result = await media.upload.fromBuffer(req.file!.buffer, {
    originalName: req.file!.originalname,
    mimeType: req.file!.mimetype,
  });
  res.json({ id: result.id, key: result.key });
});

// Presigned upload flow
app.post("/upload/presign", async (req, res) => {
  const { url, key } = await media.upload.requestPresignedUpload(req.body.key, {
    contentType: req.body.contentType,
  });
  res.json({ url, key });
});

app.post("/upload/complete", async (req, res) => {
  const record = await media.upload.complete(req.body.key, req.body.metadata);
  res.json(record);
});
```

### NestJS

```ts
// better-media.module.ts
import { Global, Module } from "@nestjs/common";
import { createBetterMedia } from "@better-media/framework";

export const BETTER_MEDIA = "BETTER_MEDIA";

@Global()
@Module({
  providers: [
    {
      provide: BETTER_MEDIA,
      useFactory: () => createBetterMedia({ storage, database, plugins }),
    },
  ],
  exports: [BETTER_MEDIA],
})
export class BetterMediaModule {}

// In a controller
@Controller("upload")
export class UploadController {
  constructor(@Inject(BETTER_MEDIA) private media: BetterMediaRuntime) {}

  @Post()
  async upload(@UploadedFile() file: Express.Multer.File) {
    return this.media.upload.fromBuffer(file.buffer, { originalName: file.originalname });
  }
}
```

### Next.js

```ts
// lib/media.ts — singleton pattern required for Next.js
import { createBetterMedia, type BetterMediaRuntime } from "@better-media/framework";

let instance: BetterMediaRuntime | null = null;

export function getMedia(): BetterMediaRuntime {
  if (instance) return instance;
  instance = createBetterMedia({ storage, database, plugins });
  return instance;
}

// app/api/upload/route.ts
import { getMedia } from "@/lib/media";

export async function POST(request: Request) {
  const formData = await request.formData();
  const file = formData.get("file") as File;
  const buffer = Buffer.from(await file.arrayBuffer());

  const record = await getMedia().upload.fromBuffer(buffer, {
    originalName: file.name,
    mimeType: file.type,
  });

  return Response.json({ id: record.id });
}
```

## Common Mistakes

**Don't instantiate adapters or call `createBetterMedia()` inside request handlers.** Create once at module load or app startup and reuse.

**`memoryDatabase()` and `memoryStorageAdapter()` are dev-only.** All data is lost on process restart. Never use in production.

**Background plugins require a durable job adapter in production.** Without one, better-media falls back to an in-memory job queue — jobs are lost if the process restarts. Use `@better-media/adapter-jobs-bullmq` with Redis for production background processing.

**`validation:run` and `scan:run` are sync-only hooks.** Always pass `executionMode: "sync"` to `validationPlugin` and `virusScanPlugin`. Any other value is ignored with a warning.

**Plugin namespaces must be unique.** Each plugin in the `plugins` array must have a distinct namespace. Duplicates throw at startup.
