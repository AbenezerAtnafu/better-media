import { Storage } from "@google-cloud/storage";
import { Readable } from "node:stream";
import type {
  StorageAdapter,
  GetUrlOptions,
  PresignedUploadOptions,
  PresignedUploadResult,
  ListOptions,
  ListResult,
  StorageObject,
} from "@better-media/core";
import type { GCSStorageConfig } from "../interfaces/gcs-storage-config.interface";

const DEFAULT_EXPIRES_IN = 3600;
const DEFAULT_MAX_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB
const DEFAULT_MIN_SIZE_BYTES = 1;

export class GCSStorageAdapter implements StorageAdapter {
  private readonly storage: Storage;
  private readonly bucketResolver: (key: string) => string;
  private readonly basePrefix: string;

  constructor(config: GCSStorageConfig) {
    this.bucketResolver =
      typeof config.bucket === "function" ? config.bucket : () => config.bucket as string;
    this.basePrefix = config.basePrefix ? config.basePrefix.replace(/\/$/, "") + "/" : "";
    this.storage = new Storage({
      projectId: config.projectId,
      keyFilename: config.keyFilename,
      credentials: config.credentials,
    });
  }

  private bucket(key: string) {
    return this.storage.bucket(this.bucketResolver(key));
  }

  private fileKey(key: string): string {
    return this.basePrefix + key;
  }

  private stripPrefix(fullKey: string): string {
    return this.basePrefix ? fullKey.slice(this.basePrefix.length) : fullKey;
  }

  private isNotFound(err: unknown): boolean {
    if (!(err instanceof Error)) return false;
    const e = err as { code?: number | string };
    return e.code === 404 || e.code === "404";
  }

  async get(key: string): Promise<Buffer | null> {
    try {
      const [contents] = await this.bucket(key).file(this.fileKey(key)).download();
      return contents;
    } catch (err) {
      if (this.isNotFound(err)) return null;
      throw err;
    }
  }

  async put(key: string, value: Buffer): Promise<void> {
    await this.bucket(key).file(this.fileKey(key)).save(value);
  }

  async delete(key: string): Promise<void> {
    try {
      await this.bucket(key).file(this.fileKey(key)).delete();
    } catch (err) {
      if (this.isNotFound(err)) return;
      throw err;
    }
  }

  async exists(key: string): Promise<boolean> {
    const [found] = await this.bucket(key).file(this.fileKey(key)).exists();
    return found;
  }

  async getSize(key: string): Promise<number | null> {
    try {
      const [meta] = await this.bucket(key).file(this.fileKey(key)).getMetadata();
      const size = meta.size;
      if (size == null) return null;
      return typeof size === "string" ? parseInt(size, 10) : (size as number);
    } catch (err) {
      if (this.isNotFound(err)) return null;
      throw err;
    }
  }

  async getStream(key: string): Promise<ReadableStream<Uint8Array> | null> {
    const [found] = await this.bucket(key).file(this.fileKey(key)).exists();
    if (!found) return null;
    const nodeStream = this.bucket(key).file(this.fileKey(key)).createReadStream();
    return Readable.toWeb(nodeStream) as ReadableStream<Uint8Array>;
  }

  async getUrl(key: string, options?: GetUrlOptions): Promise<string> {
    const expiresIn = options?.expiresIn ?? DEFAULT_EXPIRES_IN;
    const expires = Date.now() + expiresIn * 1000;
    const [url] = await this.bucket(key).file(this.fileKey(key)).getSignedUrl({
      action: "read",
      expires,
    });
    return url;
  }

  async createPresignedUpload(
    key: string,
    options: PresignedUploadOptions
  ): Promise<PresignedUploadResult> {
    const {
      method = "PUT",
      contentType,
      expiresIn = DEFAULT_EXPIRES_IN,
      maxSizeBytes = DEFAULT_MAX_SIZE_BYTES,
      minSizeBytes = DEFAULT_MIN_SIZE_BYTES,
      metadata = {},
    } = options;

    const expires = Date.now() + expiresIn * 1000;
    const file = this.bucket(key).file(this.fileKey(key));
    const metaHeaders = Object.fromEntries(
      Object.entries(metadata).map(([k, v]) => [`x-goog-meta-${k}`, v])
    );

    if (method === "POST") {
      const [result] = await file.generateSignedPostPolicyV4({
        expires,
        conditions: [
          ["eq", "$Content-Type", contentType],
          ["content-length-range", minSizeBytes, maxSizeBytes],
          ...Object.entries(metadata).map(([k, v]) => ({ [`x-goog-meta-${k}`]: v })),
        ],
        fields: { "Content-Type": contentType, ...metaHeaders },
      });
      return { method: "POST", url: result.url, fields: result.fields };
    }

    // PUT — signs content type and extension headers into the URL
    const [url] = await file.getSignedUrl({
      version: "v4",
      action: "write",
      expires,
      contentType,
      extensionHeaders: metaHeaders,
    });

    return {
      method: "PUT",
      url,
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(maxSizeBytes),
        ...metaHeaders,
      },
    };
  }

  async deleteMany(keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    await Promise.all(keys.map((key) => this.delete(key)));
  }

  async copy(source: string, destination: string): Promise<void> {
    const destFile = this.bucket(destination).file(this.fileKey(destination));
    await this.bucket(source).file(this.fileKey(source)).copy(destFile);
  }

  async move(source: string, destination: string): Promise<void> {
    await this.copy(source, destination);
    await this.delete(source);
  }

  async list(prefix: string, options?: ListOptions): Promise<ListResult> {
    const fullPrefix = this.fileKey(prefix);
    const [files, nextQuery] = await this.bucket(prefix).getFiles({
      prefix: fullPrefix || undefined,
      maxResults: options?.limit,
      pageToken: options?.continuationToken,
    });

    const items: StorageObject[] = files.map((f) => {
      const size = f.metadata.size;
      return {
        key: this.stripPrefix(f.name),
        size: typeof size === "string" ? parseInt(size, 10) : ((size as number | undefined) ?? 0),
        lastModified: f.metadata.updated ? new Date(f.metadata.updated as string) : undefined,
        etag: f.metadata.etag as string | undefined,
        contentType: f.metadata.contentType as string | undefined,
      };
    });

    const token = (nextQuery as { pageToken?: string } | null)?.pageToken;
    return { items, nextToken: token };
  }

  async checkConnection(): Promise<boolean> {
    try {
      await this.bucket("").exists();
      return true;
    } catch {
      return false;
    }
  }
}
