import path from "node:path";
import type { StorageAdapter } from "@better-media/core";

export interface StreamingProxyOptions {
  storage: StorageAdapter;
  authenticate?: (req: unknown, context: { recordId: string; storageKey: string }) => Promise<void>;
  cacheControl?: { playlist?: string; segment?: string };
  /** CORS origin to allow. Default: "*". */
  corsOrigin?: string;
  /** Storage key prefix used at transcode time. Default: "streaming". */
  derivativePrefix?: string;
}

export interface ProxyHandleOptions {
  recordId: string;
  /** Relative path within the record, e.g. "hls/master.m3u8" or "hls/720p/seg001.ts". */
  filePath: string;
  /** Original request object — passed through to authenticate if provided. */
  req?: unknown;
  /** HTTP method. Default: "GET". HEAD returns headers only (no body). */
  method?: string;
}

export interface StreamingProxy {
  handle(options: ProxyHandleOptions): Promise<Response>;
}

const CONTENT_TYPES: Record<string, string> = {
  ".m3u8": "application/x-mpegURL",
  ".mpd": "application/dash+xml",
  ".ts": "video/MP2T",
  ".mp4": "video/mp4",
  ".m4s": "video/iso.segment",
};

const PLAYLIST_EXTS = new Set([".m3u8", ".mpd"]);

const DEFAULT_CACHE_PLAYLIST = "no-cache, no-store";
const DEFAULT_CACHE_SEGMENT = "public, max-age=31536000, immutable";

export function createStreamingProxy(options: StreamingProxyOptions): StreamingProxy {
  const {
    storage,
    authenticate,
    cacheControl,
    corsOrigin = "*",
    derivativePrefix = "streaming",
  } = options;

  const playlistCache = cacheControl?.playlist ?? DEFAULT_CACHE_PLAYLIST;
  const segmentCache = cacheControl?.segment ?? DEFAULT_CACHE_SEGMENT;

  return {
    async handle({ recordId, filePath, req, method = "GET" }): Promise<Response> {
      // Step 1: path traversal guard
      if (filePath.includes("..")) {
        return new Response("Bad Request", { status: 400 });
      }

      const storageKey = `${derivativePrefix}/${recordId}/${filePath}`;

      // Step 2: authenticate
      if (authenticate) {
        try {
          await authenticate(req, { recordId, storageKey });
        } catch {
          return new Response("Forbidden", { status: 403 });
        }
      }

      // Step 3: check existence
      const exists = await storage.exists(storageKey);
      if (!exists) {
        return new Response("Not Found", { status: 404 });
      }

      const ext = path.extname(filePath);
      const contentType = CONTENT_TYPES[ext] ?? "application/octet-stream";
      const cacheHeader = PLAYLIST_EXTS.has(ext) ? playlistCache : segmentCache;

      const headers = new Headers({
        "Content-Type": contentType,
        "Cache-Control": cacheHeader,
        "Access-Control-Allow-Origin": corsOrigin,
        "Access-Control-Allow-Methods": "GET, HEAD",
        "Access-Control-Expose-Headers": "Content-Length, Content-Type",
      });

      // Step 4: HEAD — headers only, no body
      if (method.toUpperCase() === "HEAD") {
        return new Response(null, { status: 200, headers });
      }

      // Step 5: stream or buffer
      if (storage.getStream) {
        const stream = await storage.getStream(storageKey);
        if (stream == null) {
          return new Response("Not Found", { status: 404 });
        }
        return new Response(stream, { status: 200, headers });
      }

      const buffer = await storage.get(storageKey);
      if (buffer == null) {
        return new Response("Not Found", { status: 404 });
      }
      return new Response(new Uint8Array(buffer), { status: 200, headers });
    },
  };
}
