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

    await storage.put("file-disallowed.png", PNG_1X1);

    await expect(
      media.upload.complete("file-disallowed.png", { contentType: "image/png" })
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

    await storage.put("photo-allowed.jpg", MINIMAL_JPEG);

    await expect(
      media.upload.complete("photo-allowed.jpg", { contentType: "image/jpeg" })
    ).resolves.toBeDefined();
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
    await storage.put("large-size.jpg", large);

    await expect(media.upload.complete("large-size.jpg", {})).rejects.toMatchObject({
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

    await storage.put("small-dim.png", PNG_1X1);

    await expect(
      media.upload.complete("small-dim.png", { contentType: "image/png" })
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

    // Use .bin to avoid spoofing checks on .txt/.jpg
    await storage.put("file-checksum-fail.bin", content);

    await expect(
      media.upload.complete("file-checksum-fail.bin", { expectedHash: wrongHash })
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

    await storage.put("file-checksum-ok.bin", content);

    await expect(
      media.upload.complete("file-checksum-ok.bin", { expectedHash: correctHash })
    ).resolves.toBeDefined();
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

    await storage.put("photo-extract.jpg", MINIMAL_JPEG);

    await media.upload.complete("photo-extract.jpg", {
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

    await storage.put("file-check.bin", content);

    await media.upload.complete("file-check.bin", {});

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

    await storage.put("large-stream.bin", largeContent);
    await media.upload.complete("large-stream.bin", {});

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

    await storage.put("photo-skip.jpg", MINIMAL_JPEG);

    await media.upload.complete("photo-skip.jpg", { contentType: "image/jpeg", size: 12345 });

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

    await expect(media.upload.complete("missing-file.jpg", {})).rejects.toMatchObject({
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

    const tooBigContent = Buffer.concat([MINIMAL_JPEG, Buffer.alloc(100)]);
    await storage.put("too-big-db.jpg", tooBigContent);

    await expect(media.upload.complete("too-big-db.jpg", {})).rejects.toMatchObject({
      name: "ValidationError",
    });

    const record = (await database.findOne({
      model: "validation_results",
      where: [{ field: "id", value: "better-media:validation:too-big-db.jpg" }],
    })) as Record<string, unknown>;
    expect(record).toBeDefined();
    expect(record?.valid).toBe(false);
    expect(Array.isArray(record?.errors)).toBe(true);
    expect((record?.errors as { message: string }[])[0]?.message).toContain("exceeds maximum");
  });
});

describe("validationPlugin - automated security scan", () => {
  it("rejects suspicious strings in metadata", async () => {
    const storage = memoryStorage();
    const database = memoryDatabase();
    const media = createBetterMedia({
      storage,
      database,
      plugins: [
        validationPlugin({
          executionMode: "sync",
          onFailure: "abort",
        }),
      ],
    });

    await storage.put("safe-sec.jpg", MINIMAL_JPEG);

    // SQL Injection in title
    await expect(
      media.upload.complete("safe-sec.jpg", { title: "Normal'; DROP TABLE users;--" })
    ).rejects.toMatchObject({
      name: "ValidationError",
      result: { valid: false, message: expect.stringContaining("Suspicious activity") },
    });
  });

  it("rejects suspicious strings in filename", async () => {
    const storage = memoryStorage();
    const database = memoryDatabase();
    const media = createBetterMedia({
      storage,
      database,
      plugins: [
        validationPlugin({
          executionMode: "sync",
          onFailure: "abort",
        }),
      ],
    });

    // XSS in filename
    await storage.put("<script>alert(1)</script>.jpg", MINIMAL_JPEG);

    await expect(media.upload.complete("<script>alert(1)</script>.jpg", {})).rejects.toMatchObject({
      name: "ValidationError",
      result: { valid: false, message: expect.stringContaining("Suspicious activity") },
    });
  });

  it("rejects MIME spoofing (extension vs content mismatch)", async () => {
    const storage = memoryStorage();
    const database = memoryDatabase();
    const media = createBetterMedia({
      storage,
      database,
      plugins: [
        validationPlugin({
          executionMode: "sync",
          onFailure: "abort",
        }),
      ],
    });

    // A text file renamed to .jpg
    const TEXT_CONTENT = Buffer.from("this is just a text file");
    await storage.put("spoofed-mime.jpg", TEXT_CONTENT);

    await expect(media.upload.complete("spoofed-mime.jpg", {})).rejects.toMatchObject({
      name: "ValidationError",
      result: { valid: false, message: expect.stringContaining("MIME spoofing detected") },
    });
  });
});
