import { fileTypeFromBuffer } from "file-type";
import path from "node:path";
import { type FileInfo, EXTENSION_TO_MIME_MAP } from "@better-media/core";
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

  // Detect MIME via magic bytes
  let detectedMime: string | undefined;
  let magicMime: string | undefined;

  const useMagicBytes = opts.useMagicBytes !== false;

  if (useMagicBytes) {
    const ft = await fileTypeFromBuffer(buffer);
    magicMime = ft?.mime;

    if (!magicMime && opts.allowedMimeTypes && opts.allowedMimeTypes.length > 0) {
      errors.push({
        rule: "magic-bytes",
        message: "Could not detect MIME type from file content (magic bytes)",
        details: { fileKey: file.key },
      });
    }

    // OWASP: Spoofing detection (Magic bytes vs Extension)
    if (ext) {
      const allowedMimes = EXTENSION_TO_MIME_MAP[ext];

      if (allowedMimes) {
        if (!magicMime) {
          // Failure to detect magic bytes for a known binary extension is a threat.
          // However, for generic types like text/plain or octet-stream, magic bytes are often absent.
          const isGeneric = allowedMimes.some(
            (m: string) => m === "application/octet-stream" || m === "text/plain"
          );

          if (!isGeneric) {
            errors.push({
              rule: "mime-spoof",
              message: `MIME spoofing detected: file content does not match expected ${ext} format`,
              details: { extension: ext, magicMime: "none" },
            });
          }
        } else if (!allowedMimes.includes(magicMime)) {
          errors.push({
            rule: "mime-spoof",
            message: `MIME spoofing detected: content is ${magicMime} but extension is ${ext}`,
            details: { extension: ext, magicMime },
          });
        }
      }
    }

    detectedMime = magicMime;
  }

  // Fallback to metadata if magic bytes not used or failed
  if (!detectedMime) {
    const metaMime =
      file.mimeType ?? metadata.contentType ?? metadata.mimeType ?? metadata["content-type"];
    detectedMime = typeof metaMime === "string" ? metaMime : undefined;
  }

  if (opts.allowedMimeTypes && opts.allowedMimeTypes.length > 0) {
    if (detectedMime && !opts.allowedMimeTypes.includes(detectedMime)) {
      errors.push({
        rule: "mime-type",
        message: `MIME type ${detectedMime} not allowed. Allowed: ${opts.allowedMimeTypes.join(", ")}`,
        details: { mime: detectedMime, allowedMimeTypes: opts.allowedMimeTypes },
      });
    } else if (!detectedMime) {
      errors.push({
        rule: "mime-type-missing",
        message: "MIME type could not be determined for validation",
        details: { fileKey: file.key },
      });
    }
  }

  return errors;
}
