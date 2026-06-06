import { Queue, Worker } from "bullmq";
import { bullmqJobAdapter } from "./bullmq-job-adapter";
import { createBullMQWorker } from "./bullmq-worker";

jest.mock("bullmq");

const MockQueue = Queue as jest.MockedClass<typeof Queue>;
const MockWorker = Worker as jest.MockedClass<typeof Worker>;

describe("bullmqJobAdapter", () => {
  let mockQueueAdd: jest.Mock;
  let mockQueueClose: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockQueueAdd = jest.fn().mockResolvedValue({ id: "job-1" });
    mockQueueClose = jest.fn().mockResolvedValue(undefined);
    MockQueue.mockImplementation(
      () => ({ add: mockQueueAdd, close: mockQueueClose }) as unknown as Queue
    );
  });

  it("creates a Queue with the provided connection and queue name", () => {
    bullmqJobAdapter({ connection: { host: "redis-host", port: 6380 }, queueName: "custom-queue" });
    expect(MockQueue).toHaveBeenCalledWith("custom-queue", {
      connection: { host: "redis-host", port: 6380 },
      defaultJobOptions: undefined,
    });
  });

  it("defaults queueName to 'better-media:background'", () => {
    bullmqJobAdapter({ connection: { host: "localhost", port: 6379 } });
    expect(MockQueue).toHaveBeenCalledWith(
      "better-media:background",
      expect.objectContaining({ connection: { host: "localhost", port: 6379 } })
    );
  });

  it("enqueue() calls queue.add() with name and payload", async () => {
    const adapter = bullmqJobAdapter({ connection: { host: "localhost", port: 6379 } });
    await adapter.enqueue("better-media:background", { recordId: "abc", pluginName: "test" });
    expect(mockQueueAdd).toHaveBeenCalledWith(
      "better-media:background",
      { recordId: "abc", pluginName: "test" },
      undefined
    );
  });

  it("enqueue() passes defaultJobOptions to queue.add()", async () => {
    const defaultJobOptions = {
      attempts: 3,
      backoff: { type: "exponential" as const, delay: 1000 },
    };
    const adapter = bullmqJobAdapter({
      connection: { host: "localhost", port: 6379 },
      defaultJobOptions,
    });
    await adapter.enqueue("q", { foo: "bar" });
    expect(mockQueueAdd).toHaveBeenCalledWith("q", { foo: "bar" }, defaultJobOptions);
  });

  it("close() closes the underlying queue", async () => {
    const adapter = bullmqJobAdapter({ connection: { host: "localhost", port: 6379 } });
    await adapter.close();
    expect(mockQueueClose).toHaveBeenCalled();
  });

  it("satisfies JobAdapter interface (enqueue resolves without throwing)", async () => {
    const adapter = bullmqJobAdapter({ connection: { host: "localhost", port: 6379 } });
    await expect(adapter.enqueue("q", {})).resolves.toBeUndefined();
  });
});

describe("createBullMQWorker", () => {
  let mockWorkerOn: jest.Mock;
  let mockWorkerClose: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockWorkerOn = jest.fn().mockReturnThis();
    mockWorkerClose = jest.fn().mockResolvedValue(undefined);
    MockWorker.mockImplementation(
      () => ({ on: mockWorkerOn, close: mockWorkerClose }) as unknown as Worker
    );
  });

  it("creates a Worker with the correct queue name and concurrency", () => {
    const processor = jest.fn().mockResolvedValue(undefined);
    createBullMQWorker(processor, {
      connection: { host: "localhost", port: 6379 },
      queueName: "my-queue",
      concurrency: 3,
    });
    expect(MockWorker).toHaveBeenCalledWith(
      "my-queue",
      expect.any(Function),
      expect.objectContaining({
        connection: { host: "localhost", port: 6379 },
        concurrency: 3,
        autorun: true,
      })
    );
  });

  it("defaults queueName to 'better-media:background' and concurrency to 5", () => {
    createBullMQWorker(jest.fn(), { connection: { host: "localhost", port: 6379 } });
    expect(MockWorker).toHaveBeenCalledWith(
      "better-media:background",
      expect.any(Function),
      expect.objectContaining({ concurrency: 5, autorun: true })
    );
  });

  it("calls processor with job.data when a job is processed", async () => {
    const processor = jest.fn().mockResolvedValue(undefined);
    let capturedFn: ((job: { data: Record<string, unknown> }) => Promise<void>) | undefined;

    MockWorker.mockImplementation((_name, fn) => {
      capturedFn = fn as typeof capturedFn;
      return { on: mockWorkerOn, close: mockWorkerClose } as unknown as Worker;
    });

    createBullMQWorker(processor, { connection: { host: "localhost", port: 6379 } });

    await capturedFn!({ data: { recordId: "rec-1", pluginName: "validation" } });
    expect(processor).toHaveBeenCalledWith({ recordId: "rec-1", pluginName: "validation" });
  });

  it("registers completed, failed, and error event listeners", () => {
    createBullMQWorker(jest.fn(), { connection: { host: "localhost", port: 6379 } });
    expect(mockWorkerOn).toHaveBeenCalledWith("completed", expect.any(Function));
    expect(mockWorkerOn).toHaveBeenCalledWith("failed", expect.any(Function));
    expect(mockWorkerOn).toHaveBeenCalledWith("error", expect.any(Function));
  });

  it("returns the Worker instance so callers can call worker.close()", () => {
    const worker = createBullMQWorker(jest.fn(), { connection: { host: "localhost", port: 6379 } });
    expect(worker).toBeDefined();
    expect(typeof worker.close).toBe("function");
  });

  it("merges extra workerOptions without overriding connection/concurrency/autorun", () => {
    createBullMQWorker(jest.fn(), {
      connection: { host: "localhost", port: 6379 },
      concurrency: 2,
      workerOptions: { stalledInterval: 30000 },
    });
    expect(MockWorker).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Function),
      expect.objectContaining({
        stalledInterval: 30000,
        concurrency: 2,
        autorun: true,
      })
    );
  });
});
