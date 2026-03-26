-- Better Media schema (postgres)

CREATE TABLE IF NOT EXISTS "media" (
  "id" text PRIMARY KEY NOT NULL,
  "ownerId" text,
  "filename" text,
  "mimeType" text,
  "size" integer,
  "storageProvider" text,
  "storageKey" text,
  "checksum" text,
  "width" integer,
  "height" integer,
  "duration" integer,
  "context" jsonb,
  "status" text,
  "visibility" text,
  "createdAt" timestamp,
  "updatedAt" timestamp,
  "deletedAt" timestamp
);

CREATE TABLE IF NOT EXISTS "media_versions" (
  "id" text PRIMARY KEY NOT NULL,
  "mediaId" text REFERENCES "media"("id") ON DELETE CASCADE,
  "storageKey" text,
  "checksum" text,
  "isOriginal" boolean,
  "type" text,
  "versionNumber" integer,
  "createdAt" timestamp
);

CREATE TABLE IF NOT EXISTS "media_jobs" (
  "id" text PRIMARY KEY NOT NULL,
  "mediaId" text REFERENCES "media"("id") ON DELETE CASCADE,
  "type" text,
  "status" text,
  "attempts" integer,
  "maxAttempts" integer,
  "idempotencyKey" text UNIQUE,
  "scheduledAt" timestamp,
  "startedAt" timestamp,
  "completedAt" timestamp,
  "error" text,
  "createdAt" timestamp
);

CREATE TABLE IF NOT EXISTS "validation_results" (
  "id" text PRIMARY KEY NOT NULL,
  "mediaId" text REFERENCES "media"("id") ON DELETE CASCADE,
  "valid" boolean,
  "pluginId" text,
  "errors" jsonb,
  "createdAt" timestamp
);

CREATE TABLE IF NOT EXISTS "virus_scan_results" (
  "id" text PRIMARY KEY NOT NULL,
  "mediaId" text REFERENCES "media"("id") ON DELETE CASCADE,
  "status" text,
  "threats" jsonb,
  "scanner" text,
  "createdAt" timestamp
);

CREATE INDEX IF NOT EXISTS "idx_media_checksum_storageKey" ON "media" ("checksum", "storageKey");

CREATE UNIQUE INDEX IF NOT EXISTS "idx_media_versions_mediaId_versionNumber" ON "media_versions" ("mediaId", "versionNumber");
