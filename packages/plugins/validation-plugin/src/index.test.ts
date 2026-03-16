import crypto from "node:crypto";
import { validationPlugin } from "./index";
import { memoryStorage } from "@better-media/adapter-storage-memory";
import { memoryDatabase } from "@better-media/adapter-db";
import { createBetterMedia } from "better-media";

// Minimal JPEG header (valid for magic byte detection)
const MINIMAL_JPEG = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00,
]);

// 1x1 valid PNG (base64)
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

describe("validationPlugin", () => {
  it("returns a plugin with name and apply", () => {
    const plugin = validationPlugin();
    expect(plugin.name).toBe("validation");
    expect(plugin.apply).toBeDefined();
    expect(plugin.executionMode).toBe("background");
    expect(plugin.intensive).toBe(true);
  });

  it("defaults to background execution mode", () => {
    const plugin = validationPlugin({});
    expect(plugin.executionMode).toBe("background");
  });

  it("can use sync execution mode", () => {
    const plugin = validationPlugin({ executionMode: "sync" });
    expect(plugin.executionMode).toBe("sync");
  });
});

describe("validationPlugin - file type", () => {
  it("rejects disallowed extension in sync mode", async () => {
    const storage = memoryStorage();
    const database = memoryDatabase();
    const media = createBetterMedia({
      storage,
      database,
      plugins: [
        validationPlugin({
          executionMode: "sync",
          allowedExtensions: [".jpg", ".jpeg"],
          onFailure: "abort",
        }),
      ],
    });

    await storage.put("file.png", PNG_1X1);

    await expect(
      media.upload.multer("file.png", { contentType: "image/png" })
    ).rejects.toMatchObject({
      name: "ValidationError",
      result: { valid: false, message: expect.stringContaining("Extension") },
    });
  });

  it("accepts allowed extension with magic bytes", async () => {
    const storage = memoryStorage();
    const database = memoryDatabase();
    const media = createBetterMedia({
      storage,
      database,
      plugins: [
        validationPlugin({
          executionMode: "sync",
          allowedExtensions: [".jpg", ".jpeg"],
          allowedMimeTypes: ["image/jpeg"],
          useMagicBytes: true,
          onFailure: "abort",
        }),
      ],
    });

    await storage.put("photo.jpg", MINIMAL_JPEG);

    await expect(
      media.upload.multer("photo.jpg", { contentType: "image/jpeg" })
    ).resolves.toBeUndefined();
  });
});

describe("validationPlugin - file size", () => {
  it("rejects file exceeding maxBytes", async () => {
    const storage = memoryStorage();
    const database = memoryDatabase();
    const media = createBetterMedia({
      storage,
      database,
      plugins: [
        validationPlugin({
          executionMode: "sync",
          maxBytes: 100,
          onFailure: "abort",
        }),
      ],
    });

    const large = Buffer.alloc(200);
    await storage.put("large.jpg", large);

    await expect(media.upload.multer("large.jpg", {})).rejects.toMatchObject({
      name: "ValidationError",
      result: { valid: false, message: expect.stringContaining("exceeds maximum") },
    });
  });
});

describe("validationPlugin - dimensions", () => {
  it("rejects image below minWidth", async () => {
    const storage = memoryStorage();
    const database = memoryDatabase();
    const media = createBetterMedia({
      storage,
      database,
      plugins: [
        validationPlugin({
          executionMode: "sync",
          minWidth: 300,
          onFailure: "abort",
        }),
      ],
    });

    await storage.put("small.png", PNG_1X1);

    await expect(
      media.upload.multer("small.png", { contentType: "image/png" })
    ).rejects.toMatchObject({
      name: "ValidationError",
      result: { valid: false, message: expect.stringContaining("width") },
    });
  });
});

describe("validationPlugin - checksum", () => {
  it("rejects mismatched checksum", async () => {
    const storage = memoryStorage();
    const database = memoryDatabase();
    const content = Buffer.from("hello");
    const wrongHash = crypto.createHash("sha256").update(Buffer.from("wrong")).digest("hex");

    const media = createBetterMedia({
      storage,
      database,
      plugins: [
        validationPlugin({
          executionMode: "sync",
          checksum: { algorithm: "sha256", metadataKey: "expectedHash" },
          onFailure: "abort",
        }),
      ],
    });

    await storage.put("file.txt", content);

    await expect(
      media.upload.multer("file.txt", { expectedHash: wrongHash })
    ).rejects.toMatchObject({
      name: "ValidationError",
      result: { valid: false, message: expect.stringContaining("hash mismatch") },
    });
  });

  it("accepts matching checksum", async () => {
    const storage = memoryStorage();
    const database = memoryDatabase();
    const content = Buffer.from("hello");
    const correctHash = crypto.createHash("sha256").update(content).digest("hex");

    const media = createBetterMedia({
      storage,
      database,
      plugins: [
        validationPlugin({
          executionMode: "sync",
          checksum: { algorithm: "sha256", metadataKey: "expectedHash" },
          onFailure: "abort",
        }),
      ],
    });

    await storage.put("file.txt", content);

    await expect(
      media.upload.multer("file.txt", { expectedHash: correctHash })
    ).resolves.toBeUndefined();
  });
});

describe("validationPlugin - extract metadata", () => {
  it("overrides critical fields from file content (trust library over caller)", async () => {
    const storage = memoryStorage();
    const database = memoryDatabase();
    let capturedFile: { mimeType?: string; size?: number; checksums?: Record<string, string> } = {};

    const spyPlugin = {
      name: "spy",
      apply(runtime: {
        hooks: {
          "upload:complete": {
            tap: (n: string, fn: (ctx: { file: typeof capturedFile }) => Promise<void>) => void;
          };
        };
      }) {
        runtime.hooks["upload:complete"].tap("spy", async (ctx) => {
          capturedFile = { ...ctx.file };
        });
      },
    };

    const media = createBetterMedia({
      storage,
      database,
      plugins: [
        validationPlugin({
          executionMode: "sync",
          allowedExtensions: [".jpg", ".jpeg"],
          allowedMimeTypes: ["image/jpeg"],
          useMagicBytes: true,
          onFailure: "abort",
        }),
        spyPlugin,
      ],
    });

    await storage.put("photo.jpg", MINIMAL_JPEG);

    await media.upload.multer("photo.jpg", {
      contentType: "image/gif",
      size: 99999,
      originalName: "wrong.png",
    });

    expect(capturedFile.mimeType).toBe("image/jpeg");
    expect(capturedFile.size).toBe(MINIMAL_JPEG.length);
    expect(capturedFile.checksums?.sha256).toBeDefined();
    expect(typeof capturedFile.checksums?.sha256).toBe("string");
    expect(capturedFile.checksums!.sha256).toHaveLength(64);
  });

  it("extracts both sha256 and md5 when configured", async () => {
    const storage = memoryStorage();
    const database = memoryDatabase();
    let capturedFile: { checksums?: Record<string, string> } = {};

    const spyPlugin = {
      name: "spy",
      apply(runtime: {
        hooks: {
          "upload:complete": {
            tap: (n: string, fn: (ctx: { file: typeof capturedFile }) => Promise<void>) => void;
          };
        };
      }) {
        runtime.hooks["upload:complete"].tap("spy", async (ctx) => {
          capturedFile = { ...ctx.file };
        });
      },
    };

    const content = Buffer.from("hello");
    const media = createBetterMedia({
      storage,
      database,
      plugins: [
        validationPlugin({
          executionMode: "sync",
          extractMetadata: true,
          extractChecksums: ["sha256", "md5"],
          onFailure: "abort",
        }),
        spyPlugin,
      ],
    });

    await storage.put("file.bin", content);

    await media.upload.multer("file.bin", {});

    expect(capturedFile.checksums?.sha256).toBe(
      crypto.createHash("sha256").update(content).digest("hex")
    );
    expect(capturedFile.checksums?.md5).toBe(
      crypto.createHash("md5").update(content).digest("hex")
    );
  });

  it("uses streaming when file exceeds maxBufferBytes", async () => {
    const storage = memoryStorage();
    const database = memoryDatabase();
    let hadTempPath = false;

    const spyPlugin = {
      name: "spy",
      apply(runtime: {
        hooks: {
          "upload:complete": {
            tap: (
              n: string,
              fn: (ctx: { utilities?: { fileContent?: { tempPath?: string } } }) => Promise<void>
            ) => void;
          };
        };
      }) {
        runtime.hooks["upload:complete"].tap("spy", async (ctx) => {
          hadTempPath = !!ctx.utilities?.fileContent?.tempPath;
        });
      },
    };

    const largeContent = Buffer.alloc(200, "x");
    const media = createBetterMedia({
      storage,
      database,
      fileHandling: { maxBufferBytes: 100 },
      plugins: [
        validationPlugin({
          executionMode: "sync",
          extractMetadata: true,
          onFailure: "abort",
        }),
        spyPlugin,
      ],
    });

    await storage.put("large.bin", largeContent);
    await media.upload.multer("large.bin", {});

    expect(hadTempPath).toBe(true);
  });

  it("skips extraction when extractMetadata is false", async () => {
    const storage = memoryStorage();
    const database = memoryDatabase();
    let capturedFile: { mimeType?: string; size?: number; checksums?: Record<string, string> } = {};

    const spyPlugin = {
      name: "spy",
      apply(runtime: {
        hooks: {
          "upload:complete": {
            tap: (n: string, fn: (ctx: { file: typeof capturedFile }) => Promise<void>) => void;
          };
        };
      }) {
        runtime.hooks["upload:complete"].tap("spy", async (ctx) => {
          capturedFile = { ...ctx.file };
        });
      },
    };

    const media = createBetterMedia({
      storage,
      database,
      plugins: [
        validationPlugin({
          executionMode: "sync",
          extractMetadata: false,
          allowedExtensions: [".jpg"],
          allowedMimeTypes: ["image/jpeg"],
          useMagicBytes: true,
          onFailure: "abort",
        }),
        spyPlugin,
      ],
    });

    await storage.put("photo.jpg", MINIMAL_JPEG);

    await media.upload.multer("photo.jpg", { contentType: "image/jpeg", size: 12345 });

    expect(capturedFile.mimeType).toBe("image/jpeg");
    expect(capturedFile.size).toBe(12345);
    expect(capturedFile.checksums).toBeUndefined();
  });
});

describe("validationPlugin - file not found", () => {
  it("fails when file not in storage and fileNotFoundBehavior is fail", async () => {
    const storage = memoryStorage();
    const database = memoryDatabase();
    const media = createBetterMedia({
      storage,
      database,
      plugins: [
        validationPlugin({
          executionMode: "sync",
          fileNotFoundBehavior: "fail",
          onFailure: "abort",
        }),
      ],
    });

    await expect(media.upload.multer("missing.jpg", {})).rejects.toMatchObject({
      name: "ValidationError",
      result: { valid: false, message: expect.stringContaining("not found") },
    });
  });

  it("stores validation failure in database", async () => {
    const storage = memoryStorage();
    const database = memoryDatabase();
    const media = createBetterMedia({
      storage,
      database,
      plugins: [
        validationPlugin({
          executionMode: "sync",
          fileNotFoundBehavior: "fail",
          maxBytes: 10,
          onFailure: "abort",
        }),
      ],
    });

    await storage.put("too-big.jpg", Buffer.alloc(100));

    await expect(media.upload.multer("too-big.jpg", {})).rejects.toMatchObject({
      name: "ValidationError",
    });

    const record = await database.get("better-media:validation:too-big.jpg");
    expect(record).toBeDefined();
    expect(record?.valid).toBe(false);
    expect(Array.isArray(record?.errors)).toBe(true);
    expect((record?.errors as { message: string }[])[0]?.message).toContain("exceeds maximum");
  });
});
