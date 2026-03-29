import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import type { PresignedPostOptions } from "@aws-sdk/s3-presigned-post";
import { Readable } from "node:stream";
import type {
  StorageAdapter,
  GetUrlOptions,
  PresignedUploadOptions,
  PresignedUploadResult,
} from "@better-media/core";
import type { S3StorageConfig } from "../interfaces/s3-storage-config.interface";

const DEFAULT_EXPIRES_IN = 3600; // 1 hour
const DEFAULT_MAX_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB
const DEFAULT_MIN_SIZE_BYTES = 1; // at least 1 byte

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
    const expiresIn = options?.expiresIn ?? DEFAULT_EXPIRES_IN;
    const command = new GetObjectCommand({
      Bucket: this.getBucket(key),
      Key: key,
    });
    return getSignedUrl(this.client, command, { expiresIn });
  }

  /**
   * Create a presigned upload for direct-to-storage upload.
   *
   * - **POST**: Uses an S3 Policy to strictly enforce `Content-Type` and
   *   `content-length-range` server-side. S3 rejects any upload violating these.
   *   Best for web/browser clients using multipart forms.
   *
   * - **PUT**: Signs `ContentType`, `ContentLength`, and metadata headers into the URL.
   *   S3 rejects any request that presents mismatched header values.
   *   Best for mobile/API clients doing direct binary body uploads.
   */
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

    const bucket = this.getBucket(key);
    // Build x-amz-meta-* header map for user metadata
    const metaHeaders: Record<string, string> = Object.fromEntries(
      Object.entries(metadata).map(([k, v]): [string, string] => [`x-amz-meta-${k}`, String(v)])
    );

    if (method === "POST") {
      return this._createPresignedPost({
        key,
        bucket,
        contentType,
        expiresIn,
        maxSizeBytes,
        minSizeBytes,
        metadata,
        metaHeaders,
      });
    }

    return this._createPresignedPut({
      key,
      bucket,
      contentType,
      expiresIn,
      maxSizeBytes,
      metadata,
      metaHeaders,
    });
  }

  private async _createPresignedPost(params: {
    key: string;
    bucket: string;
    contentType: string;
    expiresIn: number;
    maxSizeBytes: number;
    minSizeBytes: number;
    metadata: Record<string, string>;
    metaHeaders: Record<string, string>;
  }): Promise<PresignedUploadResult> {
    const {
      key,
      bucket,
      contentType,
      expiresIn,
      maxSizeBytes,
      minSizeBytes,
      metadata,
      metaHeaders,
    } = params;

    // Build the conditions array using the SDK's element type
    const conditions: NonNullable<PresignedPostOptions["Conditions"]> = [
      // Enforce exact Content-Type — S3 rejects mismatches
      { "Content-Type": contentType },
      // Enforce file size range — S3 rejects files outside [min, max]
      ["content-length-range", minSizeBytes, maxSizeBytes],
      // Enforce each metadata k/v — S3 rejects if any value differs
      ...Object.entries(metadata).map(([k, v]) => ({
        [`x-amz-meta-${k}`]: v,
      })),
    ];

    const { url, fields } = await createPresignedPost(this.client, {
      Bucket: bucket,
      Key: key,
      Expires: expiresIn,
      Conditions: conditions,
      Fields: {
        "Content-Type": contentType,
        ...metaHeaders,
      },
    });

    return { method: "POST", url, fields };
  }

  private async _createPresignedPut(params: {
    key: string;
    bucket: string;
    contentType: string;
    expiresIn: number;
    maxSizeBytes: number;
    metadata: Record<string, string>;
    metaHeaders: Record<string, string>;
  }): Promise<PresignedUploadResult> {
    const { key, bucket, contentType, expiresIn, maxSizeBytes, metadata, metaHeaders } = params;

    // All fields set on PutObjectCommand are hashed into the signature.
    // S3 will return 403 for any request that presents different header values.
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
      // Encoding ContentLength ties the signature to an exact body size.
      // The client MUST send a Content-Length header that matches this value.
      ContentLength: maxSizeBytes,
      // User metadata is signed in — mismatches cause 403.
      Metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
    });

    const url = await getSignedUrl(this.client, command, { expiresIn });

    // Surface the required headers so callers know exactly what to send.
    const headers: Record<string, string> = {
      "Content-Type": contentType,
      "Content-Length": String(maxSizeBytes),
      ...metaHeaders,
    };

    return { method: "PUT", url, headers };
  }
}
