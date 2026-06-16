/**
 * GCS Storage Adapter — Integration Tests
 *
 * Required env:
 *   GCS_TEST_BUCKET              — target bucket (tests skip when unset)
 *
 * Optional env:
 *   GCS_TEST_PROJECT_ID          — GCP project ID
 *   GCS_TEST_KEY_FILENAME        — path to service account JSON key file
 *   GCS_TEST_CREDENTIALS_JSON    — inline service account JSON (CI alternative)
 *
 * Presigned URL tests (getUrl, createPresignedUpload) require a service account
 * with the iam.serviceAccounts.signBlob permission.
 *
 * Run:
 *   GCS_TEST_BUCKET=my-bucket GCS_TEST_KEY_FILENAME=/path/key.json pnpm test:integration
 */

import { GCSStorageAdapter } from "./gcs-storage.adapter";

const TEST_BUCKET = process.env.GCS_TEST_BUCKET;

const suite = TEST_BUCKET ? describe : describe.skip;

suite("GCSStorageAdapter — integration", () => {
  const RUN_PREFIX = `better-media-test-${Date.now()}`;
  let adapter: GCSStorageAdapter;

  beforeAll(() => {
    const credentials = process.env.GCS_TEST_CREDENTIALS_JSON
      ? (JSON.parse(process.env.GCS_TEST_CREDENTIALS_JSON) as {
          client_email: string;
          private_key: string;
        })
      : undefined;

    adapter = new GCSStorageAdapter({
      bucket: TEST_BUCKET!,
      projectId: process.env.GCS_TEST_PROJECT_ID,
      keyFilename: process.env.GCS_TEST_KEY_FILENAME,
      credentials,
      basePrefix: RUN_PREFIX,
    });
  });

  afterAll(async () => {
    try {
      const { items } = await adapter.list("");
      if (items.length > 0) {
        await adapter.deleteMany(items.map((o) => o.key));
      }
    } catch {
      // best-effort — don't fail the suite on cleanup errors
    }
  }, 30_000);

  // ---------------------------------------------------------------------------
  // checkConnection
  // ---------------------------------------------------------------------------

  it("checkConnection returns true for a valid bucket", async () => {
    expect(await adapter.checkConnection()).toBe(true);
  }, 10_000);

  // ---------------------------------------------------------------------------
  // put / get / exists / delete
  // ---------------------------------------------------------------------------

  describe("put / get / exists / delete", () => {
    const key = "basic/hello.txt";
    const content = Buffer.from("hello, gcs integration!");

    afterAll(async () => {
      await adapter.delete(key).catch(() => {});
    }, 10_000);

    it("puts a file and gets it back as an equal buffer", async () => {
      await adapter.put(key, content);
      expect(await adapter.get(key)).toEqual(content);
    }, 15_000);

    it("exists returns true after put", async () => {
      expect(await adapter.exists(key)).toBe(true);
    }, 10_000);

    it("getSize returns the correct byte count", async () => {
      expect(await adapter.getSize!(key)).toBe(content.length);
    }, 10_000);

    it("getStream returns a readable stream with correct content", async () => {
      const stream = await adapter.getStream!(key);
      expect(stream).not.toBeNull();

      const chunks: Uint8Array[] = [];
      const reader = stream!.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }
      expect(Buffer.concat(chunks.map((c) => Buffer.from(c)))).toEqual(content);
    }, 15_000);

    it("get returns null for a missing key", async () => {
      expect(await adapter.get("does-not-exist-xyz")).toBeNull();
    }, 10_000);

    it("exists returns false for a missing key", async () => {
      expect(await adapter.exists("does-not-exist-xyz")).toBe(false);
    }, 10_000);

    it("delete removes the file", async () => {
      await adapter.delete(key);
      expect(await adapter.exists(key)).toBe(false);
    }, 15_000);

    it("delete is idempotent for a missing key", async () => {
      await expect(adapter.delete("already-gone-xyz")).resolves.toBeUndefined();
    }, 10_000);
  });

  // ---------------------------------------------------------------------------
  // copy / move
  // ---------------------------------------------------------------------------

  describe("copy / move", () => {
    const srcKey = "copy-move/source.txt";
    const dstKey = "copy-move/dest.txt";
    const content = Buffer.from("copy-move test content");

    beforeEach(async () => {
      await adapter.put(srcKey, content);
    }, 10_000);

    afterEach(async () => {
      await Promise.all([
        adapter.delete(srcKey).catch(() => {}),
        adapter.delete(dstKey).catch(() => {}),
      ]);
    }, 10_000);

    it("copy duplicates the file leaving the source intact", async () => {
      await adapter.copy!(srcKey, dstKey);
      expect(await adapter.exists(srcKey)).toBe(true);
      expect(await adapter.get(dstKey)).toEqual(content);
    }, 20_000);

    it("move removes the source and creates the destination", async () => {
      await adapter.move!(srcKey, dstKey);
      expect(await adapter.exists(srcKey)).toBe(false);
      expect(await adapter.get(dstKey)).toEqual(content);
    }, 20_000);
  });

  // ---------------------------------------------------------------------------
  // deleteMany
  // ---------------------------------------------------------------------------

  describe("deleteMany", () => {
    it("deletes multiple files in parallel", async () => {
      const keys = ["batch/a.txt", "batch/b.txt", "batch/c.txt"];
      await Promise.all(keys.map((k) => adapter.put(k, Buffer.from(k))));
      await adapter.deleteMany!(keys);
      for (const k of keys) {
        expect(await adapter.exists(k)).toBe(false);
      }
    }, 30_000);

    it("is a no-op for an empty array", async () => {
      await expect(adapter.deleteMany!([])).resolves.toBeUndefined();
    }, 5_000);
  });

  // ---------------------------------------------------------------------------
  // list
  // ---------------------------------------------------------------------------

  describe("list", () => {
    const listKeys = ["list/a.txt", "list/b.txt", "list/sub/c.txt"];

    beforeAll(async () => {
      await Promise.all(listKeys.map((k) => adapter.put(k, Buffer.from(k))));
    }, 15_000);

    afterAll(async () => {
      await adapter.deleteMany!(listKeys).catch(() => {});
    }, 15_000);

    it("returns all objects under the given prefix", async () => {
      const { items } = await adapter.list!("list/");
      const keys = items.map((o) => o.key).sort();
      expect(keys).toContain("list/a.txt");
      expect(keys).toContain("list/b.txt");
      expect(keys).toContain("list/sub/c.txt");
    }, 15_000);

    it("items include size, contentType, and lastModified", async () => {
      const { items } = await adapter.list!("list/a");
      const item = items.find((o) => o.key === "list/a.txt");
      expect(item).toBeDefined();
      expect(item!.size).toBeGreaterThan(0);
      expect(item!.lastModified).toBeInstanceOf(Date);
    }, 15_000);

    it("respects limit and returns a nextToken for subsequent pages", async () => {
      const first = await adapter.list!("list/", { limit: 2 });
      expect(first.items.length).toBe(2);
      expect(first.nextToken).toBeDefined();

      const second = await adapter.list!("list/", {
        limit: 10,
        continuationToken: first.nextToken,
      });
      expect(second.items.length).toBeGreaterThanOrEqual(1);
    }, 20_000);
  });

  // ---------------------------------------------------------------------------
  // getUrl — signed read URL
  // ---------------------------------------------------------------------------

  describe("getUrl", () => {
    const key = "url/readable.txt";
    const content = Buffer.from("signed-url-content");

    beforeAll(async () => {
      await adapter.put(key, content);
    }, 10_000);

    afterAll(async () => {
      await adapter.delete(key).catch(() => {});
    }, 10_000);

    it("returns an HTTPS signed URL", async () => {
      const url = await adapter.getUrl!(key);
      expect(url).toMatch(/^https:\/\//);
    }, 10_000);

    it("signed URL serves the correct content over HTTP", async () => {
      const url = await adapter.getUrl!(key);
      const response = await fetch(url);
      expect(response.ok).toBe(true);
      expect(Buffer.from(await response.arrayBuffer())).toEqual(content);
    }, 15_000);
  });

  // ---------------------------------------------------------------------------
  // createPresignedUpload — PUT
  // ---------------------------------------------------------------------------

  describe("createPresignedUpload PUT", () => {
    const key = "presigned/put-upload.bin";
    const content = Buffer.from("presigned-put-payload");
    const contentType = "application/octet-stream";

    afterAll(async () => {
      await adapter.delete(key).catch(() => {});
    }, 10_000);

    it("presigned PUT URL accepts the upload and content is retrievable", async () => {
      const result = await adapter.createPresignedUpload!(key, {
        method: "PUT",
        contentType,
        maxSizeBytes: content.length,
      });

      expect(result.method).toBe("PUT");
      expect(result.url).toMatch(/^https:\/\//);

      const response = await fetch(result.url, {
        method: "PUT",
        headers: result.headers,
        body: content,
      });
      expect(response.ok).toBe(true);

      expect(await adapter.get(key)).toEqual(content);
    }, 30_000);
  });

  // ---------------------------------------------------------------------------
  // createPresignedUpload — POST
  // ---------------------------------------------------------------------------

  describe("createPresignedUpload POST", () => {
    const key = "presigned/post-upload.bin";
    const content = Buffer.from("presigned-post-payload");
    const contentType = "application/octet-stream";

    afterAll(async () => {
      await adapter.delete(key).catch(() => {});
    }, 10_000);

    it("presigned POST policy accepts the upload and content is retrievable", async () => {
      const result = await adapter.createPresignedUpload!(key, {
        method: "POST",
        contentType,
        minSizeBytes: 1,
        maxSizeBytes: 1024 * 1024,
      });

      expect(result.method).toBe("POST");
      expect(result.url).toMatch(/^https:\/\//);

      // Policy fields must be appended before the file field
      const form = new FormData();
      for (const [field, value] of Object.entries(result.fields ?? {})) {
        form.append(field, value as string);
      }
      form.append("file", new Blob([content], { type: contentType }), "upload.bin");

      const response = await fetch(result.url, { method: "POST", body: form });
      // GCS returns 204 on a successful policy POST
      expect(response.status).toBe(204);

      expect(await adapter.get(key)).toEqual(content);
    }, 30_000);
  });
});
