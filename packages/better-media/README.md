# better-media

The core runtime orchestration engine for Better Media pipelines.

## Overview

Better Media is a modular media framework that handles the entire lifecycle of a file ingest—from intake and validation to transformation and multi-environment storage.

This package provides the `createBetterMedia` factory and the core execution logic to coordinate:

1.  **Ingest**: Handle binary, stream, or file-path inputs.
2.  **Validation**: Run plugins to check file size, MIME type, or integrity.
3.  **Persistence**: Save to SQL, NoSQL, or custom database adapters.
4.  **Storage**: Move files to local disk, S3, or in-memory targets.
5.  **Processing**: Run background or synchronous jobs (resizing, transpoding, etc).

## Installation

```bash
pnpm add better-media @better-media/core
```

## Basic Usage

```ts
import { createBetterMedia } from "better-media";
import { S3StorageAdapter } from "@better-media/adapter-storage-s3";
import { KyselyDatabaseAdapter } from "@better-media/adapter-db";
import { validationPlugin } from "@better-media/plugin-validation";

// 1. Configure the runtime
const media = createBetterMedia({
  storage: new S3StorageAdapter(s3Config),
  database: new KyselyDatabaseAdapter(dbConfig),
  plugins: [validationPlugin({ maxSize: "10mb", allowedMimeTypes: ["image/jpeg", "image/png"] })],
});

// 2. Process an upload
const result = await media.upload({
  file: myFileBuffer,
  fileName: "profile-pic.jpg",
});

console.log("Uploaded file key:", result.fileKey);
```

## Documentation

Full documentation is available at [better-media.dev](https://better-media.dev).
