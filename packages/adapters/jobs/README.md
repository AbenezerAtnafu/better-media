# @better-media/adapter-jobs

Job adapters for background execution in the Better Media framework.

## Overview

Some media pipeline steps (e.g. video transcoding, large virus scans) should not block the main request thread. This package provides:

- **In-Memory Job Adapter**: Simple FIFO queue for development or small-scale apps.
- **Hook Integration**: Automatically enqueues tasks tagged with `execution: 'background'`.

## Usage

```ts
import { InMemoryJobAdapter } from "@better-media/adapter-jobs";

const jobs = new InMemoryJobAdapter({ concurrency: 2 });
```

Visit [better-media-platform.vercel.app/docs/adapters/jobs](https://better-media-platform.vercel.app/docs/adapters/jobs) for more.
