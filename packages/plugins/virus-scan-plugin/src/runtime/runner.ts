import type {
  PipelineContext,
  ValidationResult,
  DatabaseAdapter,
  PluginApi,
} from "@better-media/core";
import type { VirusScanPluginOptions } from "../interfaces/options.interface";
import type { VirusScanner } from "../interfaces/scanner.interface";
import type { ScanRecord } from "../interfaces/scan-result.interface";

const SCAN_DB_KEY_PREFIX = "better-media:virus-scan:";

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Wrap a promise with a timeout.
 */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    promise.then(
      (val) => {
        clearTimeout(timer);
        resolve(val);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

async function recordScanResult(database: DatabaseAdapter, record: ScanRecord): Promise<void> {
  const model = "virus_scan_results";
  const id = `${SCAN_DB_KEY_PREFIX}${record.fileKey}`;
  const status = record.infected ? "infected" : "clean";

  const data = {
    mediaId: record.fileKey,
    status,
    threats: record.viruses,
    scanner: record.scannerName,
    createdAt: record.scannedAt,
  };

  const existing = await database.findOne({
    model,
    where: [{ field: "id", value: id }],
  });

  if (existing) {
    await database.update({
      model,
      where: [{ field: "id", value: id }],
      update: data,
    });
  } else {
    await database.create({
      model,
      data: { id, ...data },
    });
  }
}

/**
 * Execute the scan with retry logic for transient failures.
 */
async function scanWithRetry(
  scanner: VirusScanner,
  buffer: Buffer,
  tempPath: string | undefined,
  opts: VirusScanPluginOptions
): Promise<{ infected: boolean; viruses: string[] }> {
  const maxAttempts = opts.retryOptions?.maxAttempts ?? 3;
  const delayMs = opts.retryOptions?.delayMs ?? 1000;
  const backoff = opts.retryOptions?.backoff ?? "exponential";
  const timeoutMs = opts.scanTimeoutMs ?? 30_000;

  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const scanPromise = tempPath ? scanner.scanFile(tempPath) : scanner.scanBuffer(buffer);

      const result = await withTimeout(scanPromise, timeoutMs, "Virus scan");
      return { infected: result.infected, viruses: result.viruses };
    } catch (err: unknown) {
      lastError = err instanceof Error ? err : new Error(String(err));
      if (attempt < maxAttempts) {
        const wait =
          backoff === "exponential" ? delayMs * Math.pow(2, attempt - 1) : delayMs * attempt;
        await sleep(wait);
      }
    }
  }

  throw lastError ?? new Error("Virus scan failed after retries");
}

/**
 * Core virus scan runner. Called from the plugin's hook tap.
 */
export async function runVirusScan(
  context: PipelineContext,
  api: PluginApi,
  scanner: VirusScanner,
  opts: VirusScanPluginOptions
): Promise<void | ValidationResult> {
  const { file, database } = context;
  const fileKey = file.key;
  const fileContent = context.utilities?.fileContent;

  if (!fileContent || (!fileContent.buffer && !fileContent.tempPath)) {
    throw new Error(
      "Virus scan plugin requires fileContent (buffer or tempPath) to be available in context.utilities"
    );
  }

  // Prefer tempPath for scanFile; only read buffer when no tempPath is available
  const tempPath = fileContent.tempPath;
  const buffer = tempPath ? undefined : (fileContent.buffer ?? null);

  if (!buffer && !tempPath) {
    throw new Error("Unable to resolve file content for virus scanning");
  }

  const startTime = Date.now();
  let infected: boolean;
  let viruses: string[];

  try {
    const result = await scanWithRetry(
      scanner,
      buffer ?? Buffer.alloc(0), // scanWithRetry will use tempPath if available
      tempPath,
      opts
    );
    infected = result.infected;
    viruses = result.viruses;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    // Scanner failure is treated as an abort — we don't know if the file is safe
    return { valid: false, message: `Virus scan failed: ${message}` };
  }

  const durationMs = Date.now() - startTime;

  const scannedAt = new Date().toISOString();

  // Persist scan result to DB
  const record: ScanRecord = {
    fileKey,
    infected,
    viruses,
    scannedAt,
    scannerName: scanner.name,
    durationMs,
  };
  await recordScanResult(database, record);

  // Write scan metadata to plugin metadata via PluginApi
  api.emitMetadata({ infected, viruses, scannedAt });

  if (!infected) return;

  // Infected file — handle according to failure mode
  const failureMessage = `Virus detected in "${fileKey}": ${viruses.join(", ")}`;

  switch (opts.onFailure ?? "abort") {
    case "continue":
      return;
    case "custom":
      if (opts.onFailureCallback) {
        const customResult = await opts.onFailureCallback(fileKey, viruses);
        if (customResult && customResult.valid === false) return customResult;
      }
      return;
    case "abort":
    default:
      return { valid: false, message: failureMessage };
  }
}
