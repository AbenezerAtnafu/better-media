import type { IncomingMessage } from "node:http";

export type StreamingFormat = "hls" | "dash" | "progressive";

export interface PlaybackUrlOptions {
  /** Format to return. Defaults to the first available format for the record. */
  format?: StreamingFormat;
  /** Expiry in seconds for signed URLs. Passed to storage.getUrl(). */
  expiresIn?: number;
}

export interface PlaybackUrl {
  format: StreamingFormat;
  /** Storage key of the master playlist or file. */
  masterKey: string;
  /** Resolved URL — signed or public depending on the storage adapter. */
  url: string;
}

export interface StreamingVariant {
  format: StreamingFormat;
  masterKey: string;
  /** null when the storage adapter does not support getUrl(). */
  url: string | null;
  mimeType: string;
}

export interface StreamingRouterOptions {
  /**
   * Storage key prefix that was used when the streaming plugin stored segments.
   * Must match the `derivativePrefix` option on the plugin (default: "streaming").
   */
  derivativePrefix?: string;
  /**
   * Optional per-request auth gate. Return false to send a 403.
   * Called before every segment or playlist is fetched from storage.
   */
  onRequest?: (
    recordId: string,
    subpath: string,
    req: IncomingMessage
  ) => boolean | Promise<boolean>;
}
