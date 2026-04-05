# @better-media/adapter-storage-s3

Amazon S3 and S3-compatible storage adapter for the Better Media framework.

## Features

- **S3 Support**: Works with AWS S3, MinIO, DigitalOcean Spaces, Cloudflare R2, etc.
- **Dynamic Buckets**: Supports function-based bucket resolution dynamically per file key.
- **Presigned URLs**: Securely upload from or download to the browser without exposing credentials using both PUT and POST policies.
- **Bulk & Directory Operations**: Native support for bulk deletions, moving, copying, and directory enumeration.
- **Multipart Uploads**: Deeply integrated support for chunked uploading sequences.
- **Bucket Lifecycle & CORS**: Configure S3 buckets programmatically via the adapter.

## Usage

```ts
import { S3StorageAdapter } from "@better-media/adapter-storage-s3";

// AWS S3 Example
const s3Storage = new S3StorageAdapter({
  region: "us-east-1",
  bucket: "media-bucket",
  accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
});

// MinIO / Custom Endpoint Example
const minioStorage = new S3StorageAdapter({
  region: "us-east-1",
  bucket: "local-bucket",
  accessKeyId: "minio-root-user",
  secretAccessKey: "minio-root-password",
  endpoint: "http://localhost:9000",
  forcePathStyle: true,
});
```

See [better-media-platform.vercel.app/docs/adapters/storage-s3](https://better-media-platform.vercel.app/docs/adapters/storage-s3) for more details.
