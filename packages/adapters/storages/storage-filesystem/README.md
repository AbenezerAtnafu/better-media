# @better-media/adapter-storage-filesystem

Local filesystem storage adapter for the Better Media framework.

## Features

- **Local Storage**: Store files in a directory on your disk.
- **Node.js**: Uses `fs-extra` and Node.js built-in streams.
- **MIME Awareness**: Respects and stores MIME information as needed.

## Installation

```bash
pnpm add @better-media/adapter-storage-filesystem
```

## Usage

```ts
import { FileSystemStorageAdapter } from "@better-media/adapter-storage-filesystem";

const storage = new FileSystemStorageAdapter({
  baseDir: "./uploads",
  baseUrl: "http://localhost:3000/public",
});
```

For more, visit [better-media-platform.vercel.app/docs/adapters/storage-filesystem](https://better-media-platform.vercel.app/docs/adapters/storage-filesystem).
