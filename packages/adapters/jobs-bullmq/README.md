# @better-media/adapter-jobs-bullmq

BullMQ (Redis) job adapter for Better Media background processing.

## Installation

```bash
pnpm add @better-media/adapter-jobs-bullmq bullmq
```

## Usage

### Application process — enqueue side

```ts
import { createBetterMedia } from "@better-media/framework";
import { bullmqJobAdapter } from "@better-media/adapter-jobs-bullmq";

const media = createBetterMedia({
  jobs: bullmqJobAdapter({
    connection: { host: "localhost", port: 6379 },
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 1000 },
    },
  }),
  // ...storage, database, plugins
});
```

### Worker process — consume side

Run this in a **separate process** alongside your app:

```ts
import { createBullMQWorker } from "@better-media/adapter-jobs-bullmq";
import type { BackgroundJobPayload } from "@better-media/framework";
import { media } from "./media.config";

const worker = createBullMQWorker(
  async (payload) => media.runBackgroundJob(payload as BackgroundJobPayload),
  {
    connection: { host: "localhost", port: 6379 },
    concurrency: 5,
  }
);

process.on("SIGTERM", async () => {
  await worker.close();
  process.exit(0);
});
```

### Graceful shutdown — app process

```ts
const jobs = bullmqJobAdapter({ connection: { host: "localhost", port: 6379 } });
const media = createBetterMedia({ jobs, ... });

process.on("SIGTERM", async () => {
  await jobs.close();
  process.exit(0);
});
```

## Monitoring

Use [Bull Board](https://github.com/felixmosh/bull-board) for a web UI dashboard:

```bash
pnpm add @bull-board/api @bull-board/express
```

```ts
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";
import { Queue } from "bullmq";

const monitorQueue = new Queue("better-media:background", { connection });
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath("/admin/queues");
createBullBoard({ queues: [new BullMQAdapter(monitorQueue)], serverAdapter });
app.use("/admin/queues", serverAdapter.getRouter());
```

## API

### `bullmqJobAdapter(options)`

| Option              | Type                | Default                     | Description                                       |
| ------------------- | ------------------- | --------------------------- | ------------------------------------------------- |
| `connection`        | `ConnectionOptions` | required                    | Redis connection (host/port object or URL string) |
| `queueName`         | `string`            | `"better-media:background"` | Queue name — must match the worker                |
| `defaultJobOptions` | `JobsOptions`       | `undefined`                 | BullMQ job options (attempts, backoff, etc.)      |

Returns `JobAdapter & { close(): Promise<void> }`.

### `createBullMQWorker(processor, options)`

| Option          | Type                | Default                     | Description                         |
| --------------- | ------------------- | --------------------------- | ----------------------------------- |
| `connection`    | `ConnectionOptions` | required                    | Redis connection                    |
| `queueName`     | `string`            | `"better-media:background"` | Queue name — must match the adapter |
| `concurrency`   | `number`            | `5`                         | Max concurrent jobs                 |
| `workerOptions` | `WorkerOptions`     | `undefined`                 | Extra BullMQ worker options         |

Returns the BullMQ `Worker` instance.
