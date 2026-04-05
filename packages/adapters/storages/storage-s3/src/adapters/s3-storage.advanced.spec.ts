import { Buffer } from "node:buffer";
import {
  S3Client,
  DeleteObjectCommand,
  ListObjectsV2Command,
  DeleteObjectsCommand,
  CopyObjectCommand,
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
} from "@aws-sdk/client-s3";
import { S3StorageAdapter } from "./s3-storage.adapter";
import type { S3StorageConfig } from "../interfaces/s3-storage-config.interface";

jest.mock("@aws-sdk/client-s3");
jest.mock("@aws-sdk/s3-request-presigner");

describe("S3StorageAdapter Advanced Methods", () => {
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

  describe("list", () => {
    it("should list objects successfully", async () => {
      mockS3ClientSend.mockResolvedValueOnce({
        Contents: [
          { Key: "file1.txt", Size: 100, LastModified: new Date() },
          { Key: "file2.txt", Size: 200, LastModified: new Date() },
        ],
        NextContinuationToken: "next-token",
      });

      const result = await adapter.list("prefix/");
      expect(result.items).toHaveLength(2);
      expect(result.items[0]?.key).toBe("file1.txt");
      expect(result.nextToken).toBe("next-token");
      expect(mockS3ClientSend).toHaveBeenCalledWith(expect.any(ListObjectsV2Command));
    });
  });

  describe("deleteMany", () => {
    it("should delete multiple objects", async () => {
      mockS3ClientSend.mockResolvedValueOnce({});
      await adapter.deleteMany(["key1", "key2"]);
      expect(mockS3ClientSend).toHaveBeenCalledWith(expect.any(DeleteObjectsCommand));
    });
  });

  describe("copy and move", () => {
    it("should copy an object", async () => {
      mockS3ClientSend.mockResolvedValueOnce({});
      await adapter.copy("source", "dest");
      expect(mockS3ClientSend).toHaveBeenCalledWith(expect.any(CopyObjectCommand));
    });

    it("should move an object (copy then delete)", async () => {
      mockS3ClientSend.mockResolvedValue({});
      await adapter.move("source", "dest");
      expect(mockS3ClientSend).toHaveBeenCalledWith(expect.any(CopyObjectCommand));
      expect(mockS3ClientSend).toHaveBeenCalledWith(expect.any(DeleteObjectCommand));
    });
  });

  describe("multipart upload", () => {
    it("should initiate multipart upload", async () => {
      mockS3ClientSend.mockResolvedValueOnce({ UploadId: "upload-id" });
      const multipart = await adapter.createMultiPart({ key: "large-file.zip" }, 5);
      expect(multipart.uploadId).toBe("upload-id");
      expect(multipart.maxPartNumber).toBe(5);
      expect(mockS3ClientSend).toHaveBeenCalledWith(expect.any(CreateMultipartUploadCommand));
    });

    it("should upload a part", async () => {
      mockS3ClientSend.mockResolvedValueOnce({ ETag: "etag-1" });
      const multipart = {
        bucket: "test-bucket",
        key: "large-file.zip",
        uploadId: "upload-id",
        lastPartNumber: 0,
        maxPartNumber: 5,
        parts: [],
      };
      const result = await adapter.putItemMultiPart(multipart, 1, Buffer.from("part content"));
      expect(result.parts).toHaveLength(1);
      expect(result.parts[0]?.eTag).toBe("etag-1");
      expect(mockS3ClientSend).toHaveBeenCalledWith(expect.any(UploadPartCommand));
    });

    it("should complete multipart upload", async () => {
      mockS3ClientSend.mockResolvedValueOnce({});
      await adapter.completeMultipart("large-file.zip", "upload-id", [
        { eTag: "etag-1", partNumber: 1, size: 100 },
      ]);
      expect(mockS3ClientSend).toHaveBeenCalledWith(expect.any(CompleteMultipartUploadCommand));
    });
  });
});
