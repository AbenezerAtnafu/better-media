import crypto from "node:crypto";
import type { DatabaseAdapter } from "@better-media/core";
import type { ValidationPluginOptions } from "../interfaces/options.interface";
import type { ValidationErrorItem } from "../interfaces/error-item.interface";

export async function validateChecksumUniqueness(
  buffer: Buffer,
  fileKey: string,
  database: DatabaseAdapter,
  opts: ValidationPluginOptions
): Promise<ValidationErrorItem[]> {
  const errors: ValidationErrorItem[] = [];
  const cfg = opts.preventDuplicates;
  if (!cfg) return errors;

  // Authoritative uniqueness check must use the same algorithm as the media table (sha256)
  const algo = "sha256";
  const hash = crypto.createHash(algo).update(buffer).digest("hex");

  const existing = await database.findOne({
    model: "media",
    where: [{ field: "checksum", value: hash }],
  });

  if (existing && existing.id !== fileKey) {
    errors.push({
      rule: "duplicate-content",
      message: `File with same ${algo} checksum already exists: ${existing.id}`,
      details: { duplicateId: existing.id, checksum: hash, algorithm: algo },
    });
  }

  return errors;
}
