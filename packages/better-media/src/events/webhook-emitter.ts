import { createHmac } from "node:crypto";

/**
 * Calls an optional event handler and swallows any errors it throws.
 * Ensures event handler failures never propagate into the pipeline.
 * Overloaded to support both single-argument and two-argument callbacks.
 */
export async function safeEmit<T>(
  fn: ((arg: T) => void | Promise<void>) | undefined,
  arg: T
): Promise<void>;
export async function safeEmit<T, U>(
  fn: ((a: T, b: U) => void | Promise<void>) | undefined,
  a: T,
  b: U
): Promise<void>;
export async function safeEmit(
  fn: ((...args: unknown[]) => void | Promise<void>) | undefined,
  ...args: unknown[]
): Promise<void> {
  if (!fn) return;
  try {
    await fn(...args);
  } catch (err) {
    console.error("[better-media:events] Event handler error:", err);
  }
}

/**
 * Creates a webhook emitter that POSTs event payloads to a URL as JSON.
 * Optionally signs payloads with HMAC-SHA256 for verification.
 * Retries up to 3 times on 5xx responses or network errors (exponential backoff).
 *
 * @example
 * ```ts
 * const media = createBetterMedia({
 *   events: {
 *     onUploadComplete: createWebhookEmitter("https://example.com/hooks", "my-secret"),
 *     onError: createWebhookEmitter("https://example.com/hooks/errors"),
 *   },
 * });
 * ```
 */
export function createWebhookEmitter(
  url: string,
  secret?: string
): (payload: unknown) => Promise<void> {
  return async (payload: unknown) => {
    const body = JSON.stringify(payload);
    const headers: Record<string, string> = { "Content-Type": "application/json" };

    if (secret) {
      const sig = createHmac("sha256", secret).update(body).digest("hex");
      headers["X-Better-Media-Signature"] = `sha256=${sig}`;
    }

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(url, { method: "POST", headers, body });
        if (res.status < 500) return; // success or permanent client error — don't retry
      } catch {
        // network error — fall through to retry
      }
      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
      }
    }
  };
}
