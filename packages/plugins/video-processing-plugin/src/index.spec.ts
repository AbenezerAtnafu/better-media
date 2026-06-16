import type { PipelineContext, MediaRuntime, PluginApi } from "@better-media/core";
import { videoProcessingPlugin } from "./index";
import { runVideoProcessing } from "./runtime/runner";
import * as ffmpegMod from "./runtime/ffmpeg";
import * as fsPromises from "node:fs/promises";

// Mock readFile so tests don't need real ffmpeg output files on disk.
// All other fs operations (mkdir, writeFile, rm) remain real.
jest.mock("node:fs/promises", () => {
  const actual = jest.requireActual<typeof import("node:fs/promises")>("node:fs/promises");
  return { ...actual, readFile: jest.fn().mockResolvedValue(Buffer.from("mocked-output")) };
});

const mockReadFile = fsPromises.readFile as jest.Mock;

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

beforeEach(() => {
  mockReadFile.mockResolvedValue(Buffer.from("mocked-output"));
});

afterEach(() => {
  jest.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Plugin registration
// ---------------------------------------------------------------------------

describe("videoProcessingPlugin", () => {
  it("registers on process:run in background mode by default", () => {
    const plugin = videoProcessingPlugin();
    const { runtime } = createMockRuntime();
    plugin.apply!(runtime);
    expect(runtime.hooks["process:run"].tap).toHaveBeenCalledWith(
      "video-processing",
      expect.any(Function),
      { mode: "background" }
    );
  });

  it("respects executionMode sync override", () => {
    const plugin = videoProcessingPlugin({ executionMode: "sync" });
    const { runtime } = createMockRuntime();
    plugin.apply!(runtime);
    expect(runtime.hooks["process:run"].tap).toHaveBeenCalledWith(
      "video-processing",
      expect.any(Function),
      { mode: "sync" }
    );
  });

  it("has intensive: true", () => {
    expect(videoProcessingPlugin().intensive).toBe(true);
  });

  it("has untrusted trustLevel", () => {
    expect(videoProcessingPlugin().runtimeManifest.trustLevel).toBe("untrusted");
  });

  it("has correct plugin id and namespace", () => {
    const { id, namespace } = videoProcessingPlugin().runtimeManifest;
    expect(id).toBe("better-media-video-processing");
    expect(namespace).toBe("video-processing");
  });
});

// ---------------------------------------------------------------------------
// runVideoProcessing — skip conditions
// ---------------------------------------------------------------------------

describe("runVideoProcessing — skip conditions", () => {
  it("skips on reference-url mode", async () => {
    const api = baseApi();
    const ctx = baseContext({
      file: { key: "https://cdn.example.com/video.mp4", mimeType: "video/mp4" },
      storageLocation: {
        key: "https://cdn.example.com/video.mp4",
        url: "https://cdn.example.com/video.mp4",
      },
    });
    await runVideoProcessing(ctx, api, {});
    expect(api.emitMetadata).toHaveBeenCalledWith({ skipped: "reference-url" });
    expect(api.emitProcessing).not.toHaveBeenCalled();
  });

  it("skips on disallowed MIME type", async () => {
    const api = baseApi();
    const ctx = baseContext({
      file: { key: "uploads/photo.jpg", mimeType: "image/jpeg" },
    });
    await runVideoProcessing(ctx, api, {});
    expect(api.emitMetadata).toHaveBeenCalledWith(
      expect.objectContaining({ skipped: "mime-not-allowed", mimeType: "image/jpeg" })
    );
  });

  it("skips when storage returns null buffer", async () => {
    const api = baseApi();
    const ctx = baseContext({
      storage: {
        get: jest.fn().mockResolvedValue(null),
        put: jest.fn(),
        delete: jest.fn(),
        exists: jest.fn().mockResolvedValue(false),
      } as unknown as PipelineContext["storage"],
    });
    await runVideoProcessing(ctx, api, {});
    expect(api.emitMetadata).toHaveBeenCalledWith({ skipped: "no-file-content" });
  });

  it("skips when file exceeds maxInputBytes", async () => {
    const api = baseApi();
    const ctx = baseContext({
      storage: {
        get: jest.fn().mockResolvedValue(Buffer.alloc(200)),
        put: jest.fn(),
        delete: jest.fn(),
        exists: jest.fn().mockResolvedValue(false),
      } as unknown as PipelineContext["storage"],
    });
    await runVideoProcessing(ctx, api, { maxInputBytes: 100 });
    expect(api.emitMetadata).toHaveBeenCalledWith(
      expect.objectContaining({ skipped: "input-too-large" })
    );
  });
});

// ---------------------------------------------------------------------------
// runVideoProcessing — ffmpeg error handling
// ---------------------------------------------------------------------------

describe("runVideoProcessing — ffmpeg errors", () => {
  it("emits ffmpeg-not-found when fluent-ffmpeg is missing during probe", async () => {
    jest.spyOn(ffmpegMod, "probeVideo").mockRejectedValueOnce(new ffmpegMod.FfmpegNotFoundError());
    const api = baseApi();
    await runVideoProcessing(baseContext(), api, {});
    expect(api.emitMetadata).toHaveBeenCalledWith(
      expect.objectContaining({ error: "ffmpeg-not-found" })
    );
    expect(api.emitProcessing).not.toHaveBeenCalled();
  });

  it("emits probe-failed on generic probe error", async () => {
    jest.spyOn(ffmpegMod, "probeVideo").mockRejectedValueOnce(new Error("probe exploded"));
    const api = baseApi();
    await runVideoProcessing(baseContext(), api, {});
    expect(api.emitMetadata).toHaveBeenCalledWith(
      expect.objectContaining({ error: "probe-failed", message: "probe exploded" })
    );
  });

  it("emits ffmpeg-not-found when fluent-ffmpeg is missing during thumbnail extraction", async () => {
    jest.spyOn(ffmpegMod, "probeVideo").mockResolvedValueOnce({ duration: 30 });
    jest
      .spyOn(ffmpegMod, "extractThumbnail")
      .mockRejectedValueOnce(new ffmpegMod.FfmpegNotFoundError());
    const api = baseApi();
    await runVideoProcessing(baseContext(), api, { thumbnails: [{ at: "10%", format: "jpeg" }] });
    expect(api.emitMetadata).toHaveBeenCalledWith(
      expect.objectContaining({ error: "ffmpeg-not-found" })
    );
  });

  it("continues other presets when one thumbnail fails with a generic error", async () => {
    jest.spyOn(ffmpegMod, "probeVideo").mockResolvedValue({ duration: 60 });
    jest
      .spyOn(ffmpegMod, "extractThumbnail")
      .mockRejectedValueOnce(new Error("frame grab failed"))
      .mockResolvedValueOnce({ width: 640, height: 360 });

    const api = baseApi();
    await runVideoProcessing(baseContext(), api, {
      thumbnails: [
        { at: 5, format: "jpeg" },
        { at: 15, format: "jpeg" },
      ],
    });
    expect(api.emitMetadata).toHaveBeenCalledWith(
      expect.objectContaining({ error: "thumbnail-failed", index: 0 })
    );
  });

  it("emits ffmpeg-not-found when fluent-ffmpeg is missing during transcode", async () => {
    jest.spyOn(ffmpegMod, "probeVideo").mockResolvedValueOnce({ duration: 30 });
    jest
      .spyOn(ffmpegMod, "transcodeVideo")
      .mockRejectedValueOnce(new ffmpegMod.FfmpegNotFoundError());

    const api = baseApi();
    await runVideoProcessing(baseContext(), api, {
      thumbnails: false,
      transcode: [{ name: "720p", format: "mp4" }],
    });
    expect(api.emitMetadata).toHaveBeenCalledWith(
      expect.objectContaining({ error: "ffmpeg-not-found" })
    );
  });

  it("emits transcode-failed on generic transcode error and continues", async () => {
    jest.spyOn(ffmpegMod, "probeVideo").mockResolvedValue({ duration: 30 });
    jest
      .spyOn(ffmpegMod, "transcodeVideo")
      .mockRejectedValueOnce(new Error("codec not found"))
      .mockResolvedValue({ duration: 30 });

    const api = baseApi();
    await runVideoProcessing(baseContext(), api, {
      thumbnails: false,
      transcode: [
        { name: "720p", format: "mp4" },
        { name: "360p", format: "mp4" },
      ],
    });
    expect(api.emitMetadata).toHaveBeenCalledWith(
      expect.objectContaining({ error: "transcode-failed", name: "720p" })
    );
  });
});

// ---------------------------------------------------------------------------
// runVideoProcessing — success path
// ---------------------------------------------------------------------------

describe("runVideoProcessing — success", () => {
  it("emits probe metadata after successful run with no processing configured", async () => {
    jest.spyOn(ffmpegMod, "probeVideo").mockResolvedValueOnce({
      duration: 42.5,
      width: 1280,
      height: 720,
      videoCodec: "h264",
      audioCodec: "aac",
      framerate: 29.97,
      bitrate: 3000000,
    });

    const api = baseApi();
    await runVideoProcessing(baseContext(), api, { thumbnails: false, transcode: [] });

    expect(api.emitMetadata).toHaveBeenCalledWith(
      expect.objectContaining({
        duration: 42.5,
        videoCodec: "h264",
        audioCodec: "aac",
        width: 1280,
        height: 720,
        framerate: 29.97,
      })
    );
    expect(api.emitProcessing).not.toHaveBeenCalled();
  });

  it("emits thumbnails in processing output and persists media_versions row", async () => {
    jest
      .spyOn(ffmpegMod, "probeVideo")
      .mockResolvedValueOnce({ duration: 30, width: 1280, height: 720, videoCodec: "h264" });
    jest.spyOn(ffmpegMod, "extractThumbnail").mockResolvedValueOnce({ width: 640, height: 360 });
    const thumbBuf = Buffer.from("fake-thumb");
    mockReadFile.mockResolvedValueOnce(thumbBuf);

    const ctx = baseContext();
    const api = baseApi();
    await runVideoProcessing(ctx, api, {
      thumbnails: [{ at: "10%", format: "jpeg", width: 640 }],
      transcode: [],
    });

    expect(ctx.storage.put).toHaveBeenCalledWith(
      expect.stringContaining("thumbnails/thumb_0.jpg"),
      thumbBuf
    );
    expect(ctx.database.create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "media_versions",
        data: expect.objectContaining({ type: "thumbnail", mimeType: "image/jpeg" }),
      })
    );
    expect(api.emitProcessing).toHaveBeenCalledWith(
      expect.objectContaining({
        thumbnails: expect.arrayContaining([expect.objectContaining({ format: "jpeg" })]),
      })
    );
  });

  it("emits transcode in processing output and persists media_versions row", async () => {
    jest.spyOn(ffmpegMod, "probeVideo").mockResolvedValueOnce({ duration: 30, videoCodec: "h264" });
    jest.spyOn(ffmpegMod, "transcodeVideo").mockResolvedValueOnce({ duration: 30 });
    const outBuf = Buffer.from("fake-mp4");
    mockReadFile.mockResolvedValueOnce(outBuf);

    const ctx = baseContext();
    const api = baseApi();
    await runVideoProcessing(ctx, api, {
      thumbnails: false,
      transcode: [{ name: "720p", format: "mp4", videoBitrate: "2500k" }],
    });

    expect(ctx.storage.put).toHaveBeenCalledWith(
      expect.stringContaining("transcode/720p.mp4"),
      outBuf
    );
    expect(ctx.database.create).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "media_versions",
        data: expect.objectContaining({ type: "compressed", mimeType: "video/mp4" }),
      })
    );
    expect(api.emitProcessing).toHaveBeenCalledWith(
      expect.objectContaining({
        transcode: expect.arrayContaining([
          expect.objectContaining({ name: "720p", format: "mp4" }),
        ]),
      })
    );
  });

  it("skips existing derivative when skipExistingDerivatives is true", async () => {
    jest.spyOn(ffmpegMod, "probeVideo").mockResolvedValueOnce({ duration: 30 });
    const extractSpy = jest.spyOn(ffmpegMod, "extractThumbnail");

    const ctx = baseContext({
      storage: {
        get: jest.fn().mockResolvedValue(Buffer.from("video")),
        put: jest.fn(),
        delete: jest.fn(),
        exists: jest.fn().mockResolvedValue(true),
      } as unknown as PipelineContext["storage"],
    });
    const api = baseApi();
    await runVideoProcessing(ctx, api, {
      thumbnails: [{ at: "10%", format: "jpeg" }],
      transcode: [],
      skipExistingDerivatives: true,
    });

    expect(extractSpy).not.toHaveBeenCalled();
    expect(ctx.storage.put).not.toHaveBeenCalled();
    expect(api.emitProcessing).toHaveBeenCalledWith(
      expect.objectContaining({
        thumbnails: expect.arrayContaining([expect.objectContaining({ index: 0 })]),
      })
    );
  });

  it("does not persist media_versions when persistMediaVersions is false", async () => {
    jest.spyOn(ffmpegMod, "probeVideo").mockResolvedValueOnce({ duration: 30 });
    jest.spyOn(ffmpegMod, "extractThumbnail").mockResolvedValueOnce({ width: 640 });

    const ctx = baseContext();
    const api = baseApi();
    await runVideoProcessing(ctx, api, {
      thumbnails: [{ at: 5, format: "jpeg" }],
      transcode: [],
      persistMediaVersions: false,
    });

    expect(ctx.database.create).not.toHaveBeenCalled();
  });

  it("webm transcode output has video/webm MIME type", async () => {
    jest.spyOn(ffmpegMod, "probeVideo").mockResolvedValueOnce({ duration: 20 });
    jest.spyOn(ffmpegMod, "transcodeVideo").mockResolvedValueOnce({ duration: 20 });

    const ctx = baseContext();
    const api = baseApi();
    await runVideoProcessing(ctx, api, {
      thumbnails: false,
      transcode: [{ name: "360p-webm", format: "webm" }],
    });

    expect(ctx.database.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ mimeType: "video/webm" }),
      })
    );
    expect(ctx.storage.put).toHaveBeenCalledWith(
      expect.stringContaining("transcode/360p-webm.webm"),
      expect.any(Buffer)
    );
  });
});

// ---------------------------------------------------------------------------
// resolveTimestamp
// ---------------------------------------------------------------------------

describe("resolveTimestamp", () => {
  const { resolveTimestamp } =
    jest.requireActual<typeof import("./runtime/ffmpeg")>("./runtime/ffmpeg");

  it("returns seconds as-is for a number", () => {
    expect(resolveTimestamp(10, 60)).toBe(10);
  });

  it("resolves percentage to fraction of duration", () => {
    expect(resolveTimestamp("25%", 60)).toBeCloseTo(15);
  });

  it("parses a numeric string as seconds", () => {
    expect(resolveTimestamp("5.5", 60)).toBeCloseTo(5.5);
  });

  it("clamps negative values to 0", () => {
    expect(resolveTimestamp(-5, 60)).toBe(0);
  });
});
