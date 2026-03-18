import fs from "node:fs/promises";
import { createWriteStream } from "node:fs";
import path from "node:path";
import os from "node:os";
import { randomUUID } from "node:crypto";
import { Readable } from "node:stream";
import type {
  PipelineContext,
  StorageAdapter,
  DatabaseAdapter,
  TrustedMetadata,
} from "@better-media/core";

const TRUSTED_DB_KEY_PREFIX = "better-media:trusted:";

export interface FileHandlingConfig {
  /** When set, files larger than this use streaming to temp file instead of loading into memory. */
  maxBufferBytes?: number;
}

export async function loadTrustedFromDb(
  database: DatabaseAdapter,
  fileKey: string
): Promise<TrustedMetadata | null> {
  const key = `${TRUSTED_DB_KEY_PREFIX}${fileKey}`;
  const record = await database.get(key);
  if (record == null || typeof record !== "object") return null;
  const trusted = record as unknown as TrustedMetadata;
  return (trusted.file ?? trusted.checksums) ? trusted : null;
}

export async function saveTrustedToDb(
  database: DatabaseAdapter,
  fileKey: string,
  trusted: TrustedMetadata
): Promise<void> {
  const key = `${TRUSTED_DB_KEY_PREFIX}${fileKey}`;
  await database.put(key, trusted as unknown as Record<string, unknown>);
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
}

export async function getBufferFromContext(context: PipelineContext): Promise<Buffer | null> {
  const fileContent = context.utilities?.fileContent;
  if (!fileContent) return null;
  if (fileContent.buffer) return fileContent.buffer;
  if (fileContent.tempPath) {
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
