import type { PipelineContext, MediaRuntime, PluginApi } from "@better-media/core";
import { audioStreamingPlugin } from "./index";
import { runAudioStreaming } from "./runtime/runner";
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
    file: { key: "uploads/test.mp3", mimeType: "audio/mpeg", extension: ".mp3" },
    storageLocation: { key: "uploads/test.mp3" },
    processing: {},
    metadata: {},
    trusted: {},
    storage: {
      get: jest.fn().mockResolvedValue(Buffer.from("fake-audio")),
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

describe("audioStreamingPlugin", () => {
  it("registers on process:run in background mode", () => {
    const plugin = audioStreamingPlugin();
    const { runtime } = createMockRuntime();
    plugin.apply!(runtime);
    expect(runtime.hooks["process:run"].tap).toHaveBeenCalledWith(
      "audio-streaming",
      expect.any(Function),
      { mode: "background" }
    );
  });

  it("respects executionMode sync override", () => {
    const plugin = audioStreamingPlugin({ executionMode: "sync" });
    const { runtime } = createMockRuntime();
    plugin.apply!(runtime);
    expect(runtime.hooks["process:run"].tap).toHaveBeenCalledWith(
      "audio-streaming",
      expect.any(Function),
      { mode: "sync" }
    );
  });

  it("has intensive: true", () => {
    expect(audioStreamingPlugin().intensive).toBe(true);
  });
});

describe("runAudioStreaming", () => {
  it("skips on reference-url mode", async () => {
    const api = baseApi();
    const ctx = baseContext({
      file: { key: "https://cdn.example.com/audio.mp3", mimeType: "audio/mpeg" },
      storageLocation: {
        key: "https://cdn.example.com/audio.mp3",
        url: "https://cdn.example.com/audio.mp3",
      },
    });
    await runAudioStreaming(ctx, api, {});
    expect(api.emitMetadata).toHaveBeenCalledWith({ skipped: "reference-url" });
    expect(api.emitProcessing).not.toHaveBeenCalled();
  });

  it("skips on disallowed MIME type", async () => {
    const api = baseApi();
    const ctx = baseContext({
      file: { key: "uploads/video.mp4", mimeType: "video/mp4" },
    });
    await runAudioStreaming(ctx, api, {});
    expect(api.emitMetadata).toHaveBeenCalledWith(
      expect.objectContaining({ skipped: "mime-not-allowed", mimeType: "video/mp4" })
    );
  });

  it("skips when master playlist already exists", async () => {
    const api = baseApi();
    const ctx = baseContext({
      storage: {
        get: jest.fn().mockResolvedValue(Buffer.from("data")),
        put: jest.fn(),
        delete: jest.fn(),
        exists: jest.fn().mockResolvedValue(true),
      } as unknown as PipelineContext["storage"],
    });
    await runAudioStreaming(ctx, api, { skipExistingDerivatives: true });
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
    await runAudioStreaming(ctx, api, {});
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
    await runAudioStreaming(ctx, api, {});
    expect(api.emitMetadata).toHaveBeenCalledWith({ skipped: "no-file-content" });
  });

  it("uses progressive format when configured", async () => {
    jest.spyOn(ffmpegMod, "transcodeProgressive").mockResolvedValueOnce({ duration: 180 });

    const uploadMod = await import("./runtime/upload");
    jest.spyOn(uploadMod, "uploadDirectory").mockResolvedValueOnce([]);

    const dbMock = {
      findMany: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockResolvedValue({}),
    };
    const api = baseApi();
    const ctx = baseContext({
      database: dbMock as unknown as PipelineContext["database"],
    });

    await runAudioStreaming(ctx, api, { formats: ["progressive"] });

    expect(ffmpegMod.transcodeProgressive).toHaveBeenCalled();
    expect(api.emitProcessing).toHaveBeenCalledWith(
      expect.objectContaining({
        "audio-streaming": expect.objectContaining({ formats: ["progressive"], duration: 180 }),
      })
    );

    jest.restoreAllMocks();
  });
});
