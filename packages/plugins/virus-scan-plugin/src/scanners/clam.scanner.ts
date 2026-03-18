import { Readable } from "node:stream";
import type { VirusScanner } from "../interfaces/scanner.interface";
import type { ScanResult } from "../interfaces/scan-result.interface";

/** ClamAV daemon connection options. */
export interface ClamScannerOptions {
  /** Remove infected files after detection. Default: false. */
  removeInfected?: boolean;
  /** Quarantine path for infected files. */
  quarantinePath?: string;
  /** Log scan output to console. Default: false. */
  debugMode?: boolean;
  /** Path to clamscan binary. */
  clamscanPath?: string;
  /** Path to clamdscan binary. */
  clamdscanPath?: string;
  /** ClamAV daemon connection settings. */
  clamdscan?: {
    /** Use clamd for scanning. Default: true. */
    active?: boolean;
    /** Daemon host. Default: "127.0.0.1". */
    host?: string;
    /** Daemon port. Default: 3310. */
    port?: number;
    /** Socket path (overrides host/port). */
    socket?: string;
    /** Connection timeout in ms. Default: 5000. */
    timeout?: number;
  };
}

interface ClamScanInstance {
  isInfected(filePath: string): Promise<{
    isInfected: boolean | null;
    viruses: string[];
  }>;
  scanStream(stream: Readable): Promise<{
    isInfected: boolean | null;
    viruses: string[];
  }>;
}

interface ClamScanConstructor {
  new (): { init(options: Record<string, unknown>): Promise<ClamScanInstance> };
}

/**
 * ClamAV implementation of the VirusScanner interface.
 * Wraps the `clamscan` npm package.
 */
export class ClamScanner implements VirusScanner {
  readonly name = "clamav";
  private instance: ClamScanInstance | null = null;
  private readonly options: ClamScannerOptions;

  constructor(options: ClamScannerOptions = {}) {
    this.options = options;
  }

  async init(): Promise<void> {
    if (this.instance) return;

    // Dynamic import to avoid hard dependency when using a different scanner
    const NodeClam = (await import("clamscan")).default as unknown as ClamScanConstructor;
    this.instance = await new NodeClam().init(this.buildClamConfig());
  }

  async scanBuffer(buffer: Buffer): Promise<ScanResult> {
    const scanner = await this.getScanner();
    const stream = Readable.from(buffer);
    const result = await scanner.scanStream(stream);

    return {
      infected: result.isInfected === true,
      viruses: result.viruses ?? [],
    };
  }

  async scanFile(filePath: string): Promise<ScanResult> {
    const scanner = await this.getScanner();
    const result = await scanner.isInfected(filePath);

    return {
      infected: result.isInfected === true,
      viruses: result.viruses ?? [],
    };
  }

  private async getScanner(): Promise<ClamScanInstance> {
    if (!this.instance) await this.init();
    return this.instance!;
  }

  private buildClamConfig(): Record<string, unknown> {
    return {
      removeInfected: this.options.removeInfected ?? false,
      quarantineInfected: this.options.quarantinePath ?? false,
      debugMode: this.options.debugMode ?? false,
      clamscan: {
        path: this.options.clamscanPath ?? "/usr/bin/clamscan",
      },
      clamdscan: {
        path: this.options.clamdscanPath ?? "/usr/bin/clamdscan",
        active: this.options.clamdscan?.active ?? true,
        host: this.options.clamdscan?.host ?? "127.0.0.1",
        port: this.options.clamdscan?.port ?? 3310,
        socket: this.options.clamdscan?.socket ?? null,
        timeout: this.options.clamdscan?.timeout ?? 5000,
      },
    };
  }
}
