import type { PipelineContext, MediaRuntime, PluginApi } from "@better-media/core";
import { schema } from "@better-media/core";
import { MemoryDbAdapter } from "@better-media/adapter-db-memory";
import { memoryStorage } from "@better-media/adapter-storage-memory";
import { mediaProcessingPlugin } from "./index";
import { runMediaProcessing } from "./runtime/runner";

/** Valid 1×1 PNG */
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

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

describe("mediaProcessingPlugin", () => {
  it("registers process:run", () => {
    const plugin = mediaProcessingPlugin();
    const { runtime } = createMockRuntime();
    plugin.apply!(runtime);
    expect(runtime.hooks["process:run"].tap).toHaveBeenCalledWith(
      "media-processing",
      expect.any(Function),
      { mode: "background" }
    );
  });

  it("runMediaProcessing skips reference URL mode", async () => {
    const api = baseApi();
    const ctx: PipelineContext = {
      recordId: "r1",
      file: { key: "https://cdn.example.com/a.png", mimeType: "image/png" },
      storageLocation: {
        key: "https://cdn.example.com/a.png",
        url: "https://cdn.example.com/a.png",
      },
      processing: {},
      metadata: {},
      trusted: {},
      storage: memoryStorage(),
      database: new MemoryDbAdapter({ schema }),
      jobs: {} as PipelineContext["jobs"],
    };
    await runMediaProcessing(ctx, api, {});
    expect(api.emitMetadata).toHaveBeenCalledWith({ skipped: "reference-url" });
    expect(api.emitProcessing).not.toHaveBeenCalled();
  });

  it("runMediaProcessing skips when MIME not allowed", async () => {
    const api = baseApi();
    const ctx: PipelineContext = {
      recordId: "r1",
      file: { key: "v.mp4", mimeType: "video/mp4" },
      storageLocation: { key: "v.mp4" },
      processing: {},
      metadata: {},
      trusted: {},
      storage: memoryStorage(),
      database: new MemoryDbAdapter({ schema }),
      jobs: {} as PipelineContext["jobs"],
      utilities: { fileContent: { buffer: PNG_1X1 } },
    };
    await runMediaProcessing(ctx, api, {});
    expect(api.emitMetadata).toHaveBeenCalledWith(
      expect.objectContaining({ skipped: "mime-not-allowed" })
    );
    expect(api.emitProcessing).not.toHaveBeenCalled();
  });

  it("runMediaProcessing generates thumbnails with sharp", async () => {
    const api = baseApi();
    const storage = memoryStorage();
    const database = new MemoryDbAdapter({ schema });
    const ctx: PipelineContext = {
      recordId: "rec-thumb",
      file: { key: "orig/x.png", mimeType: "image/png" },
      storageLocation: { key: "orig/x.png" },
      processing: {},
      metadata: {},
      trusted: {},
      storage,
      database,
      jobs: {} as PipelineContext["jobs"],
      utilities: { fileContent: { buffer: PNG_1X1 } },
    };

    await runMediaProcessing(ctx, api, {
      thumbnailPresets: [{ name: "sm", width: 32, format: "webp" }],
      derivativePrefix: "v",
    });

    expect(api.emitProcessing).toHaveBeenCalled();
    const patch = (api.emitProcessing as jest.Mock).mock.calls[0][0] as {
      dimensions?: { width: number; height: number };
      thumbnails: { default: { key: string }[] };
    };
    expect(patch.dimensions?.width).toBe(1);
    expect(patch.dimensions?.height).toBe(1);
    expect(patch.thumbnails.default[0]?.key).toMatch(/v\/rec-thumb\/thumb-sm\.webp$/);

    const stored = await storage.get(patch.thumbnails.default[0]!.key);
    expect(stored).toBeInstanceOf(Buffer);
    expect(stored!.length).toBeGreaterThan(0);

    const versions = await database.findMany({
      model: "media_versions",
      where: [{ field: "mediaId", value: "rec-thumb" }],
    });
    expect(versions.length).toBe(1);
    expect(versions[0]?.type).toBe("thumbnail");
  });

  it("resolveThumbnailPreset can set fit from context metadata", async () => {
    const api = baseApi();
    const storage = memoryStorage();
    const ctx: PipelineContext = {
      recordId: "rec-fit",
      file: { key: "orig/x.png", mimeType: "image/png" },
      storageLocation: { key: "orig/x.png" },
      processing: {},
      metadata: { upload: { thumbFit: "cover" } },
      trusted: {},
      storage,
      database: new MemoryDbAdapter({ schema }),
      jobs: {} as PipelineContext["jobs"],
      utilities: { fileContent: { buffer: PNG_1X1 } },
    };

    await runMediaProcessing(ctx, api, {
      thumbnailPresets: [{ name: "sm", width: 8, height: 8, format: "webp" }],
      derivativePrefix: "v",
      resolveThumbnailPreset: (_c, preset) => {
        const fit = (_c.metadata.upload as { thumbFit?: string })?.thumbFit;
        if (
          fit === "cover" ||
          fit === "contain" ||
          fit === "fill" ||
          fit === "inside" ||
          fit === "outside"
        ) {
          return { ...preset, fit };
        }
        return preset;
      },
    });

    expect(api.emitProcessing).toHaveBeenCalled();
    const key = "v/rec-fit/thumb-sm.webp";
    const stored = await storage.get(key);
    expect(stored).toBeInstanceOf(Buffer);
    expect(stored!.length).toBeGreaterThan(0);
  });

  it("runMediaProcessing skips put when derivative exists", async () => {
    const api = baseApi();
    const storage = memoryStorage();
    const key = "v/rec-skip/thumb-sm.webp";
    await storage.put(key, Buffer.from("existing"));

    const ctx: PipelineContext = {
      recordId: "rec-skip",
      file: { key: "orig/x.png", mimeType: "image/png" },
      storageLocation: { key: "orig/x.png" },
      processing: {},
      metadata: {},
      trusted: {},
      storage,
      database: new MemoryDbAdapter({ schema }),
      jobs: {} as PipelineContext["jobs"],
      utilities: { fileContent: { buffer: PNG_1X1 } },
    };

    await runMediaProcessing(ctx, api, {
      thumbnailPresets: [{ name: "sm", width: 32, format: "webp" }],
      derivativePrefix: "v",
    });

    expect(api.emitProcessing).toHaveBeenCalled();
    const buf = await storage.get(key);
    expect(buf?.toString()).toBe("existing");
  });
});
