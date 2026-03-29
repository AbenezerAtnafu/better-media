import fs from "node:fs/promises";
import { createWriteStream } from "node:fs";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import {
  type PipelineContext,
  type StorageAdapter,
  type DatabaseAdapter,
  TrustedMetadataSchema,
  type TrustedMetadata,
  markFileContentVerified,
} from "@better-media/core";

// const TRUSTED_DB_KEY_PREFIX = "better-media:trusted:";

export interface FileHandlingConfig {
  /** When set, files larger than this use streaming to temp file instead of loading into memory. */
  maxBufferBytes?: number;
}

export async function loadTrustedFromDb(
  database: DatabaseAdapter,
  recordId: string
): Promise<TrustedMetadata | null> {
  // Trusted metadata aligns with the central `media` model
  const record = await database.findOne({
    model: "media",
    where: [{ field: "id", value: recordId }],
  });

  if (!record || typeof record !== "object") return null;

  // Reconstruct TrustedMetadata shape from media record
  const rawTrusted = {
    file: {
      mimeType: record.mimeType ?? undefined,
      size: record.size ?? undefined,
      originalName: record.filename ?? undefined,
    },
    checksums: {
      sha256: record.checksum ?? undefined,
    },
    media: {
      width: record.width ?? undefined,
      height: record.height ?? undefined,
      duration: record.duration ?? undefined,
    },
  };

  // Strict runtime schema validation via Zod
  const result = TrustedMetadataSchema.safeParse(rawTrusted);

  if (!result.success) {
    console.error(`[QUARANTINE] Invalid TrustedMetadata mapped from media record "${recordId}"!`);
    console.error(`[QUARANTINE] Reason: ${JSON.stringify(result.error.format())}`);
    console.error(`[QUARANTINE] Data: ${JSON.stringify(rawTrusted)}`);
    return null;
  }

  const validated = result.data;
  return validated.file || validated.checksums || validated.media ? validated : null;
}

export async function saveTrustedToDb(
  database: DatabaseAdapter,
  recordId: string,
  fileKey: string,
  trusted: TrustedMetadata,
  initialArgs?: {
    filename?: string;
    mimeType?: string;
    size?: number;
    context?: Record<string, unknown>;
  }
): Promise<void> {
  // We map the trusted metadata back to the central media table, falling back to initial args.
  const updatePayload: Record<string, unknown> = {};

  if (trusted.file?.mimeType !== undefined) updatePayload.mimeType = trusted.file.mimeType;
  else if (initialArgs?.mimeType !== undefined) updatePayload.mimeType = initialArgs.mimeType;

  if (trusted.file?.size !== undefined) updatePayload.size = trusted.file.size;
  else if (initialArgs?.size !== undefined) updatePayload.size = initialArgs.size;

  if (trusted.file?.originalName !== undefined) updatePayload.filename = trusted.file.originalName;
  else if (initialArgs?.filename !== undefined) updatePayload.filename = initialArgs.filename;

  if (trusted.checksums?.sha256 !== undefined) updatePayload.checksum = trusted.checksums.sha256;
  if (trusted.media?.width !== undefined) updatePayload.width = trusted.media.width;
  if (trusted.media?.height !== undefined) updatePayload.height = trusted.media.height;
  if (trusted.media?.duration !== undefined) updatePayload.duration = trusted.media.duration;

  if (initialArgs?.context !== undefined) updatePayload.context = initialArgs.context;

  // Perform a single-shot Upsert
  const existing = await database.findOne({
    model: "media",
    where: [{ field: "id", value: recordId }],
  });

  updatePayload.storageKey = fileKey;

  if (existing) {
    if (Object.keys(updatePayload).length > 0) {
      await database.update({
        model: "media",
        where: [{ field: "id", value: recordId }],
        update: updatePayload,
      });
    }
  } else {
    // Record does not exist, initialize it
    updatePayload.id = recordId;
    updatePayload.status = "PROCESSING"; // Default standard
    updatePayload.createdAt = new Date();
    await database.create({
      model: "media",
      data: updatePayload,
    });
  }
}

async function streamToTempFile(
  stream: ReadableStream<Uint8Array> | Readable | unknown,
  fileKey: string
): Promise<string> {
  const ext = path.extname(fileKey) || ".bin";
  const tmpPath = path.join(os.tmpdir(), `better-media-${randomUUID()}${ext}`);
  const nodeStream =
    stream instanceof Readable
      ? stream
      : Readable.fromWeb(stream as Parameters<typeof Readable.fromWeb>[0]);
  const writeStream = createWriteStream(tmpPath);
  await new Promise<void>((resolve, reject) => {
    nodeStream.pipe(writeStream);
    nodeStream.on("error", reject);
    writeStream.on("error", reject);
    writeStream.on("finish", resolve);
  });
  return tmpPath;
}

export async function loadFileIntoContext(
  context: PipelineContext,
  fileHandling: FileHandlingConfig
): Promise<void> {
  const { file, storage } = context;
  const fileKey = file.key;
  const maxBufferBytes = fileHandling.maxBufferBytes;

  const storageWithExtras = storage as StorageAdapter & {
    getSize?: (key: string) => Promise<number | null>;
    getStream?: (key: string) => Promise<ReadableStream | null>;
  };

  if (!context.utilities) context.utilities = {};

  const fileContent: NonNullable<PipelineContext["utilities"]>["fileContent"] = {};

  let useStream = false;
  if (
    maxBufferBytes != null &&
    typeof storageWithExtras.getSize === "function" &&
    typeof storageWithExtras.getStream === "function"
  ) {
    const size = await storageWithExtras.getSize(fileKey);
    if (size != null && size > maxBufferBytes) {
      useStream = true;
    }
  }

  if (useStream && typeof storageWithExtras.getStream === "function") {
    const stream = await storageWithExtras.getStream(fileKey);
    if (stream != null) {
      const tmpPath = await streamToTempFile(stream, fileKey);
      fileContent.tempPath = tmpPath;
    } else {
      const buffer = await storage.get(fileKey);
      if (buffer != null) fileContent.buffer = buffer;
    }
  } else {
    const buffer = await storage.get(fileKey);
    if (buffer != null) fileContent.buffer = buffer;
  }

  context.utilities!.fileContent = fileContent;

  if (fileContent.buffer != null || fileContent.tempPath != null) {
    markFileContentVerified(context);
  }
}

export async function getBufferFromContext(context: PipelineContext): Promise<Buffer | null> {
  const fileContent = context.utilities?.fileContent;
  if (!fileContent) return null;
  if (fileContent.buffer) {
    markFileContentVerified(context);
    return fileContent.buffer;
  }
  if (fileContent.tempPath) {
    markFileContentVerified(context);
    return fs.readFile(fileContent.tempPath);
  }
  return null;
}

export async function cleanupTempFile(context: PipelineContext): Promise<void> {
  const tmpPath = context.utilities?.fileContent?.tempPath;
  if (tmpPath) {
    await fs.unlink(tmpPath).catch(() => {});
    if (context.utilities?.fileContent) {
      context.utilities.fileContent.tempPath = undefined;
    }
  }
}
