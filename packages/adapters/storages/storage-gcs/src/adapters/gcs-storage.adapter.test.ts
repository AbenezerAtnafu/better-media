import { GCSStorageAdapter } from "./gcs-storage.adapter";

// ---------------------------------------------------------------------------
// Mock @google-cloud/storage
// ---------------------------------------------------------------------------

const mockFile = {
  name: "test-key",
  metadata: {
    size: "1024",
    contentType: "image/jpeg",
    updated: "2024-01-01T00:00:00Z",
    etag: "abc123",
  },
  download: jest.fn(),
  save: jest.fn(),
  delete: jest.fn(),
  exists: jest.fn(),
  getMetadata: jest.fn(),
  createReadStream: jest.fn(),
  getSignedUrl: jest.fn(),
  generateSignedPostPolicyV4: jest.fn(),
  copy: jest.fn(),
};

const mockBucket = {
  file: jest.fn().mockReturnValue(mockFile),
  exists: jest.fn().mockResolvedValue([true]),
  getFiles: jest.fn(),
};

jest.mock("@google-cloud/storage", () => ({
  Storage: jest.fn().mockImplementation(() => ({
    bucket: jest.fn().mockReturnValue(mockBucket),
  })),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAdapter(config?: { basePrefix?: string; bucket?: string }) {
  return new GCSStorageAdapter({
    bucket: config?.bucket ?? "my-bucket",
    projectId: "my-project",
    ...(config?.basePrefix && { basePrefix: config.basePrefix }),
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  jest.clearAllMocks();
  mockFile.name = "test-key";
  mockFile.metadata = {
    size: "1024",
    contentType: "image/jpeg",
    updated: "2024-01-01T00:00:00Z",
    etag: "abc123",
  };
  mockBucket.file.mockReturnValue(mockFile);
  mockBucket.exists.mockResolvedValue([true]);
});

// ---------------------------------------------------------------------------
// get
// ---------------------------------------------------------------------------

describe("get", () => {
  it("returns a buffer when the file exists", async () => {
    const buf = Buffer.from("hello");
    mockFile.download.mockResolvedValue([buf]);
    const adapter = makeAdapter();
    const result = await adapter.get("test-key");
    expect(result).toBe(buf);
    expect(mockBucket.file).toHaveBeenCalledWith("test-key");
  });

  it("returns null for a 404 error", async () => {
    const err = Object.assign(new Error("Not found"), { code: 404 });
    mockFile.download.mockRejectedValue(err);
    const adapter = makeAdapter();
    const result = await adapter.get("missing");
    expect(result).toBeNull();
  });

  it("re-throws non-404 errors", async () => {
    const err = Object.assign(new Error("Network error"), { code: 500 });
    mockFile.download.mockRejectedValue(err);
    const adapter = makeAdapter();
    await expect(adapter.get("key")).rejects.toThrow("Network error");
  });

  it("prepends basePrefix to the key", async () => {
    mockFile.download.mockResolvedValue([Buffer.from("")]);
    const adapter = makeAdapter({ basePrefix: "media" });
    await adapter.get("photo.jpg");
    expect(mockBucket.file).toHaveBeenCalledWith("media/photo.jpg");
  });
});

// ---------------------------------------------------------------------------
// put
// ---------------------------------------------------------------------------

describe("put", () => {
  it("calls save with the provided buffer", async () => {
    mockFile.save.mockResolvedValue(undefined);
    const adapter = makeAdapter();
    const buf = Buffer.from("content");
    await adapter.put("uploads/file.jpg", buf);
    expect(mockBucket.file).toHaveBeenCalledWith("uploads/file.jpg");
    expect(mockFile.save).toHaveBeenCalledWith(buf);
  });

  it("prepends basePrefix", async () => {
    mockFile.save.mockResolvedValue(undefined);
    const adapter = makeAdapter({ basePrefix: "media/" });
    await adapter.put("file.jpg", Buffer.from("x"));
    expect(mockBucket.file).toHaveBeenCalledWith("media/file.jpg");
  });
});

// ---------------------------------------------------------------------------
// delete
// ---------------------------------------------------------------------------

describe("delete", () => {
  it("calls file.delete for the given key", async () => {
    mockFile.delete.mockResolvedValue([{}]);
    const adapter = makeAdapter();
    await adapter.delete("uploads/file.jpg");
    expect(mockBucket.file).toHaveBeenCalledWith("uploads/file.jpg");
    expect(mockFile.delete).toHaveBeenCalled();
  });

  it("silently ignores a 404 error", async () => {
    const err = Object.assign(new Error("Not found"), { code: 404 });
    mockFile.delete.mockRejectedValue(err);
    const adapter = makeAdapter();
    await expect(adapter.delete("missing")).resolves.toBeUndefined();
  });

  it("re-throws non-404 errors", async () => {
    const err = Object.assign(new Error("Forbidden"), { code: 403 });
    mockFile.delete.mockRejectedValue(err);
    const adapter = makeAdapter();
    await expect(adapter.delete("key")).rejects.toThrow("Forbidden");
  });
});

// ---------------------------------------------------------------------------
// exists
// ---------------------------------------------------------------------------

describe("exists", () => {
  it("returns true when file.exists resolves [true]", async () => {
    mockFile.exists.mockResolvedValue([true]);
    const adapter = makeAdapter();
    expect(await adapter.exists("key")).toBe(true);
  });

  it("returns false when file.exists resolves [false]", async () => {
    mockFile.exists.mockResolvedValue([false]);
    const adapter = makeAdapter();
    expect(await adapter.exists("key")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getSize
// ---------------------------------------------------------------------------

describe("getSize", () => {
  it("returns the file size as a number (string metadata)", async () => {
    mockFile.getMetadata.mockResolvedValue([{ size: "2048" }]);
    const adapter = makeAdapter();
    expect(await adapter.getSize("key")).toBe(2048);
  });

  it("returns the file size when metadata.size is already a number", async () => {
    mockFile.getMetadata.mockResolvedValue([{ size: 4096 }]);
    const adapter = makeAdapter();
    expect(await adapter.getSize("key")).toBe(4096);
  });

  it("returns null when metadata.size is undefined", async () => {
    mockFile.getMetadata.mockResolvedValue([{}]);
    const adapter = makeAdapter();
    expect(await adapter.getSize("key")).toBeNull();
  });

  it("returns null on a 404 error", async () => {
    const err = Object.assign(new Error("Not found"), { code: 404 });
    mockFile.getMetadata.mockRejectedValue(err);
    const adapter = makeAdapter();
    expect(await adapter.getSize("key")).toBeNull();
  });

  it("re-throws non-404 errors", async () => {
    const err = Object.assign(new Error("Access denied"), { code: 403 });
    mockFile.getMetadata.mockRejectedValue(err);
    const adapter = makeAdapter();
    await expect(adapter.getSize("key")).rejects.toThrow("Access denied");
  });
});

// ---------------------------------------------------------------------------
// getStream
// ---------------------------------------------------------------------------

describe("getStream", () => {
  it("returns a ReadableStream when the file exists", async () => {
    const { Readable } = await import("node:stream");
    mockFile.exists.mockResolvedValue([true]);
    const nodeStream = new Readable({
      read() {
        this.push(null);
      },
    });
    mockFile.createReadStream.mockReturnValue(nodeStream);

    const adapter = makeAdapter();
    const result = await adapter.getStream("key");
    expect(result).not.toBeNull();
  });

  it("returns null when the file does not exist", async () => {
    mockFile.exists.mockResolvedValue([false]);
    const adapter = makeAdapter();
    const result = await adapter.getStream("missing");
    expect(result).toBeNull();
    expect(mockFile.createReadStream).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// getUrl
// ---------------------------------------------------------------------------

describe("getUrl", () => {
  it("returns a signed read URL", async () => {
    mockFile.getSignedUrl.mockResolvedValue(["https://storage.googleapis.com/signed"]);
    const adapter = makeAdapter();
    const url = await adapter.getUrl("key");
    expect(url).toBe("https://storage.googleapis.com/signed");
    expect(mockFile.getSignedUrl).toHaveBeenCalledWith(expect.objectContaining({ action: "read" }));
  });

  it("uses the provided expiresIn to set the expiry", async () => {
    mockFile.getSignedUrl.mockResolvedValue(["https://url"]);
    const before = Date.now();
    const adapter = makeAdapter();
    await adapter.getUrl("key", { expiresIn: 7200 });
    const [[opts]] = mockFile.getSignedUrl.mock.calls as [[{ expires: number }]];
    expect(opts.expires).toBeGreaterThanOrEqual(before + 7200 * 1000);
  });
});

// ---------------------------------------------------------------------------
// createPresignedUpload — PUT
// ---------------------------------------------------------------------------

describe("createPresignedUpload PUT", () => {
  it("returns a PUT result with url and headers", async () => {
    mockFile.getSignedUrl.mockResolvedValue(["https://signed-put-url"]);
    const adapter = makeAdapter();
    const result = await adapter.createPresignedUpload("key", {
      method: "PUT",
      contentType: "image/jpeg",
      maxSizeBytes: 5 * 1024 * 1024,
    });

    expect(result.method).toBe("PUT");
    expect(result.url).toBe("https://signed-put-url");
    expect(result.headers?.["Content-Type"]).toBe("image/jpeg");
    expect(result.headers?.["Content-Length"]).toBe(String(5 * 1024 * 1024));
  });

  it("signs with version v4 and action write", async () => {
    mockFile.getSignedUrl.mockResolvedValue(["https://url"]);
    const adapter = makeAdapter();
    await adapter.createPresignedUpload("key", { contentType: "video/mp4" });
    expect(mockFile.getSignedUrl).toHaveBeenCalledWith(
      expect.objectContaining({ version: "v4", action: "write", contentType: "video/mp4" })
    );
  });

  it("includes metadata as x-goog-meta-* extension headers", async () => {
    mockFile.getSignedUrl.mockResolvedValue(["https://url"]);
    const adapter = makeAdapter();
    await adapter.createPresignedUpload("key", {
      contentType: "image/png",
      metadata: { userId: "u1" },
    });
    expect(mockFile.getSignedUrl).toHaveBeenCalledWith(
      expect.objectContaining({
        extensionHeaders: { "x-goog-meta-userId": "u1" },
      })
    );
  });
});

// ---------------------------------------------------------------------------
// createPresignedUpload — POST
// ---------------------------------------------------------------------------

describe("createPresignedUpload POST", () => {
  it("returns a POST result with url and fields", async () => {
    const policyResult = {
      url: "https://storage.googleapis.com/my-bucket",
      fields: { key: "uploads/file.jpg", "Content-Type": "image/jpeg", "x-goog-signature": "sig" },
    };
    mockFile.generateSignedPostPolicyV4.mockResolvedValue([policyResult]);
    const adapter = makeAdapter();
    const result = await adapter.createPresignedUpload("key", {
      method: "POST",
      contentType: "image/jpeg",
      maxSizeBytes: 10 * 1024 * 1024,
    });

    expect(result.method).toBe("POST");
    expect(result.url).toBe(policyResult.url);
    expect(result.fields).toBe(policyResult.fields);
  });

  it("includes content-length-range condition", async () => {
    mockFile.generateSignedPostPolicyV4.mockResolvedValue([{ url: "u", fields: {} }]);
    const adapter = makeAdapter();
    await adapter.createPresignedUpload("key", {
      method: "POST",
      contentType: "image/png",
      minSizeBytes: 10,
      maxSizeBytes: 1024,
    });
    const [[opts]] = mockFile.generateSignedPostPolicyV4.mock.calls as [
      [{ conditions: unknown[] }],
    ];
    expect(opts.conditions).toContainEqual(["content-length-range", 10, 1024]);
  });

  it("includes eq Content-Type condition", async () => {
    mockFile.generateSignedPostPolicyV4.mockResolvedValue([{ url: "u", fields: {} }]);
    const adapter = makeAdapter();
    await adapter.createPresignedUpload("key", { method: "POST", contentType: "image/webp" });
    const [[opts]] = mockFile.generateSignedPostPolicyV4.mock.calls as [
      [{ conditions: unknown[] }],
    ];
    expect(opts.conditions).toContainEqual(["eq", "$Content-Type", "image/webp"]);
  });

  it("includes metadata in conditions and fields", async () => {
    mockFile.generateSignedPostPolicyV4.mockResolvedValue([{ url: "u", fields: {} }]);
    const adapter = makeAdapter();
    await adapter.createPresignedUpload("key", {
      method: "POST",
      contentType: "image/png",
      metadata: { tenantId: "t1" },
    });
    const [[opts]] = mockFile.generateSignedPostPolicyV4.mock.calls as [
      [
        {
          conditions: unknown[];
          fields: Record<string, string>;
        },
      ],
    ];
    expect(opts.conditions).toContainEqual({ "x-goog-meta-tenantId": "t1" });
    expect(opts.fields["x-goog-meta-tenantId"]).toBe("t1");
  });
});

// ---------------------------------------------------------------------------
// deleteMany
// ---------------------------------------------------------------------------

describe("deleteMany", () => {
  it("deletes each key in parallel", async () => {
    mockFile.delete.mockResolvedValue([{}]);
    const adapter = makeAdapter();
    await adapter.deleteMany(["a", "b", "c"]);
    expect(mockFile.delete).toHaveBeenCalledTimes(3);
  });

  it("is a no-op for an empty array", async () => {
    const adapter = makeAdapter();
    await adapter.deleteMany([]);
    expect(mockFile.delete).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// copy / move
// ---------------------------------------------------------------------------

describe("copy", () => {
  it("calls file.copy with the destination file reference", async () => {
    mockFile.copy.mockResolvedValue([{}]);
    const adapter = makeAdapter();
    await adapter.copy("src/a.jpg", "dst/b.jpg");
    expect(mockFile.copy).toHaveBeenCalledWith(mockFile);
  });
});

describe("move", () => {
  it("copies then deletes the source", async () => {
    mockFile.copy.mockResolvedValue([{}]);
    mockFile.delete.mockResolvedValue([{}]);
    const adapter = makeAdapter();
    await adapter.move("src/a.jpg", "dst/b.jpg");
    expect(mockFile.copy).toHaveBeenCalled();
    expect(mockFile.delete).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// list
// ---------------------------------------------------------------------------

describe("list", () => {
  it("returns items mapped from GCS file metadata", async () => {
    const gcsFile = {
      name: "uploads/photo.jpg",
      metadata: {
        size: "2048",
        contentType: "image/jpeg",
        updated: "2024-03-01T00:00:00Z",
        etag: "etag1",
      },
    };
    mockBucket.getFiles.mockResolvedValue([[gcsFile], null]);
    const adapter = makeAdapter();
    const result = await adapter.list("uploads/");

    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toEqual({
      key: "uploads/photo.jpg",
      size: 2048,
      lastModified: new Date("2024-03-01T00:00:00Z"),
      etag: "etag1",
      contentType: "image/jpeg",
    });
  });

  it("strips basePrefix from returned keys", async () => {
    const gcsFile = {
      name: "media/uploads/photo.jpg",
      metadata: { size: "512" },
    };
    mockBucket.getFiles.mockResolvedValue([[gcsFile], null]);
    const adapter = makeAdapter({ basePrefix: "media" });
    const result = await adapter.list("uploads/");
    expect(result.items[0]?.key).toBe("uploads/photo.jpg");
  });

  it("returns nextToken from the second response element", async () => {
    mockBucket.getFiles.mockResolvedValue([[], { pageToken: "next-page-token" }]);
    const adapter = makeAdapter();
    const result = await adapter.list("prefix/");
    expect(result.nextToken).toBe("next-page-token");
  });

  it("returns no nextToken when there are no more pages", async () => {
    mockBucket.getFiles.mockResolvedValue([[], null]);
    const adapter = makeAdapter();
    const result = await adapter.list("prefix/");
    expect(result.nextToken).toBeUndefined();
  });

  it("passes limit and continuationToken to getFiles", async () => {
    mockBucket.getFiles.mockResolvedValue([[], null]);
    const adapter = makeAdapter();
    await adapter.list("prefix/", { limit: 50, continuationToken: "token-123" });
    expect(mockBucket.getFiles).toHaveBeenCalledWith(
      expect.objectContaining({ maxResults: 50, pageToken: "token-123" })
    );
  });
});

// ---------------------------------------------------------------------------
// checkConnection
// ---------------------------------------------------------------------------

describe("checkConnection", () => {
  it("returns true when bucket.exists resolves", async () => {
    mockBucket.exists.mockResolvedValue([true]);
    const adapter = makeAdapter();
    expect(await adapter.checkConnection()).toBe(true);
  });

  it("returns false when bucket.exists throws", async () => {
    mockBucket.exists.mockRejectedValue(new Error("network error"));
    const adapter = makeAdapter();
    expect(await adapter.checkConnection()).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// basePrefix
// ---------------------------------------------------------------------------

describe("basePrefix", () => {
  it("normalises a trailing-slash prefix", async () => {
    mockFile.save.mockResolvedValue(undefined);
    const adapter = makeAdapter({ basePrefix: "media/" });
    await adapter.put("file.jpg", Buffer.from("x"));
    expect(mockBucket.file).toHaveBeenCalledWith("media/file.jpg");
  });

  it("handles a prefix without a trailing slash", async () => {
    mockFile.save.mockResolvedValue(undefined);
    const adapter = makeAdapter({ basePrefix: "media" });
    await adapter.put("file.jpg", Buffer.from("x"));
    expect(mockBucket.file).toHaveBeenCalledWith("media/file.jpg");
  });
});
