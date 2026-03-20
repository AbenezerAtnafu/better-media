import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { Readable } from "node:stream";
import type { StorageAdapter, GetUrlOptions, PresignedPutUrlOptions } from "@better-media/core";
import type { S3StorageConfig } from "../interfaces/s3-storage-config.interface";

/**
 * S3 storage adapter for production deployments.
 * Supports AWS S3 and S3-compatible object storage (MinIO, etc.).
 */
export class S3StorageAdapter implements StorageAdapter {
  private readonly client: S3Client;
  private readonly bucketResolver: (key: string) => string;

  constructor(config: S3StorageConfig) {
    this.bucketResolver =
      typeof config.bucket === "function" ? config.bucket : () => config.bucket as string;
    this.client = new S3Client({
      region: config.region,
      credentials: {
        accessKeyId: config.accessKeyId,
        secretAccessKey: config.secretAccessKey,
      },
      ...(config.endpoint && {
        endpoint: config.endpoint,
        forcePathStyle: config.forcePathStyle ?? true,
      }),
    });
  }

  private isNotFoundError(err: unknown): boolean {
    if (!(err instanceof Error)) return false;
    const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
    return e.name === "NoSuchKey" || e.name === "NotFound" || e.$metadata?.httpStatusCode === 404;
  }

  private getBucket(key: string): string {
    return this.bucketResolver(key);
  }

  async get(key: string): Promise<Buffer | null> {
    try {
      const response = await this.client.send(
        new GetObjectCommand({ Bucket: this.getBucket(key), Key: key })
      );
      const body = response.Body;
      if (body == null) return null;
      const chunks: Uint8Array[] = [];
      for await (const chunk of body as AsyncIterable<Uint8Array>) {
        chunks.push(chunk);
      }
      return Buffer.concat(chunks);
    } catch (err) {
      if (this.isNotFoundError(err)) return null;
      throw err;
    }
  }

  async put(key: string, value: Buffer): Promise<void> {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.getBucket(key),
        Key: key,
        Body: value,
      })
    );
  }

  async delete(key: string): Promise<void> {
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.getBucket(key), Key: key }));
    } catch (err) {
      if (this.isNotFoundError(err)) return;
      throw err;
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.getBucket(key), Key: key }));
      return true;
    } catch (err) {
      if (this.isNotFoundError(err)) return false;
      throw err;
    }
  }

  async getSize(key: string): Promise<number | null> {
    try {
      const response = await this.client.send(
        new HeadObjectCommand({ Bucket: this.getBucket(key), Key: key })
      );
      const size = response.ContentLength;
      return size != null ? size : null;
    } catch (err) {
      if (this.isNotFoundError(err)) return null;
      throw err;
    }
  }

  async getStream(key: string): Promise<ReadableStream<Uint8Array> | null> {
    try {
      const response = await this.client.send(
        new GetObjectCommand({ Bucket: this.getBucket(key), Key: key })
      );
      const body = response.Body;
      if (body == null) return null;
      if (body instanceof Readable) {
        return Readable.toWeb(body) as ReadableStream<Uint8Array>;
      }
      if (body instanceof ReadableStream) {
        return body as ReadableStream<Uint8Array>;
      }
      if (typeof (body as Blob).stream === "function") {
        return (body as Blob).stream() as ReadableStream<Uint8Array>;
      }
      return null;
    } catch (err) {
      if (this.isNotFoundError(err)) return null;
      throw err;
    }
  }

  async getUrl(key: string, options?: GetUrlOptions): Promise<string> {
    const expiresIn = options?.expiresIn ?? 3600;
    const command = new GetObjectCommand({ Bucket: this.getBucket(key), Key: key });
    return getSignedUrl(this.client, command, { expiresIn });
  }

  async createPresignedPutUrl(key: string, options?: PresignedPutUrlOptions): Promise<string> {
    const expiresIn = options?.expiresIn ?? 3600;
    const command = new PutObjectCommand({
      Bucket: this.getBucket(key),
      Key: key,
      ContentType: options?.contentType,
    });
    return getSignedUrl(this.client, command, { expiresIn });
  }
}
