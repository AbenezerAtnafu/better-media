import type { ValidationPluginOptions } from "../interfaces/options.interface";
import type { ValidationErrorItem } from "../interfaces/error-item.interface";

export function validateFileSize(
  buffer: Buffer,
  opts: ValidationPluginOptions
): ValidationErrorItem[] {
  const errors: ValidationErrorItem[] = [];
  const size = buffer.length;

  if (opts.minBytes != null && size < opts.minBytes) {
    errors.push({
      rule: "min-size",
      message: `File size ${size} bytes is below minimum ${opts.minBytes} bytes`,
      details: { size, minBytes: opts.minBytes },
    });
  }

  if (opts.maxBytes != null && size > opts.maxBytes) {
    errors.push({
      rule: "max-size",
      message: `File size ${size} bytes exceeds maximum ${opts.maxBytes} bytes`,
      details: { size, maxBytes: opts.maxBytes },
    });
  }

  return errors;
}
