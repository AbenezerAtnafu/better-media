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
      "POST /upload": "Simulate a file upload",
    },
  });
});

app.post("/upload", async (req, res) => {
  try {
    const fileKey = req.body.fileKey ?? `file-${Date.now()}`;
    const metadata = req.body.metadata ?? {};
    await media.upload.multer(fileKey, metadata);
    res.json({ success: true, fileKey });
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
