export interface ValidationErrorItem {
  rule: string;
  message: string;
  details?: Record<string, unknown>;
}
