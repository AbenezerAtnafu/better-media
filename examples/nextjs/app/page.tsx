"use client";

import { useRef, useState } from "react";

type DemoState = {
  media: unknown[];
  media_versions: unknown[];
} | null;

function delay(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

export default function Home() {
  const [status, setStatus] = useState<string | null>(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const [mediaId, setMediaId] = useState<string | null>(null);
  const [demo, setDemo] = useState<DemoState>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function refreshDemo(id: string | null) {
    setDemoLoading(true);
    try {
      const q = id ? `?mediaId=${encodeURIComponent(id)}` : "";
      const res = await fetch(`/api/media-demo${q}`);
      const data = await res.json();
      if (res.ok) setDemo(data);
      else setStatus(`Demo API error: ${data.error ?? res.statusText}`);
    } catch (err) {
      setStatus(`Demo API error: ${err instanceof Error ? err.message : "Unknown"}`);
    } finally {
      setDemoLoading(false);
    }
  }

  async function handleRealUpload() {
    const input = fileInputRef.current;
    const file = input?.files?.[0];
    if (!file) {
      setStatus("Choose an image file first.");
      return;
    }

    setUploadLoading(true);
    setStatus(null);
    setDemo(null);
    try {
      const form = new FormData();
      form.append("file", file);

      const res = await fetch("/api/upload", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (data.success && data.mediaId) {
        setMediaId(data.mediaId);
        setStatus(
          `Uploaded ${file.name} (${file.size} bytes) → mediaId=${data.mediaId}. Loading DB snapshot…`
        );
        await delay(300);
        await refreshDemo(data.mediaId);
      } else {
        setStatus(`Error: ${data.error}`);
      }
    } catch (err) {
      setStatus(`Error: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setUploadLoading(false);
    }
  }

  async function handleSimulateUpload(simulateFail = false) {
    setUploadLoading(true);
    setStatus(null);
    setDemo(null);
    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileKey: `photo-${Date.now()}.jpg`,
          metadata: { contentType: "image/jpeg" },
          simulateValidationFail: simulateFail,
        }),
      });
      const data = await res.json();
      if (data.success && data.mediaId) {
        setMediaId(data.mediaId);
        setStatus(
          `Upload ingested (mediaId=${data.mediaId}). Default job adapter runs background plugins in-process after the request; waiting a moment, then loading DB snapshot…`
        );
        await delay(250);
        await refreshDemo(data.mediaId);
      } else {
        setStatus(`Error: ${data.error}`);
      }
    } catch (err) {
      setStatus(`Error: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setUploadLoading(false);
    }
  }

  return (
    <main style={{ padding: "2rem", maxWidth: 720, margin: "0 auto" }}>
      <h1 style={{ marginBottom: "1rem" }}>Better Media + Next.js</h1>
      <p style={{ marginBottom: "1rem", color: "#666" }}>
        This app uses the framework&apos;s <strong>default job adapter</strong> (in-process
        <code> setImmediate</code> processor). Background plugins are <strong>not</strong> a manual
        “drain the queue” step — that was only an older demo pattern. Production often uses
        Redis/SQS + workers calling <code>runBackgroundJob</code>.
      </p>
      <p style={{ marginBottom: "1.5rem", color: "#666" }}>
        <strong>Validation</strong> and <strong>virus-scan</strong> run <strong>sync</strong> during
        the pipeline (required by hook contracts). <strong>Media processing</strong> runs as a
        background <code>process:run</code> job (no-op virus scanner here). Thumbnails under{" "}
        <code>versions/&lt;mediaId&gt;/thumb-*.webp</code> and <code>media_versions</code> rows need{" "}
        <code>sharp</code>.
      </p>

      <section
        style={{
          marginBottom: "1.5rem",
          padding: "1rem",
          border: "1px solid #ccc",
          borderRadius: 8,
          background: "#fafafa",
        }}
      >
        <h2 style={{ margin: "0 0 0.5rem", fontSize: "1.1rem" }}>Upload a real image</h2>
        <p style={{ margin: "0 0 0.75rem", color: "#555", fontSize: "0.95rem" }}>
          JPEG, PNG, or WebP from your machine (same limits as validation:{" "}
          <code>maxBytes 10MB</code>, width/height bounds). Inspect the JSON for{" "}
          <code>media_versions</code> storage keys.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            disabled={uploadLoading}
          />
          <button
            type="button"
            onClick={handleRealUpload}
            disabled={uploadLoading}
            style={{
              padding: "0.5rem 1rem",
              fontSize: "1rem",
              cursor: uploadLoading ? "not-allowed" : "pointer",
              borderRadius: 4,
              border: "1px solid #0a0",
              background: "#e8f5e9",
            }}
          >
            {uploadLoading ? "Uploading…" : "Upload file"}
          </button>
        </div>
      </section>

      <p style={{ marginBottom: "0.5rem", color: "#888", fontSize: "0.9rem" }}>
        Or use the tiny synthetic JPEG (no file picker):
      </p>
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
        <button
          type="button"
          onClick={() => handleSimulateUpload(false)}
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
          {uploadLoading ? "Uploading..." : "Simulate upload (valid JPEG)"}
        </button>
        <button
          type="button"
          onClick={() => handleSimulateUpload(true)}
          disabled={uploadLoading}
          style={{
            padding: "0.5rem 1rem",
            fontSize: "1rem",
            cursor: uploadLoading ? "not-allowed" : "pointer",
            borderRadius: 4,
            border: "1px solid #c00",
            background: "#fff",
            color: "#c00",
          }}
        >
          {uploadLoading ? "..." : "Simulate validation failure"}
        </button>
        <button
          type="button"
          onClick={() => refreshDemo(mediaId)}
          disabled={demoLoading}
          style={{
            padding: "0.5rem 1rem",
            fontSize: "1rem",
            cursor: demoLoading ? "not-allowed" : "pointer",
            borderRadius: 4,
            border: "1px solid #06c",
            background: "#f0f8ff",
          }}
        >
          {demoLoading ? "Loading..." : "Inspect DB (media + versions)"}
        </button>
      </div>
      {status && (
        <p
          style={{ marginTop: "1rem", padding: "0.75rem", background: "#f5f5f5", borderRadius: 4 }}
        >
          Status: <strong>{status}</strong>
        </p>
      )}
      {demo && (
        <pre
          style={{
            marginTop: "1rem",
            padding: "0.75rem",
            background: "#1e1e1e",
            color: "#d4d4d4",
            borderRadius: 4,
            fontSize: 12,
            overflow: "auto",
            maxHeight: 360,
          }}
        >
          {JSON.stringify(demo, null, 2)}
        </pre>
      )}
    </main>
  );
}
