# Plugin Hook Contracts

This document defines the contract for each lifecycle hook in the Better Media pipeline. Plugins that tap into hooks can rely on these guarantees.

## Pipeline Order

Hooks run in a fixed sequence. The pipeline executes phases in order; if a validation phase returns an abort result, later phases are skipped.

| Phase | Hook Name         | Order            |
| ----- | ----------------- | ---------------- |
| 1     | `upload:init`     | First            |
| 2     | `validation:run`  | After init       |
| 3     | `scan:run`        | After validation |
| 4     | `process:run`     | After scan       |
| 5     | `upload:complete` | Last             |

## Context

All hooks receive the same `PipelineContext`:

| Field             | Type                      | Description                                            |
| ----------------- | ------------------------- | ------------------------------------------------------ |
| `file`            | `FileInfo`                | Core file info (key, size, mimeType, etc); **mutable** |
| `storageLocation` | `StorageLocation`         | Where file lives (key, bucket, etc); **mutable**       |
| `processing`      | `ProcessingResults`       | Thumbnails, variants, dimensions; **mutable**          |
| `metadata`        | `Record<string, unknown>` | Custom app/plugin data; **mutable**                    |
| `utilities`       | `Record<string, unknown>` | Plugin scratchpad (not persisted); **mutable**         |
| `storage`         | `StorageAdapter`          | Read/write file bytes; **read-only reference**         |
| `database`        | `DatabaseAdapter`         | Media records; **read-only reference**                 |
| `jobs`            | `JobAdapter`              | Enqueue background jobs; **read-only reference**       |

### Mutability Rules

| Mutable           | Immutable  |
| ----------------- | ---------- |
| `file`            | `storage`  |
| `storageLocation` | `database` |
| `processing`      | `jobs`     |
| `metadata`        |            |
| `utilities`       |            |

- **Mutable**: Add/update fields. Use namespaced keys in `processing` (e.g. `processing.thumbnails["my-plugin"]`) to avoid overwrites.
- **Immutable**: Do not reassign adapter references. Use `storage.read()`, `jobs.enqueue()`.

## Hook Reference

### `upload:init`

- **When**: First phase; runs before validation.
- **Context**: Full `PipelineContext`.
- **May mutate**: `file`, `storageLocation`, `processing`, `metadata`, `utilities`.
- **May abort**: No.
- **Mode**: sync-only.
- **Purpose**: Set up initial state, enrich metadata, prepare utilities for downstream plugins.

---

### `validation:run`

- **When**: Second phase; runs after `upload:init`.
- **Context**: Full `PipelineContext`.
- **May mutate**: `file`, `storageLocation`, `processing`, `metadata`, `utilities`.
- **May abort**: **Yes**. Return `{ valid: false, message?: string }` to abort the pipeline. Later phases are not executed.
- **Mode**: sync-only.
- **Purpose**: Validate file type, dimensions, size, or custom rules. Return `ValidationResult` to reject invalid uploads.

---

### `scan:run`

- **When**: Third phase; runs after validation.
- **Context**: Full `PipelineContext`.
- **May mutate**: `file`, `storageLocation`, `processing`, `metadata`, `utilities`.
- **May abort**: No.
- **Mode**: sync-only.
- **Purpose**: Virus/malware scanning, content analysis. Typically runs before file is persisted.

---

### `process:run`

- **When**: Fourth phase; runs after scan.
- **Context**: Full `PipelineContext`.
- **May mutate**: `file`, `storageLocation`, `processing`, `metadata`, `utilities`.
- **May abort**: No.
- **Mode**: sync-or-background.
- **Purpose**: Transcoding, resizing, thumbnails, format conversion. Can run in sync or background mode.

---

### `upload:complete`

- **When**: Fifth phase; last phase; runs after all processing.
- **Context**: Full `PipelineContext`.
- **May mutate**: `file`, `storageLocation`, `processing`, `metadata`, `utilities`.
- **May abort**: No.
- **Mode**: sync-or-background.
- **Purpose**: Finalization, notifications, database updates, cleanup. Runs only when pipeline completes without abort.

## Summary Table

| Hook              | Order | Context | Mutates                                                          | Can Abort | Mode               |
| ----------------- | ----- | ------- | ---------------------------------------------------------------- | --------- | ------------------ |
| `upload:init`     | 1     | Full    | `file`, `storageLocation`, `processing`, `metadata`, `utilities` | No        | sync-only          |
| `validation:run`  | 2     | Full    | `file`, `storageLocation`, `processing`, `metadata`, `utilities` | Yes       | sync-only          |
| `scan:run`        | 3     | Full    | `file`, `storageLocation`, `processing`, `metadata`, `utilities` | No        | sync-only          |
| `process:run`     | 4     | Full    | `file`, `storageLocation`, `processing`, `metadata`, `utilities` | No        | sync-or-background |
| `upload:complete` | 5     | Full    | `file`, `storageLocation`, `processing`, `metadata`, `utilities` | No        | sync-or-background |

## Execution Mode

Each hook has a **mode constraint** that determines whether plugins may choose sync, background, or neither:

| Constraint             | Allowed modes      | If plugin passes wrong mode         |
| ---------------------- | ------------------ | ----------------------------------- |
| **sync-only**          | sync only          | Override to sync, log warning       |
| **sync-or-background** | sync or background | Respect plugin choice               |
| **background-only**    | background only    | Override to background, log warning |

- **sync-only** (`upload:init`, `validation:run`, `scan:run`): Handlers always run inline. Pipeline must complete these before advancing. Validation must run sync to support abort.
- **sync-or-background** (`process:run`, `upload:complete`): Plugin may pass `mode: "sync"` or `mode: "background"`. Background handlers are enqueued via JobAdapter and run asynchronously.
- **background-only**: Reserved for future hooks (e.g. fire-and-forget notifications). Handlers always enqueued; passing sync is overridden with a warning.
