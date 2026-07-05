import type { PipelineContext, MediaRuntime, PluginApi } from "@better-media/core";
import { videoStreamingPlugin } from "./index";
import { runVideoStreaming } from "./runtime/runner";
import * as ffmpegMod from "./runtime/ffmpeg";
import * as uploadMod from "./runtime/upload";
import type { StreamingPreset, StreamingProgressEvent } from "./interfaces/options.interface";

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

  it("always runs in background mode", () => {
    const plugin = videoStreamingPlugin();
    const { runtime } = createMockRuntime();
    plugin.apply!(runtime);
    expect(runtime.hooks["process:run"].tap).toHaveBeenCalledWith(
      "video-streaming",
      expect.any(Function),
      { mode: "background" }
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

describe("runVideoStreaming — happy path and branch coverage", () => {
  let transcodeHLSSpy: jest.SpyInstance;
  let transcodeDASHSpy: jest.SpyInstance;
  let uploadDirSpy: jest.SpyInstance;

  beforeEach(() => {
    transcodeHLSSpy = jest
      .spyOn(ffmpegMod, "transcodeHLS")
      .mockResolvedValue({ duration: 95, files: [] });
    transcodeDASHSpy = jest
      .spyOn(ffmpegMod, "transcodeDASH")
      .mockResolvedValue({ duration: 95, files: [] });
    uploadDirSpy = jest.spyOn(uploadMod, "uploadDirectory").mockResolvedValue([]);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("calls emitProcessing with correct shape on HLS success", async () => {
    const api = baseApi();
    const ctx = baseContext();

    await runVideoStreaming(ctx, api, {});

    expect(api.emitProcessing).toHaveBeenCalledWith({
      variants: {
        streaming: [{ key: "streaming/test-record-id/hls/master.m3u8", format: "hls" }],
      },
      "video-streaming": {
        formats: ["hls"],
        presets: ["360p", "480p", "720p", "1080p"],
        duration: 95,
        segmentDuration: 6,
      },
    });
    expect(api.emitMetadata).not.toHaveBeenCalled();
  });

  it("inserts media_versions rows: 1 master + 1 per variant playlist for HLS", async () => {
    const api = baseApi();
    const ctx = baseContext();

    await runVideoStreaming(ctx, api, {});

    // default 4 presets → 1 master + 4 variant playlists
    expect(ctx.database.create).toHaveBeenCalledTimes(5);
    expect(ctx.database.create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "media_versions",
        data: expect.objectContaining({
          storageKey: "streaming/test-record-id/hls/master.m3u8",
          mimeType: "application/x-mpegURL",
          isOriginal: false,
          type: "compressed",
        }),
      })
    );
    expect(ctx.database.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          storageKey: "streaming/test-record-id/hls/360p/index.m3u8",
        }),
      })
    );
  });

  it("skips DB inserts when persistMediaVersions is false", async () => {
    const api = baseApi();
    const ctx = baseContext();

    await runVideoStreaming(ctx, api, { persistMediaVersions: false });

    expect(ctx.database.create).not.toHaveBeenCalled();
    expect(api.emitProcessing).toHaveBeenCalled();
  });

  it("passes mutated presets to transcodeHLS when resolvePreset is provided", async () => {
    const api = baseApi();
    const ctx = baseContext();
    const resolvePreset = jest.fn(
      (_ctx: PipelineContext, preset: StreamingPreset): StreamingPreset => ({
        ...preset,
        height: Math.min(preset.height ?? 1080, 720),
      })
    );

    await runVideoStreaming(ctx, api, { resolvePreset });

    expect(resolvePreset).toHaveBeenCalledTimes(4);
    const resolvedPresets = transcodeHLSSpy.mock.calls[0][2] as StreamingPreset[];
    expect(resolvedPresets.every((p) => (p.height ?? 0) <= 720)).toBe(true);
  });

  it("emits both hls and dash entries when formats: ['hls', 'dash']", async () => {
    const api = baseApi();
    const ctx = baseContext();

    await runVideoStreaming(ctx, api, { formats: ["hls", "dash"] });

    expect(transcodeHLSSpy).toHaveBeenCalledTimes(1);
    expect(transcodeDASHSpy).toHaveBeenCalledTimes(1);
    expect(api.emitProcessing).toHaveBeenCalledWith(
      expect.objectContaining({
        variants: {
          streaming: [
            { key: "streaming/test-record-id/hls/master.m3u8", format: "hls" },
            { key: "streaming/test-record-id/dash/master.mpd", format: "dash" },
          ],
        },
      })
    );
  });

  it("inserts only the master row for DASH (no per-representation rows)", async () => {
    const api = baseApi();
    const ctx = baseContext();

    await runVideoStreaming(ctx, api, { formats: ["dash"] });

    // DASH: master only → 1 row, not 1 + numPresets
    expect(ctx.database.create).toHaveBeenCalledTimes(1);
    expect(ctx.database.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          storageKey: "streaming/test-record-id/dash/master.mpd",
          mimeType: "application/dash+xml",
        }),
      })
    );
  });

  it("continues remaining formats when one transcode fails", async () => {
    transcodeHLSSpy.mockRejectedValueOnce(new Error("encoder crashed"));
    const api = baseApi();
    const ctx = baseContext();

    await runVideoStreaming(ctx, api, { formats: ["hls", "dash"] });

    expect(api.emitMetadata).toHaveBeenCalledWith(
      expect.objectContaining({
        error: "transcode-failed",
        format: "hls",
        message: "encoder crashed",
      })
    );
    expect(api.emitProcessing).toHaveBeenCalledWith(
      expect.objectContaining({
        variants: {
          streaming: [{ key: "streaming/test-record-id/dash/master.mpd", format: "dash" }],
        },
      })
    );
  });

  it("does not call emitProcessing when all formats fail", async () => {
    transcodeHLSSpy.mockRejectedValueOnce(new Error("fail"));
    const api = baseApi();
    const ctx = baseContext();

    await runVideoStreaming(ctx, api, {});

    expect(api.emitProcessing).not.toHaveBeenCalled();
    expect(api.emitMetadata).toHaveBeenCalledWith(
      expect.objectContaining({ error: "transcode-failed", format: "hls" })
    );
  });

  it("emits transcode-failed when transcode times out", async () => {
    transcodeHLSSpy.mockImplementation(() => new Promise(() => {}));
    const api = baseApi();
    const ctx = baseContext();

    await runVideoStreaming(ctx, api, { timeoutMs: 30 });

    expect(api.emitMetadata).toHaveBeenCalledWith(
      expect.objectContaining({ error: "transcode-failed", format: "hls" })
    );
    expect(api.emitProcessing).not.toHaveBeenCalled();
  });

  it("does not call uploadDirectory when transcoding fails", async () => {
    transcodeHLSSpy.mockRejectedValueOnce(new Error("fail"));
    const api = baseApi();
    const ctx = baseContext();

    await runVideoStreaming(ctx, api, {});

    expect(uploadDirSpy).not.toHaveBeenCalled();
  });

  it("forwards onProgress events with format context", async () => {
    transcodeHLSSpy.mockImplementation((...args: Parameters<typeof ffmpegMod.transcodeHLS>) => {
      const onProgress = args[4];
      onProgress?.({ preset: "720p", percent: 50, currentTimeSecs: 30 });
      return Promise.resolve({ duration: 95, files: [] });
    });

    const events: StreamingProgressEvent[] = [];
    const api = baseApi();
    const ctx = baseContext();

    await runVideoStreaming(ctx, api, { onProgress: (e) => events.push(e) });

    expect(events).toContainEqual({
      format: "hls",
      preset: "720p",
      percent: 50,
      currentTimeSecs: 30,
    });
  });

  it("does not throw when onProgress is not provided", async () => {
    const api = baseApi();
    const ctx = baseContext();
    await expect(runVideoStreaming(ctx, api, {})).resolves.toBeUndefined();
  });
});
