import crypto from "node:crypto";
import type { ValidationPluginOptions } from "../options";
import type { ValidationErrorItem } from "../options";

export function validateChecksum(
  buffer: Buffer,
  metadata: Record<string, unknown>,
  opts: ValidationPluginOptions
): ValidationErrorItem[] {
  const errors: ValidationErrorItem[] = [];
  const cfg = opts.checksum;
  if (!cfg) return errors;

  const algo = cfg.algorithm;
  const expected = cfg.metadataKey != null ? metadata[cfg.metadataKey] : undefined;
  if (expected == null || typeof expected !== "string") {
    errors.push({
      rule: "checksum",
      message: `Expected checksum not found in metadata (key: ${cfg.metadataKey ?? "default"})`,
      details: { metadataKey: cfg.metadataKey },
    });
    return errors;
  }

  const hash = crypto.createHash(algo).update(buffer).digest("hex");
  const expectedNorm = expected.toLowerCase().trim();
  if (hash.toLowerCase() !== expectedNorm) {
    errors.push({
      rule: "checksum",
      message: `${algo} hash mismatch`,
      details: { expected: expectedNorm, computed: hash },
    });
  }

  return errors;
}
