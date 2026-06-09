import type { BmSchema } from "./types";

/**
 * Central schema defining all Better Media tables and relationships.
 * This is the single source of truth for the database structure.
 */
export const schema: BmSchema = {
  // Core media records
  media: {
    fields: {
      id: { type: "string", primaryKey: true, required: true },
      ownerId: { type: "string" },
      filename: { type: "string" },
      extension: { type: "string" },
      mimeType: { type: "string" },
      size: { type: "number" },
      storageProvider: { type: "string" },
      storageKey: { type: "string" },
      checksumSha256: { type: "string" },
      checksumMd5: { type: "string" },
      width: { type: "number" },
      height: { type: "number" },
      duration: { type: "number" },
      metadata: { type: "json" },
      status: { type: "string" }, // 'pending' | 'processing' | 'ready' | 'failed' | 'quarantined'
      visibility: { type: "string" }, // 'public' | 'private' | 'unlisted'
      createdAt: { type: "date" },
      updatedAt: { type: "date" },
      deletedAt: { type: "date" },
    },
    indexes: [{ fields: ["checksumSha256", "storageKey"] }],
  },

  // Different versions of the media (thumbnails, previews, etc.)
  media_versions: {
    fields: {
      id: { type: "string", primaryKey: true, required: true },
      mediaId: {
        type: "string",
        references: {
          model: "media",
          field: "id",
          onDelete: "cascade",
        },
      },
      storageProvider: { type: "string" },
      storageKey: { type: "string" },
      checksumSha256: { type: "string" },
      mimeType: { type: "string" },
      size: { type: "number" },
      width: { type: "number" },
      height: { type: "number" },
      isOriginal: { type: "boolean" },
      type: { type: "string" }, // 'thumbnail' | 'preview' | 'compressed' | 'original'
      versionNumber: { type: "number" },
      createdAt: { type: "date" },
      deletedAt: { type: "date" },
    },
    indexes: [{ fields: ["mediaId"] }, { fields: ["mediaId", "versionNumber"], unique: true }],
  },

  // Business record for media processing jobs — not a BullMQ state mirror.
  // Tracks idempotency, final outcome, and links jobs to media.
  // Runtime state (queue position, locks, backoff) lives in BullMQ/Redis.
  media_jobs: {
    fields: {
      id: { type: "string", primaryKey: true, required: true },
      mediaId: {
        type: "string",
        references: {
          model: "media",
          field: "id",
          onDelete: "cascade",
        },
      },
      type: { type: "string" }, // 'virus-scan' | 'thumbnail' | 'compress' | 'validate'
      status: { type: "string" }, // 'pending' | 'running' | 'completed' | 'failed'
      attempts: { type: "number" },
      maxAttempts: { type: "number" },
      idempotencyKey: { type: "string", unique: true },
      scheduledAt: { type: "date" },
      startedAt: { type: "date" },
      completedAt: { type: "date" },
      error: { type: "json" }, // { message, code, stack, retryable }
      result: { type: "json" },
      createdAt: { type: "date" },
      updatedAt: { type: "date" },
    },
    indexes: [{ fields: ["mediaId"] }],
  },

  media_validation_results: {
    fields: {
      id: { type: "string", primaryKey: true, required: true },
      mediaId: {
        type: "string",
        references: { model: "media", field: "id", onDelete: "cascade" },
      },
      valid: { type: "boolean" },
      pluginId: { type: "string" },
      errors: { type: "json" },
      warnings: { type: "json" },
      createdAt: { type: "date" },
    },
    indexes: [{ fields: ["mediaId"] }],
  },

  media_virus_scan_results: {
    fields: {
      id: { type: "string", primaryKey: true, required: true },
      mediaId: {
        type: "string",
        references: { model: "media", field: "id", onDelete: "cascade" },
      },
      status: { type: "string" }, // 'clean' | 'infected' | 'error'
      threats: { type: "json" },
      scanner: { type: "string" },
      metadata: { type: "json" },
      createdAt: { type: "date" },
    },
    indexes: [{ fields: ["mediaId"] }],
  },
};
