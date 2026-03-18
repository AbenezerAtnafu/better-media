import type { PipelinePlugin, MediaRuntime } from "@better-media/core";
import type { VirusScanPluginOptions } from "./interfaces/options.interface";
import { ClamScanner } from "./scanners/clam.scanner";
import { runVirusScan } from "./runtime/runner";

export type { VirusScanPluginOptions } from "./interfaces/options.interface";
export type { VirusScanner } from "./interfaces/scanner.interface";
export type { ScanResult, ScanRecord } from "./interfaces/scan-result.interface";
export { ClamScanner } from "./scanners/clam.scanner";
export type { ClamScannerOptions } from "./scanners/clam.scanner";
export { VirusTotalScanner } from "./scanners/virustotal.scanner";
export type { VirusTotalScannerOptions } from "./scanners/virustotal.scanner";

/**
 * Virus scan plugin for the Better Media pipeline.
 *
 * Scans uploaded files for malware using a configurable scanner engine.
 * Defaults to ClamAV via the built-in ClamScanner.
 *
 * @example
 * ```ts
 * import { virusScanPlugin } from "@better-media/plugin-virus-scan";
 *
 * // With defaults (ClamAV daemon on localhost:3310)
 * const plugin = virusScanPlugin();
 *
 * // With custom scanner
 * const plugin = virusScanPlugin({ scanner: myCustomScanner });
 * ```
 */
export function virusScanPlugin(opts: VirusScanPluginOptions = {}): PipelinePlugin {
  const executionMode = opts.executionMode ?? "background";
  const isBackground = executionMode === "background";
  const scanner = opts.scanner ?? new ClamScanner();

  return {
    name: "virus-scan",
    executionMode,
    intensive: isBackground,

    apply(runtime: MediaRuntime) {
      // Initialize scanner eagerly on first apply
      let initPromise: Promise<void> | null = null;

      runtime.hooks["scan:run"].tap(
        "virus-scan",
        async (context) => {
          // Lazy init — only once across all invocations
          if (!initPromise) {
            initPromise = scanner.init();
          }
          await initPromise;

          return runVirusScan(context, scanner, opts);
        },
        { mode: executionMode }
      );
    },
  };
}
