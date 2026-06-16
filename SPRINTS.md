# Better Media — Sprint Roadmap

> Side project sprints. Each sprint is ~2 weeks. Update status in-place as work progresses.
> Status: `[ ]` todo · `[~]` in progress · `[x]` done · `[-]` skipped

---

## Overview

| Sprint                                               | Theme                          | Dates          | Status        |
| ---------------------------------------------------- | ------------------------------ | -------------- | ------------- |
| [Sprint 1](#sprint-1--production-foundation)         | Production Foundation          | Jun 9 – Jun 20 | `planned`     |
| [Sprint 2](#sprint-2--storage--processing-expansion) | Storage & Processing Expansion | Jun 23 – Jul 4 | `in progress` |
| [Sprint 3](#sprint-3--observability--metadata)       | Observability & Metadata       | Jul 7 – Jul 18 | `planned`     |
| [Sprint 4](#sprint-4--polish--developer-experience)  | Polish & Developer Experience  | Jul 21 – Aug 1 | `planned`     |

---

## Sprint 1 — Production Foundation

**Goal:** Make background processing actually work in production. Close the biggest correctness gaps.

### Deliverable 1.1 — Redis / BullMQ Job Adapter · `@better-media/jobs-bullmq`

The in-memory job adapter drops queued background jobs on process restart. This makes `executionMode: "background"` unreliable in any real deployment.

**Tasks:**

- [x] Create `packages/adapters/jobs-bullmq/` package
- [x] Implement `JobAdapter` interface using BullMQ (`enqueue(name, payload)`)
- [x] Add `BullMQJobAdapterOptions`: `connection` (Redis), `queueName`, `defaultJobOptions` (attempts, backoff)
- [x] Export worker factory `createBullMQWorker(processor, options)` for worker-process entrypoint
- [x] Add example worker script to `examples/express/`
- [x] Write unit tests (jest.mock — no Redis needed); integration tests deferred to Sprint 3
- [x] Add Bull Board monitoring UI to express example (`/admin/queues`)

**Acceptance criteria:**

- Background plugin jobs survive process restart and are picked up by a separate worker process
- Failed jobs retry with configurable backoff
- Existing in-memory adapter behavior unchanged

---

### Deliverable 1.2 — MongoDB Adapter · `@better-media/db-mongodb`

Package exists but is stubbed. MongoDB users hit a dead end.

**Tasks:**

- [x] Full `DatabaseAdapter` interface implemented in `packages/adapters/databases/mongodb-adapter/`
- [x] All CRUD operations: `create`, `findOne`, `findMany`, `update`, `updateMany`, `delete`, `deleteMany`, `count`
- [x] All `where` clause operators mapped to MongoDB query operators (`$ne`, `$lt`, `$gt`, `$in`, `$nin`, `$regex`)
- [x] `transaction()` implemented using MongoDB `ClientSession` + `session.withTransaction()`
- [x] Soft delete (`deletedAt` filtering, `withDeleted` option)
- [x] `__initCollection()` for schema migration (collection + index creation)
- [x] 43 tests covering all methods, all operators, soft delete, transactions, `__initCollection`
- [x] Removed stale `@better-media/framework` dependency and deprecated `@types/mongodb`

---

### Deliverable 1.3 — Webhook / Event System

After async processing, there's no way for clients to know what happened. Clients polling `getStatus()` (Sprint 3) need events to avoid tight loops; external systems need webhooks.

**Tasks:**

- [x] Added `events?: BetterMediaEvents` to `BetterMediaConfig` (`packages/better-media/src/config/config.interface.ts`)
- [x] `onUploadComplete` fires after `ingest()` and `complete()` succeed
- [x] `onProcessingComplete` fires after `runBackgroundJob()` succeeds (background plugin done)
- [x] `onError` fires on any pipeline or background job error (re-throws to caller)
- [x] All event handlers wrapped in `safeEmit` — handler errors never crash the pipeline
- [x] `createWebhookEmitter(url, secret?)` — HMAC-SHA256 signed POST, retries on 5xx (max 3, exp backoff)
- [x] Exported from `@better-media/framework`: `createWebhookEmitter`, `BetterMediaEvents`, `ProcessingCompleteEvent`, `ErrorEvent`
- [x] 12 tests covering `safeEmit` and `createWebhookEmitter` (retry, signature, 4xx no-retry, network error)

---

## Sprint 2 — Storage & Processing Expansion

**Goal:** Cover the other major cloud storage target and unlock video as a first-class media type.

### Deliverable 2.1 — Google Cloud Storage Adapter · `@better-media/storage-gcs`

Many projects use Firebase / GCP. S3 + filesystem doesn't cover them.

**Tasks:**

- [x] Create `packages/adapters/storages/storage-gcs/` package
- [x] Implement full `StorageAdapter` interface using `@google-cloud/storage`
- [x] Support: `get`, `put`, `delete`, `exists`, `getSize`, `getStream`, `move`, `copy`, `deleteMany`, `list`
- [x] Implement `createPresignedUpload()` for both PUT (signed URL) and POST (signed policy)
- [x] `GCSStorageAdapterOptions`: `bucket`, `keyFilename | credentials`, `projectId`, `basePrefix`
- [x] Write integration tests (GCS emulator or real bucket with test credentials)

**Acceptance criteria:**

- Passes the shared storage adapter test suite
- Presigned upload URLs work end-to-end with a real GCS bucket

---

### Deliverable 2.2 — Video Processing Plugin · `@better-media/plugin-video-processing`

The media processing plugin is Sharp-only (images). Video is a primary use case.

**Tasks:**

- [x] Create `packages/plugins/video-processing-plugin/` package
- [x] Tap `process:run` lifecycle hook
- [x] Options:
  - `thumbnails`: extract frame(s) at timestamp or percentage (`{at: "10%", format: "webp", width: 320}`)
  - `transcode`: output presets (`{name, format: "mp4"|"webm", codec, bitrate, resolution}`)
  - `allowedMimeTypes`: whitelist (default: `video/mp4`, `video/webm`, `video/quicktime`, etc.)
  - `maxInputBytes`: skip threshold
  - `ffmpegPath`: override binary location
- [x] Use `fluent-ffmpeg` as optional peer dependency
- [x] Store video thumbnails as `media_versions` rows (same table as image plugin)
- [x] Emit duration, codec, resolution, framerate to trusted metadata
- [x] Write tests with fixture video files

**Acceptance criteria:**

- Thumbnail extracted from uploaded video and stored as a version
- Transcoded output stored and linked to source record
- Duration/codec accessible via `media.files.get(id)`

---

### Deliverable 2.3 — Batch Ingest API

No `ingestMany()` today — callers must loop manually with no shared error handling.

**Tasks:**

- [ ] Add `media.upload.ingestMany(inputs[], options?)` to `BetterMediaRuntime`
- [ ] Options: `concurrency` (default 3), `onProgress(completed, total)`, `failFast` (default false)
- [ ] Return `BatchIngestResult`: `{ succeeded: MediaRecord[], failed: { input, error }[] }`
- [ ] Support shared `metadata` applied to all inputs, overrideable per-file
- [ ] Write tests for partial failure behavior

**Acceptance criteria:**

- `ingestMany()` processes files in parallel up to `concurrency` limit
- `failFast: false` continues on individual failures and collects errors
- `onProgress` fires after each file completes

---

## Sprint 3 — Observability & Metadata

**Goal:** Give developers visibility into pipeline state and richer data out of media files.

### Deliverable 3.1 — Job Status Tracking

Background jobs are fire-and-forget today. Clients have no way to know if processing succeeded or is still running.

**Tasks:**

- [ ] Add `media_jobs` table to schema (id, mediaId, hookName, pluginId, status: pending|running|completed|failed, error, startedAt, completedAt)
- [ ] Record job lifecycle in `LifecycleEngine` for background handlers
- [ ] Add `media.files.getStatus(id)` returning `{ record, jobs: JobStatus[] }`
- [ ] Add `media.jobs.list(filter?)` and `media.jobs.retry(jobId)` to runtime
- [ ] CLI: `media jobs` command to inspect queue state

**Acceptance criteria:**

- `getStatus()` accurately reflects processing state across sync and background execution
- Failed jobs surfaceable and retryable via CLI

---

### Deliverable 3.2 — Rich Metadata Extraction

Only checksums and image dimensions are extracted today. EXIF, audio tags, and video metadata are not.

**Tasks:**

- [ ] Extend validation plugin to optionally extract:
  - **Images:** EXIF (camera, GPS, timestamp, orientation) via `exifr`
  - **Audio:** ID3 tags (title, artist, album, duration, bitrate) via `music-metadata`
  - **Video:** codec, framerate, duration, resolution via `ffprobe` (reuse ffmpeg from Sprint 2.2)
- [ ] Store extracted fields in `metadata` namespace of plugin output (`plugin.validation.exif`, etc.)
- [ ] Add `extractMetadata: true` option to validation plugin (default off to avoid dep bloat)
- [ ] Document extracted fields per media type

**Acceptance criteria:**

- EXIF data available in `media.files.get(id)` metadata after upload of a JPEG with EXIF
- Audio duration and title extracted from MP3 upload

---

### Deliverable 3.3 — Rate Limiting & Storage Quotas

No per-upload limits or per-tenant storage caps exist. Everything is opt-in via custom validators today.

**Tasks:**

- [ ] Add `limits` config to `BetterMediaConfig`:
  ```ts
  limits?: {
    maxFilesPerMinute?: number
    maxStorageBytes?: number
    maxFileSizeBytes?: number
    resolveQuota?: (context) => Promise<QuotaConfig>
  }
  ```
- [ ] Enforce `maxFileSizeBytes` before pipeline starts (fast rejection)
- [ ] Check `maxStorageBytes` against DB aggregate before storing
- [ ] Rate limit `maxFilesPerMinute` using a sliding window (in-memory for now, Redis-backed in a follow-up)
- [ ] Return `QuotaExceededError` (typed, catchable) on violation

**Acceptance criteria:**

- Upload exceeding `maxFileSizeBytes` is rejected before any storage write
- Tenant over quota receives `QuotaExceededError` with remaining bytes in error context

---

## Sprint 4 — Polish & Developer Experience

**Goal:** Reduce friction for common production setups and close rough edges.

### Deliverable 4.1 — CDN URL Rewriting

`getUrl()` returns raw S3/GCS URLs. Most production setups serve assets from CloudFront/Cloudflare.

**Tasks:**

- [ ] Add `cdn?: { baseUrl: string, rewriteKey?: (key: string) => string }` to `BetterMediaConfig`
- [ ] Apply rewrite in `getUrl()` when `cdn.baseUrl` is set
- [ ] Bypass presigned URL generation for CDN-served assets (CDN handles auth)
- [ ] Document CloudFront + S3 setup in platform docs

**Acceptance criteria:**

- `getUrl()` returns `https://cdn.example.com/<key>` when `cdnBaseUrl` is configured
- Presigned uploads still target S3 directly; CDN rewrite only affects read URLs

---

### Deliverable 4.2 — Resumable Uploads (TUS Protocol)

Large file uploads fail silently on network interruption. TUS is the standard answer.

**Tasks:**

- [ ] Add optional `@better-media/tus-server` package wrapping `tus-node-server`
- [ ] Expose `createTusMiddleware(media, options)` returning Express/Node-compatible middleware
- [ ] On TUS completion, call `media.upload.complete(key, metadata)` automatically
- [ ] Add example in `examples/express/` showing TUS endpoint + client-side `tus-js-client`
- [ ] Document max file size and chunk configuration

**Acceptance criteria:**

- 100 MB file upload completes after simulated mid-upload network cut
- Pipeline runs after TUS assembly completes

---

### Deliverable 4.3 — `clearStorage()` Safety Guard

`clearStorage()` wipes all storage + database with no confirmation. It is dangerous to call accidentally in staging.

**Tasks:**

- [ ] Require explicit opt-in: `clearStorage({ confirm: true })`
- [ ] Add `NODE_ENV` guard — throw if called outside `test` or `development` unless `force: true` explicitly passed
- [ ] Add dry-run option: `clearStorage({ dryRun: true })` returns counts without deleting
- [ ] Update all internal test helpers to pass `{ confirm: true }`

**Acceptance criteria:**

- Calling `clearStorage()` without `{ confirm: true }` throws `SafetyError` with clear message
- Calling in `production` NODE_ENV without `{ force: true }` always throws

---

### Deliverable 4.4 — Documentation Pass

- [ ] Update platform docs for all Sprint 1–3 additions
- [ ] Add "Deployment Guide" page: worker setup, Redis, environment variables
- [ ] Add "Storage Guide" page: S3 vs GCS vs filesystem trade-offs, CDN setup
- [ ] Add "Plugin Authoring Guide" page: custom plugin walkthrough end-to-end
- [ ] Add migration guide from in-memory adapters to production adapters

---

## Backlog (not scheduled)

These are worth doing eventually but don't fit the current sprints:

- `@better-media/jobs-redis` — raw Redis streams adapter (lighter than BullMQ)
- Cloudflare R2 storage adapter (S3-compatible but worth explicit docs/testing)
- Azure Blob Storage adapter
- `@better-media/plugin-image-optimization` — WebP/AVIF conversion, responsive srcset generation
- Audit log adapter (write-only append store for compliance)
- OpenTelemetry tracing integration
- TUS protocol — progress events streamed to client via SSE
