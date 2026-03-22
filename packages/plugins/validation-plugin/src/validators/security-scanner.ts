import { ValidationErrorItem } from "../interfaces/error-item.interface";

/**
 * OWASP-level patterns for mandatory injection detection.
 */
const INJECTION_PATTERNS = [
  /(%27)|(')|(--)|(%23)|(#)/i, // SQL basics
  /(<script)/i, // XSS basics
  /(\$where)/i, // NoSQL basics
  /(%|\\x)[0-9a-f]{2}/i, // Malicious encoding
];

/**
 * Recursively scan objects, arrays, and strings for mandatory OWASP security threats.
 * Achieve Zero-Config security by scanning everything passed into the plugin.
 */
export function runSecurityScan(value: unknown, path: string = "root"): ValidationErrorItem[] {
  const errors: ValidationErrorItem[] = [];

  if (typeof value === "string") {
    if (INJECTION_PATTERNS.some((p) => p.test(value))) {
      errors.push({
        rule: "security-threat",
        message: `Suspicious activity detected in ${path}`,
        details: { path, value: value.length > 50 ? `${value.substring(0, 50)}...` : value },
      });
    }
  } else if (Array.isArray(value)) {
    value.forEach((item, index) => {
      errors.push(...runSecurityScan(item, `${path}[${index}]`));
    });
  } else if (value !== null && typeof value === "object") {
    Object.entries(value).forEach(([key, val]) => {
      errors.push(...runSecurityScan(val, `${path}.${key}`));
    });
  }

  return errors;
}
