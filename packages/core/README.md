# @better-media/core

Core interfaces and types for the Better Media framework.

## Overview

This package defines the contracts that all adapters and plugins must implement. It has **zero dependencies** and provides the type definitions for:

- **StorageAdapter**: Handles file read/write operations (S3, Filesystem, Memory).
- **DatabaseAdapter**: Handles metadata persistence and retrieval.
- **JobAdapter**: Handles background execution of pipeline tasks.
- **PipelinePlugin**: Defines hooks and logic for media processing, validation, etc.
- **PipelineContext**: The data structure passed through the pipeline.

## Usage

You typically only need this package if you are:

1. **Building a custom adapter**: Implement `StorageAdapter`, `DatabaseAdapter`, or `JobAdapter`.
2. **Building a custom plugin**: Implement the `PipelinePlugin` interface.
3. **Type-checking your configuration**: Import types for your `BetterMediaConfig`.

```ts
import type { StorageAdapter, PipelinePlugin } from "@better-media/core";

// Example: Minimal custom plugin
export const myPlugin: PipelinePlugin = {
  name: "my-plugin",
  hooks: {
    afterUpload: async (context) => {
      console.log("File uploaded:", context.file.key);
    },
  },
};
```

## Documentation

For full documentation, visit [better-media-platform.vercel.app](https://better-media-platform.vercel.app/docs/core).
