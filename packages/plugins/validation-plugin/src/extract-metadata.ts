import crypto from "node:crypto";
import { fileTypeFromBuffer } from "file-type";
import type { PipelineContext, TrustedMetadata } from "@better-media/core";
import type { ValidationPluginOptions } from "./interfaces/options.interface";

/**
 * Extract critical metadata from file buffer.
 * Returns a TrustedMetadata patch.
 */
export async function extractMetadataFromBuffer(
  buffer: Buffer,
  context: PipelineContext,
  opts: ValidationPluginOptions
): Promise<TrustedMetadata> {
  const extract = opts.extractMetadata !== false;

  if (!extract) {
    return {};
  }

  const patch: TrustedMetadata = {
    file: {},
    checksums: {},
  };

  const { trusted } = context;

  // Size: set if not already present
  if (trusted.file?.size == null) {
    patch.file!.size = buffer.length;
  }

  // MIME type and Extension: set if not already present; from magic bytes
  if (trusted.file?.mimeType == null || trusted.file?.extension == null) {
    const ft = await fileTypeFromBuffer(buffer);
    if (ft) {
      if (trusted.file?.mimeType == null) patch.file!.mimeType = ft.mime;
      if (trusted.file?.extension == null) {
        // Ensure extension has a leading dot
        patch.file!.extension = ft.ext.startsWith(".") ? ft.ext : `.${ft.ext}`;
      }
    }
  }

  // Checksums: set if not already present
  const algorithms = opts.extractChecksums ?? ["sha256"];
  for (const algo of algorithms) {
    if (algo === "sha256" && trusted.checksums?.sha256 == null) {
      patch.checksums!.sha256 = crypto.createHash("sha256").update(buffer).digest("hex");
    } else if (algo === "md5" && trusted.checksums?.md5 == null) {
      patch.checksums!.md5 = crypto.createHash("md5").update(buffer).digest("hex");
    }
  }

  return patch;
}
