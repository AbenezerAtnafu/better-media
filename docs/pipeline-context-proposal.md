# Proposal: Structured Pipeline Context

> Replaces flat `metadata` with dedicated sections to avoid inconsistent naming, plugin overwrites, and unclear expectations.

## Problem

- **Inconsistent naming**: Plugins use `contentType`, `content_type`, `mimeType` interchangeably
- **Overwrites**: Plugins share the same `metadata` bag; `thumbnails` from one plugin overwrites another
- **No shared expectations**: Consumers cannot rely on a stable shape; everything is `unknown`

## Solution: Structured Sections

Introduce typed, dedicated objects for each concern. Plugins write to their section; overlap is explicit.

---

## Interface Definitions

### 1. FileInfo – Core file information

Populated by upload adapter / `upload:init`. Single source of truth for file properties.

```ts
export interface FileInfo {
  /** Logical key in storage (same as context.fileKey). Always present. */
  key: string;
  /** File size in bytes */
  size?: number;
  /** MIME type (e.g. "image/jpeg"). Use this instead of contentType/mimeType. */
  mimeType?: string;
  /** Original filename from upload (e.g. "photo.jpg") */
  originalName?: string;
  /** File extension (e.g. ".jpg"). Derived from key or originalName. */
  extension?: string;
  /** Checksum for validation (e.g. sha256). Key names are hashing algorithm. */
  checksums?: Record<string, string>;
}
```

**Mutability**: Plugins may add/update fields (e.g. `upload:init` sets `mimeType`, validation adds `checksums.sha256`). Do not change `key`.

---

### 2. StorageLocation – Where the file lives

Populated by upload adapter or `upload:init`. Adapter-specific fields are optional.

```ts
export interface StorageLocation {
  /** Logical key (same as fileInfo.key). Always present. */
  key: string;
  /** Bucket name (S3, GCS). Optional for memory/local adapters. */
  bucket?: string;
  /** Region (S3). Optional. */
  region?: string;
  /** Public or pre-signed URL. Optional; computed on demand by adapters. */
  url?: string;
}
```

**Mutability**: Typically set once. Plugins should not overwrite adapter-provided values.

---

### 3. ProcessingResults – Output from processing plugins

Populated by `process:run` handlers. Each plugin writes to a namespaced key to avoid overwrites.

```ts
/** A single thumbnail or derived image */
export interface ThumbnailResult {
  key: string;
  width?: number;
  height?: number;
  format?: string;
  url?: string;
}

/** A transcoded or converted variant */
export interface VariantResult {
  key: string;
  format?: string;
  width?: number;
  height?: number;
  bitrate?: number;
  url?: string;
}

/** Image/video dimensions. Set by validation or processing. */
export interface MediaDimensions {
  width: number;
  height: number;
  duration?: number; // seconds, for video
}

export interface ProcessingResults {
  /** Dimensions (from validation or processing) */
  dimensions?: MediaDimensions;
  /** Thumbnails. Plugins append; use plugin name as key if multiple sources. */
  thumbnails?: Record<string, ThumbnailResult[]>; // e.g. thumbnails["media-processing"] = [...]
  /** Variants (transcodes, conversions) */
  variants?: Record<string, VariantResult[]>;
  /** Plugin-specific results. Key by plugin name. */
  [pluginKey: string]: unknown;
}
```

**Mutability**: Processing plugins add to their namespace. Do not overwrite other plugins' keys.

---

### 4. Metadata – Custom app/plugin data

Remains extensible but separate from core file/processing data.

```ts
/**
 * Custom metadata from the application or plugins.
 * Use consistent keys; consider prefixing: metadata["my-plugin:customField"]
 */
export interface PipelineMetadata {
  [key: string]: unknown;
}
```

**Mutability**: Plugins may add/update. Prefer namespaced keys (e.g. `userId`, `tenantId`, `myPlugin:tags`).

---

### 5. Utilities – Plugin scratchpad (non-persisted)

Intermediate state, cache, or cross-plugin handoff. Not persisted to database.

```ts
/**
 * Plugin scratchpad. Not persisted. Namespace by plugin name.
 * e.g. utilities["validation-plugin"] = { bufferCache: ... }
 */
export interface PipelineUtilities {
  [key: string]: unknown;
}
```

**Mutability**: Any plugin may read/write. Ephemeral for the pipeline run only.

---

## Updated PipelineContext

```ts
import type { DatabaseAdapter } from "../../database/interfaces/adapter.interface";
import type { JobAdapter } from "../../job/interfaces/adapter.interface";
import type { StorageAdapter } from "../../storage/interfaces/adapter.interface";
import type { FileInfo } from "./file-info.interface";
import type { StorageLocation } from "./storage-location.interface";
import type { ProcessingResults } from "./processing-results.interface";

export interface PipelineContext {
  /** Core file information. Mutable. */
  file: FileInfo;

  /** Storage location. Mutable but typically set once. */
  storageLocation: StorageLocation;

  /** Processing outputs (thumbnails, variants, etc). Mutable. */
  processing: ProcessingResults;

  /** Custom app/plugin metadata. Mutable. */
  metadata: Record<string, unknown>;

  /** Plugin scratchpad. Not persisted. Mutable. */
  utilities: Record<string, unknown>;

  /** Storage adapter – read-only reference */
  storage: StorageAdapter;

  /** Database adapter – read-only reference */
  database: DatabaseAdapter;

  /** Job adapter – read-only reference */
  jobs: JobAdapter;
}
```

---

## Mutability Summary

| Section           | Mutable | Who populates            | Notes                                  |
| ----------------- | ------- | ------------------------ | -------------------------------------- |
| `file`            | Yes     | Upload, init, validation | Add/update fields; do not change `key` |
| `storageLocation` | Yes     | Upload, init             | Usually set once                       |
| `processing`      | Yes     | Processing plugins       | Namespace by plugin key                |
| `metadata`        | Yes     | App, any plugin          | Use prefixed keys for plugin-specific  |
| `utilities`       | Yes     | Any plugin               | Ephemeral; not persisted               |
| `storage`         | No      | Framework                | Read-only adapter reference            |
| `database`        | No      | Framework                | Read-only adapter reference            |
| `jobs`            | No      | Framework                | Read-only adapter reference            |

---

## Migration

1. Add new interfaces and fields to `PipelineContext`. Keep `fileKey` and `metadata` for backwards compatibility.
2. Pipeline executor: when creating context, map `fileKey` → `file.key` and `storageLocation.key`; initialize `file`, `storageLocation`, `processing`, `utilities`.
3. Update plugins to read from `context.file`, `context.processing` instead of `metadata` where applicable.
4. Document migration path in plugin-contracts.
5. In a future major version, deprecate `fileKey` in favor of `file.key`.

---

## Usage Examples

**Upload adapter (multer)** sets `file` and `storageLocation`:

```ts
context.file = {
  key: fileKey,
  size: req.file.size,
  mimeType: req.file.mimetype,
  originalName: req.file.originalname,
  extension: path.extname(req.file.originalname),
};
context.storageLocation = { key: fileKey, bucket: "my-bucket" };
```

**Validation plugin** reads `file.mimeType`, adds `file.checksums`:

```ts
const mime = context.file.mimeType; // No more contentType vs mimeType
context.file.checksums = { sha256: computedSha256 };
```

**Processing plugin** adds to `processing` under its name:

```ts
context.processing.thumbnails ??= {};
context.processing.thumbnails["media-processing"] = [
  { key: "thumb/small.jpg", width: 150, height: 150 },
];
```
