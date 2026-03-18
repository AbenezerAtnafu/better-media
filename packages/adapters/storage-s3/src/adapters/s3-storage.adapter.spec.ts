import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { S3StorageAdapter } from "./s3-storage.adapter";
import type { S3StorageConfig } from "../interfaces/s3-storage-config.interface";

jest.mock("@aws-sdk/client-s3");
jest.mock("@aws-sdk/s3-request-presigner");

describe("S3StorageAdapter", () => {
  const mockConfig: S3StorageConfig = {
    region: "us-east-1",
    bucket: "test-bucket",
    accessKeyId: "test-key",
    secretAccessKey: "test-secret",
  };

  let adapter: S3StorageAdapter;
  let mockS3ClientSend: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    mockS3ClientSend = jest.fn();
    (S3Client as jest.Mock).mockImplementation(() => ({
      send: mockS3ClientSend,
    }));
    adapter = new S3StorageAdapter(mockConfig);
  });

  describe("get", () => {
    it("should return a Buffer when the object exists", async () => {
      async function* mockBody() {
        yield new Uint8Array([1, 2]);
        yield new Uint8Array([3, 4]);
      }
      mockS3ClientSend.mockResolvedValueOnce({ Body: mockBody() });

      const result = await adapter.get("test-key.txt");
      expect(result).toEqual(Buffer.from([1, 2, 3, 4]));
      expect(mockS3ClientSend).toHaveBeenCalledWith(expect.any(GetObjectCommand));
    });

    it("should return null when object is not found", async () => {
      const error = new Error("NoSuchKey");
      error.name = "NoSuchKey";
      mockS3ClientSend.mockRejectedValueOnce(error);

      const result = await adapter.get("missing.txt");
      expect(result).toBeNull();
    });

    it("should throw for non-404 errors", async () => {
      const error = new Error("InternalServerError");
      mockS3ClientSend.mockRejectedValueOnce(error);

      await expect(adapter.get("test-key.txt")).rejects.toThrow("InternalServerError");
    });
  });

  describe("put", () => {
    it("should upload a buffer successfully", async () => {
      mockS3ClientSend.mockResolvedValueOnce({});
      const buffer = Buffer.from("test content");

      await adapter.put("new-key.txt", buffer);
      expect(mockS3ClientSend).toHaveBeenCalledWith(expect.any(PutObjectCommand));
    });
  });

  describe("delete", () => {
    it("should delete an object successfully", async () => {
      mockS3ClientSend.mockResolvedValueOnce({});
      await adapter.delete("test-key.txt");
      expect(mockS3ClientSend).toHaveBeenCalledWith(expect.any(DeleteObjectCommand));
    });

    it("should not throw if the object is not found", async () => {
      const error = new Error("NoSuchKey");
      error.name = "NoSuchKey";
      mockS3ClientSend.mockRejectedValueOnce(error);

      await expect(adapter.delete("missing.txt")).resolves.not.toThrow();
    });
  });

  describe("exists", () => {
    it("should return true if head object succeeds", async () => {
      mockS3ClientSend.mockResolvedValueOnce({});
      const result = await adapter.exists("test-key.txt");
      expect(result).toBe(true);
      expect(mockS3ClientSend).toHaveBeenCalledWith(expect.any(HeadObjectCommand));
    });

    it("should return false if object is not found", async () => {
      const error = new Error("NotFound");
      error.name = "NotFound";
      mockS3ClientSend.mockRejectedValueOnce(error);

      const result = await adapter.exists("missing.txt");
      expect(result).toBe(false);
    });
  });

  describe("getSize", () => {
    it("should return ContentLength if head object succeeds", async () => {
      mockS3ClientSend.mockResolvedValueOnce({ ContentLength: 1024 });
      const result = await adapter.getSize("test-key.txt");
      expect(result).toBe(1024);
    });

    it("should return null if object is not found", async () => {
      const error = new Error("NotFound");
      error.name = "NotFound";
      mockS3ClientSend.mockRejectedValueOnce(error);

      const result = await adapter.getSize("missing.txt");
      expect(result).toBeNull();
    });
  });

  describe("getUrl", () => {
    it("should return a presigned URL", async () => {
      (getSignedUrl as jest.Mock).mockResolvedValueOnce("https://signed-url.example.com");

      const url = await adapter.getUrl("test-key.txt", { expiresIn: 300 });
      expect(url).toBe("https://signed-url.example.com");
      expect(getSignedUrl).toHaveBeenCalledWith(expect.anything(), expect.any(GetObjectCommand), {
        expiresIn: 300,
      });
    });
  });

  describe("createPresignedPutUrl", () => {
    it("should return a presigned URL for PUT operations", async () => {
      (getSignedUrl as jest.Mock).mockResolvedValueOnce("https://signed-put.example.com");

      const url = await adapter.createPresignedPutUrl("upload-key.txt");
      expect(url).toBe("https://signed-put.example.com");
      expect(getSignedUrl).toHaveBeenCalledWith(expect.anything(), expect.any(PutObjectCommand), {
        expiresIn: 3600,
      });
    });
  });

  describe("multiple buckets (resolver function)", () => {
    it("should resolve the correct bucket based on the key", async () => {
      const dynamicConfig: S3StorageConfig = {
        ...mockConfig,
        bucket: (key: string) => (key.startsWith("images/") ? "image-bucket" : "default-bucket"),
      };
      const dynamicAdapter = new S3StorageAdapter(dynamicConfig);
      mockS3ClientSend.mockResolvedValue({});

      await dynamicAdapter.exists("images/pic.png");
      expect(HeadObjectCommand).toHaveBeenCalledWith({
        Bucket: "image-bucket",
        Key: "images/pic.png",
      });

      await dynamicAdapter.exists("videos/vid.mp4");
      expect(HeadObjectCommand).toHaveBeenCalledWith({
        Bucket: "default-bucket",
        Key: "videos/vid.mp4",
      });
    });
  });
});
