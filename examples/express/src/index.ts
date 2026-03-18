import express from "express";
import { createBetterMedia } from "better-media";
import { S3StorageConfig, S3StorageAdapter } from "@better-media/adapter-storage-s3";
import { memoryDatabase } from "@better-media/adapter-db";
import { validationPlugin } from "@better-media/plugin-validation";
import { virusScanPlugin, ClamScanner } from "@better-media/plugin-virus-scan";
import { mediaProcessingPlugin } from "@better-media/plugin-media-processing";

const media = createBetterMedia({
  storage: new S3StorageAdapter({
    accessKeyId: "",
    bucket: "",
  } as S3StorageConfig),
  database: memoryDatabase(),
  plugins: [
    validationPlugin(),
    virusScanPlugin({
      executionMode: "background",
      onFailure: "abort",
      scanner: new ClamScanner({
        clamdscan: { host: "127.0.0.1", port: 3310 },
      }),
      scanTimeoutMs: 30_000,
      retryOptions: { maxAttempts: 3, backoff: "exponential" },
    }),
    mediaProcessingPlugin(),
  ],
});

const app = express();
app.use(express.json());

app.get("/", (req, res) => {
  res.json({
    message: "Better Media + Express",
    endpoints: {
      "POST /upload/presign": "Generate S3 URL for direct upload",
      "POST /upload/complete": "Trigger processing after S3 upload",
    },
  });
});

// Step 1: Client requests a presigned URL to upload directly to S3
app.post("/upload/presign", async (req, res) => {
  try {
    const fileKey = req.body.fileKey ?? `file-${Date.now()}`;
    const contentType = req.body.contentType ?? "application/octet-stream";

    // Generate the URL (Does NOT trigger the validation/processing pipeline yet)
    const uploadUrl = await media.upload.presignedPutUrl(fileKey, { contentType });

    res.json({
      success: true,
      fileKey,
      uploadUrl,
      message: "Use this URL to upload the file directly to S3 via an HTTP PUT request.",
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

// Step 2: Client notifies the server that the direct S3 upload is finished
app.post("/upload/complete", async (req, res) => {
  try {
    const fileKey = req.body.fileKey;
    const metadata = req.body.metadata ?? {};

    if (!fileKey) {
      res.status(400).json({ success: false, error: "fileKey is required" });
      return;
    }

    // This downloads/streams it from S3 into the Better Media pipeline (Virus Scan, Validation, etc.)
    await media.upload.complete(fileKey, metadata);

    res.json({
      success: true,
      fileKey,
      message: "File processing pipeline completed successfully.",
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

const PORT = process.env.PORT ?? 3000;
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
