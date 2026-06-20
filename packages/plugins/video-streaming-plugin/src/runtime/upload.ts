import path from "node:path";
import fs from "node:fs/promises";
import type { StorageAdapter } from "@better-media/core";

export interface UploadedFile {
  storageKey: string;
  size: number;
}

const STREAMING_CONTENT_TYPES: Record<string, string> = {
  ".m3u8": "application/x-mpegURL",
  ".ts": "video/MP2T",
  ".mpd": "application/dash+xml",
  ".m4s": "video/iso.segment",
  ".mp4": "video/mp4",
};

function inferContentType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  return STREAMING_CONTENT_TYPES[ext] ?? "application/octet-stream";
}

/**
 * Walk tempDir recursively and upload every file to storage under storagePrefix/.
 * Mirrors the local directory structure into storage keys.
 */
export async function uploadDirectory(
  storage: StorageAdapter,
  tempDir: string,
  storagePrefix: string,
  skipExisting: boolean
): Promise<UploadedFile[]> {
  const uploaded: UploadedFile[] = [];
  await walkAndUpload(storage, tempDir, tempDir, storagePrefix, skipExisting, uploaded);
  return uploaded;
}

async function walkAndUpload(
  storage: StorageAdapter,
  rootDir: string,
  currentDir: string,
  storagePrefix: string,
  skipExisting: boolean,
  acc: UploadedFile[]
): Promise<void> {
  const entries = await fs.readdir(currentDir, { withFileTypes: true });
  await Promise.all(
    entries.map(async (entry) => {
      const fullPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        await walkAndUpload(storage, rootDir, fullPath, storagePrefix, skipExisting, acc);
        return;
      }
      const relative = path.relative(rootDir, fullPath);
      const storageKey = `${storagePrefix}/${relative.split(path.sep).join("/")}`;

      if (skipExisting && (await storage.exists(storageKey))) {
        acc.push({ storageKey, size: 0 });
        return;
      }

      const buffer = await fs.readFile(fullPath);
      await storage.put(storageKey, buffer, { contentType: inferContentType(entry.name) });
      acc.push({ storageKey, size: buffer.length });
    })
  );
}
