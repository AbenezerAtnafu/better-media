import express from "express";
import multer from "multer";
import os from "node:os";
import { Queue } from "bullmq";
import { createBullBoard } from "@bull-board/api";
import { BullMQAdapter } from "@bull-board/api/bullMQAdapter";
import { ExpressAdapter } from "@bull-board/express";

import { media } from "../media.config";

const PORT = process.env.PORT ?? 6000;

const app = express();
app.use(express.json());

// Bull Board queue monitoring — available at /admin/queues when Redis is configured
if (process.env.REDIS_URL ?? process.env.REDIS_HOST) {
  const connection = {
    host: process.env.REDIS_HOST ?? "localhost",
    port: Number(process.env.REDIS_PORT ?? 6379),
  };
  const monitorQueue = new Queue("better-media:background", { connection });
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath("/admin/queues");
  createBullBoard({ queues: [new BullMQAdapter(monitorQueue)], serverAdapter });
  app.use("/admin/queues", serverAdapter.getRouter());
  console.log(`[server] Bull Board available at http://localhost:${PORT}/admin/queues`);
}

const upload = multer({ dest: os.tmpdir() });

// Serve the uploads directory statically to test filesystem storage
app.use("/uploads", express.static("uploads"));

app.get("/", (req, res) => {
  res.json({
    message: "Better Media + Express",
    endpoints: {
      "POST /upload/binary": "Upload raw binary file (image/jpeg) to filesystem",
      "POST /upload/presign": "Generate S3 URL for direct upload",
      "POST /upload/complete": "Trigger processing after S3 upload",
      "GET /uploads/:fileKey": "Access uploaded files (filesystem)",
    },
  });
});

// --- 1. The Canonical Upload (Multipart with Multer) ---
// See how Better Media orchestrates taking the tmp file from Multer and storing it.
app.post("/upload/multipart", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, error: "No file uploaded" });
      return;
    }

    // Layer 6: Handing off to Better Media's Ingest core (default deletes Multer's temp path).
    const result = await media.upload.ingest({
      file: { path: req.file.path },
      metadata: {
        filename: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
      },
    });

    res.json({
      success: true,
      ...result,
      url: (result as { url?: string }).url ?? `http://localhost:${PORT}/uploads/${result.key}`,
      message: "File ingested from Multer and processed successfully.",
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

// --- 2. The Convenience Upload (Raw Binary via Buffer) ---
app.post("/upload/binary", express.raw({ type: "*/*", limit: "10mb" }), async (req, res) => {
  try {
    const fileKey = (req.headers["x-file-key"] as string) ?? `file-${Date.now()}`;
    const contentType = (req.headers["content-type"] as string) ?? "application/octet-stream";

    // Ensure the body was parsed as raw binary
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      res.status(400).json({
        success: false,
        error: "Body must be binary data. Make sure to send raw binary content.",
      });
      return;
    }

    // Layer 6: Handing off a raw Buffer to Better Media via Convenience Helper
    const result = await media.upload.fromBuffer(req.body, {
      key: fileKey,
      metadata: { mimeType: contentType },
    });

    res.json({
      success: true,
      ...result,
      url: (result as { url?: string }).url ?? `http://localhost:${PORT}/uploads/${result.key}`,
      message: "Buffer directly ingested and processed successfully.",
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

// Step 1: Client requests a presigned URL to upload directly to S3
app.post("/upload/presign", async (req, res) => {
  try {
    const fileKey = req.body.fileKey ?? `file-${Date.now()}`;
    const contentType = req.body.contentType ?? "application/octet-stream";

    // Generate the URL (Does NOT trigger the validation/processing pipeline yet)
    const result = await media.upload.requestPresignedUpload(fileKey, {
      method: req.body.method ?? "PUT",
      contentType,
      maxSizeBytes: req.body.maxSizeBytes,
    });

    res.json({
      success: true,
      fileKey,
      ...result,
      message:
        result.method === "PUT"
          ? "Use this URL to upload the file directly to S3 via an HTTP PUT request with the specified headers."
          : "Use this URL and form fields to upload via a multipart/form-data POST request.",
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
    const result = await media.upload.complete(fileKey, metadata);

    res.json({
      success: true,
      ...result,
      message: "File processing pipeline completed successfully.",
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err instanceof Error ? err.message : "Unknown error",
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
