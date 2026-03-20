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
      storageKey: { type: "string", required: true },
      mimeType: { type: "string", required: true },
      size: { type: "number", required: true },
      status: { type: "string", required: true, defaultValue: "PENDING_VERIFICATION" },
      createdAt: { type: "date", required: true },
      updatedAt: { type: "date", required: true },
    },
  },

  // Extracted metadata per media record
  media_metadata: {
    fields: {
      id: { type: "string", primaryKey: true, required: true },
      mediaId: {
        type: "string",
        required: true,
        unique: true, // one-to-one relationship
        references: {
          model: "media",
          field: "id",
          onDelete: "cascade",
        },
      },
      data: { type: "json", required: true },
    },
  },

  // Background job state
  media_jobs: {
    fields: {
      id: { type: "string", primaryKey: true, required: true },
      mediaId: {
        type: "string",
        required: true,
        references: {
          model: "media",
          field: "id",
          onDelete: "cascade",
        },
      },
      type: { type: "string", required: true }, // e.g., 'virus-scan', 'thumbnail'
      status: { type: "string", required: true, defaultValue: "pending" }, // pending, running, completed, failed
      error: { type: "string" },
      createdAt: { type: "date", required: true },
      updatedAt: { type: "date", required: true },
    },
  },

  // Trusted metadata for files in transition (e.g. tracking checksums pre-verification)
  trusted_metadata: {
    fields: {
      id: { type: "string", primaryKey: true, required: true },
      file: { type: "json" },
      checksums: { type: "json" },
    },
  },
};
