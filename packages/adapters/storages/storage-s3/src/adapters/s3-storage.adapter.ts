import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
  CopyObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand,
  PutBucketPolicyCommand,
  PutBucketCorsCommand,
  PutBucketLifecycleConfigurationCommand,
  PutPublicAccessBlockCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import type { PresignedPostOptions } from "@aws-sdk/s3-presigned-post";
import { Buffer } from "node:buffer";
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
import type { S3StorageConfig } from "../interfaces/s3-storage-config.interface";
import {
  S3Object,
  S3Multipart,
  S3MultipartPart,
  S3Presign,
  S3PresignPart,
  S3CreateMultiplePart,
  S3PutItem,
  S3Options,
  S3PutItemOptions,
  S3GetItemsOptions,
  S3DeleteDirOptions,
  S3PresignGetItemOptions,
  S3PresignPutItemOptions,
  S3PresignPutItemPartOptions,
  S3MoveItemOptions,
} from "../interfaces/s3.interface";

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
  private readonly region: string;
  private readonly endpoint?: string;
  private readonly forcePathStyle: boolean;

  constructor(config: S3StorageConfig) {
    this.region = config.region;
    this.endpoint = config.endpoint;
    this.forcePathStyle = config.forcePathStyle ?? (config.endpoint ? true : false);
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
        forcePathStyle: this.forcePathStyle,
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

  private getPublicUrl(bucket: string, key: string): string {
    if (this.endpoint) {
      if (this.forcePathStyle) {
        // Path style: endpoint/bucket/key
        const baseUrl = this.endpoint.endsWith("/") ? this.endpoint.slice(0, -1) : this.endpoint;
        return `${baseUrl}/${bucket}/${key}`;
      }
      // Virtual host style: bucket.endpoint/key
      try {
        const url = new URL(this.endpoint);
        return `${url.protocol}//${bucket}.${url.host}${url.pathname === "/" ? "" : url.pathname}/${key}`;
      } catch {
        // Fallback if endpoint is not a valid URL
        return `${this.endpoint}/${bucket}/${key}`;
      }
    }
    // Standard AWS URL - using standard regional format for reliability
    // Fallback to the original simple format if that's preferred,
    // but the regional one is more robust.
    return `https://${bucket}.s3.${this.region}.amazonaws.com/${key}`;
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

  async checkConnection(): Promise<boolean> {
    try {
      // Simplest way to check connection is to list buckets (requires permission)
      // or just check a bucket existence if we have one.
      const bucket = this.getBucket("");
      await this.client.send(
        new HeadObjectCommand({ Bucket: bucket, Key: "connection-check-non-existent" })
      );
      return true;
    } catch (err) {
      // If we get a 404, the connection itself is fine (we reached S3).
      if (this.isNotFoundError(err)) return true;
      // If we get a 403, we are connected but unauthorized, which counts as "connected" often,
      // but let's be strict and return false if we can't even reach it.
      return false;
    }
  }

  async checkBucket(_options?: S3Options): Promise<boolean> {
    try {
      const bucket = this.getBucket("");
      await this.client.send(new HeadObjectCommand({ Bucket: bucket, Key: "bucket-check" }));
      return true;
    } catch (err) {
      if (this.isNotFoundError(err)) return true;
      return false;
    }
  }

  async checkItem(key: string, _options?: S3Options): Promise<S3Object> {
    const bucket = this.getBucket(key);
    const response = await this.client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));

    const extension = key.split(".").pop() || "";
    return {
      bucket,
      key,
      mime: response.ContentType || "application/octet-stream",
      extension,
      size: response.ContentLength || 0,
      completedUrl: this.getPublicUrl(bucket, key),
    };
  }

  async getItem(key: string, _options?: S3Options): Promise<S3Object> {
    const bucket = this.getBucket(key);
    const response = await this.client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));

    const extension = key.split(".").pop() || "";
    return {
      bucket,
      key,
      mime: response.ContentType || "application/octet-stream",
      extension,
      size: response.ContentLength || 0,
      data: response.Body,
      completedUrl: this.getPublicUrl(bucket, key),
    };
  }

  async putItem(file: S3PutItem, _options?: S3PutItemOptions): Promise<S3Object> {
    const bucket = this.getBucket(file.key);
    await this.put(file.key, file.file);

    const extension = file.key.split(".").pop() || "";
    return {
      bucket,
      key: file.key,
      mime: "application/octet-stream", // Should ideally be determined from extension
      extension,
      size: file.file.length,
      completedUrl: this.getPublicUrl(bucket, file.key),
    };
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

  async list(prefix: string, options?: ListOptions): Promise<ListResult> {
    const bucket = this.getBucket(prefix || "");
    const response = await this.client.send(
      new ListObjectsV2Command({
        Bucket: bucket as string,
        Prefix: prefix || undefined,
        MaxKeys: options?.limit,
        ContinuationToken: options?.continuationToken,
      })
    );

    const items: StorageObject[] = (response.Contents || []).map((obj) => ({
      key: obj.Key || "",
      size: obj.Size || 0,
      lastModified: obj.LastModified,
      etag: obj.ETag,
    }));

    return {
      items,
      nextToken: response.NextContinuationToken,
    };
  }

  async getItems(path: string, options?: S3GetItemsOptions): Promise<S3Object[]> {
    const { items } = await this.list(path, { continuationToken: options?.continuationToken });
    const bucket = this.getBucket(path);
    return items.map((item: StorageObject) => ({
      bucket,
      key: item.key,
      mime: "application/octet-stream", // Fallback as HeadObject for each item is expensive
      extension: item.key.split(".").pop() || "",
      size: item.size,
      completedUrl: this.getPublicUrl(bucket, item.key),
    }));
  }

  async deleteMany(keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    const bucket = this.getBucket(keys[0]!);
    await this.client.send(
      new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: {
          Objects: keys.map((key) => ({ Key: key })),
        },
      })
    );
  }

  async deleteItems(keys: string[], _options?: S3Options): Promise<void> {
    return this.deleteMany(keys);
  }

  async deleteDir(path: string, options?: S3DeleteDirOptions): Promise<void> {
    let continuationToken: string | undefined = options?.continuationToken;
    do {
      const result: ListResult = await this.list(path, { continuationToken });
      const keys = result.items.map((i: StorageObject) => i.key);
      if (keys.length > 0) {
        await this.deleteMany(keys);
      }
      continuationToken = result.nextToken;
    } while (continuationToken);
  }

  async copy(source: string, destination: string): Promise<void> {
    const sourceBucket = this.getBucket(source);
    const destBucket = this.getBucket(destination);
    await this.client.send(
      new CopyObjectCommand({
        Bucket: destBucket,
        Key: destination,
        CopySource: `${sourceBucket}/${source}`,
      })
    );
  }

  async move(source: string, destination: string): Promise<void> {
    await this.copy(source, destination);
    await this.delete(source);
  }

  async moveItem(
    source: S3Object,
    destinationKey: string,
    _options?: S3MoveItemOptions
  ): Promise<S3Object> {
    await this.move(source.key, destinationKey);
    const destBucket = this.getBucket(destinationKey);
    return {
      ...source,
      bucket: destBucket,
      key: destinationKey,
      completedUrl: this.getPublicUrl(destBucket, destinationKey),
    };
  }

  async moveItems(
    sources: S3Object[],
    destinationPrefix: string,
    _options?: S3Options
  ): Promise<S3Object[]> {
    return Promise.all(
      sources.map((source) => {
        const destKey = `${destinationPrefix}/${source.key.split("/").pop()}`;
        return this.moveItem(source, destKey);
      })
    );
  }

  async createMultiPart(
    file: S3CreateMultiplePart,
    maxPartNumber: number,
    _options?: S3Options
  ): Promise<S3Multipart> {
    const bucket = this.getBucket(file.key);
    const response = await this.client.send(
      new CreateMultipartUploadCommand({
        Bucket: bucket,
        Key: file.key,
      })
    );

    return {
      bucket,
      key: file.key,
      uploadId: response.UploadId || "",
      lastPartNumber: 0,
      maxPartNumber,
      parts: [],
    };
  }

  async putItemMultiPart(
    multipart: S3Multipart,
    partNumber: number,
    file: Buffer,
    _options?: S3Options
  ): Promise<S3Multipart> {
    const response = await this.client.send(
      new UploadPartCommand({
        Bucket: multipart.bucket,
        Key: multipart.key,
        UploadId: multipart.uploadId,
        PartNumber: partNumber,
        Body: file,
      })
    );

    const newPart: S3MultipartPart = {
      size: file.length,
      eTag: response.ETag || "",
      partNumber,
    };

    return {
      ...multipart,
      lastPartNumber: partNumber,
      parts: [...multipart.parts, newPart],
    };
  }

  async completeMultipart(
    key: string,
    uploadId: string,
    parts: S3MultipartPart[],
    _options?: S3Options
  ): Promise<void> {
    const bucket = this.getBucket(key);
    await this.client.send(
      new CompleteMultipartUploadCommand({
        Bucket: bucket,
        Key: key,
        UploadId: uploadId,
        MultipartUpload: {
          Parts: parts.map((p) => ({
            ETag: p.eTag,
            PartNumber: p.partNumber,
          })),
        },
      })
    );
  }

  async abortMultipart(key: string, uploadId: string, _options?: S3Options): Promise<void> {
    const bucket = this.getBucket(key);
    await this.client.send(
      new AbortMultipartUploadCommand({
        Bucket: bucket,
        Key: key,
        UploadId: uploadId,
      })
    );
  }

  async getUrl(key: string, options?: GetUrlOptions): Promise<string> {
    const expiresIn = options?.expiresIn ?? DEFAULT_EXPIRES_IN;
    const command = new GetObjectCommand({
      Bucket: this.getBucket(key),
      Key: key,
    });
    return getSignedUrl(this.client, command, { expiresIn });
  }

  async presignGetItem(key: string, options?: S3PresignGetItemOptions): Promise<S3Presign> {
    const expiredIn = options?.expired ?? DEFAULT_EXPIRES_IN;
    const presignUrl = await this.getUrl(key, { expiresIn: expiredIn });
    const extension = key.split(".").pop() || "";
    return {
      key,
      mime: "application/octet-stream",
      extension,
      presignUrl,
      expiredIn,
    };
  }

  async presignPutItem(
    file: S3CreateMultiplePart,
    options?: S3PresignPutItemOptions
  ): Promise<S3Presign> {
    const expiredIn = options?.expired ?? DEFAULT_EXPIRES_IN;
    const bucket = this.getBucket(file.key);
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: file.key,
    });
    const presignUrl = await getSignedUrl(this.client, command, { expiresIn: expiredIn });
    const extension = file.key.split(".").pop() || "";

    return {
      key: file.key,
      mime: "application/octet-stream",
      extension,
      presignUrl,
      expiredIn,
    };
  }

  async presignPutItemPart(
    file: S3CreateMultiplePart & { uploadId: string; partNumber: number },
    options?: S3PresignPutItemPartOptions
  ): Promise<S3PresignPart> {
    const expiredIn = options?.expired ?? DEFAULT_EXPIRES_IN;
    const bucket = this.getBucket(file.key);
    const command = new UploadPartCommand({
      Bucket: bucket,
      Key: file.key,
      UploadId: file.uploadId,
      PartNumber: file.partNumber,
    });
    const presignUrl = await getSignedUrl(this.client, command, { expiresIn: expiredIn });
    const extension = file.key.split(".").pop() || "";

    return {
      key: file.key,
      mime: "application/octet-stream",
      extension,
      presignUrl,
      expiredIn,
      size: file.size || 0,
      partNumber: file.partNumber,
    };
  }

  async settingBucketPolicy(_options?: S3Options): Promise<void> {
    const bucket = this.getBucket("");
    // Example: allow public read (simplified)
    const policy = JSON.stringify({
      Version: "2012-10-17",
      Statement: [
        {
          Sid: "PublicRead",
          Effect: "Allow",
          Principal: "*",
          Action: ["s3:GetObject"],
          Resource: [`arn:aws:s3:::${bucket}/*`],
        },
      ],
    });
    await this.client.send(new PutBucketPolicyCommand({ Bucket: bucket, Policy: policy }));
  }

  async settingCorsConfiguration(_options?: S3Options): Promise<void> {
    const bucket = this.getBucket("");
    await this.client.send(
      new PutBucketCorsCommand({
        Bucket: bucket,
        CORSConfiguration: {
          CORSRules: [
            {
              AllowedOrigins: ["*"],
              AllowedMethods: ["GET", "PUT", "POST", "DELETE", "HEAD"],
              AllowedHeaders: ["*"],
              MaxAgeSeconds: 3000,
            },
          ],
        },
      })
    );
  }

  async settingBucketExpiredObjectLifecycle(_options: S3Options): Promise<void> {
    const bucket = this.getBucket("");
    await this.client.send(
      new PutBucketLifecycleConfigurationCommand({
        Bucket: bucket,
        LifecycleConfiguration: {
          Rules: [
            {
              ID: "ExpireOldObjects",
              Status: "Enabled",
              Prefix: "",
              Expiration: { Days: 30 },
            },
          ],
        },
      })
    );
  }

  async settingDisableAclConfiguration(_options?: S3Options): Promise<void> {
    // This is often part of Public Access Block or Bucket creation
    // S3 disables ACLs by default now with "Bucket owner enforced"
  }

  async settingBlockPublicAccessConfiguration(_options?: S3Options): Promise<void> {
    const bucket = this.getBucket("");
    await this.client.send(
      new PutPublicAccessBlockCommand({
        Bucket: bucket,
        PublicAccessBlockConfiguration: {
          BlockPublicAcls: true,
          IgnorePublicAcls: true,
          BlockPublicPolicy: true,
          RestrictPublicBuckets: true,
        },
      })
    );
  }

  mapPresign(file: S3CreateMultiplePart, _options?: S3Options): S3Object {
    const bucket = this.getBucket(file.key);
    const extension = file.key.split(".").pop() || "";
    return {
      bucket,
      key: file.key,
      mime: "application/octet-stream",
      extension,
      size: file.size || 0,
      completedUrl: this.getPublicUrl(bucket, file.key),
    };
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
