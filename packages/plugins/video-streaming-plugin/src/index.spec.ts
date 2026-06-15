import type { PipelineContext, MediaRuntime, PluginApi } from "@better-media/core";
import { videoStreamingPlugin } from "./index";
import { runVideoStreaming } from "./runtime/runner";
import * as ffmpegMod from "./runtime/ffmpeg";

type TapFn = (ctx: PipelineContext, api: PluginApi) => Promise<void>;

function createMockRuntime(): { runtime: MediaRuntime; getTapFn: () => TapFn } {
  let captured: TapFn | null = null;
  const runtime: MediaRuntime = {
    hooks: {
      "upload:init": { tap: jest.fn() },
      "validation:run": { tap: jest.fn() },
      "scan:run": { tap: jest.fn() },
      "process:run": {
        tap: jest.fn((_name: string, fn: TapFn) => {
          captured = fn;
        }),
      },
      "upload:complete": { tap: jest.fn() },
    },
  };
  return {
    runtime,
    getTapFn: () => {
      if (!captured) throw new Error("tap was not called");
      return captured;
    },
  };
}

function baseApi(): PluginApi {
  return {
    emitMetadata: jest.fn(),
    emitProcessing: jest.fn(),
    proposeTrusted: jest.fn(),
  };
}

function baseContext(overrides: Partial<PipelineContext> = {}): PipelineContext {
  return {
    recordId: "test-record-id",
    file: { key: "uploads/test.mp4", mimeType: "video/mp4", extension: ".mp4" },
    storageLocation: { key: "uploads/test.mp4" },
    processing: {},
    metadata: {},
    trusted: {},
    storage: {
      get: jest.fn().mockResolvedValue(Buffer.from("fake-video")),
      put: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn(),
      exists: jest.fn().mockResolvedValue(false),
    } as unknown as PipelineContext["storage"],
    database: {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({}),
    } as unknown as PipelineContext["database"],
    jobs: { enqueue: jest.fn() } as unknown as PipelineContext["jobs"],
    ...overrides,
  };
}

describe("videoStreamingPlugin", () => {
  it("registers on process:run in background mode", () => {
    const plugin = videoStreamingPlugin();
    const { runtime } = createMockRuntime();
    plugin.apply!(runtime);
    expect(runtime.hooks["process:run"].tap).toHaveBeenCalledWith(
      "video-streaming",
      expect.any(Function),
      { mode: "background" }
    );
  });

  it("respects executionMode sync override", () => {
    const plugin = videoStreamingPlugin({ executionMode: "sync" });
    const { runtime } = createMockRuntime();
    plugin.apply!(runtime);
    expect(runtime.hooks["process:run"].tap).toHaveBeenCalledWith(
      "video-streaming",
      expect.any(Function),
      { mode: "sync" }
    );
  });

  it("has intensive: true", () => {
    expect(videoStreamingPlugin().intensive).toBe(true);
  });
});

describe("runVideoStreaming", () => {
  it("skips on reference-url mode", async () => {
    const api = baseApi();
    const ctx = baseContext({
      file: { key: "https://cdn.example.com/video.mp4", mimeType: "video/mp4" },
      storageLocation: {
        key: "https://cdn.example.com/video.mp4",
        url: "https://cdn.example.com/video.mp4",
      },
    });
    await runVideoStreaming(ctx, api, {});
    expect(api.emitMetadata).toHaveBeenCalledWith({ skipped: "reference-url" });
    expect(api.emitProcessing).not.toHaveBeenCalled();
  });

  it("skips on disallowed MIME type", async () => {
    const api = baseApi();
    const ctx = baseContext({
      file: { key: "uploads/photo.jpg", mimeType: "image/jpeg" },
    });
    await runVideoStreaming(ctx, api, {});
    expect(api.emitMetadata).toHaveBeenCalledWith(
      expect.objectContaining({ skipped: "mime-not-allowed", mimeType: "image/jpeg" })
    );
  });

  it("skips when master playlist already exists", async () => {
    const api = baseApi();
    const storage = {
      get: jest.fn().mockResolvedValue(Buffer.from("data")),
      put: jest.fn(),
      delete: jest.fn(),
      exists: jest.fn().mockResolvedValue(true),
    } as unknown as PipelineContext["storage"];
    const ctx = baseContext({ storage });
    await runVideoStreaming(ctx, api, { skipExistingDerivatives: true });
    expect(api.emitMetadata).toHaveBeenCalledWith(
      expect.objectContaining({ skipped: "already-processed" })
    );
  });

  it("emits ffmpeg-not-found when fluent-ffmpeg is missing", async () => {
    jest
      .spyOn(ffmpegMod, "transcodeHLS")
      .mockRejectedValueOnce(new ffmpegMod.FfmpegNotFoundError());

    const api = baseApi();
    const ctx = baseContext();
    await runVideoStreaming(ctx, api, {});
    expect(api.emitMetadata).toHaveBeenCalledWith(
      expect.objectContaining({ error: "ffmpeg-not-found" })
    );
    expect(api.emitProcessing).not.toHaveBeenCalled();

    jest.restoreAllMocks();
  });

  it("skips when buffer is null", async () => {
    const api = baseApi();
    const ctx = baseContext({
      storage: {
        get: jest.fn().mockResolvedValue(null),
        put: jest.fn(),
        delete: jest.fn(),
        exists: jest.fn().mockResolvedValue(false),
      } as unknown as PipelineContext["storage"],
    });
    await runVideoStreaming(ctx, api, {});
    expect(api.emitMetadata).toHaveBeenCalledWith({ skipped: "no-file-content" });
  });
});
