# @better-media/adapter-storage-s3

Amazon S3 and S3-compatible storage adapter for the Better Media framework.

## Features

- **S3 Support**: Works with AWS S3, Minio, DigitalOcean Spaces, Cloudflare R2, etc.
- **Presigned URLs**: Securely upload from or download to the browser without exposing credentials.
- **Streaming**: Supports high-performance streaming for large media files.

## Usage

```ts
import { S3StorageAdapter } from "@better-media/adapter-storage-s3";

const storage = new S3StorageAdapter({
  region: "us-east-1",
  bucket: "media-bucket",
  accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
});
```

See [better-media-platform.vercel.app/docs/adapters/storage-s3](https://better-media-platform.vercel.app/docs/adapters/storage-s3) for more details.
