"use client";

import { useState } from "react";
import { IntakeService, PipelineEngine } from "@better-media/sdk";
import { validationPlugin } from "@better-media/plugin-validation";

const intakeService = new IntakeService();
const pipeline = new PipelineEngine();
pipeline.registerStep(validationPlugin);

export default function Home() {
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSimulateUpload() {
    setLoading(true);
    setStatus(null);
    try {
      const result = await intakeService.handleUpload("example-file-123");
      await pipeline.run("example-file-123", { filename: "demo.mp4" });
      setStatus(result);
    } catch (err) {
      setStatus(`Error: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ padding: "2rem", maxWidth: 600, margin: "0 auto" }}>
      <h1 style={{ marginBottom: "1rem" }}>Better Media + Next.js</h1>
      <p style={{ marginBottom: "1.5rem", color: "#666" }}>
        This example demonstrates integrating the Better Media framework with a Next.js application.
      </p>
      <button
        onClick={handleSimulateUpload}
        disabled={loading}
        style={{
          padding: "0.5rem 1rem",
          fontSize: "1rem",
          cursor: loading ? "not-allowed" : "pointer",
          borderRadius: 4,
          border: "1px solid #333",
          background: "#fff",
        }}
      >
        {loading ? "Processing..." : "Simulate Upload"}
      </button>
      {status && (
        <p
          style={{ marginTop: "1rem", padding: "0.75rem", background: "#f5f5f5", borderRadius: 4 }}
        >
          Status: <strong>{status}</strong>
        </p>
      )}
    </main>
  );
}
