# Better Media

Modular media pipeline framework for intake, validation, processing, and storage.

## Architecture

**Core defines contracts. Adapters implement infrastructure. Framework orchestrates.**

| Layer         | Package(s)                                                                                | Responsibility                                                                                           |
| ------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| **Core**      | `@better-media/core`                                                                      | Interfaces only (StorageAdapter, DatabaseAdapter, JobAdapter, PipelinePlugin). No implementations.       |
| **Adapters**  | `@better-media/adapter-storage`, `@better-media/adapter-db`, `@better-media/adapter-jobs` | Implement core contracts (memoryStorage, memoryDatabase, memoryJobAdapter, future Redis/RabbitMQ/Kafka). |
| **Framework** | `better-media`                                                                            | Orchestrate: wire adapters + plugins, run lifecycle. No infrastructure contracts or implementations.     |

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
    ├── storage/       # @better-media/adapter-storage - Storage implementations
    ├── db/            # @better-media/adapter-db - Database implementations
    └── jobs/          # @better-media/adapter-jobs - Job queue (in-memory default, Redis, RabbitMQ, Kafka)
```

## Plugin System

Plugins run in either **synchronous** or **background** execution modes.

```
Plugin
 ├─ name
 ├─ hooks (extensible lifecycle hooks)
 └─ execution mode
      ├─ sync      – run inline during processUpload
      └─ background – enqueue via job adapter
```

## Job Adapter System

Background execution is powered by an optional job adapter. Default: in-memory.

- **sync** – Plugin runs inline during `processUpload`
- **background** – Plugin work is enqueued via job adapter (Redis, RabbitMQ, Kafka, etc.)

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
