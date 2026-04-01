import { type StorageAdapter, type DatabaseAdapter } from "@better-media/core";
import { createBetterMedia } from "./index";

describe("URL Reference Mode", () => {
  const mockStorage = {
    put: jest.fn().mockResolvedValue(undefined),
    get: jest.fn().mockResolvedValue(Buffer.from("")),
    delete: jest.fn().mockResolvedValue(undefined),
    createPresignedUpload: jest.fn(),
    getUrl: jest.fn(),
  };

  const mockDatabase = {
    create: jest.fn().mockResolvedValue(undefined),
    update: jest.fn().mockResolvedValue(undefined),
    findOne: jest.fn().mockResolvedValue(null),
    delete: jest.fn().mockResolvedValue(undefined),
  };

  const media = createBetterMedia({
    storage: mockStorage as unknown as StorageAdapter,
    database: mockDatabase as unknown as DatabaseAdapter,
    plugins: [],
  });

  it("should register a URL reference without calling storage.put", async () => {
    const url = "https://example.com/asset.test.png";
    const result = await media.upload.fromUrl(url, { mode: "reference" });

    expect(result.status).toBe("processed");
    expect(result.id).toBeDefined();

    // Verify storage.put was NOT called
    expect(mockStorage.put).not.toHaveBeenCalled();

    // Verify database.create was called with the referenceUrl in context
    expect(mockDatabase.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          storageKey: expect.any(String),
          context: expect.objectContaining({
            referenceUrl: url,
          }),
        }),
      })
    );
  });

  it("should correctly identify the extension from a reference URL", async () => {
    const url = "https://example.com/some/path/image.test.jpg?query=123";
    await media.upload.fromUrl(url, { mode: "reference" });

    // The executor should have set the extension to .jpg
    // Since we're using a real PipelineExecutor, we can check the database call
    expect(mockDatabase.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          filename: "image.test.jpg", // Derived from URL path if no filename provided
        }),
      })
    );
  });
});
