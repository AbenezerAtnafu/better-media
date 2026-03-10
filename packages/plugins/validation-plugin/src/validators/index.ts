import type { FileInfo } from "@better-media/core";
import type { ValidationPluginOptions } from "../interfaces/options.interface";
import type { ValidationErrorItem } from "../interfaces/error-item.interface";
import { validateFileType } from "./file-type";
import { validateFileSize } from "./file-size";
import { validateDimensions } from "./dimensions";
import { validateChecksum } from "./checksum";

export async function runValidators(
  buffer: Buffer,
  file: FileInfo,
  metadata: Record<string, unknown>,
  opts: ValidationPluginOptions
): Promise<ValidationErrorItem[]> {
  const allErrors: ValidationErrorItem[] = [];

  if (opts.allowedExtensions || opts.allowedMimeTypes || opts.useMagicBytes) {
    allErrors.push(...(await validateFileType(buffer, file, metadata, opts)));
  }

  if (opts.minBytes != null || opts.maxBytes != null) {
    allErrors.push(...validateFileSize(buffer, opts));
  }

  if (
    opts.minWidth != null ||
    opts.maxWidth != null ||
    opts.minHeight != null ||
    opts.maxHeight != null
  ) {
    allErrors.push(...validateDimensions(buffer, opts));
  }

  if (opts.checksum) {
    allErrors.push(...validateChecksum(buffer, metadata, opts));
  }

  if (opts.customValidators && opts.customValidators.length > 0) {
    for (const fn of opts.customValidators) {
      const customErrors = await fn(buffer, metadata, file.key);
      allErrors.push(...customErrors);
    }
  }

  return allErrors;
}
