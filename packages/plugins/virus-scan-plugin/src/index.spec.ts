import type { PipelineContext, MediaRuntime, PluginApi } from "@better-media/core";
import type { VirusScanner } from "./interfaces/scanner.interface";
import type { ScanResult } from "./interfaces/scan-result.interface";
import { virusScanPlugin } from "./index";

// ---------------------------------------------------------------------------
// Mock Scanner
// ---------------------------------------------------------------------------

function createMockScanner(overrides?: Partial<VirusScanner>): VirusScanner {
  return {
    name: "mock-scanner",
    init: jest.fn().mockResolvedValue(undefined),
    scanBuffer: jest.fn().mockResolvedValue({ infected: false, viruses: [] }),
    scanFile: jest.fn().mockResolvedValue({ infected: false, viruses: [] }),
    ...overrides,
  };
}

function infectedResult(viruses: string[] = ["EICAR-Test"]): ScanResult {
  return { infected: true, viruses };
}

function cleanResult(): ScanResult {
  return { infected: false, viruses: [] };
}

// ---------------------------------------------------------------------------
// Mock Runtime
// ---------------------------------------------------------------------------

type TapFn = (
  ctx: PipelineContext,
  api: PluginApi
) => Promise<void | { valid: boolean; message?: string }>;

function createMockRuntime(): { runtime: MediaRuntime; api: PluginApi; getTapFn: () => TapFn } {
  let captured: TapFn | null = null;

  const api: PluginApi = {
    emitMetadata: jest.fn(),
    emitProcessing: jest.fn(),
    proposeTrusted: jest.fn(),
  };

  const runtime: MediaRuntime = {
    hooks: {
      "upload:init": { tap: jest.fn() },
      "validation:run": { tap: jest.fn() },
      "scan:run": {
        tap: jest.fn((_name: string, fn: TapFn) => {
          captured = fn;
        }),
      },
      "process:run": { tap: jest.fn() },
      "upload:complete": { tap: jest.fn() },
    },
  };

  return {
    runtime,
    api,
    getTapFn: () => {
      if (!captured) throw new Error("tap was not called");
      return captured;
    },
  };
}

// ---------------------------------------------------------------------------
// Mock Context
// ---------------------------------------------------------------------------

function createMockContext(fileContent?: { buffer?: Buffer; tempPath?: string }): PipelineContext {
  return {
    recordId: "test-uuid",
    file: { key: "test-file.jpg" } as PipelineContext["file"],
    storageLocation: {} as PipelineContext["storageLocation"],
    processing: {} as PipelineContext["processing"],
    metadata: {},
    trusted: {} as PipelineContext["trusted"],
    storage: {} as PipelineContext["storage"],
    database: {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue(undefined),
      update: jest.fn().mockResolvedValue(undefined),
    } as unknown as PipelineContext["database"],
    jobs: {} as PipelineContext["jobs"],
    utilities: fileContent ? { fileContent } : undefined,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("virusScanPlugin", () => {
  describe("plugin structure", () => {
    it("should expose the correct plugin name", () => {
      const plugin = virusScanPlugin({ scanner: createMockScanner() });
      expect(plugin.name).toBe("virus-scan");
    });

    it("should default to background execution mode", () => {
      const plugin = virusScanPlugin({ scanner: createMockScanner() });
      expect(plugin.executionMode).toBe("background");
      expect(plugin.intensive).toBe(true);
    });

    it("should respect sync execution mode", () => {
      const plugin = virusScanPlugin({ scanner: createMockScanner(), executionMode: "sync" });
      expect(plugin.executionMode).toBe("sync");
      expect(plugin.intensive).toBe(false);
    });

    it("should register a tap on scan:run hook", () => {
      const { runtime } = createMockRuntime();
      const plugin = virusScanPlugin({ scanner: createMockScanner() });
      plugin.apply!(runtime);
      expect(runtime.hooks["scan:run"].tap).toHaveBeenCalledWith(
        "virus-scan",
        expect.any(Function),
        { mode: "background" }
      );
    });
  });

  describe("clean file scanning", () => {
    it("should return undefined for a clean buffer", async () => {
      const scanner = createMockScanner({
        scanBuffer: jest.fn().mockResolvedValue(cleanResult()),
      });
      const { runtime, api, getTapFn } = createMockRuntime();

      virusScanPlugin({ scanner }).apply!(runtime);
      const result = await getTapFn()(createMockContext({ buffer: Buffer.from("clean") }), api);

      expect(result).toBeUndefined();
      expect(scanner.scanBuffer).toHaveBeenCalled();
      expect(api.emitMetadata).toHaveBeenCalled();
    });

    it("should return undefined for a clean file on disk", async () => {
      const scanner = createMockScanner({
        scanFile: jest.fn().mockResolvedValue(cleanResult()),
      });
      const { runtime, api, getTapFn } = createMockRuntime();

      virusScanPlugin({ scanner }).apply!(runtime);
      const result = await getTapFn()(createMockContext({ tempPath: "/tmp/clean.jpg" }), api);

      expect(result).toBeUndefined();
      expect(scanner.scanFile).toHaveBeenCalledWith("/tmp/clean.jpg");
      expect(api.emitMetadata).toHaveBeenCalledWith(
        expect.objectContaining({ infected: false, viruses: [] })
      );
    });
  });

  describe("infected file scanning", () => {
    it("should abort by default when a virus is detected via buffer", async () => {
      const scanner = createMockScanner({
        scanBuffer: jest.fn().mockResolvedValue(infectedResult(["Win.Test.EICAR"])),
      });
      const { runtime, api, getTapFn } = createMockRuntime();

      virusScanPlugin({ scanner }).apply!(runtime);
      const result = await getTapFn()(createMockContext({ buffer: Buffer.from("bad") }), api);

      expect(result).toEqual({
        valid: false,
        message: expect.stringContaining("Win.Test.EICAR"),
      });
      expect(api.emitMetadata).toHaveBeenCalledWith(
        expect.objectContaining({ infected: true, viruses: ["Win.Test.EICAR"] })
      );
    });

    it("should abort by default when a virus is detected via tempPath", async () => {
      const scanner = createMockScanner({
        scanFile: jest.fn().mockResolvedValue(infectedResult(["Trojan.Generic"])),
      });
      const { runtime, api, getTapFn } = createMockRuntime();

      virusScanPlugin({ scanner }).apply!(runtime);
      const result = await getTapFn()(createMockContext({ tempPath: "/tmp/malware.exe" }), api);

      expect(result).toEqual({
        valid: false,
        message: expect.stringContaining("Trojan.Generic"),
      });
    });
  });

  describe("failure modes", () => {
    it("should continue pipeline when onFailure is 'continue'", async () => {
      const scanner = createMockScanner({
        scanBuffer: jest.fn().mockResolvedValue(infectedResult()),
      });
      const { runtime, api, getTapFn } = createMockRuntime();

      virusScanPlugin({ scanner, onFailure: "continue" }).apply!(runtime);
      const result = await getTapFn()(createMockContext({ buffer: Buffer.from("bad") }), api);

      expect(result).toBeUndefined();
    });

    it("should invoke custom callback when onFailure is 'custom'", async () => {
      const callback = jest.fn().mockResolvedValue({ valid: false, message: "custom rejection" });
      const scanner = createMockScanner({
        scanBuffer: jest.fn().mockResolvedValue(infectedResult(["EICAR"])),
      });
      const { runtime, api, getTapFn } = createMockRuntime();

      virusScanPlugin({ scanner, onFailure: "custom", onFailureCallback: callback }).apply!(
        runtime
      );
      const result = await getTapFn()(createMockContext({ buffer: Buffer.from("bad") }), api);

      expect(callback).toHaveBeenCalledWith("test-file.jpg", ["EICAR"]);
      expect(result).toEqual({ valid: false, message: "custom rejection" });
    });

    it("should continue if custom callback returns void", async () => {
      const callback = jest.fn().mockResolvedValue(undefined);
      const scanner = createMockScanner({
        scanBuffer: jest.fn().mockResolvedValue(infectedResult()),
      });
      const { runtime, api, getTapFn } = createMockRuntime();

      virusScanPlugin({ scanner, onFailure: "custom", onFailureCallback: callback }).apply!(
        runtime
      );
      const result = await getTapFn()(createMockContext({ buffer: Buffer.from("bad") }), api);

      expect(result).toBeUndefined();
    });
  });

  describe("DB persistence", () => {
    it("should record scan result to database", async () => {
      const scanner = createMockScanner({
        scanBuffer: jest.fn().mockResolvedValue(cleanResult()),
      });
      const { runtime, api, getTapFn } = createMockRuntime();
      const context = createMockContext({ buffer: Buffer.from("clean") });

      virusScanPlugin({ scanner }).apply!(runtime);
      await getTapFn()(context, api);

      expect(context.database.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "media_virus_scan_results",
          data: expect.objectContaining({
            id: expect.any(String),
            mediaId: "test-uuid",
            status: "clean",
            scanner: "mock-scanner",
          }),
        })
      );
    });

    it("should record infected scan result to database", async () => {
      const scanner = createMockScanner({
        scanBuffer: jest.fn().mockResolvedValue(infectedResult(["EICAR"])),
      });
      const { runtime, api, getTapFn } = createMockRuntime();
      const context = createMockContext({ buffer: Buffer.from("bad") });

      virusScanPlugin({ scanner }).apply!(runtime);
      await getTapFn()(context, api);

      expect(context.database.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "media_virus_scan_results",
          data: expect.objectContaining({
            id: expect.any(String),
            mediaId: "test-uuid",
            status: "infected",
            threats: ["EICAR"],
          }),
        })
      );
    });
  });

  describe("error handling", () => {
    it("should throw if no file content is provided", async () => {
      const scanner = createMockScanner();
      const { runtime, api, getTapFn } = createMockRuntime();

      virusScanPlugin({ scanner }).apply!(runtime);

      await expect(getTapFn()(createMockContext(), api)).rejects.toThrow("fileContent");
    });

    it("should return invalid result when scanner fails after retries", async () => {
      const scanner = createMockScanner({
        scanBuffer: jest.fn().mockRejectedValue(new Error("Daemon unreachable")),
      });
      const { runtime, api, getTapFn } = createMockRuntime();

      virusScanPlugin({
        scanner,
        retryOptions: { maxAttempts: 2, delayMs: 10, backoff: "linear" },
      }).apply!(runtime);

      const result = await getTapFn()(createMockContext({ buffer: Buffer.from("data") }), api);

      expect(result).toEqual({
        valid: false,
        message: expect.stringContaining("Daemon unreachable"),
      });
      expect(scanner.scanBuffer).toHaveBeenCalledTimes(2);
    });
  });

  describe("scan metadata", () => {
    it("should write scan metadata to context.metadata", async () => {
      const scanner = createMockScanner({
        scanBuffer: jest.fn().mockResolvedValue(cleanResult()),
      });
      const { runtime, api, getTapFn } = createMockRuntime();
      const context = createMockContext({ buffer: Buffer.from("clean") });

      virusScanPlugin({ scanner }).apply!(runtime);
      await getTapFn()(context, api);

      expect(api.emitMetadata).toHaveBeenCalledWith(
        expect.objectContaining({
          infected: false,
          viruses: [],
        })
      );
    });
  });
});
