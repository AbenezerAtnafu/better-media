import type { DatabaseAdapter, StorageAdapter } from "@better-media/core";
import { memoryStorage } from "@better-media/adapter-storage-memory";
import { resolveStreamingUrls } from "./resolve-streaming-urls";
import { createStreamingProxy } from "./create-streaming-proxy";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDb(rows: { storageKey: string; mimeType: string }[] = []): DatabaseAdapter {
  return { findMany: jest.fn().mockResolvedValue(rows) } as unknown as DatabaseAdapter;
}

function makeStorageWithUrl(getUrl: jest.Mock): StorageAdapter {
  return { getUrl, exists: jest.fn().mockResolvedValue(true) } as unknown as StorageAdapter;
}

function makeStorageNoUrl(): StorageAdapter {
  return { exists: jest.fn().mockResolvedValue(true) } as unknown as StorageAdapter;
}

// ---------------------------------------------------------------------------
// resolveStreamingUrls
// ---------------------------------------------------------------------------

describe("resolveStreamingUrls", () => {
  const recordId = "rec-123";

  it("throws when storage.getUrl is not implemented", async () => {
    const storage = makeStorageNoUrl();
    const database = makeDb();

    await expect(resolveStreamingUrls(recordId, { database, storage })).rejects.toThrow(/getUrl/);
  });

  it("queries media_versions with mediaId and mimeType IN filter", async () => {
    const getUrl = jest.fn().mockResolvedValue("https://cdn.example.com/master.m3u8");
    const storage = makeStorageWithUrl(getUrl);
    const database = makeDb([
      { storageKey: `streaming/${recordId}/hls/master.m3u8`, mimeType: "application/x-mpegURL" },
    ]);

    await resolveStreamingUrls(recordId, { database, storage });

    expect(database.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "media_versions",
        where: expect.arrayContaining([
          expect.objectContaining({ field: "mediaId", value: recordId }),
          expect.objectContaining({
            field: "mimeType",
            operator: "in",
            value: expect.arrayContaining(["application/x-mpegURL", "application/dash+xml"]),
          }),
        ]),
      })
    );
  });

  it("returns hls URL when HLS master exists", async () => {
    const url = "https://cdn.example.com/master.m3u8";
    const getUrl = jest.fn().mockResolvedValue(url);
    const storage = makeStorageWithUrl(getUrl);
    const database = makeDb([
      { storageKey: `streaming/${recordId}/hls/master.m3u8`, mimeType: "application/x-mpegURL" },
    ]);

    const result = await resolveStreamingUrls(recordId, { database, storage });

    expect(result.hls).toBe(url);
    expect(result.dash).toBeUndefined();
  });

  it("returns dash URL when DASH master exists", async () => {
    const url = "https://cdn.example.com/master.mpd";
    const getUrl = jest.fn().mockResolvedValue(url);
    const storage = makeStorageWithUrl(getUrl);
    const database = makeDb([
      { storageKey: `streaming/${recordId}/dash/master.mpd`, mimeType: "application/dash+xml" },
    ]);

    const result = await resolveStreamingUrls(recordId, { database, storage });

    expect(result.dash).toBe(url);
    expect(result.hls).toBeUndefined();
  });

  it("returns both hls and dash when both masters exist", async () => {
    const getUrl = jest
      .fn()
      .mockResolvedValueOnce("https://cdn.example.com/hls/master.m3u8")
      .mockResolvedValueOnce("https://cdn.example.com/dash/master.mpd");
    const storage = makeStorageWithUrl(getUrl);
    const database = makeDb([
      { storageKey: `streaming/${recordId}/hls/master.m3u8`, mimeType: "application/x-mpegURL" },
      { storageKey: `streaming/${recordId}/dash/master.mpd`, mimeType: "application/dash+xml" },
    ]);

    const result = await resolveStreamingUrls(recordId, { database, storage });

    expect(result.hls).toBe("https://cdn.example.com/hls/master.m3u8");
    expect(result.dash).toBe("https://cdn.example.com/dash/master.mpd");
  });

  it("returns {} when no matching master rows exist", async () => {
    const getUrl = jest.fn();
    const storage = makeStorageWithUrl(getUrl);
    const database = makeDb([]);

    const result = await resolveStreamingUrls(recordId, { database, storage });

    expect(result).toEqual({});
    expect(getUrl).not.toHaveBeenCalled();
  });

  it("filters out variant playlists — only master keys reach getUrl", async () => {
    const getUrl = jest.fn().mockResolvedValue("https://cdn.example.com/master.m3u8");
    const storage = makeStorageWithUrl(getUrl);
    const database = makeDb([
      { storageKey: `streaming/${recordId}/hls/master.m3u8`, mimeType: "application/x-mpegURL" },
      {
        storageKey: `streaming/${recordId}/hls/720p/index.m3u8`,
        mimeType: "application/x-mpegURL",
      },
      {
        storageKey: `streaming/${recordId}/hls/360p/index.m3u8`,
        mimeType: "application/x-mpegURL",
      },
    ]);

    await resolveStreamingUrls(recordId, { database, storage });

    expect(getUrl).toHaveBeenCalledTimes(1);
    expect(getUrl).toHaveBeenCalledWith(`streaming/${recordId}/hls/master.m3u8`, undefined);
  });

  it("strategy A: calls getUrl without options when expiresIn is not set", async () => {
    const getUrl = jest.fn().mockResolvedValue("https://cdn.example.com/master.m3u8");
    const storage = makeStorageWithUrl(getUrl);
    const database = makeDb([
      { storageKey: `streaming/${recordId}/hls/master.m3u8`, mimeType: "application/x-mpegURL" },
    ]);

    await resolveStreamingUrls(recordId, { database, storage });

    expect(getUrl).toHaveBeenCalledWith(`streaming/${recordId}/hls/master.m3u8`, undefined);
  });

  it("strategy B: passes expiresIn to getUrl when set", async () => {
    const getUrl = jest.fn().mockResolvedValue("https://cdn.example.com/master.m3u8?sig=x");
    const storage = makeStorageWithUrl(getUrl);
    const database = makeDb([
      { storageKey: `streaming/${recordId}/hls/master.m3u8`, mimeType: "application/x-mpegURL" },
    ]);

    await resolveStreamingUrls(recordId, { database, storage, expiresIn: 3600 });

    expect(getUrl).toHaveBeenCalledWith(`streaming/${recordId}/hls/master.m3u8`, {
      expiresIn: 3600,
    });
  });

  it("respects custom derivativePrefix in key lookup", async () => {
    const getUrl = jest.fn().mockResolvedValue("https://cdn.example.com/master.m3u8");
    const storage = makeStorageWithUrl(getUrl);
    const database = makeDb([
      { storageKey: `media/${recordId}/hls/master.m3u8`, mimeType: "application/x-mpegURL" },
    ]);

    const result = await resolveStreamingUrls(recordId, {
      database,
      storage,
      derivativePrefix: "media",
    });

    expect(result.hls).toBe("https://cdn.example.com/master.m3u8");
  });
});

// ---------------------------------------------------------------------------
// createStreamingProxy
// ---------------------------------------------------------------------------

describe("createStreamingProxy", () => {
  const recordId = "rec-456";
  const segment = Buffer.from("fake-segment-bytes");

  async function seedStorage(storage: StorageAdapter, key: string, data = segment) {
    await storage.put(key, data);
  }

  it("returns 400 for path traversal", async () => {
    const proxy = createStreamingProxy({ storage: memoryStorage() });

    const response = await proxy.handle({ recordId, filePath: "../secret/file" });

    expect(response.status).toBe(400);
  });

  it("returns 400 for nested path traversal", async () => {
    const proxy = createStreamingProxy({ storage: memoryStorage() });

    const response = await proxy.handle({ recordId, filePath: "hls/../../etc/passwd" });

    expect(response.status).toBe(400);
  });

  it("returns 403 when authenticate throws", async () => {
    const storage = memoryStorage();
    await seedStorage(storage, `streaming/${recordId}/hls/master.m3u8`);

    const proxy = createStreamingProxy({
      storage,
      authenticate: async () => {
        throw new Error("Forbidden");
      },
    });

    const response = await proxy.handle({ recordId, filePath: "hls/master.m3u8" });

    expect(response.status).toBe(403);
  });

  it("returns 404 for missing storage key", async () => {
    const proxy = createStreamingProxy({ storage: memoryStorage() });

    const response = await proxy.handle({ recordId, filePath: "hls/master.m3u8" });

    expect(response.status).toBe(404);
  });

  it("serves HLS master playlist with correct Content-Type", async () => {
    const storage = memoryStorage();
    await seedStorage(storage, `streaming/${recordId}/hls/master.m3u8`);
    const proxy = createStreamingProxy({ storage });

    const response = await proxy.handle({ recordId, filePath: "hls/master.m3u8" });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/x-mpegURL");
  });

  it("serves DASH manifest with correct Content-Type", async () => {
    const storage = memoryStorage();
    await seedStorage(storage, `streaming/${recordId}/dash/master.mpd`);
    const proxy = createStreamingProxy({ storage });

    const response = await proxy.handle({ recordId, filePath: "dash/master.mpd" });

    expect(response.headers.get("Content-Type")).toBe("application/dash+xml");
  });

  it("serves .ts segment with correct Content-Type", async () => {
    const storage = memoryStorage();
    await seedStorage(storage, `streaming/${recordId}/hls/720p/seg001.ts`);
    const proxy = createStreamingProxy({ storage });

    const response = await proxy.handle({ recordId, filePath: "hls/720p/seg001.ts" });

    expect(response.headers.get("Content-Type")).toBe("video/MP2T");
  });

  it("serves .m4s chunk with correct Content-Type", async () => {
    const storage = memoryStorage();
    await seedStorage(storage, `streaming/${recordId}/dash/chunk-stream0-00001.m4s`);
    const proxy = createStreamingProxy({ storage });

    const response = await proxy.handle({ recordId, filePath: "dash/chunk-stream0-00001.m4s" });

    expect(response.headers.get("Content-Type")).toBe("video/iso.segment");
  });

  it("serves .mp4 init segment with correct Content-Type", async () => {
    const storage = memoryStorage();
    await seedStorage(storage, `streaming/${recordId}/dash/init-stream0.mp4`);
    const proxy = createStreamingProxy({ storage });

    const response = await proxy.handle({ recordId, filePath: "dash/init-stream0.mp4" });

    expect(response.headers.get("Content-Type")).toBe("video/mp4");
  });

  it("sets no-cache Cache-Control for playlist files", async () => {
    const storage = memoryStorage();
    await seedStorage(storage, `streaming/${recordId}/hls/master.m3u8`);
    const proxy = createStreamingProxy({ storage });

    const response = await proxy.handle({ recordId, filePath: "hls/master.m3u8" });

    expect(response.headers.get("Cache-Control")).toBe("no-cache, no-store");
  });

  it("sets immutable Cache-Control for segment files", async () => {
    const storage = memoryStorage();
    await seedStorage(storage, `streaming/${recordId}/hls/720p/seg001.ts`);
    const proxy = createStreamingProxy({ storage });

    const response = await proxy.handle({ recordId, filePath: "hls/720p/seg001.ts" });

    expect(response.headers.get("Cache-Control")).toBe("public, max-age=31536000, immutable");
  });

  it("respects custom cacheControl options", async () => {
    const storage = memoryStorage();
    await seedStorage(storage, `streaming/${recordId}/hls/master.m3u8`);
    const proxy = createStreamingProxy({
      storage,
      cacheControl: { playlist: "no-store", segment: "max-age=60" },
    });

    const playlist = await proxy.handle({ recordId, filePath: "hls/master.m3u8" });
    expect(playlist.headers.get("Cache-Control")).toBe("no-store");
  });

  it("sets CORS headers on every response", async () => {
    const storage = memoryStorage();
    await seedStorage(storage, `streaming/${recordId}/hls/master.m3u8`);
    const proxy = createStreamingProxy({ storage });

    const response = await proxy.handle({ recordId, filePath: "hls/master.m3u8" });

    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(response.headers.get("Access-Control-Allow-Methods")).toBe("GET, HEAD");
  });

  it("respects custom corsOrigin", async () => {
    const storage = memoryStorage();
    await seedStorage(storage, `streaming/${recordId}/hls/master.m3u8`);
    const proxy = createStreamingProxy({ storage, corsOrigin: "https://app.example.com" });

    const response = await proxy.handle({ recordId, filePath: "hls/master.m3u8" });

    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://app.example.com");
  });

  it("HEAD returns 200 with headers and no body", async () => {
    const storage = memoryStorage();
    await seedStorage(storage, `streaming/${recordId}/hls/master.m3u8`);
    const proxy = createStreamingProxy({ storage });

    const response = await proxy.handle({ recordId, filePath: "hls/master.m3u8", method: "HEAD" });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("application/x-mpegURL");
    expect(response.body).toBeNull();
  });

  it("HEAD still returns 404 for missing key", async () => {
    const proxy = createStreamingProxy({ storage: memoryStorage() });

    const response = await proxy.handle({ recordId, filePath: "hls/master.m3u8", method: "HEAD" });

    expect(response.status).toBe(404);
  });

  it("HEAD still returns 403 when authenticate throws", async () => {
    const storage = memoryStorage();
    await seedStorage(storage, `streaming/${recordId}/hls/master.m3u8`);
    const proxy = createStreamingProxy({
      storage,
      authenticate: async () => {
        throw new Error("no");
      },
    });

    const response = await proxy.handle({ recordId, filePath: "hls/master.m3u8", method: "HEAD" });

    expect(response.status).toBe(403);
  });

  it("streams body bytes correctly", async () => {
    const data = Buffer.from("segment-content");
    const storage = memoryStorage();
    await seedStorage(storage, `streaming/${recordId}/hls/720p/seg001.ts`, data);
    const proxy = createStreamingProxy({ storage });

    const response = await proxy.handle({ recordId, filePath: "hls/720p/seg001.ts" });
    const body = await response.arrayBuffer();

    expect(Buffer.from(body)).toEqual(data);
  });

  it("falls back to storage.get when getStream is not implemented", async () => {
    const data = Buffer.from("buffered-segment");
    const storage = memoryStorage();
    await seedStorage(storage, `streaming/${recordId}/hls/720p/seg001.ts`, data);

    // Remove getStream to simulate a storage adapter without streaming support
    const storageWithoutStream = { ...storage, getStream: undefined };
    const proxy = createStreamingProxy({ storage: storageWithoutStream });

    const response = await proxy.handle({ recordId, filePath: "hls/720p/seg001.ts" });
    const body = await response.arrayBuffer();

    expect(response.status).toBe(200);
    expect(Buffer.from(body)).toEqual(data);
  });

  it("uses custom derivativePrefix when building storage key", async () => {
    const storage = memoryStorage();
    await storage.put(`media/${recordId}/hls/master.m3u8`, segment);
    const proxy = createStreamingProxy({ storage, derivativePrefix: "media" });

    const response = await proxy.handle({ recordId, filePath: "hls/master.m3u8" });

    expect(response.status).toBe(200);
  });

  it("passes recordId and storageKey to authenticate", async () => {
    const storage = memoryStorage();
    await seedStorage(storage, `streaming/${recordId}/hls/master.m3u8`);

    const authenticate = jest.fn().mockResolvedValue(undefined);
    const proxy = createStreamingProxy({ storage, authenticate });

    await proxy.handle({ recordId, filePath: "hls/master.m3u8", req: { user: "alice" } });

    expect(authenticate).toHaveBeenCalledWith(
      { user: "alice" },
      { recordId, storageKey: `streaming/${recordId}/hls/master.m3u8` }
    );
  });
});
