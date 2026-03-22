import { v4 as uuidv4 } from "uuid";
import path from "node:path";
import type { ValidationPluginOptions } from "../interfaces/options.interface";

export function sanitizeFilename(originalName: string, opts: ValidationPluginOptions): string {
  const safety = opts.filenameSafety ?? "sanitize";
  const ext = path.extname(originalName);
  const base = path.basename(originalName, ext);

  if (safety === "randomize") {
    return `${uuidv4()}${ext}`;
  }

  if (safety === "sanitize") {
    // OWASP: Strip unsafe characters (.., /, \, :, etc.)
    // Restrict to alphanumeric, hyphen, underscore, and dots.
    const sanitizedBase = base
      .replace(/[^a-zA-Z0-9_\-\s]/g, "")
      .replace(/\.\./g, "") // Prevent directory traversal
      .trim();

    const result = `${sanitizedBase}${ext}`;
    const maxLength = opts.maxFilenameLength ?? 255;

    return result.length > maxLength ? result.substring(0, maxLength) : result;
  }

  return originalName;
}
