import fs from "node:fs/promises";
import { createReadStream } from "node:fs";
import path from "node:path";
import { Readable } from "node:stream";
import type { StorageAdapter } from "@better-media/core";

export interface FilesystemStorageConfig {
  /** Base directory where all files are stored. Keys are resolved relative to this path. */
  baseDir: string;
}

/**
 * Resolve a storage key to a safe filesystem path inside baseDir.
 * Prevents directory traversal (e.g. "../../etc/passwd").
 */
function resolveSafePath(baseDir: string, key: string): string {
  const base = path.resolve(baseDir);
  const resolved = path.resolve(base, key);
  const relative = path.relative(base, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Storage key resolves outside base directory: ${key}`);
  }
  return resolved;
}

/**
 * Filesystem storage adapter for development or single-node deployments.
 * Stores files on disk under a configurable base directory.
 *
 * Works well with Multer in Express/NestJS - Multer saves to disk, then you
 * can read the file and put it into this storage using the desired key.
 */
export class FileSystemStorageAdapter implements StorageAdapter {
  private readonly baseDir: string;

  constructor(config: FilesystemStorageConfig) {
    this.baseDir = path.resolve(config.baseDir);
  }

  async get(key: string): Promise<Buffer | null> {
    const filePath = resolveSafePath(this.baseDir, key);
    try {
      return await fs.readFile(filePath);
    } catch (err) {
      if (isNotFoundError(err)) return null;
      throw err;
    }
  }

  async put(key: string, value: Buffer): Promise<void> {
    const filePath = resolveSafePath(this.baseDir, key);
    const dir = path.dirname(filePath);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(filePath, value);
  }

  async delete(key: string): Promise<void> {
    const filePath = resolveSafePath(this.baseDir, key);
    try {
      await fs.unlink(filePath);
    } catch (err) {
      if (isNotFoundError(err)) return;
      throw err;
    }
  }

  async exists(key: string): Promise<boolean> {
    const filePath = resolveSafePath(this.baseDir, key);
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async getSize(key: string): Promise<number | null> {
    const filePath = resolveSafePath(this.baseDir, key);
    try {
      const stat = await fs.stat(filePath);
      return stat.isFile() ? stat.size : null;
    } catch {
      return null;
    }
  }

  async getStream(key: string): Promise<ReadableStream<Uint8Array> | null> {
    const filePath = resolveSafePath(this.baseDir, key);
    try {
      await fs.access(filePath);
    } catch {
      return null;
    }
    const nodeStream = createReadStream(filePath);
    return Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;
  }
}

function isNotFoundError(err: unknown): boolean {
  return err instanceof Error && (err as NodeJS.ErrnoException).code === "ENOENT";
}
