# Better Media

Modular media pipeline framework for intake, validation, processing, and storage.

[**View Documentation**](docs/README.md)

## Architecture

**Core defines contracts. Adapters implement infrastructure. Framework orchestrates.**

| Layer         | Package(s)                                                                                                                                                                                                        | Responsibility                                                                                       |
| ------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| **Core**      | `@better-media/core`                                                                                                                                                                                              | Interfaces only (StorageAdapter, DatabaseAdapter, JobAdapter, PipelinePlugin). No implementations.   |
| **Adapters**  | `@better-media/adapter-storage-memory`, `@better-media/adapter-storage-filesystem`, `@better-media/adapter-storage-s3`, `@better-media/adapter-db`, `@better-media/mongodb-adapter`, `@better-media/adapter-jobs` | Implement core contracts (MemoryStorageAdapter, FileSystemStorageAdapter, S3StorageAdapter, etc).    |
| **Framework** | `better-media`                                                                                                                                                                                                    | Orchestrate: wire adapters + plugins, run lifecycle. No infrastructure contracts or implementations. |

## Monorepo Structure

```
packages/
├── core/              # @better-media/core - Contracts (interfaces, types)
├── better-media/      # better-media - Framework entry, lifecycle engine
├── plugins/
│   ├── validation-plugin/     # @better-media/plugin-validation
│   ├── virus-scan-plugin/     # @better-media/plugin-virus-scan
│   └── media-processing-plugin/  # @better-media/plugin-media-processing
└── adapters/
    ├── storage-memory/     # @better-media/adapter-storage-memory - In-memory (dev/test)
    ├── storage-filesystem/ # @better-media/adapter-storage-filesystem - Disk storage
    ├── storage-s3/         # @better-media/adapter-storage-s3 - S3 / MinIO
    ├── db/                 # @better-media/adapter-db - SQL/Kysely database implementations
    ├── mongodb-adapter/    # @better-media/mongodb-adapter - MongoDB implementation
    └── jobs/               # @better-media/adapter-jobs - Job queue
```

## Plugin System

Plugins run in either **synchronous** or **background** execution modes.

```
Plugin
 ├─ name
 ├─ hooks (extensible lifecycle hooks)
 └─ execution mode
      ├─ sync      – run inline during upload
      └─ background – enqueue via job adapter
```

## Job Adapter System

Background execution is powered by an optional job adapter. Default: in-memory.

- **sync** – Plugin runs inline during upload
- **background** – Plugin work is enqueued via job adapter (Redis, RabbitMQ, Kafka, etc.)

### Worker Integration

Use `media.runBackgroundJob(payload)` from your worker process. The payload is serializable:

```ts
interface BackgroundJobPayload {
  fileKey: string;
  metadata: Record<string, unknown>;
  hookName: HookName;
  pluginName: string;
}
```

**Example with Bull/BullMQ:**

```ts
const media = createBetterMedia({ storage, database, jobs: bullAdapter, plugins });
const worker = new Worker("better-media:background", async (job) => {
  await media.runBackgroundJob(job.data);
});
```

**Example with Inngest:**

```ts
inngest.createFunction(
  { id: "better-media-job" },
  { event: "better-media/background" },
  async ({ event }) => {
    await media.runBackgroundJob(event.data.payload);
  }
);
```

The framework does not implement polling or scheduling—adapters and your worker own that.

## Storage Adapters

Choose a storage implementation based on your environment:

| Adapter        | Package                                    | Use case                     |
| -------------- | ------------------------------------------ | ---------------------------- |
| **Memory**     | `@better-media/adapter-storage-memory`     | Development, tests           |
| **Filesystem** | `@better-media/adapter-storage-filesystem` | Single-node, local disk      |
| **S3**         | `@better-media/adapter-storage-s3`         | AWS S3, MinIO, S3-compatible |

**Filesystem** (works with Multer in Express/NestJS):

```ts
import { FileSystemStorageAdapter } from "@better-media/adapter-storage-filesystem";

const storage = new FileSystemStorageAdapter({ baseDir: "/var/uploads" });
```

**S3** (AWS or MinIO):

```ts
import { S3StorageAdapter } from "@better-media/adapter-storage-s3";

const storage = new S3StorageAdapter({
  region: "us-east-1",
  bucket: "my-media-bucket",
  accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  // For MinIO:
  // endpoint: "http://localhost:9000",
  // forcePathStyle: true,
});
```

## Quick Start

```bash
pnpm install
pnpm build
```

## Scripts

| Command          | Description                       |
| ---------------- | --------------------------------- |
| `pnpm build`     | Build all packages                |
| `pnpm dev`       | Watch mode for all packages       |
| `pnpm typecheck` | Type-check all packages           |
| `pnpm lint`      | Lint all packages                 |
| `pnpm test`      | Run tests                         |
| `pnpm format`    | Format with Prettier              |
| `pnpm changeset` | Create a changeset for versioning |

## Adding a Plugin

1. Create `packages/plugins/<name>-plugin/` with `package.json`, `tsconfig.json`, `tsup.config.ts`
2. Implement the `PipelinePlugin` interface from `@better-media/core`
3. Add `@better-media/core` as a workspace dependency

## Adding an Adapter

1. Create `packages/adapters/<name>/` (or add to existing storage/db)
2. Implement the contract from `@better-media/core` (e.g. `StorageAdapter`, `DatabaseAdapter`)
3. Export the implementation; re-export the interface from core for convenience
4. Add to workspace in `pnpm-workspace.yaml` if using a new top-level adapter package
