import type { FileInfo, DatabaseAdapter } from "@better-media/core";
import type { ValidationPluginOptions } from "../interfaces/options.interface";
import type { ValidationErrorItem } from "../interfaces/error-item.interface";
import { validateFileType } from "./file-type";
import { validateFileSize } from "./file-size";
import { validateDimensions } from "./dimensions";
import { validateChecksum } from "./checksum";
import { validateChecksumUniqueness } from "./checksum-uniqueness";
import { runSecurityScan } from "./security-scanner";

export async function runValidators(
  buffer: Buffer,
  file: FileInfo,
  metadata: Record<string, unknown>,
  database: DatabaseAdapter,
  opts: ValidationPluginOptions
): Promise<ValidationErrorItem[]> {
  const allErrors: ValidationErrorItem[] = [];

  // 1. Mandatory Security Scan (Zero-Config OWASP Layer)
  // Scans filename and all metadata recursively for injection patterns.
  allErrors.push(...runSecurityScan(file.key, "fileKey"));
  if (file.originalName) {
    allErrors.push(...runSecurityScan(file.originalName, "filename"));
  }
  allErrors.push(...runSecurityScan(metadata, "metadata"));

  // 2. File-Specific Validators (Mandatory magic bytes/spoofing check by default)
  if (opts.allowedExtensions || opts.allowedMimeTypes || opts.useMagicBytes !== false) {
    allErrors.push(...(await validateFileType(buffer, file, metadata, opts)));
  }

  if (opts.minBytes || opts.maxBytes) {
    allErrors.push(...validateFileSize(buffer, opts));
  }

  if (opts.minWidth || opts.maxWidth || opts.minHeight || opts.maxHeight) {
    allErrors.push(...(await validateDimensions(buffer, opts)));
  }

  if (opts.checksum) {
    allErrors.push(...validateChecksum(buffer, metadata, opts));
  }

  if (opts.preventDuplicates) {
    allErrors.push(...(await validateChecksumUniqueness(buffer, file.key, database, opts)));
  }

  // 3. Custom Validators
  if (opts.customValidators) {
    for (const v of opts.customValidators) {
      const e = await v(buffer, metadata, file.key);
      allErrors.push(...e);
    }
  }

  return allErrors;
}

export const ValidatorService = {
  run: runValidators,
  scan: runSecurityScan,
};
