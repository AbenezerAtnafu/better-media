# @better-media/adapter-storage-memory

In-memory storage adapter for the Better Media framework.

## Overview

A non-persistent storage adapter intended for testing, CI/CD, and rapid development. Stores all binary data as buffers in memory.

## Usage

```ts
import { In-MemoryStorageAdapter } from "@better-media/adapter-storage-memory";

const storage = new In-MemoryStorageAdapter();
```

Visit [better-media-platform.vercel.app/docs/adapters/storage-memory](https://better-media-platform.vercel.app/docs/adapters/storage-memory) for details.
