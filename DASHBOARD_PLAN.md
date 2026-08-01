# 🎛️ better-media Cloud Dashboard — Architecture Plan

## 🧭 What We're Building

A developer-facing SaaS product. Developers use `better-media` in their own apps, install a lightweight cloud-reporter plugin, drop an API key into their env, and from that point all file activity flows into a hosted dashboard showing analytics, security results, storage health, and duplicate detection.

---

## 🏛️ Solution Architecture — Infrastructure Ownership

This is the most important boundary to establish. The system has two distinct sides.

### 🧑‍💻 Their Infrastructure (Developer's Side)

Everything the developer provisions and operates themselves:

```
┌─────────────────────────────────────────────────────────────┐
│                    DEVELOPER'S INFRASTRUCTURE               │
│                                                             │
│  ┌──────────────────────────────────────────┐              │
│  │           Their Application Server        │              │
│  │  (Express / Next.js / NestJS / etc.)      │              │
│  │                                           │              │
│  │  better-media framework                   │              │
│  │    ├── their storage adapter  ──────────────── their S3 / GCS / filesystem │
│  │    ├── their DB adapter       ──────────────── their Postgres / Mongo       │
│  │    ├── their job adapter      ──────────────── their Redis (optional)       │
│  │    └── @better-media/plugin-cloud ──────────────────► (outbound only, see below)  │
│  └──────────────────────────────────────────┘              │
└─────────────────────────────────────────────────────────────┘
```

The developer owns and pays for all of this. We never touch their storage, their DB, or their files.

---

### ☁️ Our Infrastructure (better-media Cloud)

Everything we provision, operate, and are responsible for:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        BETTER-MEDIA CLOUD                               │
│                                                                         │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────────────┐  │
│  │  Ingest API  │    │  Dashboard   │    │       Auth Service       │  │
│  │  (Hono)      │    │  (Next.js)   │    │      (Better Auth)       │  │
│  │              │    │              │    │                          │  │
│  │  Validates   │    │  Serves UI   │    │  Sign up / sign in       │  │
│  │  API keys    │    │  Reads from  │    │  Session management      │  │
│  │  Enqueues    │    │  Postgres    │    │  API key issuance        │  │
│  │  jobs        │    │              │    │                          │  │
│  └──────┬───────┘    └──────────────┘    └──────────────────────────┘  │
│         │                                                               │
│         ▼                                                               │
│  ┌──────────────┐                                                       │
│  │    Redis     │  ← BullMQ job queues                                 │
│  └──────┬───────┘                                                       │
│         │                                                               │
│         ▼                                                               │
│  ┌──────────────────────────────────────────────────────────────────┐  │
│  │                        Worker Pool                               │  │
│  │                                                                  │  │
│  │  metadata-worker    ← normalises + stores file records          │  │
││  │  dedup-worker       ← SHA-256 lookup, flags duplicates          │  │
│  │  snapshot-worker    ← daily storage stats aggregation           │  │
│  │  webhook-worker     ← fires outbound webhooks to their app      │  │
│  └──────────────────────────────────────────────────────────────────┘  │
│         │                                                               │
│         ▼                                                               │
│  ┌──────────────┐                                                       │
│  │  PostgreSQL  │  ← all metadata, events, snapshots                   │
│  └──────────────┘                                                       │
│                                                                         │
│  ┌──────────────┐                                                       │
│  │  Email relay │  ← transactional email (alerts, verification)        │
│  │  (Resend /   │                                                       │
│  │   Postmark)  │                                                       │
│  └──────────────┘                                                       │
└─────────────────────────────────────────────────────────────────────────┘
```

---

### 🔌 The Boundary — What Crosses the Wire

The `@better-media/plugin-cloud` plugin is the only thing that bridges the two sides. It runs inside their app, talks to our Ingest API over HTTPS.

**What we receive (metadata only):**

```typescript
// Shape of every ingest event — no file bytes, no storage URLs, ever
{
  event:     "file.uploaded" | "file.processed" | "file.deleted" | "processing.failed",
  fileId:    string,          // their internal file ID
  filename:  string,
  mimeType:  string,
  sizeBytes: number,
  sha256:    string,          // computed client-side in their app
  storageProvider: "s3" | "gcs" | "filesystem" | "memory",
  storageLocation: string,    // bucket name for s3/gcs, folder path for filesystem
  meta:      Record<string, unknown
>,  // any extra context they opt in to send
  timestamp: string,
}
```

**What we never receive:**

- File bytes
- Their users' personal data
- Their app database contents
- Their storage credentials

**What we send back to their app (optional):**

- Webhooks: `POST` to their configured endpoint when a scan completes, a duplicate is found, or a threshold is breached

---

### 🛠️ Infrastructure We Are Responsible For

| Service             | What it does                                       | Scales how                              |
| ------------------- | -------------------------------------------------- | --------------------------------------- |
| Ingest API (Hono)   | Receives events, validates API keys, enqueues jobs | Horizontally — stateless, add instances |
| Dashboard (Next.js) | Serves the UI, reads from Postgres                 | Horizontally — stateless                |
| Auth (Better Auth)  | Sessions, API key management                       | Bundled with Dashboard                  |
| PostgreSQL          | Source of truth for all metadata                   | Vertically first, read replicas later   |
| Redis               | BullMQ job queues + session cache                  | Single instance → cluster if needed     |
| Worker Pool         | Async processing of all events                     | Horizontally — add worker processes     |
| Email relay         | Auth emails + alert emails                         | Managed service (Resend/Postmark)       |

**What we do NOT run:**

- Object storage (no S3 on our side)
- CDN (their files are served from their storage)
- Media processing servers (processing happens in their app)

---

### 🔒 Security Model

```
Their App → Ingest API     authenticated by:  API key (hashed in DB, scoped to project)
Their Browser → Dashboard  authenticated by:  Better Auth session cookie (httpOnly)
Workers → third-party APIs authenticated by:  service API keys in our env
Our workers → their webhooks  one-way push,   signed with HMAC secret they configure
```

File bytes never enter our network. We are a metadata and observability layer, not a data processor under GDPR for their users' files. This is a deliberate design choice that keeps our compliance surface small.

---

## 📁 Repository Structure

Three repos total: one existing public repo, two new private repos.

### 📦 `better-media` (existing — public)

The open-source framework. One addition here:

```
packages/plugins/
  cloud-plugin/     ← @better-media/plugin-cloud — published to npm, installed by developers
```

This stays public because it's a package developers install in their own apps. It only contains the event-emitting plugin — no secrets, no backend logic, no connection to our infrastructure beyond an outbound HTTPS call.

### 🖥️ `better-media-dashboard` (new — private)

The SaaS frontend. Deployed on Vercel (or similar).

```
apps/
  dashboard/     ← Next.js 15 — the dashboard UI + server components
```

Depends on `@better-media/plugin-cloud` (npm) for shared types only. Has its own DB connection, auth config, and env secrets.

### ⚙️ `better-media-api` (new — private)

The ingest backend. Deployed separately for independent scaling.

```
apps/
  api/     ← Hono — receives file events, validates API keys, enqueues jobs
            ← Workers — metadata, scan, dedup, snapshot, webhook
```

Shares the same PostgreSQL and Redis as the dashboard but deployed as its own process. Keeping it separate from the dashboard means we can scale ingest independently and it never goes down during a dashboard deploy.

---

### 🤔 Why this split

| Concern                                | How it's solved                                                                                        |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Framework stays open source            | `better-media` repo stays public, `@better-media/plugin-cloud` is published openly                     |
| Dashboard + API stay proprietary       | Private repos, no framework code in them                                                               |
| Shared types between API and dashboard | Extracted into `@better-media/plugin-cloud` (the public package) or a shared private package if needed |
| DB schema ownership                    | Lives in `better-media-api`, dashboard connects to the same DB                                         |
| Independent deployments                | Dashboard and API deploy on their own cadence, no coupling to framework releases                       |

The existing `platform/` (docs site) stays untouched in the public repo.

---

## ⚙️ Tech Stack Decisions

| Concern             | Choice                                         | Reason                                                           |
| ------------------- | ---------------------------------------------- | ---------------------------------------------------------------- |
| Dashboard UI        | Next.js 15 (App Router) + Tailwind + shadcn/ui | Already used in `platform/`, team familiarity, SSR for analytics |
| Ingest API          | **Hono**                                       | Lightweight, edge-compatible, handles high event volume cheaply  |
| Auth                | **Better Auth**                                | TypeScript-first, self-hostable, fits OSS ethos of the project   |
| Database            | PostgreSQL + **Drizzle**                       | Already in the monorepo, existing adapter, zero new tooling      |
| Background Jobs     | **BullMQ** (Redis)                             | Already in the monorepo via `@better-media/adapter-jobs-bullmq`  |
| Duplicate Detection | SHA-256 hash per file                          | Stored at ingest time, O(1) lookup                               |
| Analytics           | **Postgres time-series queries**               | No extra infra for MVP; migrate to ClickHouse if needed at scale |

---

## 🔄 Data Flow

```
─── WRITE PATH ──────────────────────────────────────────────────

User's App
  └── @better-media/plugin-cloud
        │  hooks into plugin lifecycle, batches events
        ▼
  POST /v1/ingest   (Hono — authenticated by project API key)
        │
        ▼
  BullMQ Queue (Redis)
        │
        ├── metadata-worker    → writes to bm_files
        ├── dedup-worker       → SHA-256 lookup, flags duplicates
        ├── snapshot-worker    → daily storage aggregation
        └── webhook-worker     → fires outbound webhooks to their app

─── READ PATH ───────────────────────────────────────────────────

Dashboard (Next.js)
  └── GET /v1/projects/:id/files
  └── GET /v1/projects/:id/analytics
  └── GET /v1/projects/:id/storage
        ▼
  better-media-api (Hono — authenticated by dashboard session token)
        ▼
  PostgreSQL

─── OWNERSHIP ───────────────────────────────────────────────────

PostgreSQL
  ↑ only better-media-api holds DB credentials
  ↑ dashboard holds an API token, not a DB connection string
```

---

## 🗄️ Database Schema

New tables, owned and managed by `better-media-api`. Schema lives at `src/db/schema.ts` inside that repo, using Drizzle ORM.

```
bm_users              id, email, password_hash, created_at
bm_projects           id, owner_id, name, slug, created_at
bm_project_members    id, project_id, user_id, role (owner/admin/viewer), joined_at
bm_api_keys           id, project_id, key_hash, name, last_used_at, revoked_at
bm_files              id, project_id, filename, mime_type, size_bytes,
                      sha256, storage_provider, storage_location, duplicate_of_id, created_at
bm_file_events        id, project_id, file_id, event_type, payload_json, received_at
bm_storage_snapshots  id, project_id, total_files, total_bytes, snapshot_at
```

---

## 📡 Plugin ↔ API Communication

### 🚀 Transport

HTTPS POST only. Same pattern as Sentry, Datadog, and Segment SDKs — simple, firewall-friendly, no persistent connection to manage.

```
POST https://api.betterMedia.dev/v1/ingest
Authorization: Bearer <api_key>
Content-Type: application/json

{
  "events": [
    {
      // one of the 7 events below
      "event": string,
      "fileId": string,       // absent on file.validation.rejected (never stored)
      "timestamp": string,
      "meta": {}              // event-specific fields, see event catalogue below
    }
  ]
}

← 202 Accepted      events queued, processing async
← 401 Unauthorized  bad or revoked API key
← 429 Too Many Reqs rate limited, Retry-After header set
← 400 Bad Request   malformed payload
```

The API validates the key, enqueues the batch to BullMQ, and returns 202 immediately. No waiting for processing.

### 📋 Event Catalogue

14 events total. Every plugin stage has an explicit started event so the dashboard shows real status, not inferred state.

#### File status flow

```
uploaded → validating → validated → processing → ready
                     ↘ rejected      ↘ failed
                                  → streaming → streamed
                                  → scanning  → scanned
```

---

#### 📤 Upload

**file.uploaded** — written to storage successfully

```json
{ "filename", "mimeType", "sizeBytes", "sha256",
  "storageProvider": "s3"|"gcs"|"filesystem",
  "storageLocation": "bucket-name" | "/folder/path" }
```

**file.upload.failed** — storage write failed, file never persisted

```json
{ "filename", "mimeType", "sizeBytes", "errorCode", "errorMessage" }
```

No `fileId`.

---

#### ✅ Validation

**file.validation.started**

```json
{ "fileId", "plugin": "validation-plugin" }
```

**file.validation.passed**

```json
{ "fileId", "plugin": "validation-plugin" }
```

**file.validation.rejected** — rejected before storage

```json
{ "filename", "mimeType", "sizeBytes", "reason": "type"|"size"|"format", "plugin": "validation-plugin" }
```

No `fileId` — file never reached storage. Counted for error-rate analytics only.

---

#### ⚙️ Processing

**file.processing.started**

```json
{ "fileId", "plugin" }
```

**file.processing.completed**

```json
{ "fileId", "plugin", "durationMs" }
```

**file.processing.failed**

```json
{ "fileId", "plugin", "errorMessage" }
```

`plugin` is the package name (e.g. `video-processing-plugin`) so the developer knows exactly what broke. Multiple processing plugins can each emit their own started/completed/failed independently.

---

#### 🎥 Streaming

Streaming is separate from processing because it produces a manifest + segments, not a single transformed file. Both `video-streaming-plugin` and `audio-streaming-plugin` emit these.

**file.streaming.started**

```json
{ "fileId", "plugin": "video-streaming-plugin"|"audio-streaming-plugin" }
```

**file.streaming.completed**

```json
{ "fileId", "plugin", "manifestPath", "segmentCount",
  "resolutions": ["360p", "720p", "1080p"],
  "totalOutputBytes", "durationMs" }
```

`resolutions` is video only; audio streaming omits it.

**file.streaming.failed**

```json
{ "fileId", "plugin", "errorMessage" }
```

---

#### 🛡️ Scan

**file.scan.started**

```json
{ "fileId", "plugin": "virus-scan-plugin" }
```

**file.scan.completed**

```json
{ "fileId", "plugin": "virus-scan-plugin", "result": "clean"|"infected"|"suspicious", "threatName" }
```

---

#### 🗑️ Deletion

**file.deleted**

```json
{ "fileId", "sizeBytes" }
```

`sizeBytes` so storage snapshots subtract correctly without a DB lookup.

### 🧱 Buffering and Flush Strategy

Events are never sent one-by-one. The plugin holds an in-memory buffer and flushes it under three conditions:

```
better-media lifecycle event fires
        │
        ▼
   in-memory buffer   (never blocks the request — always async)
        │
        ├── buffer hits 50 events?   → flush now
        ├── 5 seconds elapsed?       → flush now
        └── process SIGTERM?         → flush synchronously before exit
```

On flush failure: exponential backoff, 3 attempts (1s → 2s → drop). If our API is down, events are silently dropped and a warning is logged. The developer's app never slows down or crashes because of us.

### 📦 Dependencies

The plugin uses native `fetch` (Node 18+). No extra dependencies, no disk writes, no local queue.

### 🔐 Security on the Wire

| Concern                | Approach                                                    |
| ---------------------- | ----------------------------------------------------------- |
| Key in transit         | HTTPS/TLS 1.2+ only                                         |
| Key in developer's app | Read from env var (`BETTER_MEDIA_API_KEY`), never hardcoded |
| Key on our side        | Stored as bcrypt hash, looked up on every ingest request    |
| Key rotation           | Revoke in dashboard → create new → update env var           |

---

## 🔌 The Cloud Plugin (`@better-media/plugin-cloud`)

Users add one line to their better-media config:

```typescript
import { cloudReporter } from "@better-media/plugin-cloud";

export default defineConfig({
  plugins: [cloudReporter({ apiKey: process.env.BETTER_MEDIA_API_KEY })],
});
```

It hooks into the **framework's pipeline lifecycle**, not into individual plugins. No existing plugin is modified.

```
video-streaming-plugin runs
  → writes output to the shared pipeline context (as it always does)

cloud plugin observes each pipeline stage
  → reads from that context after each stage completes
  → ships the event to the API
```

The individual plugins have no knowledge of the cloud plugin. They write their results to the framework's pipeline context as normal. The cloud plugin is a passive observer sitting at the end of each stage — it reads what's already there.

The only internal concern is whether the framework's pipeline context exposes enough fields. If a plugin's output isn't surfaced in the context, it can't be captured. That's a framework-level decision — not a change to any individual plugin.

Events are batched in-memory and flushed on a 5-second interval or when the batch hits 50 events. Fire-and-forget, never blocks the user's request.

---

## 🖥️ Dashboard Pages

```
/                          Overview — upload volume (7d/30d chart), storage used,
                           recent activity feed, quick stats cards

/files                     File browser — searchable table, filter by type/date/status,
                           SHA256 shown, duplicate badge, download link

/security                  Plugin results that indicate file health — scan outcomes,
                           processing errors, flagged files

/analytics                 Upload trends, file type breakdown, error rates,
                           top upload sources

/settings/api-keys         Create/revoke API keys, last-used timestamps
/settings/project          Project name, slug, danger zone (delete)

/onboarding                Step-by-step: create project → copy API key →
                           install plugin → verify first event received
```

---

## 🔑 Auth Flow (Better Auth)

```
Sign Up → email + password → email verification
Sign In → session cookie (httpOnly)
Projects → one user can have multiple projects
API Keys → scoped to a project, stored as bcrypt hash (never shown again after creation)
```

---

## 🗓️ Phased Delivery

---

### 🏗️ Phase 1 — Foundation

_Repo setup · Auth · Ingest · File list_

#### 1.1 🏗️ Repo & Infrastructure Setup

- ✅ Create `better-media-dashboard` private repo — [https://github.com/AbenezerAtnafu/better-media-dashboard](https://github.com/AbenezerAtnafu/better-media-dashboard)
- ✅ Create `better-media-api` private repo — [https://github.com/AbenezerAtnafu/better-media-api](https://github.com/AbenezerAtnafu/better-media-api)
- ✅ Provision Neon Postgres database
- ✅ Provision Upstash Redis instance
- ✅ Configure Railway project for `better-media-api`
- ✅ Configure Vercel project for `better-media-dashboard`
- ⬜ Set up environment variables in Railway and Vercel

#### 1.2 🗄️ `better-media-api` — Database Schema

- ✅ Install Drizzle ORM + Drizzle Kit
- ✅ Define `bm_users` table
- ✅ Define `bm_projects` table
- ✅ Define `bm_project_members` table (roles: owner / admin / viewer)
- ✅ Define `bm_api_keys` table
- ✅ Define `bm_files` table
- ✅ Define `bm_file_events` table
- ✅ Define `bm_storage_snapshots` table
- ✅ Run initial migration against Neon

#### 1.3 🔑 `better-media-api` — Auth Endpoints

- ✅ Set up Better Auth
- ✅ `POST /auth/signup` — email + password, create user + owner project membership
- ✅ `POST /auth/signin` — return session token
- ✅ `POST /auth/signout`
- ⬜ Email verification flow (via Resend/Postmark)
- ✅ GitHub OAuth — social sign in / sign up
- ⬜ Google OAuth — social sign in / sign up (credentials pending)

#### 1.4 📂 `better-media-api` — Project & API Key Endpoints

- ✅ `POST /v1/projects` — create project
- ✅ `GET /v1/projects` — list user's projects
- ✅ `POST /v1/projects/:id/members` — invite team member
- ✅ `POST /v1/projects/:id/api-keys` — generate key (return plaintext once, store hash)
- ✅ `GET /v1/projects/:id/api-keys` — list keys (name + last_used_at, never plaintext)
- ✅ `DELETE /v1/projects/:id/api-keys/:keyId` — revoke key

#### 1.5 📥 `better-media-api` — Ingest Endpoint

- ✅ `POST /v1/ingest` — validate API key, parse event batch, enqueue to BullMQ
- ✅ Return 202 immediately, reject malformed payloads with 400

#### 1.6 ⚡ `better-media-api` — Workers

- ✅ Set up BullMQ with Upstash Redis
- ⬜ `metadata-worker` — normalise ingest events, upsert into `bm_files`
- ⬜ `dedup-worker` — SHA-256 lookup on `file.uploaded`, set `duplicate_of_id` if match found
- ⬜ `webhook-worker` — fire outbound POST to project's configured webhook URL

#### 1.7 📖 `better-media-api` — Dashboard Read Endpoints

- ⬜ `GET /v1/projects/:id/files` — paginated file list with filters
- ⬜ `GET /v1/projects/:id/overview` — total files, total bytes, recent events

#### 1.8 ☁️ `@better-media/plugin-cloud` — Cloud Plugin

- ⬜ Scaffold `packages/plugins/cloud-plugin/` in the public repo
- ⬜ Implement in-memory event buffer
- ⬜ Implement flush logic (50 events or 5s interval)
- ⬜ SIGTERM handler — synchronous flush before exit
- ⬜ Retry logic — exponential backoff, 3 attempts, silent drop
- ⬜ Hook into framework pipeline context: upload, validation, processing, streaming, deletion stages
- ⬜ Export `cloudReporter({ apiKey })` as the public API
- ⬜ Publish to npm as `@better-media/plugin-cloud`

#### 1.9 🔑 `better-media-dashboard` — Auth UI

- ✅ Sign up page
- ✅ Sign in page
- ✅ Email verification page
- ✅ Auth middleware — redirect unauthenticated users

#### 1.10 🖥️ `better-media-dashboard` — Core UI

- ✅ Project creation flow
- ✅ Project switcher (sidebar)
- ✅ Team members page — invite, list, remove
- ✅ API keys page — generate, list, revoke
- ✅ Onboarding page — step-by-step: create project → copy key → install plugin → verify first event
- ✅ Overview page — total files card, storage used card, recent events feed
- ✅ Files page — empty state UI (searchable table + filters pending 1.7 backend endpoints)

---

### 🔍 Phase 2 — Insights + Deduplication

_Storage stats · Plugin result views · Duplicate detection_

#### 2.1 💾 `better-media-api` — Storage Snapshots

- ⬜ `snapshot-worker` — daily BullMQ scheduled job, aggregates total files + bytes per project into `bm_storage_snapshots`
- ⬜ `GET /v1/projects/:id/storage` — return snapshot history

#### 2.2 🔌 `better-media-api` — Plugin Result Endpoints

- ⬜ `GET /v1/projects/:id/events` — filterable event log (by event type, plugin, date)
- ⬜ `GET /v1/projects/:id/files/:fileId/events` — full event timeline for a single file

#### 2.3 📊 `better-media-dashboard` — Insights UI

- ⬜ Storage stats page — bytes over time chart, breakdown by storage provider
- ⬜ File detail drawer — full event timeline per file (validation → processing → streaming → scan)
- ⬜ Duplicate files view — grouped list of files sharing the same SHA-256
- ⬜ Plugin results page — filterable event log, failed events highlighted

---

### 📊 Phase 3 — Analytics + Ops

_Charts · Alerts · Webhooks_

#### 3.1 📈 `better-media-api` — Analytics Endpoints

- ⬜ `GET /v1/projects/:id/analytics` — upload volume over time, file type breakdown, error rate, processing duration percentiles

#### 3.2 🔔 `better-media-api` — Alerts + Webhooks

- ⬜ Webhook config endpoints — `POST/GET/DELETE /v1/projects/:id/webhooks`
- ⬜ `webhook-worker` — sign payload with HMAC, deliver to configured URL, retry on failure
- ⬜ Email alert on plugin failure — triggered from `file.processing.failed` event
- ⬜ Email alert on threshold breach — configurable (e.g. storage > X GB)

#### 3.3 📊 `better-media-dashboard` — Analytics UI

- ⬜ Analytics page — upload volume chart (7d / 30d / 90d), file type pie, error rate over time, p50/p95 processing duration
- ⬜ Webhooks settings page — add/remove webhook URLs, delivery log
- ⬜ Alert settings page — configure thresholds, toggle email alerts

---

## ♻️ What This Reuses From the Existing Codebase

| Existing thing                      | How it's reused                                                        |
| ----------------------------------- | ---------------------------------------------------------------------- |
| `@better-media/adapter-db-drizzle`  | `better-media-api` uses this for all DB access                         |
| `@better-media/adapter-jobs-bullmq` | All background workers in `better-media-api`                           |
| Plugin hook system                  | `@better-media/plugin-cloud` hooks into it to capture lifecycle events |
| `platform/` Tailwind config         | Shared design tokens for consistent UI                                 |

---

## ✅ Decisions

- **Multi-tenancy** — one account supports multiple team members per project. DB schema has `bm_project_members` (member_id, project_id, role) and the API enforces per-project access control.
- **Dashboard hosting** — Vercel
- **Database** — Neon (managed Postgres, free tier, native Vercel integration)
- **API hosting** — Railway (free $5/month credit, supports persistent Node.js processes needed for BullMQ workers — Render and Vercel are not suitable as they spin down or are serverless-only)
- **Redis** — Upstash (free tier, supports Redis protocol so BullMQ works, pairs well with Railway)
