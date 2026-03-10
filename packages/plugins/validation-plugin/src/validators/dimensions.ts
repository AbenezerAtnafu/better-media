import { imageSize } from "image-size";
import type { ValidationPluginOptions } from "../interfaces/options.interface";
import type { ValidationErrorItem } from "../interfaces/error-item.interface";

export function validateDimensions(
  buffer: Buffer,
  opts: ValidationPluginOptions
): ValidationErrorItem[] {
  const errors: ValidationErrorItem[] = [];
  const dims = imageSize(buffer);

  if (!dims || !dims.width || !dims.height) {
    // Not an image or unsupported format - skip dimension checks
    return errors;
  }

  const { width, height } = dims;

  if (opts.minWidth != null && width < opts.minWidth) {
    errors.push({
      rule: "min-width",
      message: `Image width ${width}px is below minimum ${opts.minWidth}px`,
      details: { width, minWidth: opts.minWidth },
    });
  }

  if (opts.maxWidth != null && width > opts.maxWidth) {
    errors.push({
      rule: "max-width",
      message: `Image width ${width}px exceeds maximum ${opts.maxWidth}px`,
      details: { width, maxWidth: opts.maxWidth },
    });
  }

  if (opts.minHeight != null && height < opts.minHeight) {
    errors.push({
      rule: "min-height",
      message: `Image height ${height}px is below minimum ${opts.minHeight}px`,
      details: { height, minHeight: opts.minHeight },
    });
  }

  if (opts.maxHeight != null && height > opts.maxHeight) {
    errors.push({
      rule: "max-height",
      message: `Image height ${height}px exceeds maximum ${opts.maxHeight}px`,
      details: { height, maxHeight: opts.maxHeight },
    });
  }

  return errors;
}
