import crypto from "node:crypto";
import { fileTypeFromBuffer } from "file-type";
import type { PipelineContext } from "@better-media/core";
import type { ValidationPluginOptions } from "./interfaces/options.interface";

/**
 * Extract critical metadata from file buffer into context.trusted.
 * First-writer-wins: only set values not already present.
 */
export async function extractMetadataFromBuffer(
  buffer: Buffer,
  context: PipelineContext,
  opts: ValidationPluginOptions
): Promise<void> {
  const extract = opts.extractMetadata !== false;
  if (!extract) return;

  const { trusted } = context;
  trusted.file ??= {};
  trusted.checksums ??= {};

  // Size: set if not already present
  if (trusted.file.size == null) {
    trusted.file.size = buffer.length;
  }

  // MIME type: set if not already present; from magic bytes
  if (trusted.file.mimeType == null) {
    const ft = await fileTypeFromBuffer(buffer);
    trusted.file.mimeType = ft?.mime;
  }

  // Checksums: set if not already present
  const algorithms = opts.extractChecksums ?? ["sha256"];
  for (const algo of algorithms) {
    if (algo === "sha256" && trusted.checksums.sha256 == null) {
      trusted.checksums.sha256 = crypto.createHash("sha256").update(buffer).digest("hex");
    } else if (algo === "md5" && trusted.checksums.md5 == null) {
      trusted.checksums.md5 = crypto.createHash("md5").update(buffer).digest("hex");
    }
  }
}
