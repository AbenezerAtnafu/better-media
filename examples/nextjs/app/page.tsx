"use client";

import { useState } from "react";

export default function Home() {
  const [status, setStatus] = useState<string | null>(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [jobsLoading, setJobsLoading] = useState(false);

  async function handleSimulateUpload() {
    setUploadLoading(true);
    setStatus(null);
    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileKey: "example-file-123",
          metadata: { filename: "demo.mp4" },
        }),
      });
      const data = await res.json();
      setStatus(
        data.success
          ? `Upload done. Sync plugins ran. Background jobs queued.`
          : `Error: ${data.error}`
      );
    } catch (err) {
      setStatus(`Error: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setUploadLoading(false);
    }
  }

  async function handleProcessJobs() {
    setJobsLoading(true);
    setStatus(null);
    try {
      const res = await fetch("/api/process-jobs", { method: "POST" });
      const data = await res.json();
      setStatus(
        data.success
          ? `Processed ${data.processed} background job(s). Check server logs.`
          : `Error: ${data.error}`
      );
    } catch (err) {
      setStatus(`Error: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setJobsLoading(false);
    }
  }

  return (
    <main style={{ padding: "2rem", maxWidth: 600, margin: "0 auto" }}>
      <h1 style={{ marginBottom: "1rem" }}>Better Media + Next.js</h1>
      <p style={{ marginBottom: "1.5rem", color: "#666" }}>
        Sync plugins (validation, virus-scan) run during upload. Media processing runs in
        background.
      </p>
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
        <button
          onClick={handleSimulateUpload}
          disabled={uploadLoading}
          style={{
            padding: "0.5rem 1rem",
            fontSize: "1rem",
            cursor: uploadLoading ? "not-allowed" : "pointer",
            borderRadius: 4,
            border: "1px solid #333",
            background: "#fff",
          }}
        >
          {uploadLoading ? "Uploading..." : "1. Simulate Upload"}
        </button>
        <button
          onClick={handleProcessJobs}
          disabled={jobsLoading}
          style={{
            padding: "0.5rem 1rem",
            fontSize: "1rem",
            cursor: jobsLoading ? "not-allowed" : "pointer",
            borderRadius: 4,
            border: "1px solid #333",
            background: "#fff",
          }}
        >
          {jobsLoading ? "Processing..." : "2. Process background jobs"}
        </button>
      </div>
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
