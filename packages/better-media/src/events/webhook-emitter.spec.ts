import { createHmac } from "node:crypto";
import { safeEmit, createWebhookEmitter } from "./webhook-emitter";

const mockFetch = jest.fn();
global.fetch = mockFetch;

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

// ---------------------------------------------------------------------------
// safeEmit
// ---------------------------------------------------------------------------

describe("safeEmit", () => {
  it("calls the handler with the provided argument", async () => {
    const handler = jest.fn().mockResolvedValue(undefined);
    await safeEmit(handler, { id: "abc" });
    expect(handler).toHaveBeenCalledWith({ id: "abc" });
  });

  it("swallows errors thrown by the handler without rethrowing", async () => {
    const handler = jest.fn().mockRejectedValue(new Error("boom"));
    await expect(safeEmit(handler, {})).resolves.toBeUndefined();
  });

  it("no-ops when handler is undefined", async () => {
    await expect(safeEmit(undefined, { id: "x" })).resolves.toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// createWebhookEmitter
// ---------------------------------------------------------------------------

describe("createWebhookEmitter", () => {
  it("POSTs JSON body to the URL", async () => {
    mockFetch.mockResolvedValueOnce({ status: 200 });
    const emitter = createWebhookEmitter("https://example.com/hook");
    await emitter({ id: "1", key: "file.jpg" });

    expect(mockFetch).toHaveBeenCalledWith(
      "https://example.com/hook",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ id: "1", key: "file.jpg" }),
      })
    );
  });

  it("sets Content-Type: application/json", async () => {
    mockFetch.mockResolvedValueOnce({ status: 200 });
    const emitter = createWebhookEmitter("https://example.com/hook");
    await emitter({});

    const headers = (mockFetch.mock.calls[0]![1] as RequestInit).headers as Record<string, string>;
    expect(headers["Content-Type"]).toBe("application/json");
  });

  it("adds X-Better-Media-Signature when secret is provided", async () => {
    mockFetch.mockResolvedValueOnce({ status: 200 });
    const secret = "my-secret";
    const payload = { id: "1" };
    const emitter = createWebhookEmitter("https://example.com/hook", secret);
    await emitter(payload);

    const body = JSON.stringify(payload);
    const expectedSig = `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
    const headers = (mockFetch.mock.calls[0]![1] as RequestInit).headers as Record<string, string>;
    expect(headers["X-Better-Media-Signature"]).toBe(expectedSig);
  });

  it("omits X-Better-Media-Signature when no secret", async () => {
    mockFetch.mockResolvedValueOnce({ status: 200 });
    const emitter = createWebhookEmitter("https://example.com/hook");
    await emitter({});

    const headers = (mockFetch.mock.calls[0]![1] as RequestInit).headers as Record<string, string>;
    expect(headers["X-Better-Media-Signature"]).toBeUndefined();
  });

  it("does not retry on 2xx success", async () => {
    mockFetch.mockResolvedValueOnce({ status: 201 });
    const emitter = createWebhookEmitter("https://example.com/hook");
    await emitter({});
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("does not retry on 4xx (permanent client error)", async () => {
    mockFetch.mockResolvedValueOnce({ status: 422 });
    const emitter = createWebhookEmitter("https://example.com/hook");
    await emitter({});
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("retries up to 3 times on 5xx responses", async () => {
    mockFetch.mockResolvedValue({ status: 503 });
    const emitter = createWebhookEmitter("https://example.com/hook");

    const emitPromise = emitter({});
    // Advance timers past both backoff delays (1s + 2s)
    await jest.runAllTimersAsync();
    await emitPromise;

    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("retries up to 3 times on network errors", async () => {
    mockFetch.mockRejectedValue(new TypeError("network error"));
    const emitter = createWebhookEmitter("https://example.com/hook");

    const emitPromise = emitter({});
    await jest.runAllTimersAsync();
    await emitPromise;

    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("stops retrying as soon as a non-5xx response is received", async () => {
    mockFetch.mockResolvedValueOnce({ status: 500 }).mockResolvedValueOnce({ status: 200 });

    const emitter = createWebhookEmitter("https://example.com/hook");
    const emitPromise = emitter({});
    await jest.runAllTimersAsync();
    await emitPromise;

    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
