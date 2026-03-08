import express from "express";
import { IntakeService, PipelineEngine } from "@better-media/sdk";
import { validationPlugin } from "@better-media/plugin-validation";

const app = express();
app.use(express.json());

const intakeService = new IntakeService();
const pipeline = new PipelineEngine();
pipeline.registerStep(validationPlugin);

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
    const status = await intakeService.handleUpload(fileKey);
    await pipeline.run(fileKey, { ...req.body.metadata });
    res.json({ success: true, fileKey, status });
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
