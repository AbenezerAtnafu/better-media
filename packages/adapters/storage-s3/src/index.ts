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

export interface S3StorageConfig {
  /** AWS region (e.g. "us-east-1") */
  region: string;
  /** S3 bucket name */
  bucket: string;
  /** AWS access key ID */
  accessKeyId: string;
  /** AWS secret access key */
  secretAccessKey: string;
  /**
   * Custom endpoint for S3-compatible storage (e.g. MinIO).
   * Omit for standard AWS S3.
   */
  endpoint?: string;
  /**
   * Use path-style bucket URLs (bucket.endpoint vs endpoint/bucket).
   * Required for MinIO and some S3-compatible services.
   */
  forcePathStyle?: boolean;
}

function createClient(config: S3StorageConfig): S3Client {
  return new S3Client({
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

function isNotFoundError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const e = err as { name?: string; $metadata?: { httpStatusCode?: number } };
  return e.name === "NoSuchKey" || e.name === "NotFound" || e.$metadata?.httpStatusCode === 404;
}

/**
 * S3 storage adapter for production deployments.
 * Supports AWS S3 and S3-compatible object storage (MinIO, etc.).
 */
export function s3Storage(config: S3StorageConfig): StorageAdapter {
  const client = createClient(config);
  const { bucket } = config;

  return {
    async get(key: string): Promise<Buffer | null> {
      try {
        const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
        const body = response.Body;
        if (body == null) return null;
        const chunks: Uint8Array[] = [];
        for await (const chunk of body as AsyncIterable<Uint8Array>) {
          chunks.push(chunk);
        }
        return Buffer.concat(chunks);
      } catch (err) {
        if (isNotFoundError(err)) return null;
        throw err;
      }
    },

    async put(key: string, value: Buffer): Promise<void> {
      await client.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: value,
        })
      );
    },

    async delete(key: string): Promise<void> {
      try {
        await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
      } catch (err) {
        if (isNotFoundError(err)) return;
        throw err;
      }
    },

    async exists(key: string): Promise<boolean> {
      try {
        await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
        return true;
      } catch (err) {
        if (isNotFoundError(err)) return false;
        throw err;
      }
    },

    async getSize(key: string): Promise<number | null> {
      try {
        const response = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
        const size = response.ContentLength;
        return size != null ? size : null;
      } catch (err) {
        if (isNotFoundError(err)) return null;
        throw err;
      }
    },

    async getStream(key: string): Promise<ReadableStream<Uint8Array> | null> {
      try {
        const response = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
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
        if (isNotFoundError(err)) return null;
        throw err;
      }
    },

    async getUrl(key: string, options?: GetUrlOptions): Promise<string> {
      const expiresIn = options?.expiresIn ?? 3600;
      const command = new GetObjectCommand({ Bucket: bucket, Key: key });
      return getSignedUrl(client, command, { expiresIn });
    },

    async createPresignedPutUrl(key: string, options?: PresignedPutUrlOptions): Promise<string> {
      const expiresIn = options?.expiresIn ?? 3600;
      const command = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        ContentType: options?.contentType,
      });
      return getSignedUrl(client, command, { expiresIn });
    },
  };
}
