import fs from "node:fs/promises";
import type { VirusScanner } from "../interfaces/scanner.interface";
import type { ScanResult } from "../interfaces/scan-result.interface";

export interface VirusTotalScannerOptions {
  /** VirusTotal API Key */
  apiKey: string;
  /** Max time to poll for analysis completion in ms. Default: 120,000 (2 minutes) */
  pollingTimeoutMs?: number;
  /** Polling interval in ms. Default: 5000 (5 seconds) */
  pollingIntervalMs?: number;
}

/**
 * VirusTotal API v3 implementation of the VirusScanner interface.
 * Uses the native global `fetch` API available in Node 18+.
 */
export class VirusTotalScanner implements VirusScanner {
  readonly name = "virustotal";
  private readonly options: VirusTotalScannerOptions;

  constructor(options: VirusTotalScannerOptions) {
    if (!options.apiKey) {
      throw new Error("VirusTotalScanner requires an apiKey");
    }
    this.options = {
      pollingTimeoutMs: 120_000,
      pollingIntervalMs: 5_000,
      ...options,
    };
  }

  async init(): Promise<void> {
    // REST API doesn't require initialization connection
  }

  async scanBuffer(buffer: Buffer): Promise<ScanResult> {
    const blob = new Blob([new Uint8Array(buffer)]);
    return this.uploadAndAnalyze(blob, "upload.bin");
  }

  async scanFile(filePath: string): Promise<ScanResult> {
    const buffer = await fs.readFile(filePath);
    const blob = new Blob([new Uint8Array(buffer)]);
    const filename = filePath.split("/").pop() || "upload.bin";
    return this.uploadAndAnalyze(blob, filename);
  }

  private async uploadAndAnalyze(blob: Blob, filename: string): Promise<ScanResult> {
    const size = blob.size;
    let uploadUrl = "https://www.virustotal.com/api/v3/files";

    // VirusTotal v3 requires a special URL for files > 32MB
    if (size > 32 * 1024 * 1024) {
      const urlRes = await fetch("https://www.virustotal.com/api/v3/files/upload_url", {
        headers: { "x-apikey": this.options.apiKey },
      });
      if (!urlRes.ok) {
        throw new Error(`VirusTotal failed to get upload URL: ${urlRes.statusText}`);
      }
      const urlData = await urlRes.json();
      uploadUrl = urlData.data;
    }

    const formData = new FormData();
    formData.append("file", blob, filename);

    const uploadRes = await fetch(uploadUrl, {
      method: "POST",
      headers: { "x-apikey": this.options.apiKey },
      body: formData,
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text().catch(() => "");
      throw new Error(`VirusTotal upload failed: ${uploadRes.status} ${errText}`);
    }

    const uploadData = await uploadRes.json();
    const analysisId = uploadData.data.id;

    return this.pollAnalysis(analysisId);
  }

  private async pollAnalysis(analysisId: string): Promise<ScanResult> {
    const startTime = Date.now();
    const timeout = this.options.pollingTimeoutMs!;
    const interval = this.options.pollingIntervalMs!;

    while (Date.now() - startTime < timeout) {
      const res = await fetch(`https://www.virustotal.com/api/v3/analyses/${analysisId}`, {
        headers: { "x-apikey": this.options.apiKey },
      });

      if (!res.ok) {
        throw new Error(`VirusTotal polling failed: ${res.statusText}`);
      }

      const data = await res.json();
      const status = data.data.attributes.status;

      if (status === "completed") {
        const stats = data.data.attributes.stats;
        let infected = false;
        const viruses: string[] = [];

        if (stats.malicious > 0 || stats.suspicious > 0) {
          infected = true;
          const results = data.data.attributes.results;
          for (const [engine, info] of Object.entries<{ category: string; result: string | null }>(
            results
          )) {
            if (info.category === "malicious" || info.category === "suspicious") {
              viruses.push(`${engine}:${info.result}`);
            }
          }
        }

        return {
          infected,
          viruses,
          raw: data.data,
        };
      }

      // Wait interval before polling again
      await new Promise((resolve) => setTimeout(resolve, interval));
    }

    throw new Error(`VirusTotal scan timed out waiting for analysis ${analysisId} to complete`);
  }
}
