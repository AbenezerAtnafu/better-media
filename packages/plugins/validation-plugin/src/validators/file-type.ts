import { fileTypeFromBuffer } from "file-type";
import path from "node:path";
import type { FileInfo } from "@better-media/core";
import type { ValidationPluginOptions } from "../interfaces/options.interface";
import type { ValidationErrorItem } from "../interfaces/error-item.interface";

export async function validateFileType(
  buffer: Buffer,
  file: FileInfo,
  metadata: Record<string, unknown>,
  opts: ValidationPluginOptions
): Promise<ValidationErrorItem[]> {
  const errors: ValidationErrorItem[] = [];
  const ext = path.extname(file.key).toLowerCase();

  if (opts.allowedExtensions && opts.allowedExtensions.length > 0) {
    const allowed = opts.allowedExtensions.map((e) => e.toLowerCase().replace(/^\.?/, "."));
    if (!allowed.includes(ext)) {
      errors.push({
        rule: "extension",
        message: `Extension ${ext} not allowed. Allowed: ${allowed.join(", ")}`,
        details: { extension: ext, allowedExtensions: opts.allowedExtensions },
      });
    }
  }

  let detectedMime: string | undefined;
  if (opts.useMagicBytes) {
    const ft = await fileTypeFromBuffer(buffer);
    detectedMime = ft?.mime;
    if (!detectedMime && opts.allowedMimeTypes && opts.allowedMimeTypes.length > 0) {
      errors.push({
        rule: "magic-bytes",
        message: "Could not detect MIME type from file content (magic bytes)",
        details: { fileKey: file.key },
      });
    }
  } else {
    // Prefer structured file.mimeType, fallback to legacy metadata keys
    const metaMime =
      file.mimeType ?? metadata.contentType ?? metadata.mimeType ?? metadata["content-type"];
    detectedMime = typeof metaMime === "string" ? metaMime : undefined;
  }

  if (opts.allowedMimeTypes && opts.allowedMimeTypes.length > 0 && detectedMime) {
    if (!opts.allowedMimeTypes.includes(detectedMime)) {
      errors.push({
        rule: "mime-type",
        message: `MIME type ${detectedMime} not allowed. Allowed: ${opts.allowedMimeTypes.join(", ")}`,
        details: { mime: detectedMime, allowedMimeTypes: opts.allowedMimeTypes },
      });
    }
  }

  return errors;
}
