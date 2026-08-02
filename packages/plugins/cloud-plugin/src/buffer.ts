export type CloudEvent = Record<string, unknown> & { event: string; timestamp: string };

const MAX_BUFFER = 50;
const FLUSH_INTERVAL_MS = 5_000;
const MAX_RETRIES = 3;

export class EventBuffer {
  private readonly queue: CloudEvent[] = [];
  private readonly apiKey: string;
  private readonly endpoint: string;
  private readonly timer: ReturnType<typeof setInterval>;
  private flushing = false;

  constructor(apiKey: string, endpoint: string) {
    this.apiKey = apiKey;
    this.endpoint = endpoint;

    this.timer = setInterval(() => {
      void this.flush();
    }, FLUSH_INTERVAL_MS);
    // Don't keep the process alive just for the flush timer
    if (typeof this.timer.unref === "function") this.timer.unref();

    const drain = () => {
      clearInterval(this.timer);
      this.flush().finally(() => process.exit(0));
    };
    process.once("SIGTERM", drain);
    process.once("SIGINT", drain);
  }

  push(event: CloudEvent): void {
    this.queue.push(event);
    if (this.queue.length >= MAX_BUFFER) void this.flush();
  }

  async flush(): Promise<void> {
    if (this.flushing || this.queue.length === 0) return;
    this.flushing = true;
    const batch = this.queue.splice(0, this.queue.length);
    try {
      await this.send(batch);
    } finally {
      this.flushing = false;
    }
  }

  private async send(events: CloudEvent[], attempt = 1): Promise<void> {
    try {
      const res = await fetch(this.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({ events }),
        signal: AbortSignal.timeout(10_000),
      });
      if (res.ok) return;
      if (attempt >= MAX_RETRIES) {
        console.warn(`[better-media/cloud] drop batch — ${res.status} after ${attempt} attempts`);
        return;
      }
    } catch {
      if (attempt >= MAX_RETRIES) {
        console.warn(`[better-media/cloud] drop batch — network error after ${attempt} attempts`);
        return;
      }
    }
    await sleep(2 ** (attempt - 1) * 1000); // 1s → 2s → 4s
    return this.send(events, attempt + 1);
  }
}

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}
