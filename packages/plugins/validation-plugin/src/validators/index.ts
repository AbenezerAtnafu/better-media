import type { ValidationPluginOptions, ValidationErrorItem } from "../options";
import { validateFileType } from "./file-type";
import { validateFileSize } from "./file-size";
import { validateDimensions } from "./dimensions";
import { validateChecksum } from "./checksum";

export async function runValidators(
  buffer: Buffer,
  fileKey: string,
  metadata: Record<string, unknown>,
  opts: ValidationPluginOptions
): Promise<ValidationErrorItem[]> {
  const allErrors: ValidationErrorItem[] = [];

  if (opts.allowedExtensions || opts.allowedMimeTypes || opts.useMagicBytes) {
    allErrors.push(...(await validateFileType(buffer, fileKey, metadata, opts)));
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
      const customErrors = await fn(buffer, metadata, fileKey);
      allErrors.push(...customErrors);
    }
  }

  return allErrors;
}
