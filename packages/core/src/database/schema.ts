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
      checksum: { type: "string" },
      checksumMd5: { type: "string" },
      width: { type: "number" },
      height: { type: "number" },
      duration: { type: "number" },
      context: { type: "json" },
      status: { type: "string" },
      visibility: { type: "string" },
      createdAt: { type: "date" },
      updatedAt: { type: "date" },
      deletedAt: { type: "date" },
    },
    indexes: [{ fields: ["checksum", "storageKey"] }],
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
      storageKey: { type: "string" },
      checksum: { type: "string" },
      isOriginal: { type: "boolean" },
      type: { type: "string" }, // e.g., 'thumbnail', 'preview', 'compressed'
      versionNumber: { type: "number" },
      createdAt: { type: "date" },
    },
    indexes: [
      {
        fields: ["mediaId", "versionNumber"],
        unique: true,
      },
    ],
  },

  // Background job state for media processing
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
      type: { type: "string" }, // e.g., 'virus-scan', 'thumbnail'
      status: { type: "string" }, // e.g., 'pending', 'running', 'completed', 'failed'
      attempts: { type: "number" },
      maxAttempts: { type: "number" },
      idempotencyKey: { type: "string", unique: true },
      scheduledAt: { type: "date" },
      startedAt: { type: "date" },
      completedAt: { type: "date" },
      error: { type: "string" },
      createdAt: { type: "date" },
    },
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
      createdAt: { type: "date" },
    },
  },

  media_virus_scan_results: {
    fields: {
      id: { type: "string", primaryKey: true, required: true },
      mediaId: {
        type: "string",
        references: { model: "media", field: "id", onDelete: "cascade" },
      },
      status: { type: "string" }, // 'clean', 'infected', 'error'
      threats: { type: "json" }, // List of detected threats
      scanner: { type: "string" }, // clamd, etc.
      createdAt: { type: "date" },
    },
  },
};
